import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:9000',
  headers: { 'Content-Type': 'application/json' }
});

const BACKEND_URL = 'http://localhost:9000';

export const analyzeWithAI = async (context: string, task: string) => {
  const res = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, task }),
  });
  if (!res.ok) throw new Error('AI error');
  return res.json();
};

export const runNmap = async (target: string) => {
  const res = await fetch(`${BACKEND_URL}/api/tools/nmap-parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  return res.json();
};

export const runGobuster = async (target: string, port: string = '80') => {
  const res = await fetch(`${BACKEND_URL}/api/tools/gobuster-smart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, scan_type: port }),
  });
  return res.json();
};

export const runNuclei = async (target: string) => {
  const res = await fetch(`${BACKEND_URL}/api/tools/nuclei-smart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  return res.json();
};

export const getRiskScore = async (ports: any[], findings: any[], paths: any[]) => {
  const res = await fetch(`${BACKEND_URL}/api/tools/risk-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: JSON.stringify({ ports, findings, paths }),
      scan_type: 'full'
    }),
  });
  return res.json();
};

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
};

export const runCVEHunter = async (nmapOutput: string, target: string) => {
  const res = await fetch(`http://localhost:9000/api/cve/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nmap_output: nmapOutput, target }),
  });
  return res.json();
};