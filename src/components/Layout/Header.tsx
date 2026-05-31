import React from 'react';
import { C } from '../../theme';

interface Props {
  scanning: boolean;
  totalScans: number;
  currentPage: string;
}

export const Header: React.FC<Props> = ({ scanning, totalScans, currentPage }) => (
  <header style={s.header}>

    {/* Red top accent line */}
    <div style={s.topLine} />

    {/* Breadcrumb */}
    <div style={s.breadcrumb}>
      <span style={s.breadHome}>OFFSEC</span>
      <span style={s.breadSep}> / </span>
      <span style={s.breadCur}>{currentPage.toUpperCase()}</span>
    </div>

  
  </header>
);

const s: Record<string, React.CSSProperties> = {
  header: {
    height: 56, background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    position: 'relative',
  },
  topLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, transparent, ${C.crimson}, transparent)`,
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72em', letterSpacing: '0.08em', fontWeight: 600 },
  breadHome:  { color: C.textSecondary },
  breadSep:   { color: C.textDim },
  breadCur:   {
    background: `linear-gradient(90deg, ${C.crimson}, #ff4444)`,
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  right:     { display: 'flex', alignItems: 'center', gap: 10 },
  search:    { display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: '5px 14px', cursor: 'pointer' },
  searchText:{ fontSize: '0.75em', color: C.textSecondary },
  divider:   { width: 1, height: 22, background: C.border },
  pill:      { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: '0.68em', fontWeight: 700, background: C.cyanLight, color: C.cyan, border: `1px solid #b8e6f9` },
 pillDot:   { width: 6, height: 6, borderRadius: '50%' },
};
