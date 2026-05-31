import React, { useState } from 'react';
import { C } from '../../theme';

interface Props {
  onStart: (target: string, scanType: string) => void;
  scanning: boolean;
}

// ── Validation ────────────────────────────────────────────
function validateTarget(raw: string): string | null {
  const t = raw.trim();

  if (!t) return 'Please enter a target IP or domain.';

  if (t.length > 253)
    return 'Target is too long. Maximum 253 characters.';

  // Block command injection characters
  if (/[;&|`$<>(){}[\]\\]/.test(t))
    return 'Invalid target: contains forbidden characters ( ; & | ` $ < > ).';

  // Block obvious injection / path traversal / script patterns
  if (/(\.\.[/\\]|%00|<script|javascript:|' *or *1|union.*select)/i.test(t))
    return 'Invalid target: looks like an injection attempt.';

  // Strip protocol to get the raw host for further checks
  const host = t.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

  // Block localhost variants
  if (/^(localhost|ip6-localhost|ip6-loopback)$/i.test(host))
    return 'Scanning localhost is not allowed.';

  // Try parsing as IP
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host);
  if (ipv4) {
    const parts = host.split('.').map(Number);
    if (parts.some(p => p > 255))
      return 'Invalid IP address: each octet must be 0–255.';

    const [a, b] = parts;
    if (a === 0)   return 'Invalid target: 0.x.x.x is not a routable address.';
    if (a === 10)  return 'Private/internal IP addresses are not allowed.';
    if (a === 127) return 'Loopback addresses are not allowed.';
    if (a === 169 && b === 254) return 'Link-local addresses are not allowed.';
    if (a === 172 && b >= 16 && b <= 31) return 'Private/internal IP addresses are not allowed.';
    if (a === 192 && b === 168) return 'Private/internal IP addresses are not allowed.';
    if (a === 255) return 'Broadcast addresses are not allowed.';

    return null; // valid public IP
  }

  // Validate as domain / hostname
  // Must only contain letters, digits, hyphens, dots (and optional port)
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])*(:\d+)?$/.test(host))
    return 'Invalid target: domain must contain only letters, numbers, hyphens, and dots.';

  // Must have at least one dot (e.g. example.com)
  if (!host.includes('.'))
    return 'Invalid target: please enter a full domain (e.g. example.com) or IP address.';

  // No label can start/end with a hyphen
  const labels = host.split('.');
  if (labels.some(l => l.startsWith('-') || l.endsWith('-')))
    return 'Invalid domain: labels cannot start or end with a hyphen.';

  // TLD must be at least 2 chars
  const tld = labels[labels.length - 1];
  if (tld.length < 2)
    return 'Invalid domain: TLD must be at least 2 characters.';

  return null; // all good
}

// ── Component ─────────────────────────────────────────────
export const ScanInput: React.FC<Props> = ({ onStart, scanning }) => {
  const [target,   setTarget]   = useState('');
  const [scanType, setScanType] = useState('full');
  const [focused,  setFocused]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handle = () => {
    if (scanning) return;
    const err = validateTarget(target);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onStart(target.trim(), scanType);
    setTarget('');
  };

  const handleChange = (val: string) => {
    setTarget(val);
    if (error) setError(null); // clear error as user types
  };

  const hasError  = !!error;
  const borderCol = hasError ? C.red : focused ? C.cyan : C.borderDark;
  const glowCol   = hasError ? `0 0 0 3px ${C.red}20` : focused ? `0 0 0 3px ${C.cyan}15` : 'none';

  return (
    <div style={s.card}>
      <div style={s.topRow}>
        <div style={s.label}>
          <span style={s.labelDot} />
          TARGET
        </div>
        <select
          style={s.select}
          value={scanType}
          onChange={e => setScanType(e.target.value)}
          disabled={scanning}
        >
          <option value="quick">QUICK SCAN</option>
          <option value="full">FULL TEST</option>
          <option value="web">WEB ONLY</option>
        </select>
      </div>

      {/* Input row */}
      <div style={{ ...s.inputRow, borderColor: borderCol, boxShadow: glowCol }}>
        <span style={{ ...s.prefix, color: hasError ? C.red : C.cyan }}>{'>_'}</span>
        <input
          style={s.input}
          placeholder="Enter target IP or domain (e.g. 192.168.1.1 or example.com)"
          value={target}
          onChange={e => handleChange(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handle()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={scanning}
        />
        <button
          style={{ ...s.btn, ...(scanning || !target.trim() ? s.btnOff : hasError ? s.btnErr : s.btnOn) }}
          onClick={handle}
          disabled={scanning || !target.trim()}
        >
          {scanning
            ? <><span style={s.spinner} /> SCANNING</>
            : '▶ LAUNCH'
          }
        </button>
      </div>

      {/* Inline error message */}
      {hasError && (
        <div style={s.errorBox}>
          <span style={s.errorIcon}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div style={s.footer}>
        <span style={s.hint}>⏱ Est: {scanType === 'quick' ? '5–10' : '20–30'} min</span>
        <span style={s.hint}>6 phases · AI-guided · Groq Llama-3.3</span>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  card:     { background: C.bgDark, border: `1px solid ${C.borderDark}`, borderRadius: 12, padding: '22px', marginBottom: 20 },
  topRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:    { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65em', fontWeight: 700, color: C.cyan, letterSpacing: '0.14em' },
  labelDot: { width: 5, height: 5, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` },
  select:   { background: C.bgInput, border: `1px solid ${C.borderDark}`, borderRadius: 6, padding: '6px 12px', fontSize: '0.65em', fontWeight: 700, color: C.textLight, fontFamily: 'Space Grotesk, sans-serif', outline: 'none', cursor: 'pointer' },
  inputRow: { display: 'flex', alignItems: 'center', background: C.bgInput, border: `1px solid ${C.borderDark}`, borderRadius: 9, padding: '0 0 0 14px', transition: 'all 0.2s', marginBottom: 8 },
  prefix:   { fontFamily: 'JetBrains Mono, monospace', marginRight: 8, fontSize: '0.9em', transition: 'color 0.2s' },
  input:    { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.88em', padding: '13px 0' },
  btn:      { display: 'flex', alignItems: 'center', gap: 6, padding: '13px 22px', border: 'none', borderRadius: '0 8px 8px 0', fontSize: '0.72em', fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  btnOn:    { background: C.cyan, color: '#000f1a', boxShadow: `0 0 16px ${C.cyan}44` },
  btnOff:   { background: '#1a2a4a', color: C.textLight, cursor: 'not-allowed' },
  btnErr:   { background: C.red, color: '#fff', boxShadow: `0 0 16px ${C.red}44` },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 8, background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 7, padding: '9px 13px', marginBottom: 8, fontSize: '0.75em', color: C.red, lineHeight: 1.5 },
  errorIcon:{ flexShrink: 0, fontWeight: 700 },
  footer:   { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
  hint:     { fontSize: '0.68em', color: C.textLight },
  spinner:  { width: 10, height: 10, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },
};