import React from 'react';
import { C } from '../../theme';
import logo from '../../assets/logo.png';

const NAV_ITEMS = [
  { section: 'Main', items: [
    { icon: '⬡', label: 'Dashboard' },
    { icon: '◎', label: 'New Scan'  },
  ]},
  { section: 'Analysis', items: [
    { icon: '≡', label: 'Scan History'    },
    { icon: '⚠', label: 'Vulnerabilities' },
    { icon: '▤', label: 'Reports'         },
    { icon: '◈', label: 'AI Assistant'    },
  ]},
  { section: 'System', items: [
    { icon: '?', label: 'Help & Docs'},
  ]},
];

interface Props {
  selected: string;
  onSelect: (s: string) => void;
}

export const Sidebar: React.FC<Props> = ({ selected, onSelect }) => (
  <aside style={s.sidebar}>

    {/* Logo & Brand */}
    <div style={s.logoArea}>
      <div style={s.logoWrap}>
        <img
          src={logo}
          alt="OffSec"
          style={s.logoImg}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={s.logoGlow} />
      </div>
      <div style={s.brandName}>OffSec</div>
      <div style={s.brandTagline}>Offense for Defense</div>
    </div>

    {/* Divider */}
    <div style={s.divider} />

    {/* Nav sections */}
    <nav style={s.nav}>
      {NAV_ITEMS.map(group => (
        <div key={group.section}>
          <div style={s.sectionLabel}>{group.section}</div>
          {group.items.map(item => {
            const active = selected === item.label;
            return (
              <div
                key={item.label}
                style={{
                  ...s.item,
                  background:   active ? `${C.crimson}14` : 'transparent',
                  color:        active ? '#ff8888' : C.textLight,
                  borderColor:  active ? `${C.crimson}44` : 'transparent',
                  fontWeight:   active ? 600 : 500,
                }}
                onClick={() => onSelect(item.label)}
                onMouseEnter={e => { if (!active)(e.currentTarget as HTMLDivElement).style.background = '#ffffff0a'; }}
                onMouseLeave={e => { if (!active)(e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {/* Red left accent bar */}
                <div style={{
                  ...s.accent,
                  opacity: active ? 1 : 0,
                }} />
                <span style={s.icon}>{item.icon}</span>
                <span style={s.label}>{item.label}</span>
                {active && (
                  <div style={s.dot} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>

    {/* Footer */}
    <div style={s.footer}>
      <div style={s.footerInner}>
        <div style={s.footerDot} />
        <div>
          <div style={s.footerTitle}>System Online</div>
          <div style={s.footerSub}>v1.0.0 · AI Ready</div>
        </div>
      </div>
    </div>
  </aside>
);

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    background: 'linear-gradient(180deg, #0a1428 0%, #0f1f3d 50%, #141e35 100%)',
    display: 'flex', flexDirection: 'column',
    height: '100vh', flexShrink: 0,
    borderRight: `1px solid ${C.borderDark}`,
    position: 'relative', overflow: 'hidden',
  },
  logoArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 16px 18px',
    borderBottom: `1px solid ${C.crimson}33`,
    background: 'linear-gradient(180deg, #1a0810 0%, transparent 100%)',
  },
  logoWrap: {
    position: 'relative', width: 80, height: 80, marginBottom: 10,
  },
  logoImg: {
    width: 80, height: 80, borderRadius: 14,
    objectFit: 'cover',
    border: `2px solid ${C.crimson}66`,
    boxShadow: `0 0 20px ${C.crimson}44, 0 4px 16px rgba(0,0,0,0.4)`,
  },
  logoGlow: {
    position: 'absolute', inset: -4, borderRadius: 18,
    border: `1px solid ${C.crimson}33`,
    animation: 'ping 3s ease-out infinite',
  },
  brandName: {
    fontFamily: '"Cinzel", serif',
    fontSize: '1.4em', fontWeight: 900,
    letterSpacing: '0.12em',
    background: 'linear-gradient(135deg, #ff6b6b 0%, #cc1a2e 40%, #ff4444 70%, #ffaaaa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1, marginBottom: 4,
  },
  brandTagline: {
    fontFamily: '"Crimson Text", serif',
    fontStyle: 'italic',
    fontSize: '0.72em',
    color: C.textLight,
    letterSpacing: '0.1em',
  },
  divider: {
    height: 1,
    background: `linear-gradient(90deg, transparent, ${C.borderDark}, transparent)`,
    margin: '8px 16px',
  },
  nav:          { padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto' },
  sectionLabel: { fontSize: '0.58em', fontWeight: 700, color: '#2a4a6e', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '10px 12px 4px', marginTop: 4 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    cursor: 'pointer', transition: 'all 0.15s',
    fontSize: '0.82em', position: 'relative',
    border: '1px solid transparent',
  },
  accent: {
    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
    width: 3, height: '60%',
    background: `linear-gradient(180deg, #ff6b6b, ${C.crimson})`,
    borderRadius: '0 3px 3px 0',
    boxShadow: `2px 0 8px ${C.crimson}66`,
    transition: 'opacity 0.2s',
  },
  icon:  { width: 20, textAlign: 'center', fontSize: '1em', flexShrink: 0 },
  label: { flex: 1 },
  dot:   { width: 4, height: 4, borderRadius: '50%', background: '#ff8888', boxShadow: `0 0 6px ${C.crimson}`, marginLeft: 'auto', flexShrink: 0 },
  footer: { padding: '14px 16px', borderTop: `1px solid ${C.borderDark}` },
  footerInner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: `${C.green}08`,
    border: `1px solid ${C.green}20`,
    borderRadius: 8, padding: '10px 12px',
  },
  footerDot:   { width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, flexShrink: 0, animation: 'pulse 2s infinite' },
  footerTitle: { fontSize: '0.72em', fontWeight: 600, color: C.green },
  footerSub:   { fontSize: '0.6em', color: C.textLight, marginTop: 1 },
};