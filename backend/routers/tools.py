import asyncio
import sys
import os
import re
import json
import socket
import ipaddress
import subprocess
import time
from fastapi import APIRouter
from pydantic import BaseModel

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

router = APIRouter()

# ── Target Validation ─────────────────────────────────────
def validate_target(target: str):
    import re, ipaddress as _ip
    t = target.strip()
    if not t:
        return "Target cannot be empty."
    if len(t) > 253:
        return "Target too long (max 253 characters)."
    if re.search(r'[;&|`$<>(){}\[\]\\]', t):
        return "Invalid target: forbidden characters detected ( ; & | ` $ < > )."
    if re.search(r'(\.\./|%00|<script|javascript:|\' *or *1|union.*select)', t, re.IGNORECASE):
        return "Invalid target: looks like an injection attempt."
    host = re.sub(r'^https?://', '', t, flags=re.IGNORECASE)
    host = host.split('/')[0].split(':')[0]
    if re.match(r'^(localhost|ip6-localhost|ip6-loopback)$', host, re.IGNORECASE):
        return "Scanning localhost is not allowed."
    ipv4_match = re.match(r'^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$', host)
    if ipv4_match:
        parts = [int(x) for x in host.split('.')]
        if any(p > 255 for p in parts):
            return "Invalid IP: each octet must be 0-255."
        a, b = parts[0], parts[1]
        if a == 0:   return "0.x.x.x is not a valid routable address."
        if a == 10:  return "Private/internal IP addresses are not allowed."
        if a == 127: return "Loopback addresses are not allowed."
        if a == 169 and b == 254: return "Link-local addresses are not allowed."
        if a == 172 and 16 <= b <= 31: return "Private/internal IP addresses are not allowed."
        if a == 192 and b == 168: return "Private/internal IP addresses are not allowed."
        if a == 255: return "Broadcast addresses are not allowed."
        return None
    try:
        addr = _ip.ip_address(host)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            return "Private/loopback/link-local IPv6 addresses are not allowed."
        return None
    except ValueError:
        pass
    if not re.match(r'^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])*(:\d+)?$', host):
        return "Invalid domain: use only letters, numbers, hyphens, and dots."
    if '.' not in host:
        return "Invalid target: enter a full domain (e.g. example.com) or IP address."
    labels = host.split('.')
    if any(l.startswith('-') or l.endswith('-') for l in labels):
        return "Invalid domain: labels cannot start or end with a hyphen."
    if len(labels[-1]) < 2:
        return "Invalid domain: TLD must be at least 2 characters."
    return None


def detect_scheme(target: str) -> str:
    """
    Return the best base URL for a target.
    - If it already has http:// or https://, use as-is.
    - If port implies HTTPS (443, 8443, 4443, 8843), use https://.
    - Otherwise default to http://.
    """
    if target.startswith("http://") or target.startswith("https://"):
        return target
    host_part = target.split('/')[0]
    port_match = re.search(r':(\d+)$', host_part)
    if port_match:
        port = int(port_match.group(1))
        if port in (443, 8443, 4443, 8843):
            return f"https://{target}"
    return f"http://{target}"


# ── Config ────────────────────────────────────────────────
DOCKER_PATHS = [
    r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
    r"C:\Program Files\Docker\Docker\resources\bin\docker",
    r"C:\ProgramData\DockerDesktop\version-bin\docker.exe",
    "/usr/bin/docker",
    "/usr/local/bin/docker",
]
DOCKER_EXE = next((p for p in DOCKER_PATHS if os.path.exists(p)), "docker")

if sys.platform == "win32":
    WORDLIST_DIR    = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "pentest_wordlists")
    SQLMAP_DATA_DIR = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "sqlmap")
else:
    WORDLIST_DIR    = "/tmp/pentest_wordlists"
    SQLMAP_DATA_DIR = "/tmp/sqlmap"

WORDLIST_CONTAINER = "/tmp/wordlist.txt"

