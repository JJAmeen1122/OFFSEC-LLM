import requests, json, os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL      = "lily-cyber"

def _ask_llm(prompt: str) -> str:
    r = requests.post(f"{OLLAMA_URL}/api/generate",
        json={"model": MODEL, "prompt": prompt, "stream": False}
    )
    return r.json()["response"]

def plan_next_steps(target: str, nmap_findings: list) -> list:
    prompt = f"""
You are an expert penetration tester.
Target: {target}
Nmap found these open ports/services:
{json.dumps(nmap_findings, indent=2)}

Decide which tools to run next. Choose from: gobuster, nikto, zap, metasploit.
Return ONLY a JSON array. Example:
[
  {{"tool": "gobuster", "reason": "port 80 open, find hidden dirs"}},
  {{"tool": "nikto",    "reason": "web server detected, check vulns"}},
  {{"tool": "metasploit", "reason": "CVE-2021-44228 found", "cves": ["CVE-2021-44228"]}}
]
Return ONLY valid JSON. No extra text.
"""
    response = _ask_llm(prompt)
    try:
        # Strip any markdown fences if model adds them
        clean = response.strip().strip("```json").strip("```").strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        return [{"tool": "nikto", "reason": "fallback"}]


def generate_report(target: str, all_results: list) -> str:
    results_text = json.dumps(all_results, indent=2)
    prompt = f"""
You are a senior penetration tester writing a professional security assessment report.
Target: {target}

Tool Results:
{results_text}

Write a full penetration test report with these exact sections:

## Executive Summary
(brief overview for non-technical stakeholders)

## Attack Surface
(what was discovered)

## Vulnerabilities Found
(for each: name, severity [Critical/High/Medium/Low/Info], description, evidence, CVSS score if known)

## Risk Assessment
(overall risk level and business impact)

## Recommendations
(prioritized, specific, actionable fixes)

## Conclusion

Be technical, specific, and professional. Reference actual tool outputs as evidence.
"""
    return _ask_llm(prompt)