import json
import httpx
import os
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime
from typing import Dict, AsyncGenerator, List, Optional
import asyncio

router = APIRouter()

# ── Config ────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL   = "llama-3.3-70b-versatile"
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
BASE_URL     = "http://localhost:9000/api/tools"

_DOCKER_CANDIDATES = [
    r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
    r"C:\Program Files\Docker\Docker\resources\bin\docker",
    r"C:\ProgramData\DockerDesktop\version-bin\docker.exe",
    "/usr/bin/docker",
    "/usr/local/bin/docker",
]
DOCKER_EXE = next((p for p in _DOCKER_CANDIDATES if os.path.exists(p)), "docker")

import time

# ── Timing budget (keep total scan under 12 minutes) ─────
# nmap        : ~3 min max
# gobuster    : ~3 min max
# zap         : ~3 min max
# nuclei      : ~2 min max  (includes template update)
# sqlmap      : ~2 min max
# cve+report  : ~1 min
# Total budget: ~14 min worst-case, typical ~10 min
TOOL_TIMEOUTS = {
    "run_nmap":        300,   # 5 min hard cap
    "run_gobuster":    360,   # 6 min hard cap
    "run_zap":         480,   # 8 min hard cap (ZAP needs JVM warmup)
    "run_nuclei":      300,   # 5 min hard cap
    "run_sqlmap":      300,   # 5 min hard cap
    "fetch_cves":       60,
    "run_ai_analysis":  90,
    "generate_report":  60,
}


# ── SSE Manager ───────────────────────────────────────────
class SSEManager:
    def __init__(self):
        self.queues: Dict[str, asyncio.Queue] = {}

    def create_queue(self, scan_id: str) -> asyncio.Queue:
        q = asyncio.Queue()
        self.queues[scan_id] = q
        return q

    async def send_update(self, scan_id: str, data: dict):
        if scan_id in self.queues:
            await self.queues[scan_id].put(data)
        else:
            print(f"[SSE] ⚠️ No queue for scan_id={scan_id}")

    def remove_queue(self, scan_id: str):
        self.queues.pop(scan_id, None)

sse_manager = SSEManager()

# ── Tool → Phase mapping ──────────────────────────────────
TOOL_TO_PHASE = {
    'run_nmap':        'Reconnaissance',
    'run_gobuster':    'Enumeration',
    'run_zap':         'Enumeration',
    'run_nuclei':      'Vulnerability Scan',
    'run_sqlmap':      'Vulnerability Scan',
    'fetch_cves':      'cve-hunt',
    'run_ai_analysis': 'AI Analysis',
    'generate_report': 'offsec'
}