WORDLISTS = {
    "small": [
        "admin", "login", "api", "backup", "config", ".git", ".env",
        "dashboard", "upload", "files", "test", "dev", "staging",
        "v1", "v2", "swagger", "docs", "robots.txt", "sitemap.xml",
        "wp-admin", "phpmyadmin", "shell", "console", "manager",
    ],
    "medium": [
        "admin", "login", "api", "backup", "config", ".git", ".env",
        "dashboard", "upload", "files", "images", "static", "assets",
        "wp-admin", "phpmyadmin", "db", "database", "test", "dev",
        "staging", "v1", "v2", "api/v1", "api/v2", "swagger", "docs",
        "robots.txt", "sitemap.xml", "shell", "console", "manager",
        "server-status", "server-info", ".htaccess", ".htpasswd",
        "cgi-bin", "scripts", "includes", "lib", "src", "private",
        "secret", "keys", "token", "auth", "oauth", "register",
        "forgot", "reset", "profile", "account", "user", "users",
        "admin/login", "admin/dashboard", "api/admin", "api/user",
        "graphql", "xmlrpc.php", "wp-json", "actuator", "health",
        "metrics", "env", "info", "trace", "heapdump", "threaddump",
        "debug", "error", "log", "logs", "tmp", "temp", "cache",
        "old", "bak", "backup.zip", "backup.tar.gz", "dump.sql",
    ],
    "large": [
        "admin", "login", "api", "backup", "config", ".git", ".env",
        "dashboard", "upload", "files", "images", "static", "assets",
        "wp-admin", "phpmyadmin", "db", "database", "test", "dev",
        "staging", "v1", "v2", "api/v1", "api/v2", "swagger", "docs",
        "robots.txt", "sitemap.xml", "shell", "console", "manager",
        "server-status", "server-info", ".htaccess", ".htpasswd",
        "cgi-bin", "scripts", "includes", "lib", "src", "private",
        "secret", "keys", "token", "auth", "oauth", "register",
        "forgot", "reset", "profile", "account", "user", "users",
        "admin/login", "admin/dashboard", "api/admin", "api/user",
        "graphql", "xmlrpc.php", "wp-json", "actuator", "health",
        "metrics", "env", "info", "trace", "heapdump", "threaddump",
        "debug", "error", "log", "logs", "tmp", "temp", "cache",
        "old", "bak", "backup.zip", "backup.tar.gz", "dump.sql",
        "install", "setup", "update", "upgrade", "migrate",
        "wp-content", "wp-includes", "wp-login.php", "wp-config.php",
        "administrator", "adminer", "cpanel", "webmail", "roundcube",
        "jenkins", "gitlab", "sonar", "nexus", "artifactory",
        "kibana", "grafana", "prometheus", "jaeger", "zipkin",
        "redis", "mongo", "elastic", "solr", "rabbitmq",
        "api/v3", "api/v4", "rest", "soap", "wsdl", "wadl",
        "js", "css", "fonts", "media", "downloads", "content",
        "portal", "intranet", "internal", "corp", "office",
        "mail", "smtp", "imap", "pop3", "ftp", "ssh",
        ".DS_Store", "Thumbs.db", "web.config", "app.config",
        "crossdomain.xml", "clientaccesspolicy.xml",
        "favicon.ico", "apple-touch-icon.png",
        "500", "404", "403", "401", "maintenance",
    ]
}


class ScanRequest(BaseModel):
    target:     str
    scan_type:  str = "full"
    ports:      str = "--top-ports 1000"
    intensity:  str = "T4"
    wordlist:   str = "medium"
    extensions: str = ""
    severity:   str = "critical,high,medium,low,info"
    level:      int = 1
    risk:       int = 1
    dbms:       str = ""
    scan_mode:  str = "active"
    param:      str = ""


# Docker image names
NMAP_IMAGE     = "instrumentisto/nmap"
GOBUSTER_IMAGE = "ghcr.io/oj/gobuster:latest"
NUCLEI_IMAGE   = "projectdiscovery/nuclei"
SQLMAP_IMAGE = "secsi/sqlmap"
ZAP_IMAGE      = "zaproxy/zap-stable:latest"

ZAP_INNER_PORT = 8080
ZAP_API_KEY    = "offsec-zap-key"


# ── Helpers ───────────────────────────────────────────────
def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


