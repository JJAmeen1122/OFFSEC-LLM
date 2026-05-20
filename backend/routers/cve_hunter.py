import httpx
import asyncio
import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class ServiceInfo(BaseModel):
    service: str
    version: str
    port: str

class NmapOutput(BaseModel):
    nmap_output: str
    target: str

# ── Parse Nmap output into services ──────────────────────
def parse_nmap_services(nmap_output: str) -> List[dict]:
    services = []
    pattern = r'(\d+)/tcp\s+open\s+(\S+)\s*(.*)'
    for line in nmap_output.split('\n'):
        match = re.match(pattern, line)
        if match:
            port    = match.group(1)
            service = match.group(2).lower()
            version = match.group(3).strip()
            if version:
                services.append({
                    "port":    port,
                    "service": service,
                    "version": version,
                })
    return services

# ── Query NVD API for CVEs ────────────────────────────────
async def fetch_cves(keyword: str) -> List[dict]:
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    params = {
        "keywordSearch": keyword,
        "resultsPerPage": 5,
        "startIndex": 0,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(url, params=params)
            if res.status_code != 200:
                return []
            data = res.json()
            cves = []
            for item in data.get("vulnerabilities", []):
                cve      = item.get("cve", {})
                cve_id   = cve.get("id", "")
                desc     = cve.get("descriptions", [{}])[0].get("value", "")
                metrics  = cve.get("metrics", {})

                # Get CVSS score
                score    = 0.0
                severity = "UNKNOWN"
                if "cvssMetricV31" in metrics:
                    cvss = metrics["cvssMetricV31"][0]["cvssData"]
                    score    = cvss.get("baseScore", 0)
                    severity = cvss.get("baseSeverity", "UNKNOWN")
                elif "cvssMetricV2" in metrics:
                    cvss = metrics["cvssMetricV2"][0]["cvssData"]
                    score    = cvss.get("baseScore", 0)
                    severity = "HIGH" if score >= 7 else "MEDIUM" if score >= 4 else "LOW"

                if cve_id:
                    cves.append({
                        "cve_id":      cve_id,
                        "description": desc[:200],
                        "score":       score,
                        "severity":    severity,
                        "url":         f"https://nvd.nist.gov/vuln/detail/{cve_id}"
                    })
            return cves
    except Exception as e:
        return [{"error": str(e)}]

# ── MAIN ENDPOINT: Parse Nmap + fetch CVEs ────────────────
@router.post("/scan")
async def cve_scan(req: NmapOutput):
    # The agent sends either:
    #   a) Full nmap output (multi-line) → parse normally
    #   b) A service name string like "Apache 2.4.52" → treat as keyword directly
    nmap_text = req.nmap_output.strip()
    is_nmap_output = "/tcp" in nmap_text or "PORT" in nmap_text

    if is_nmap_output:
        services = parse_nmap_services(nmap_text)
    else:
        # Agent passed a service/version string directly — wrap it as one service
        # so we can still query CVEs for it
        ver_match = re.search(r'(\d+\.\d+[\.\d]*)', nmap_text)
        ver_num = ver_match.group(1) if ver_match else ""
        services = [{"port": "?", "service": nmap_text.split()[0].lower(), "version": nmap_text}]

    if not services:
        # Last resort: try searching by the raw string as a keyword
        if nmap_text:
            cves = await fetch_cves(nmap_text[:60])
            valid_cves = [c for c in cves if "cve_id" in c]
            valid_cves.sort(key=lambda x: x.get("score", 0), reverse=True)
            return {
                "target":     req.target,
                "services":   [],
                "top_cves":   valid_cves[:10],
                "total_cves": len(valid_cves),
                "critical":   len([c for c in valid_cves if c.get("severity") == "CRITICAL"]),
                "high":       len([c for c in valid_cves if c.get("severity") == "HIGH"]),
                "message":    f"No structured services parsed — searched by keyword: {nmap_text[:60]}"
            }
        return {
            "target":   req.target,
            "services": [],
            "top_cves": [],
            "message":  "No services found in Nmap output"
        }

    all_cves     = []
    service_cves = []

    # Fetch CVEs for each service concurrently
    tasks = []
    for svc in services[:6]:  # limit to 6 services
        # Build smart search keyword
        version = svc["version"]
        # Extract just version number
        ver_match = re.search(r'(\d+\.\d+[\.\d]*)', version)
        ver_num = ver_match.group(1) if ver_match else ""

        keyword = f"{svc['service']} {ver_num}".strip()
        tasks.append(fetch_cves(keyword))

    results = await asyncio.gather(*tasks)

    for i, svc in enumerate(services[:6]):
        cves = results[i] if i < len(results) else []
        service_cves.append({
            "port":    svc["port"],
            "service": svc["service"],
            "version": svc["version"],
            "cves":    cves,
        })
        all_cves.extend(cves)

    # Sort all CVEs by score
    valid_cves = [c for c in all_cves if "cve_id" in c]
    valid_cves.sort(key=lambda x: x.get("score", 0), reverse=True)

    return {
        "target":       req.target,
        "services":     service_cves,
        "top_cves":     valid_cves[:10],
        "total_cves":   len(valid_cves),
        "critical":     len([c for c in valid_cves if c.get("severity") == "CRITICAL"]),
        "high":         len([c for c in valid_cves if c.get("severity") == "HIGH"]),
    }

# ── Quick CVE lookup by keyword ───────────────────────────
@router.get("/lookup")
async def cve_lookup(keyword: str):
    cves = await fetch_cves(keyword)
    return {"keyword": keyword, "cves": cves}