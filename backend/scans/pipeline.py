"""
The full autonomous pentest pipeline:
1. Nmap recon       → find open ports/services
2. LLM planning     → decide which tools to run next
3. Tool execution   → run Gobuster, Nikto, ZAP, Metasploit
4. LLM analysis     → interpret all findings
5. Report           → generate PDF
"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from tools.nmap_runner      import run_nmap, parse_nmap
from tools.gobuster_runner  import run_gobuster
from tools.nikto_runner     import run_nikto
from tools.zap_runner       import run_zap
from tools.metasploit_runner import check_exploits
from ai.agent               import plan_next_steps, generate_report
from reports.generator      import build_pdf
from scans.models           import Scan

def run_pipeline(scan_id: str, target: str, db: Session):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    scan.status = "running"
    db.commit()

    all_results = []

    try:
        # ── Phase 1: Recon with Nmap ──────────────────────────────
        print(f"[*] Phase 1: Nmap scan on {target}")
        nmap_raw    = run_nmap(target)
        nmap_parsed = parse_nmap(nmap_raw)
        all_results.append({"tool": "nmap", "findings": nmap_parsed})

        # ── Phase 2: LLM decides what to run next ─────────────────
        print("[*] Phase 2: AI planning next steps")
        next_steps = plan_next_steps(target, nmap_parsed)

        # ── Phase 3: Execute what LLM decided ────────────────────
        for step in next_steps:
            tool = step.get("tool")
            print(f"[*] Phase 3: Running {tool}")

            if tool == "gobuster":
                result = run_gobuster(target)
                all_results.append({"tool": "gobuster", "findings": result})

            elif tool == "nikto":
                result = run_nikto(target)
                all_results.append({"tool": "nikto", "findings": result})

            elif tool == "zap":
                result = run_zap(f"http://{target}")
                all_results.append({"tool": "zap", "findings": result})

            elif tool == "metasploit":
                cves = step.get("cves", [])
                result = check_exploits(target, cves)
                all_results.append({"tool": "metasploit", "findings": result})

        # ── Phase 4: LLM writes the full analysis ────────────────
        print("[*] Phase 4: AI generating analysis")
        ai_analysis = generate_report(target, all_results)

        # ── Phase 5: Build PDF report ─────────────────────────────
        print("[*] Phase 5: Building PDF report")
        pdf_path = build_pdf(scan_id, target, ai_analysis, all_results)

        # ── Save results ──────────────────────────────────────────
        scan.tool_results  = json.dumps(all_results)
        scan.ai_analysis   = ai_analysis
        scan.pdf_report    = pdf_path
        scan.status        = "completed"
        scan.completed_at  = datetime.utcnow()

    except Exception as e:
        scan.status      = "failed"
        scan.ai_analysis = f"Pipeline error: {str(e)}"
        print(f"[!] Pipeline failed: {e}")

    db.commit()