import React from 'react';
import { C } from '../theme';
import { ScanInput } from '../components/Scanner/ScanInput';
import { HackingPhases } from '../components/Scanner/HackingPhases';
import { ScanResult } from '../types';

interface Props {
  onStart: (target: string, scanType: string) => void;
  scanning: boolean;
  activeScan: ScanResult | null;
  onStop: () => void;
}

const TOOLS = [
  { icon: '🔍', name: 'Reconnaissance', tool: 'nmap', desc: 'Scans all open ports and detects running services and versions.', color: C.cyan },
  { icon: '📂', name: 'Enumeration', tool: 'gobuster', desc: 'Finds hidden directories, admin panels and sensitive paths.', color: C.green },
  { icon: '🛡️', name: 'Vuln Scan', tool: 'nuclei', desc: 'Checks 9000+ CVE templates against your target in seconds.', color: C.orange },
  { icon: '🕷️', name: 'Web Analysis', tool: 'OWASP ZAP', desc: 'Actively tests for XSS, SQL injection and CSRF.', color: C.red },
  { icon: '🧠', name: 'AI Analysis', tool: 'Groq Llama', desc: 'Generates full attack plan and risk assessment.', color: C.purple },
  { icon: '📋', name: 'Report', tool: 'offsec', desc: 'Structured report with findings and remediation steps.', color: C.cyan },
];

export const NewScanPage: React.FC<Props> = ({ onStart, scanning, activeScan, onStop }) => (
  <div style={{ animation: 'fadeIn 0.25s ease' }}>
    <div style={s.titleRow}>
      <div style={s.title}>🎯 New Security Scan</div>
      <div style={s.sub}>Enter a target to begin an AI-guided penetration test across 6 attack phases</div>
    </div>

    <ScanInput onStart={onStart} scanning={scanning} />

    <div style={s.toolsGrid}>
      {TOOLS.map(t => (
        <div
          key={t.name}
          style={{ ...s.toolCard, borderTop: `3px solid ${t.color}` }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(-5px) scale(1.035)';
            el.style.boxShadow = `0 10px 28px ${t.color}44`;
            el.style.borderColor = t.color;
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.transform = '';
            el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
            el.style.borderColor = '';
          }}
        >
          <div style={s.toolIcon}>{t.icon}</div>
          <div style={s.toolName}>{t.name}</div>
          <div style={{ ...s.toolBadge, color: t.color }}>{t.tool}</div>
          <div style={s.toolDesc}>{t.desc}</div>
        </div>
      ))}
    </div>

  </div>
);

const s: Record<string, React.CSSProperties> = {
  titleRow: { marginBottom: 22 },
  title: { fontSize: '1.25em', fontWeight: 800, color: C.textPrimary, marginBottom: 6, letterSpacing: '-0.01em' },
  sub: { fontSize: '0.82em', color: C.textSecondary },
  stopWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20
  },
  toolsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  toolCard: { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease', cursor: 'default' },
  toolIcon: { fontSize: '1.5em', marginBottom: 10 },
  toolName: { fontSize: '0.85em', fontWeight: 700, color: C.textPrimary, marginBottom: 3 },
  toolBadge: { fontSize: '0.62em', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, marginBottom: 8 },
  toolDesc: { fontSize: '0.76em', color: C.textSecondary, lineHeight: 1.6 },
  liveLabel: { fontSize: '0.85em', fontWeight: 700, color: C.cyan, marginBottom: 10 },
};