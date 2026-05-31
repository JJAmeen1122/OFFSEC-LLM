import React from 'react';
import { C } from '../../theme';

interface Props {
  analysis: string;
  target: string;
}

export const AIAnalysis: React.FC<Props> = ({ analysis, target }) => (
  <div style={s.card}>
    <div style={s.header}>
      <div style={s.iconWrap}>
        <span style={s.icon}>🧠</span>
        <div style={s.glow} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={s.title}>AI SECURITY ANALYSIS</div>
        <div style={s.sub}>{target} · Groq Llama-3.3-70b</div>
      </div>
      <div style={s.badge}>COMPLETE</div>
    </div>
    <div style={s.body}>
      <pre style={s.text}>{analysis}</pre>
    </div>
  </div>
);

const s: Record<string, React.CSSProperties> = {
  card:    { background: C.bgDark, border: `1px solid ${C.green}44`, borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: `0 0 20px ${C.green}11`, animation: 'fadeIn 0.4s ease' },
  header:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap:{ position: 'relative', width: 44, height: 44, flexShrink: 0 },
  icon:    { fontSize: '1.5em', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', position: 'relative', zIndex: 1 },
  glow:    { position: 'absolute', inset: 0, background: `radial-gradient(circle, ${C.green}33 0%, transparent 70%)`, borderRadius: '50%' },
  title:   { fontSize: '0.68em', fontWeight: 700, color: C.green, letterSpacing: '0.1em' },
  sub:     { fontSize: '0.62em', color: C.textLight, marginTop: 3, fontFamily: 'JetBrains Mono, monospace' },
  badge:   { fontSize: '0.6em', padding: '3px 10px', borderRadius: 4, background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, fontWeight: 700, letterSpacing: '0.06em' },
  body:    { background: '#0a1428', border: `1px solid ${C.green}22`, borderRadius: 8, padding: '14px 16px' },
  text:    { margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75em', color: '#a0c4e8', lineHeight: 1.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};