def is_docker_running_sync() -> bool:
    try:
        result = subprocess.run(
            [DOCKER_EXE, "ps", "--format", "{{.ID}}"],
            capture_output=True, text=True, timeout=10
        )
        stderr_lower = result.stderr.lower()
        if "cannot connect" in stderr_lower or "error during connect" in stderr_lower:
            print(f"[DOCKER] ❌ Docker not running: {result.stderr[:120]}")
            return False
        print("[DOCKER] ✅ Docker is running")
        return True
    except FileNotFoundError:
        print(f"[DOCKER] ❌ Docker not found: {DOCKER_EXE}")
        return False
    except subprocess.TimeoutExpired:
        print("[DOCKER] ❌ Docker command timed out")
        return False
    except Exception as e:
        print(f"[DOCKER] ❌ Docker check failed: {e}")
        return False


async def run_docker_sync(cmd: list, timeout: int = 300) -> str:
    print(f"[DOCKER] Running: {' '.join(str(c) for c in cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = result.stdout.strip()
        err = result.stderr.strip()
        print(f"[DOCKER] returncode={result.returncode}, stdout={len(out)}b, stderr={len(err)}b")
        if out:
            return out
        if err:
            noise_patterns = [
                "pulling from", "pulling fs layer", "pull complete",
                "digest:", "status:", "already exists", "downloading",
                "extracting", "verifying checksum", "waiting",
                "unable to find image", "latest: pulling", "using default tag"
            ]
            meaningful_lines = [
                line for line in err.splitlines()
                if line.strip() and not any(p in line.lower() for p in noise_patterns)
            ]
            clean = "\n".join(meaningful_lines).strip()
            if clean:
                if result.returncode != 0:
                    return f"Docker error (exit {result.returncode}):\n{clean}"
                return clean
        if result.returncode != 0:
            return f"Docker command failed (exit {result.returncode}) with no output."
        return "No output returned by tool."
    except subprocess.TimeoutExpired:
        return f"ERROR: Scan timed out after {timeout}s. Target may be unreachable or scan too broad."
    except FileNotFoundError:
        return f"ERROR: Docker executable not found at '{cmd[0]}'. Ensure Docker Desktop is installed and running."
    except Exception as e:
        return f"ERROR: {type(e).__name__}: {str(e)}"


# ── NMAP endpoint ─────────────────────────────────────────
@router.post("/nmap")
async def run_nmap(req: ScanRequest):
    err = validate_target(req.target)
    if err:
        return {"tool": "nmap", "target": req.target, "output": f"❌ {err}",
                "ports": [], "http_ports": [], "error": True, "validation_error": err}
    if not is_docker_running_sync():
        return {"tool": "nmap", "target": req.target,
                "output": "❌ Docker is not running. Please start Docker Desktop and wait 30 seconds.",
                "ports": [], "http_ports": [], "error": True}

    ports_arg = req.ports.strip() if req.ports else "--top-ports 1000"
    intensity  = req.intensity if req.intensity in ["T1","T2","T3","T4","T5"] else "T4"

    if ports_arg.startswith("--"):
        port_args = ports_arg.split()
    else:
        port_args = ["-p", ports_arg]

    if "65535" in ports_arg:
        timeout1 = 480
    elif "top-ports" in ports_arg:
        parts = ports_arg.split()
        top_n = int(parts[-1]) if parts[-1].isdigit() else 1000
        timeout1 = 180 if top_n <= 100 else 300
    else:
        timeout1 = 240

    if sys.platform == "win32":
        network_args = []
    else:
        network_args = ["--network", "host"]

    nmap_host = re.sub(r'^https?://', '', req.target.strip()).split('/')[0]
    print(f"[NMAP] Scanning {nmap_host} | ports={ports_arg} | {intensity} | timeout={timeout1}s")

    out1 = await run_docker_sync([
        DOCKER_EXE, "run", "--rm",
        *network_args,
        NMAP_IMAGE,
        "-sV", "-sC", "-Pn", f"-{intensity}", "--open",
        "--max-retries", "1",
        *port_args,
        nmap_host
    ], timeout=timeout1)

    all_output  = [f"=== PORT SCAN ===\n{out1}"]
    ports_found = re.findall(r'(\d+)/tcp\s+open', out1)
    print(f"[NMAP] Found ports: {ports_found}")

    http_ports = [p for p in ports_found if p in
                  ['80','443','8080','8443','8000','8888','4443','8843']]

    if http_ports:
        print(f"[NMAP] Running HTTP/HTTPS enum on ports: {http_ports}")
        out2 = await run_docker_sync([
            DOCKER_EXE, "run", "--rm",
            *network_args,
            NMAP_IMAGE,
            "-sV", "-Pn", "-T4",
            "-p", ",".join(set(http_ports)),
            "--script", "http-enum,http-headers,http-title,http-methods,vulners,http-shellshock",
            "--max-retries", "1",
            nmap_host
        ], timeout=240)
        all_output.append(f"=== HTTP/HTTPS ENUMERATION ===\n{out2}")

    final_output = "\n\n".join(all_output)
    services = []
    for line in final_output.split('\n'):
        m = re.match(r'(\d+)/tcp\s+open\s+(\S+)\s*(.*)', line)
        if m:
            services.append({
                "port":    m.group(1),
                "service": m.group(2).lower(),
                "version": m.group(3).strip()
            })

    return {
        "tool": "nmap", "target": req.target, "output": final_output,
        "ports": services, "http_ports": http_ports,
        "total_ports": len(set(ports_found)),
        "commands_run": len(all_output), "error": False
    }


# ── GOBUSTER endpoint ─────────────────────────────────────
@router.post("/gobuster")
async def run_gobuster(req: ScanRequest):
    err = validate_target(req.target)
    if err:
        return {"tool": "gobuster", "target": req.target, "output": f"❌ {err}",
                "paths": [], "error": True, "validation_error": err}
    if not is_docker_running_sync():
        return {"tool": "gobuster", "target": req.target,
                "output": "❌ Docker is not running", "paths": [], "error": True}

    target = detect_scheme(req.target)
    size   = req.wordlist if req.wordlist in WORDLISTS else "medium"

    os.makedirs(WORDLIST_DIR, exist_ok=True)
    wordlist_path = os.path.join(WORDLIST_DIR, f"{size}.txt")
    if not os.path.exists(wordlist_path):
        with open(wordlist_path, 'w') as f:
            f.write("\n".join(WORDLISTS[size]))

    if sys.platform == "win32":
        drive, rest = os.path.splitdrive(wordlist_path)
        volume_src  = f"/{drive.rstrip(':').lower()}{rest.replace(os.sep, '/')}"
    else:
        volume_src = wordlist_path

    cmd = [
        DOCKER_EXE, "run", "--rm",
        "-v", f"{volume_src}:{WORDLIST_CONTAINER}",
        GOBUSTER_IMAGE,
        "dir", "-u", target, "-w", WORDLIST_CONTAINER,
        "-t", "15",
        "-q", "--no-error",
        "--timeout", "30s",
        "--retry",
        "--retry-attempts", "2",
        "-k",              # skip TLS verification for HTTPS
    ]
    if req.extensions:
        cmd += ["-x", req.extensions]

    print(f"[GOBUSTER] Scanning {target} | wordlist={size} | timeout=30s")
    out1 = await run_docker_sync(cmd, timeout=360)

    final_output = (
        f"=== DIRECTORY SCAN (wordlist={size}) ===\n{out1}"
        if out1 and "No output" not in out1
        else "No results found."
    )
    paths = []
    for line in final_output.split('\n'):
        m = re.match(r'^(\/\S+)\s+\(Status:\s*(\d+)\)', line)
        if m:
            paths.append({"path": m.group(1), "status": m.group(2), "sensitive": False})

    return {
        "tool": "gobuster", "target": req.target, "output": final_output,
        "paths": paths, "total_paths": len(paths), "commands_run": 1
    }


# ── NUCLEI endpoint ───────────────────────────────────────
@router.post("/nuclei")
async def run_nuclei(req: ScanRequest):
    err = validate_target(req.target)
    if err:
        return {"tool": "nuclei", "target": req.target, "output": f"❌ {err}",
                "findings": [], "error": True, "validation_error": err}
    if not is_docker_running_sync():
        return {"tool": "nuclei", "target": req.target,
                "output": "❌ Docker is not running", "findings": [], "error": True}

    target   = detect_scheme(req.target)
    allowed  = {"critical","high","medium","low","info"}
    severity = ",".join(
        s.strip() for s in (req.severity or "critical,high,medium,low,info").split(",")
        if s.strip() in allowed
    ) or "critical,high,medium,low,info"

    if sys.platform == "win32":
        nuclei_dir  = os.path.join(os.environ.get("TEMP","C:\\Temp"), "nuclei-templates")
        drive, rest = os.path.splitdrive(nuclei_dir)
        templates_v = f"/{drive.rstrip(':').lower()}{rest.replace(os.sep,'/')}"
    else:
        nuclei_dir  = "/tmp/nuclei-templates"
        templates_v = nuclei_dir
    os.makedirs(nuclei_dir, exist_ok=True)

    # ── Update templates once per day only ───────────────
    templates_marker = os.path.join(nuclei_dir, ".last_update")
    should_update    = True
    if os.path.exists(templates_marker):
        age = time.time() - os.path.getmtime(templates_marker)
        should_update = age > 86400   # 24 hours in seconds
        if not should_update:
            print("[NUCLEI] Templates up to date — skipping update")

    if should_update:
        print("[NUCLEI] Updating templates (once per day)...")
        await run_docker_sync([
            DOCKER_EXE, "run", "--rm",
            "-v", f"{templates_v}:/root/nuclei-templates",
            NUCLEI_IMAGE,
            "-update-templates", "-silent"
        ], timeout=180)
        # Write marker file so we know when we last updated
        try:
            open(templates_marker, 'w').close()
        except Exception:
            pass

    print(f"[NUCLEI] Scanning {target} | severity={severity}")
    out1 = await run_docker_sync([
        DOCKER_EXE, "run", "--rm",
        "-v", f"{templates_v}:/root/nuclei-templates",
        NUCLEI_IMAGE,
        "-u", target,
        "-severity", severity,
        "-silent", "-no-color",
        "-timeout", "10",
        "-retries", "2",
        "-duc",    # disable update check — already handled above
    ], timeout=300)

    final_output = (
        f"=== VULNERABILITY SCAN ===\n{out1}"
        if out1 and "No output" not in out1
        else "No vulnerabilities found."
    )
    findings = []
    for line in final_output.split('\n'):
        m = re.match(r'\[(critical|high|medium|low|info)\]\s+\[([^\]]+)\]', line, re.I)
        if m:
            findings.append({
                "severity": m.group(1).lower(),
                "template": m.group(2),
                "detail":   line.strip()
            })

    return {
        "tool": "nuclei", "target": req.target, "output": final_output,
        "findings": findings, "total": len(findings), "commands_run": 1
    }


# ── SQLMAP endpoint ───────────────────────────────────────
@router.post("/sqlmap")
async def run_sqlmap(req: ScanRequest):
    err = validate_target(req.target)
    if err:
        return {"tool": "sqlmap", "target": req.target, "output": f"❌ {err}",
                "findings": [], "error": True, "validation_error": err}
    if not is_docker_running_sync():
        return {"tool": "sqlmap", "target": req.target,
                "output": "❌ Docker is not running.", "findings": [], "error": True}

    target = detect_scheme(req.target)
    level  = max(1, min(5, req.level if isinstance(req.level, int) else 1))
    risk   = max(1, min(3, req.risk  if isinstance(req.risk,  int) else 1))

    # Volume mount for sqlmap session data
    os.makedirs(SQLMAP_DATA_DIR, exist_ok=True)
    if sys.platform == "win32":
        drive, rest    = os.path.splitdrive(SQLMAP_DATA_DIR)
        sqlmap_vol_src = f"/{drive.rstrip(':').lower()}{rest.replace(os.sep, '/')}"
    else:
        sqlmap_vol_src = SQLMAP_DATA_DIR

    cmd = [
        DOCKER_EXE, "run", "--rm",
        "-v", f"{sqlmap_vol_src}:/root/.sqlmap/",
        SQLMAP_IMAGE,
        "-u", target,
        "--batch", "--random-agent",
        "--level",   str(level),
        "--risk",    str(risk),
        "--threads", "4",
        "--timeout", "20",
        "--retries", "2",
        "--no-cast",
        "--ssl-verify=false",
    ]

    # If specific param given, test only that — faster and more precise
    if req.param.strip():
        cmd += ["-p", req.param.strip()]
    else:
        cmd += ["--forms", "--crawl", "1"]

    if req.dbms:
        allowed_dbms = {
            "mysql","postgres","postgresql","mssql","oracle",
            "sqlite","access","sybase","db2","firebird","hsqldb"
        }
        if req.dbms.strip().lower() in allowed_dbms:
            cmd += ["--dbms", req.dbms.strip().lower()]

    print(f"[SQLMAP] Scanning {target} | level={level} | risk={risk} | param={req.param or 'auto'}")
    out1 = await run_docker_sync(cmd, timeout=360)

    final_output = (
        f"=== SQL INJECTION SCAN ===\n{out1}"
        if out1 and "No output" not in out1
        else "No SQL injection vulnerabilities found."
    )
    findings = []
    injectable_params = re.findall(
        r'Parameter:\s+(.+?)\s+\((.+?)\).*?Type:\s+(.+?)\s*\n.*?Title:\s+(.+?)\s*\n',
        final_output, re.DOTALL | re.IGNORECASE
    )
    for param, method, inj_type, title in injectable_params:
        findings.append({
            "parameter": param.strip(),
            "method":    method.strip(),
            "type":      inj_type.strip(),
            "title":     title.strip(),
            "severity":  "high",
            "detail":    f"Injectable '{param.strip()}' via {method.strip()} — {title.strip()}"
        })
    vuln_lines = [
        l.strip() for l in final_output.split('\n')
        if re.search(r'(is vulnerable|injection point|sql injection)', l, re.IGNORECASE)
        and l.strip()
    ]

    return {
        "tool": "sqlmap", "target": req.target, "output": final_output,
        "findings": findings, "vulnerable_lines": vuln_lines,
        "vulnerable": len(findings) > 0 or len(vuln_lines) > 0,
        "total": len(findings), "commands_run": 1, "error": False
    }


# ── ZAP endpoint ──────────────────────────────────────────
@router.post("/zap")
async def run_zap(req: ScanRequest):
    err = validate_target(req.target)
    if err:
        return {"tool": "owasp-zap", "target": req.target, "output": f"❌ {err}",
                "findings": [], "error": True, "validation_error": err}
    if not is_docker_running_sync():
        return {"tool": "owasp-zap", "target": req.target,
                "output": "❌ Docker is not running.", "findings": [], "error": True}

    target    = detect_scheme(req.target)
    scan_mode = req.scan_mode if req.scan_mode in ("passive","active") else "active"

    zap_host_port  = find_free_port()
    container_name = f"zap-scan-{os.getpid()}-{zap_host_port}"
    zap_url        = f"http://localhost:{zap_host_port}"

    print(f"[ZAP] Using host port {zap_host_port} | mode={scan_mode}")

    import httpx

    def zap_start_container() -> str:
        if sys.platform == "win32":
            network_args = []
            port_args    = ["-p", f"{zap_host_port}:{ZAP_INNER_PORT}"]
        else:
            network_args = ["--network", "host"]
            port_args    = []

        cmd = [
            DOCKER_EXE, "run", "-d",
            "--name", container_name,
            *network_args,
            *port_args,
            "--rm",
            "-e", "JAVA_OPTS=-Xmx1g -Xms256m",
            ZAP_IMAGE,
            "zap.sh",
            "-daemon",
            "-host", "0.0.0.0",
            "-port", str(ZAP_INNER_PORT),
            "-config", f"api.key={ZAP_API_KEY}",
            "-config", "api.addrs.addr.name=.*",
            "-config", "api.addrs.addr.regex=true",
            "-config", "api.disablekey=false",
            "-config", "connection.timeoutInSecs=20",
            "-config", "scanner.threadPerHost=2",
            "-config", "spider.maxDepth=2",   # reduced from 3 to save time
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"Failed to start ZAP container: {result.stderr.strip()}")
        cid = result.stdout.strip()
        print(f"[ZAP] Container started: {cid[:12]}")
        return cid

    def zap_stop_container():
        try:
            subprocess.run([DOCKER_EXE, "stop", container_name],
                           capture_output=True, timeout=15)
            print(f"[ZAP] Container '{container_name}' stopped.")
        except Exception as e:
            print(f"[ZAP] Warning — could not stop container: {e}")

    async def zap_wait_ready(total_timeout_s: int = 360):
        # Reduced warmup wait — your machine is fast enough
        wait_secs = 50 if sys.platform == "win32" else 40
        print(f"[ZAP] Waiting {wait_secs}s for JVM to initialise...")
        await asyncio.sleep(wait_secs)

        remaining = total_timeout_s - wait_secs
        deadline  = time.time() + remaining
        attempt   = 0
        print(f"[ZAP] Polling ZAP API at {zap_url} (up to {int(remaining)}s remaining)...")

        while time.time() < deadline:
            attempt += 1
            try:
                chk = subprocess.run(
                    [DOCKER_EXE, "inspect", "--format={{.State.Running}}", container_name],
                    capture_output=True, text=True, timeout=5
                )
                if chk.stdout.strip() != "true":
                    print(f"[ZAP] Container stopped unexpectedly")
                    return False
            except Exception:
                pass
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0),
                    limits=httpx.Limits(max_connections=1, max_keepalive_connections=0),
                ) as poll_client:
                    r = await poll_client.get(
                        f"{zap_url}/JSON/core/view/version/",
                        params={"apikey": ZAP_API_KEY},
                    )
                    if r.status_code == 200:
                        print(f"[ZAP] API ready after {attempt} attempts")
                        return True
                    print(f"[ZAP] Attempt {attempt}: HTTP {r.status_code}")
            except (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError):
                print(f"[ZAP] Attempt {attempt}: JVM warming up, retrying in 10s...")
            except Exception as e:
                print(f"[ZAP] Attempt {attempt}: {type(e).__name__}")
            await asyncio.sleep(10)
        return False

    async def zap_get(client: httpx.AsyncClient, path: str, params: dict = {}):
        params = {**params, "apikey": ZAP_API_KEY}
        r = await client.get(f"{zap_url}/JSON/{path}/", params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    container_id = None
    try:
        container_id = zap_start_container()

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            ready = await zap_wait_ready(total_timeout_s=360)
            if not ready:
                logs_result = subprocess.run(
                    [DOCKER_EXE, "logs", "--tail", "30", container_name],
                    capture_output=True, text=True, timeout=10
                )
                logs = logs_result.stdout + logs_result.stderr
                raise RuntimeError(
                    f"ZAP daemon did not become ready within 360s.\n"
                    f"Container logs:\n{logs[:800]}"
                )

            # Optional HTTPS config
            try:
                await zap_get(client, "core/action/setOptionDefaultUserAgent",
                              {"String": "Mozilla/5.0 (X10-Scanner)"})
            except Exception:
                pass

            print(f"[ZAP] Accessing target: {target}")
            await zap_get(client, "core/action/accessUrl",
                          {"url": target, "followRedirects": "true"})

            print("[ZAP] Starting spider...")
            spider    = await zap_get(client, "spider/action/scan",
                                      {"url": target, "maxChildren": "10"})
            spider_id = spider.get("scan", "0")
            for _ in range(60):
                st  = await zap_get(client, "spider/view/status", {"scanId": spider_id})
                pct = int(st.get("status", 0))
                print(f"[ZAP] Spider: {pct}%")
                if pct >= 100:
                    break
                await asyncio.sleep(2)

            print("[ZAP] Draining passive scan queue...")
            for _ in range(30):
                recs = await zap_get(client, "pscan/view/recordsToScan")
                if int(recs.get("recordsToScan", 1)) == 0:
                    break
                await asyncio.sleep(2)

            if scan_mode == "active":
                print("[ZAP] Starting active scan...")
                ascan    = await zap_get(client, "ascan/action/scan",
                                         {"url": target, "recurse": "true"})
                ascan_id = ascan.get("scan", "0")
                # Hard cap at 100 iterations × 2s = ~3.3 min max
                for _ in range(100):
                    p   = await zap_get(client, "ascan/view/status", {"scanId": ascan_id})
                    pct = int(p.get("status", 0))
                    print(f"[ZAP] Active scan: {pct}%")
                    if pct >= 100:
                        break
                    await asyncio.sleep(2)

            print("[ZAP] Fetching alerts...")
            alerts_resp = await zap_get(client, "core/view/alerts", {"baseurl": target})
            alerts      = alerts_resp.get("alerts", [])

        risk_map = {"High":"high","Medium":"medium","Low":"low","Informational":"info"}
        cvss_map = {"High":8.5,"Medium":5.0,"Low":2.5,"Informational":0.0}
        seen, findings = set(), []
        for a in alerts:
            key = (a.get("name"), a.get("url"))
            if key in seen:
                continue
            seen.add(key)
            risk = a.get("risk","Informational")
            findings.append({
                "name":        a.get("name","Unknown"),
                "severity":    risk_map.get(risk,"info"),
                "cvss_score":  cvss_map.get(risk,0.0),
                "url":         a.get("url",""),
                "description": a.get("description",""),
                "solution":    a.get("solution",""),
                "evidence":    a.get("evidence",""),
                "cwe_id":      a.get("cweid",""),
                "source":      f"owasp-zap-{scan_mode}",
            })
        findings.sort(
            key=lambda x: {"high":0,"medium":1,"low":2,"info":3}.get(x["severity"],9)
        )

        lines = [
            f"=== ZAP {scan_mode.upper()} SCAN — {target} ===",
            f"Total alerts: {len(findings)}\n"
        ]
        for f in findings:
            lines.append(
                f"[{f['severity'].upper()}] {f['name']}\n"
                f"  URL:  {f['url']}\n"
                f"  Desc: {f['description'][:120]}\n"
                f"  Fix:  {f['solution'][:100]}\n"
            )
        output = "\n".join(lines) if findings else \
                 f"ZAP {scan_mode} scan completed — no alerts found."
        counts = {s: sum(1 for f in findings if f["severity"]==s)
                  for s in ("high","medium","low","info")}
        print(f"[ZAP] ✅ Done — {len(findings)} alerts {counts}")

        return {
            "tool": "owasp-zap", "target": req.target, "output": output,
            "findings": findings, "total": len(findings), "summary": counts,
            "scan_mode": scan_mode, "error": False
        }

    except Exception as e:
        err_msg = f"ZAP scan failed: {type(e).__name__}: {str(e)}"
        print(f"[ZAP] ❌ {err_msg}")
        return {
            "tool": "owasp-zap", "target": req.target,
            "output": err_msg, "findings": [], "error": True
        }

    finally:
        if container_id:
            zap_stop_container()


# ── STATUS endpoint ───────────────────────────────────────
@router.get("/status")
async def tools_status():
    docker_ok = is_docker_running_sync()
    return {
        "docker":       "✅ running" if docker_ok else "❌ not running",
        "nmap":         "✅ ready"   if docker_ok else "❌ needs Docker",
        "gobuster":     "✅ ready"   if docker_ok else "❌ needs Docker",
        "nuclei":       "✅ ready"   if docker_ok else "❌ needs Docker",
        "sqlmap":       "✅ ready"   if docker_ok else "❌ needs Docker",
        "zap":          "✅ ready"   if docker_ok else "❌ needs Docker",
        "docker_path":  DOCKER_EXE,
        "platform":     sys.platform,
        "wordlist_dir": WORDLIST_DIR,
        "note":         "Keep Docker Desktop open while scanning"
    }


# ── Docker debug endpoint ─────────────────────────────────
@router.get("/docker-test")
async def test_docker():
    results = {
        "platform":          sys.platform,
        "docker_exe":        DOCKER_EXE,
        "docker_exe_exists": os.path.exists(DOCKER_EXE) if DOCKER_EXE != "docker" else "using PATH",
        "wordlist_dir":      WORDLIST_DIR,
    }
    try:
        r = subprocess.run(
            [DOCKER_EXE, "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True, timeout=10
        )
        results["docker_version"]         = r.stdout.strip() or r.stderr.strip()
        results["docker_version_success"] = r.returncode == 0
    except Exception as e:
        results["docker_version_error"] = str(e)
    try:
        r = subprocess.run(
            [DOCKER_EXE, "ps", "-q"],
            capture_output=True, text=True, timeout=10
        )
        results["docker_ps"]         = r.stdout.strip()[:100] or r.stderr.strip()
        results["docker_ps_success"] = r.returncode == 0
    except Exception as e:
        results["docker_ps_error"] = str(e)
    return results