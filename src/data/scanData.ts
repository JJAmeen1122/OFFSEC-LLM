import { HackingStage } from '../types';

export const HACKING_STAGES = [
  { stage: 1, name: 'Reconnaissance',       tool: 'nmap',     icon: '🔍', progress: 15,  desc: 'Port scanning & service detection' },
  { stage: 2, name: 'Enumeration',          tool: 'gobuster', icon: '📂', progress: 30,  desc: 'Directory & subdomain enumeration' },
  { stage: 3, name: 'Vulnerability Scan',   tool: 'nuclei',   icon: '🛡️', progress: 50,  desc: 'CVE & template scanning' },
  { stage: 4, name: 'Intelligence',         tool: 'cve-hunt', icon: '🧩', progress: 65,  desc: 'CVE correlation & risk scoring' },
  { stage: 5, name: 'AI Analysis',          tool: 'groq-llm', icon: '🧠', progress: 82,  desc: 'AI-powered attack chain analysis' },
  { stage: 6, name: 'Report Generation',    tool: 'offsec',   icon: '📋', progress: 100, desc: 'Professional pentest report' },
];

export const TOOL_COMMANDS: Record<string, (target: string) => string> = {
  nmap:     (t) => `nmap -sV -sC -p 80,443,22,8080 --open ${t}`,
  gobuster: (t) => `gobuster dir -u http://${t} -w /wordlists/common.txt -t 20`,
  nuclei:   (t) => `nuclei -u http://${t} -severity medium,high,critical`,
  zap:      (t) => `zap-cli active-scan ${t}`,
  'lily-ai':(t) => `Analyzing ${t} with Groq Llama-3.3-70b...`,
  offsec:   (t) => `Generating security report for ${t}...`,
};

export const SIMULATED_OUTPUTS: Record<string, (t: string) => string> = {
  'nmap':     t => `PORT     STATE  SERVICE   VERSION\n22/tcp   open   ssh       OpenSSH 8.9\n80/tcp   open   http      Apache 2.4.52\n443/tcp  open   ssl/http  nginx 1.18\n8080/tcp open   http-proxy Unknown\n\nHost: ${t} — UP (0.012s latency)`,
  'gobuster': t => `/admin        (Status: 301)\n/login        (Status: 200)\n/backup       (Status: 403)\n/.git         (Status: 403)\n/config       (Status: 403)\n/phpMyAdmin   (Status: 200)\n/api          (Status: 200)\n\nFinished: ${t}`,
  'nuclei':   t => `[medium] [ssh-weak-ciphers] ${t}:22\n[low]    [apache-version-disclosure] ${t}:80\n[medium] [missing-security-headers] ${t}:80\n[high]   [php-info-exposed] ${t}/phpinfo.php\n\n4 findings on ${t}`,
  'zap':      t => `[HIGH]   SQL Injection — ${t}/login\n[MEDIUM] XSS — ${t}/search\n[MEDIUM] CSRF token missing\n[LOW]    X-Frame-Options not set\n\n4 alerts on ${t}`,
  'lily-ai':  t => `Connecting to AI model for ${t}...`,
  'offsec':   t => `Report generated for ${t}\nTotal: 9 findings\nCritical: 1 · High: 2 · Medium: 4 · Low: 2`,
};