# ── Tool definitions ──────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_nmap",
            "description": (
                "Run Nmap port scan. MUST BE FIRST. Discovers open ports and services. "
                "Choose ports and intensity based on the scan type requested:\n"
                "- quick scan: top 100 ports, T4\n"
                "- full scan: top 1000 ports, T4\n"
                "- stealth scan: top 1000 ports, T2\n"
                "- deep scan: all ports 1-65535, T3"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "IP or domain to scan"},
                    "ports": {
                        "type": "string",
                        "description": (
                            "Port range. Examples:\n"
                            "  '--top-ports 100' — quick\n"
                            "  '--top-ports 1000' — default full\n"
                            "  '1-65535' — all ports (slow)"
                        )
                    },
                    "intensity": {
                        "type": "string",
                        "enum": ["T1","T2","T3","T4","T5"],
                        "description": "T4 recommended for speed"
                    }
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_gobuster",
            "description": (
                "Run Gobuster directory/file enumeration. "
                "Run ONLY if HTTP/HTTPS ports are open (80,443,8080,8443,8000,8888,4443,8843)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Full URL including protocol e.g. https://example.com"
                    },
                    "wordlist": {
                        "type": "string",
                        "enum": ["small","medium","large"],
                        "description": "small=~25, medium=~50, large=~100 paths. Use small for quick scans."
                    },
                    "extensions": {
                        "type": "string",
                        "description": "File extensions e.g. 'php,html,txt'"
                    }
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_nuclei",
            "description": (
                "Run Nuclei vulnerability scanner. "
                "Run ONLY if web services are detected. "
                "Scans all severities: critical, high, medium, low, info."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Full URL e.g. https://example.com"
                    },
                    "severity": {
                        "type": "string",
                        "description": "Always use: critical,high,medium,low,info"
                    }
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_zap",
            "description": (
                "Run OWASP ZAP web application scanner. "
                "Run ONLY if HTTP/HTTPS ports are open. "
                "Always use active mode for real vulnerability findings."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Full URL e.g. https://example.com"
                    },
                    "scan_mode": {
                        "type": "string",
                        "enum": ["passive","active"],
                        "description": "Always use active for real findings."
                    }
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_sqlmap",
            "description": (
                "Run SQLMap SQL injection scanner. "
                "ALWAYS run on any HTTP/HTTPS target — it will crawl and find parameters automatically. "
                "No need to pre-identify forms or parameters."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Full URL e.g. https://example.com"
                    },
                    "param": {
                        "type": "string",
                        "description": "Specific parameter to test e.g. 'id'. Leave empty for auto-crawl."
                    },
                    "level": {"type": "integer", "description": "Test depth 1-5 (use 1)"},
                    "risk":  {"type": "integer", "description": "Risk level 1-3 (use 1)"}
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_cves",
            "description": "Fetch known CVEs for detected services. Run after nmap.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {
                        "type": "string",
                        "description": "Service name and version as nmap reported e.g. 'Apache httpd 2.4.52'"
                    }
                },
                "required": ["service"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_ai_analysis",
            "description": (
                "Write a professional penetration test report using AI. "
                "Must be called before generate_report."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target":   {"type": "string"},
                    "findings": {"type": "string", "description": "Full summary of all tool outputs"}
                },
                "required": ["target","findings"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate final PDF report. MUST BE LAST tool called.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string"}
                },
                "required": ["target"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are an expert autonomous penetration tester. Follow this exact workflow:

STEP 1: Run nmap FIRST — choose ports/intensity by scan_type:
  - quick  → ports='--top-ports 100', intensity='T4'
  - full   → ports='--top-ports 1000', intensity='T4'
  - stealth → ports='--top-ports 1000', intensity='T2'
  - deep   → ports='1-65535', intensity='T3'

STEP 2: If HTTP/HTTPS ports found (80,443,8080,8443,8000,8888,4443,8843):
  - run gobuster with wordlist='small' (keeps time under budget)
  - run run_zap with scan_mode='active' (always active for real findings)

STEP 3: ALWAYS run run_nuclei with severity='critical,high,medium,low,info' on any web target

STEP 4: ALWAYS run run_sqlmap on any HTTP/HTTPS target — even without known parameters.
        It will crawl and find forms/parameters automatically.

STEP 5: Run fetch_cves for the most interesting service nmap found

STEP 6: Run run_ai_analysis with ALL findings to generate report text

STEP 7: Run generate_report LAST to create the PDF

CRITICAL RULES:
- Run nmap EXACTLY ONCE as first action
- Run run_ai_analysis then generate_report EXACTLY ONCE each as final actions
- Never repeat the same tool twice
- Maximum 9 tool calls total
- Always use https:// prefix for targets that have port 443 open
- If nmap finds NO open ports, still run fetch_cves, run_ai_analysis, generate_report"""


class AgentRequest(BaseModel):
    target:    str
    scan_type: str = "full"


# ── Helpers ───────────────────────────────────────────────
def get_phase_name(tool_name: str) -> str:
    return TOOL_TO_PHASE.get(tool_name, 'Unknown')


def extract_summary(tool_name: str, output: str) -> str:
    if tool_name == 'run_nmap':
        ports = [l.strip() for l in output.split('\n')
                 if ('open' in l) and ('/tcp' in l or '/udp' in l)]
        return f"✓ Found {len(ports)} open ports" if ports else "✓ No open ports discovered"

    elif tool_name == 'run_gobuster':
        dirs = [l.strip() for l in output.split('\n') if 'Status:' in l or 'Found:' in l]
        return f"✓ Found {len(dirs)} directories/endpoints" if dirs else "✓ No directories discovered"

    elif tool_name == 'run_nuclei':
        vulns = [l.strip() for l in output.split('\n')
                 if any(s in l.lower() for s in ['[low]','[medium]','[high]','[critical]','[info]'])]
        return f"⚠ Found {len(vulns)} vulnerabilities" if vulns else "✓ No vulnerabilities detected"

    elif tool_name == 'run_zap':
        highs   = sum(1 for l in output.split('\n') if '[HIGH]'   in l)
        mediums = sum(1 for l in output.split('\n') if '[MEDIUM]' in l)
        lows    = sum(1 for l in output.split('\n') if '[LOW]'    in l)
        total   = highs + mediums + lows
        if total == 0:
            return "✓ ZAP found no vulnerabilities"
        return f"⚠ ZAP found {highs} high, {mediums} medium, {lows} low alerts"

    elif tool_name == 'run_sqlmap':
        if 'is vulnerable' in output.lower() or 'injectable' in output.lower():
            params = [l for l in output.split('\n')
                      if 'injectable' in l.lower() or 'is vulnerable' in l.lower()]
            return f"🚨 SQL injection found! ({len(params)} parameter(s) vulnerable)"
        return "✓ No SQL injection found"

    elif tool_name == 'fetch_cves':
        if 'No CVEs found' in output or not output.strip():
            return "✓ No CVEs found"
        cve_count = output.count('CVE-')
        return f"📋 Found {cve_count} CVEs" if cve_count > 0 else "✓ CVE check completed"

    elif tool_name == 'run_ai_analysis':
        return "📝 AI report written"

    elif tool_name == 'generate_report':
        return "📄 PDF Report generated successfully"

    return "✓ Completed"


async def get_docker_status() -> bool:
    import subprocess
    try:
        result = subprocess.run(
            [DOCKER_EXE, "ps", "--format", "{{.ID}}"],
            capture_output=True, text=True, timeout=10,
        )
        stderr_lower = result.stderr.lower()
        if "cannot connect" in stderr_lower or "error during connect" in stderr_lower:
            return False
        return True
    except Exception:
        return False


async def send_phase_update(
    scan_id: str,
    tool_name: str,
    event_type: str,
    output: str = "",
    summary: str = "",
    progress: int = 0,
    message: str = ""
):
    phase = get_phase_name(tool_name)
    payload = {
        "type":      event_type,
        "tool":      tool_name,
        "phase":     phase,
        "message":   message or f"{event_type.replace('_',' ').title()} {phase}",
        "progress":  progress,
        "timestamp": datetime.now().isoformat(),
    }
    if output:
        payload["output"] = output
    if summary:
        payload["summary"] = summary
    await sse_manager.send_update(scan_id, payload)


async def send_phase_completed(
    scan_id: str, tool_name: str,
    output: str, summary: str, progress: int
):
    await send_phase_update(
        scan_id, tool_name, "phase_completed",
        output=output, summary=summary, progress=progress,
        message=f"Completed {get_phase_name(tool_name)}"
    )


# ── SSE stream endpoint ───────────────────────────────────
@router.get("/stream/{scan_id}")
async def stream_updates(scan_id: str):
    if scan_id not in sse_manager.queues:
        sse_manager.create_queue(scan_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = sse_manager.queues[scan_id]
        try:
            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("type") in ("scan_completed", "error"):
                    break
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.remove_queue(scan_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":                "no-cache",
            "Connection":                   "keep-alive",
            "X-Accel-Buffering":            "no",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


def _build_findings_summary(tool_results: dict, target: str) -> str:
    parts = [f"TARGET: {target}\n"]
    for key, label in [
        ("run_nmap",     "NMAP RECONNAISSANCE"),
        ("run_gobuster", "GOBUSTER DIRECTORY ENUMERATION"),
        ("run_zap",      "OWASP ZAP WEB SCAN"),
        ("run_nuclei",   "NUCLEI VULNERABILITY SCAN"),
        ("run_sqlmap",   "SQLMAP SQL INJECTION TEST"),
        ("fetch_cves",   "CVE INTELLIGENCE"),
    ]:
        data = tool_results.get(key, {})
        if data.get("output"):
            extra = ""
            if key == "run_sqlmap":
                extra = f" ({'VULNERABLE' if data.get('vulnerable') else 'Not vulnerable'})"
            parts.append(f"=== {label}{extra} ===\n{data['output'][:1500]}")
    return "\n\n".join(parts) if len(parts) > 1 else "No tool results collected."


# ── Execute a single tool ─────────────────────────────────
async def execute_tool(
    tool_name: str,
    tool_args: dict,
    target: str,
    scan_id: Optional[str] = None,
    tool_results: Optional[dict] = None
) -> dict:

    if tool_results is None:
        tool_results = {}

    # Per-tool read timeouts — kept tight to stay within 10-15 min total
    read_timeouts = {
        "run_zap":      660.0,
        "run_nmap":     360.0,
        "run_gobuster": 420.0,
        "run_nuclei":   360.0,
        "run_sqlmap":   360.0,
    }
    read_t  = read_timeouts.get(tool_name, 120.0)
    timeout = httpx.Timeout(connect=10.0, read=read_t, write=10.0, pool=10.0)

    if scan_id:
        await send_phase_update(
            scan_id, tool_name, "phase_started",
            message=f"Starting {get_phase_name(tool_name)}...",
            progress=0
        )
        print(f"[SSE] phase_started → {tool_name} (phase: {get_phase_name(tool_name)})")

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            def safe_json(response: httpx.Response, tool: str) -> dict:
                try:
                    return response.json()
                except Exception:
                    raw = response.text[:300] if response.text else "(empty body)"
                    return {
                        "output": f"Tool API returned invalid response (HTTP {response.status_code}). Raw: {raw}",
                        "ports": [], "http_ports": [], "paths": [], "findings": [],
                        "error": True
                    }

            # ── NMAP ─────────────────────────────────────
            if tool_name == "run_nmap":
                nmap_target = tool_args.get("target", target)
                ports       = tool_args.get("ports", "--top-ports 1000")
                intensity   = tool_args.get("intensity", "T4")
                print(f"[AGENT] 🔍 nmap → {nmap_target} ports={ports} intensity={intensity}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message=f"Nmap scanning {nmap_target} ({ports}, {intensity})...",
                        progress=20
                    )

                if not await get_docker_status():
                    output = "❌ Docker Desktop is not running."
                    if scan_id:
                        await send_phase_completed(scan_id, tool_name, output, "❌ Docker not running", 40)
                    return {"tool": tool_name, "output": output, "success": False,
                            "summary": "❌ Docker not running"}

                res  = await client.post(f"{BASE_URL}/nmap", json={
                    "target": nmap_target, "ports": ports,
                    "intensity": intensity, "scan_type": "full"
                })
                data       = safe_json(res, "nmap")
                output     = data.get("output") or "Nmap completed with no output."
                http_ports = data.get("http_ports", [])
                services   = data.get("ports", [])
                print(f"[AGENT] nmap done — {len(services)} services, HTTP ports: {http_ports}")

                summary = extract_summary(tool_name, output)
                result  = {
                    "tool": tool_name, "output": output,
                    "success": not data.get("error", False),
                    "summary": summary, "http_ports": http_ports, "services": services
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 20)
                return result

            # ── GOBUSTER ──────────────────────────────────
            elif tool_name == "run_gobuster":
                target_url = tool_args.get("target", target)
                # Default to small wordlist to save time
                wordlist   = tool_args.get("wordlist", "small")
                extensions = tool_args.get("extensions", "")
                print(f"[AGENT] 📁 gobuster → {target_url} wordlist={wordlist}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message=f"Gobuster scanning {target_url} (wordlist={wordlist})...",
                        progress=35
                    )

                if not await get_docker_status():
                    output = "❌ Docker is not running."
                    if scan_id:
                        await send_phase_completed(scan_id, tool_name, output, "❌ Docker not running", 45)
                    return {"tool": tool_name, "output": output, "success": False,
                            "summary": "❌ Docker not running"}

                # Warm up target before gobuster (handles Heroku/cold-start)
                try:
                    async with httpx.AsyncClient(timeout=30) as warm_client:
                        await warm_client.get(target_url, follow_redirects=True)
                        print(f"[GOBUSTER] Target warmed up: {target_url}")
                except Exception as e:
                    print(f"[GOBUSTER] Warm-up skipped: {e}")

                res  = await client.post(f"{BASE_URL}/gobuster", json={
                    "target": target_url, "wordlist": wordlist,
                    "extensions": extensions, "scan_type": "full"
                })
                data   = safe_json(res, "gobuster")
                output = data.get("output") or "Gobuster completed with no output."
                print(f"[AGENT] gobuster done — {data.get('total_paths', 0)} paths found")

                summary = extract_summary(tool_name, output)
                result  = {
                    "tool": tool_name, "output": output,
                    "success": not data.get("error", False),
                    "summary": summary, "paths": data.get("paths", [])
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 45)
                return result

            # ── NUCLEI ────────────────────────────────────
            elif tool_name == "run_nuclei":
                nuclei_target = tool_args.get("target", target)
                severity      = tool_args.get("severity", "critical,high,medium,low,info")
                print(f"[AGENT] 🛡️ nuclei → {nuclei_target} severity={severity}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message=f"Nuclei scanning {nuclei_target} (all severities)...",
                        progress=60
                    )

                if not await get_docker_status():
                    output = "❌ Docker is not running."
                    if scan_id:
                        await send_phase_completed(scan_id, tool_name, output, "❌ Docker not running", 70)
                    return {"tool": tool_name, "output": output, "success": False,
                            "summary": "❌ Docker not running"}

                res  = await client.post(f"{BASE_URL}/nuclei", json={
                    "target": nuclei_target, "severity": severity, "scan_type": "full"
                })
                data   = safe_json(res, "nuclei")
                output = data.get("output") or "Nuclei completed with no output."
                print(f"[AGENT] nuclei done — {data.get('total', 0)} findings")

                summary = extract_summary(tool_name, output)
                result  = {
                    "tool": tool_name, "output": output,
                    "success": not data.get("error", False),
                    "summary": summary, "findings": data.get("findings", [])
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 72)
                return result

            # ── ZAP ───────────────────────────────────────
            elif tool_name == "run_zap":
                zap_target = tool_args.get("target", target)
                scan_mode  = tool_args.get("scan_mode", "active")   # default active
                print(f"[AGENT] 🕷️ zap → {zap_target} mode={scan_mode}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message=f"ZAP {scan_mode} scanning {zap_target} (~90s startup)...",
                        progress=50
                    )

                if not await get_docker_status():
                    output = "❌ Docker is not running."
                    if scan_id:
                        await send_phase_completed(scan_id, tool_name, output, "❌ Docker not running", 60)
                    return {"tool": tool_name, "output": output, "success": False,
                            "summary": "❌ Docker not running"}

                res  = await client.post(f"{BASE_URL}/zap", json={
                    "target": zap_target, "scan_mode": scan_mode, "scan_type": "full"
                })
                data   = safe_json(res, "zap")
                output = data.get("output") or "ZAP completed with no output."
                print(f"[AGENT] zap done — {data.get('total', 0)} alerts | error={data.get('error', False)}")

                summary = extract_summary(tool_name, output)
                result  = {
                    "tool": tool_name, "output": output,
                    "success": not data.get("error", False),
                    "summary": summary, "findings": data.get("findings", [])
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 65)
                return result

            # ── SQLMAP ────────────────────────────────────
            elif tool_name == "run_sqlmap":
                sql_target = tool_args.get("target", target)
                param      = tool_args.get("param", "")
                level      = tool_args.get("level", 1)
                risk       = tool_args.get("risk", 1)
                print(f"[AGENT] 💉 sqlmap → {sql_target} param={param or 'auto'} level={level} risk={risk}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message=f"SQLMap testing {sql_target} for SQL injection...",
                        progress=75
                    )

                if not await get_docker_status():
                    output = "❌ Docker is not running."
                    if scan_id:
                        await send_phase_completed(scan_id, tool_name, output, "❌ Docker not running", 80)
                    return {"tool": tool_name, "output": output, "success": False,
                            "summary": "❌ Docker not running"}

                res  = await client.post(f"{BASE_URL}/sqlmap", json={
                    "target": sql_target, "param": param,
                    "level": level, "risk": risk, "scan_type": "full"
                })
                data   = safe_json(res, "sqlmap")
                output = data.get("output") or "SQLMap completed with no output."
                print(f"[AGENT] sqlmap done — vulnerable={data.get('vulnerable', False)}")

                summary = extract_summary(tool_name, output)
                result  = {
                    "tool": tool_name, "output": output,
                    "success": not data.get("error", False),
                    "summary": summary,
                    "injections": data.get("injections", []),
                    "vulnerable": data.get("vulnerable", False)
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 82)
                return result

            # ── FETCH CVEs ────────────────────────────────
            elif tool_name == "fetch_cves":
                service = tool_args.get("service", "")
                print(f"[AGENT] 🔍 fetch_cves → {service}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message="Fetching CVE data from NVD...",
                        progress=85
                    )

                res  = await client.post("http://localhost:9000/api/cve/scan", json={
                    "nmap_output": service, "target": target
                })
                data = safe_json(res, "fetch_cves")
                cves = data.get("top_cves", [])

                if cves:
                    output = f"Found {len(cves)} CVEs:\n"
                    for c in cves[:10]:
                        output += (
                            f"  • {c.get('cve_id','?')} "
                            f"({c.get('severity','?')}) "
                            f"CVSS: {c.get('score','?')}\n"
                            f"    {c.get('description','')[:120]}\n"
                        )
                    summary = f"📋 Found {len(cves)} CVEs"
                else:
                    output  = "No CVEs found for detected services."
                    summary = "✓ No CVEs found"

                result = {
                    "tool": tool_name, "output": output,
                    "success": True, "summary": summary,
                    "cves_found": len(cves) if cves else 0
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, output, summary, 90)
                return result

            # ── AI ANALYSIS ───────────────────────────────
            elif tool_name == "run_ai_analysis":
                findings = tool_args.get("findings", "No findings provided")
                target   = tool_args.get("target", target)
                print(f"[AGENT] 🧠 AI analysis for {target}")

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message="AI is writing the security report...",
                        progress=93
                    )

                report_prompt = [
                    {
                        "role": "system",
                        "content": (
                            "You are a senior penetration tester writing a professional security "
                            "assessment report. Write clearly, technically, and concisely. "
                            "Use markdown ## headings for sections."
                        )
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Write a penetration test report for target: {target}\n\n"
                            f"Tool findings:\n{findings}\n\n"
                            f"Structure with:\n"
                            f"## Executive Summary\n"
                            f"## Open Ports & Services\n"
                            f"## Vulnerabilities Found\n"
                            f"## SQL Injection Assessment\n"
                            f"## CVEs & Known Exploits\n"
                            f"## Risk Assessment\n"
                            f"## Recommendations"
                        )
                    }
                ]

                ai_analysis = ""
                try:
                    async with httpx.AsyncClient(timeout=90) as groq_client:
                        groq_res = await groq_client.post(
                            GROQ_URL,
                            headers={
                                "Authorization": f"Bearer {GROQ_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model":       GROQ_MODEL,
                                "messages":    report_prompt,
                                "max_tokens":  2048,
                                "temperature": 0.2
                            }
                        )
                        groq_data   = groq_res.json()
                        ai_analysis = groq_data.get("choices",[{}])[0].get(
                            "message",{}).get("content","")
                except Exception as groq_err:
                    print(f"[AGENT] Groq AI analysis failed: {groq_err}")
                    ai_analysis = findings  # fallback to raw findings

                summary = "📝 AI report written"
                result  = {
                    "tool":        tool_name,
                    "output":      ai_analysis,
                    "success":     True,
                    "summary":     summary,
                    "ai_analysis": ai_analysis
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, ai_analysis, summary, 96)
                return result

            # ── GENERATE REPORT ───────────────────────────
            elif tool_name == "generate_report":
                ai_analysis = tool_results.get("run_ai_analysis", {}).get("ai_analysis", "")
                if not ai_analysis:
                    ai_analysis = _build_findings_summary(tool_results, target)

                if scan_id:
                    await send_phase_update(
                        scan_id, tool_name, "phase_running",
                        message="Building professional PDF report...",
                        progress=97
                    )

                pdf_url = pdf_filename = None
                try:
                    pdf_res = await client.post(
                        "http://localhost:9000/api/report/generate",
                        json={
                            "target":      target,
                            "scan_id":     scan_id or "unknown",
                            "ai_analysis": ai_analysis,
                            "tool_results": {
                                k: {
                                    "output":     v.get("output",""),
                                    "vulnerable": v.get("vulnerable", False)
                                }
                                for k, v in tool_results.items()
                            },
                            "date": datetime.now().strftime("%Y-%m-%d %H:%M UTC")
                        },
                        timeout=60.0
                    )
                    pdf_data = safe_json(pdf_res, "report_generator")
                    if pdf_data.get("success"):
                        pdf_url      = pdf_data.get("pdf_url")
                        pdf_filename = pdf_data.get("filename")
                        print(f"[AGENT] ✅ PDF ready → {pdf_filename}")
                    else:
                        print(f"[AGENT] PDF failed: {pdf_data.get('error')}")
                except Exception as pdf_err:
                    print(f"[AGENT] PDF generation error: {pdf_err}")

                summary = f"📄 PDF generated{'  ·  Download ↓' if pdf_filename else ''}"
                result  = {
                    "tool":         tool_name,
                    "output":       ai_analysis,
                    "success":      True,
                    "summary":      summary,
                    "pdf_url":      pdf_url,
                    "pdf_filename": pdf_filename,
                }
                if scan_id:
                    await send_phase_completed(scan_id, tool_name, ai_analysis, summary, 100)
                return result

            return {
                "tool":    tool_name,
                "output":  f"Unknown tool: {tool_name}",
                "success": False,
                "summary": "❌ Unknown tool"
            }

        except httpx.ConnectError:
            error_msg = f"Could not connect to tools API at {BASE_URL}. Make sure backend is running."
            print(f"[AGENT] ❌ {error_msg}")
            if scan_id:
                await sse_manager.send_update(scan_id, {
                    "type": "error", "tool": tool_name,
                    "phase": get_phase_name(tool_name), "error": error_msg
                })
            return {"tool": tool_name, "output": error_msg, "success": False,
                    "summary": "❌ API Connection Failed"}

        except Exception as e:
            error_msg = f"{tool_name} error: {type(e).__name__}: {str(e)}"
            print(f"[AGENT] ❌ TOOL FAILED: {error_msg}")
            if scan_id:
                await sse_manager.send_update(scan_id, {
                    "type": "error", "tool": tool_name,
                    "phase": get_phase_name(tool_name),
                    "error": error_msg,
                    "message": f"Error in {get_phase_name(tool_name)}"
                })
            return {"tool": tool_name, "output": error_msg, "success": False, "summary": "❌ Failed"}


# ── Groq LLM call ─────────────────────────────────────────
async def call_groq_with_tools(messages: list) -> dict:
    if not GROQ_API_KEY:
        return {
            "error": "GROQ_API_KEY not set.",
            "choices": [{"message": {"content": "AI unavailable - missing API key", "tool_calls": []}}]
        }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json"
    }
    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "tools":       TOOLS,
        "tool_choice": "auto",
        "max_tokens":  4096,
        "temperature": 0.1
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res  = await client.post(GROQ_URL, headers=headers, json=payload)
            data = res.json()
            print(f"[AGENT] Groq response status: {res.status_code}")
            if res.status_code != 200:
                print(f"[AGENT] Groq error: {data.get('error',{}).get('message','Unknown')}")
            return data
    except Exception as e:
        print(f"[AGENT] Groq failed: {e}")
        return {
            "error": str(e),
            "choices": [{"message": {"content": f"AI unavailable: {e}", "tool_calls": []}}]
        }


# ── The actual scan logic ─────────────────────────────────
async def _run_scan_task(scan_id: str, target: str, scan_type: str):
    await asyncio.sleep(0.3)

    if not await get_docker_status():
        await sse_manager.send_update(scan_id, {
            "type":    "error",
            "error":   "Docker Desktop is not running. Please start Docker Desktop and try again.",
            "message": "Docker not available"
        })
        return

    await sse_manager.send_update(scan_id, {
        "type":      "scan_started",
        "target":    target,
        "message":   f"AI agent initializing security assessment of {target}...",
        "timestamp": datetime.now().isoformat()
    })

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Perform a complete penetration test on: {target}\n"
                f"Scan type: {scan_type}\n\n"
                f"Follow the workflow exactly — nmap first, then gobuster+zap if web ports found, "
                f"then nuclei and sqlmap on all web targets, then CVEs, "
                f"then run_ai_analysis, then generate_report last. "
                f"Each tool exactly once. Always use https:// for targets with port 443."
            )
        }
    ]

    all_steps    = []
    tools_called = []
    tool_results = {}
    iteration    = 0
    max_iters    = 9
    done         = False

    while iteration < max_iters and not done:
        iteration += 1
        print(f"[AGENT] ── Iteration {iteration} ──")

        response = await call_groq_with_tools(messages)

        if "error" in response and "choices" not in response:
            await sse_manager.send_update(scan_id, {
                "type": "error", "error": response["error"], "message": "AI service error"
            })
            break

        message    = response.get("choices",[{}])[0].get("message",{})
        tool_calls = message.get("tool_calls",[])
        content    = message.get("content","")

        print(f"[AGENT] Tool calls this iteration: {len(tool_calls)}")

        if not tool_calls:
            print("[AGENT] No more tool calls — agent finished")
            if "generate_report" not in tools_called:
                print("[AGENT] Forcing AI analysis + report...")
                findings_summary = _build_findings_summary(tool_results, target)

                ai_result = await execute_tool(
                    "run_ai_analysis",
                    {"target": target, "findings": findings_summary},
                    target, scan_id, tool_results
                )
                tool_results["run_ai_analysis"] = ai_result

                report_result = await execute_tool(
                    "generate_report",
                    {"target": target},
                    target, scan_id, tool_results
                )
                tool_results["generate_report"] = report_result

                all_steps += [
                    {"type":"tool","tool":"run_ai_analysis",
                     "result": ai_result.get("output","")[:1000],
                     "summary": ai_result.get("summary","")},
                    {"type":"tool","tool":"generate_report",
                     "result": report_result.get("output","")[:1000],
                     "summary": report_result.get("summary","")},
                ]
                await sse_manager.send_update(scan_id, {
                    "type":         "scan_completed",
                    "analysis":     report_result.get("output","Security assessment completed."),
                    "tools_called": tools_called + ["run_ai_analysis","generate_report"],
                    "pdf_url":      report_result.get("pdf_url"),
                    "pdf_filename": report_result.get("pdf_filename"),
                    "message":      "Scan completed!",
                    "progress":     100
                })
            else:
                await sse_manager.send_update(scan_id, {
                    "type":         "scan_completed",
                    "analysis":     tool_results.get("generate_report",{}).get(
                        "output", content or "Security assessment completed."),
                    "tools_called": tools_called,
                    "message":      "Scan completed!",
                    "progress":     100
                })
            done = True
            break

        messages.append(message)

        for tool_call in tool_calls:
            tool_name = tool_call["function"]["name"]

            if tool_name in tools_called and tool_name not in ["run_ai_analysis","generate_report"]:
                print(f"[AGENT] ⏭️ Skipping duplicate call: {tool_name}")
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call["id"],
                    "content":      f"{tool_name} already called. Use previous results."
                })
                continue

            tools_called.append(tool_name)
            print(f"[AGENT] 🛠️ Executing: {tool_name}")

            try:
                tool_args = json.loads(tool_call["function"]["arguments"])
            except json.JSONDecodeError:
                tool_args = {}

            result = await execute_tool(tool_name, tool_args, target, scan_id, tool_results)
            tool_results[tool_name] = result

            all_steps.append({
                "type":      "tool",
                "tool":      tool_name,
                "phase":     get_phase_name(tool_name),
                "args":      tool_args,
                "result":    result.get("output","")[:1000],
                "summary":   result.get("summary","Completed"),
                "iteration": iteration,
                "success":   result.get("success", True)
            })

            messages.append({
                "role":         "tool",
                "tool_call_id": tool_call["id"],
                "content":      result.get("output","")[:3000]
            })

            if tool_name == "generate_report":
                await sse_manager.send_update(scan_id, {
                    "type":         "scan_completed",
                    "analysis":     result.get("output","Penetration test completed."),
                    "tools_called": tools_called,
                    "pdf_url":      result.get("pdf_url"),
                    "pdf_filename": result.get("pdf_filename"),
                    "message":      "Security assessment complete!",
                    "progress":     100
                })
                done = True
                break

    print(f"[AGENT] ✅ Assessment complete! Tools used: {tools_called}")


# ── Main agent endpoint ───────────────────────────────────
@router.post("/run/{scan_id}")
async def run_agent(req: AgentRequest, scan_id: str, background_tasks: BackgroundTasks):
    print(f"[AGENT] ═══ Scan request for: {req.target} (ID: {scan_id}) ═══")

    from routers.tools import validate_target
    err = validate_target(req.target)
    if err:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": err, "target": req.target}
        )

    sse_manager.create_queue(scan_id)
    background_tasks.add_task(_run_scan_task, scan_id, req.target, req.scan_type)

    return {
        "scan_id":    scan_id,
        "target":     req.target,
        "scan_type":  req.scan_type,
        "status":     "started",
        "stream_url": f"/api/agent/stream/{scan_id}",
        "success":    True
    }