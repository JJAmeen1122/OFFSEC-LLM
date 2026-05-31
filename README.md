# OFFSEC-LLM
# OffSec — AI-Powered Penetration Testing Platform

OffSec is a web-based security tool that automatically scans a website or server for vulnerabilities using AI. You enter a target URL, and the system does the rest — running security tools, analyzing results with AI, and generating a professional PDF report.



## What It Does

When you start a scan, OffSec runs 6 steps automatically:

1. **Reconnaissance** — finds open ports and running services using Nmap
2. **Enumeration** — discovers hidden pages and directories using Gobuster
3. **Vulnerability Scan** — checks for known CVEs using Nuclei and OWASP ZAP
4. **CVE Intelligence** — looks up vulnerability details and CVSS severity scores
5. **AI Analysis** — sends all findings to an AI model which writes a full security assessment
6. **PDF Report** — generates a downloadable professional penetration test report

Everything streams live to your browser so you can watch it happen in real time.



## Key Features

- **One-click scanning** — enter a URL and click Start, the AI handles everything
- **Live command log** — see every tool command and its output as it runs
- **Auto PDF report** — professional report generated automatically at the end
- **Scan history** — all past scans saved and accessible anytime
- **AI chatbot** — ask security questions and get expert answers
- **Login system** — secure access with email and password



## How to Run

### Requirements
Before starting, install these on your computer:

| Tool | Download |
|---|---|
| Python 3.11+ | https://python.org/downloads |
| Node.js 18+ | https://nodejs.org |
| Docker Desktop | https://docker.com/products/docker-desktop |


You also need two free accounts:
- **Groq API key** — get it free at https://console.groq.com
- **Firebase project** — create free at https://console.firebase.google.com



### Step 1 — Download the project

```bash
git clone https://github.com/YOUR_USERNAME/offsec.git
cd offsec
```



### Step 2 — Run the setup script (installs everything)

**Windows:**
```
Double-click  scripts\setup.bat
```

**Linux / macOS:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This automatically installs all Python and Node.js packages.



### Step 5 — Launch the app

**Windows:**
```
Double-click  scripts\start_offsec.bat
```

**Linux / macOS:**
```bash
./scripts/start_offsec.sh
```



## How to Use

1. Log in with your Firebase account credentials
2. Click **New Scan** in the sidebar
3. Enter the target URL (e.g. `scanme.nmap.org`) and choose Quick or Full scan
4. Click **Start Scan** and watch the live feed
5. When complete, go to **Reports** and download your PDF




## Important Notes

- **Only scan websites you have permission to test.** Unauthorized scanning is illegal.
- Keep Docker Desktop running while scanning — all security tools run inside Docker containers.
- The `backend/.env` and `src/firebase.ts` files contain secret keys — never upload them to GitHub.

## Built With

React.js · TypeScript · FastAPI · Python · Groq LLaMA 3.3 · Ollama · Nmap · Gobuster · Nuclei · OWASP ZAP · Firebase · Docker
