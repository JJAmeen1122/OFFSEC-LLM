import React from 'react';
import { ScanResult } from '../types';
import { C } from '../theme';
import { AIAnalysis } from '../components/Scanner/AIAnalysis';

interface Props {
  activeScan: ScanResult | null;
  onNavigate: (page: string) => void;
  onStop?: () => void;
  scanning?: boolean;
}

const PHASES = [
  { name: 'Reconnaissance',     tool: 'nmap',     icon: '🔍', progressThreshold: 15  },
  { name: 'Enumeration',        tool: 'gobuster', icon: '📂', progressThreshold: 30  },
  { name: 'Vulnerability Scan', tool: 'nuclei',   icon: '🛡️', progressThreshold: 50  },
  { name: 'Intelligence',       tool: 'cve-hunt', icon: '🧩', progressThreshold: 65  },
  { name: 'AI Analysis',        tool: 'groq-llm', icon: '🧠', progressThreshold: 82  },
  { name: 'Report Generation',  tool: 'offsec',   icon: '📋', progressThreshold: 100 },
];

// ── Maps backend currentStage values → PHASES.name ───────────────────────────
// Backend sends tool display names that don't always match PHASES names exactly.
// This map normalises them so findIndex() always finds a match.
const STAGE_ALIAS: Record<string, string> = {
  // exact matches (pass-through)
  'Reconnaissance':     'Reconnaissance',
  'Enumeration':        'Enumeration',
  'Vulnerability Scan': 'Vulnerability Scan',
  'AI Analysis':        'AI Analysis',
  // backend sends tool names for these two
  'cve-hunt':           'Intelligence',
  'Intelligence':       'Intelligence',
  'offsec':             'Report Generation',
  'Report Generation':  'Report Generation',
  // extra aliases just in case
  'run_nmap':           'Reconnaissance',
  'run_gobuster':       'Enumeration',
  'run_zap':            'Enumeration',
  'run_nuclei':         'Vulnerability Scan',
  'fetch_cves':         'Intelligence',
  'run_sqlmap': 'Vulnerability Scan',
  'generate_report':    'Report Generation',
};

export const DashboardPage: React.FC<Props> = ({ activeScan, onNavigate }) => {
  const pct          = activeScan?.progress ?? 0;
  const rawStage     = activeScan?.currentStage ?? '';

  // Normalise the stage name through the alias map
  const currentStage = STAGE_ALIAS[rawStage] ?? rawStage;
  const currentIdx   = PHASES.findIndex(p => p.name === currentStage);

  const getStatus = (i: number): 'done' | 'active' | 'pending' => {
    if (currentIdx === -1) {
      // fallback: progress-based only when stage name still doesn't match
      if (pct >= PHASES[i].progressThreshold) return 'done';
      return 'pending';
    }
    if (i < currentIdx)   return 'done';
    if (i === currentIdx) return 'active';
    return 'pending';
  };

  // ── Synced progress bar ───────────────────────────────────────────────────
  // When currentIdx is known, interpolate within that phase's range so the
  // bar moves smoothly and jumps cleanly at each phase boundary.
  const syncedPct = (() => {
    if (!activeScan) return 0;
    if (pct >= 100)  return 100;
    if (currentIdx === -1) return pct;   // fallback

    const prevThreshold = currentIdx > 0 ? PHASES[currentIdx - 1].progressThreshold : 0;
    const currThreshold = PHASES[currentIdx].progressThreshold;
    const activeRange   = currThreshold - prevThreshold;
    const withinPhase   = Math.min(Math.max(pct - prevThreshold, 0), activeRange);

    return prevThreshold + withinPhase;
  })();

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>

      {/* Stats row */}
      <div style={s.statsGrid}>
        {[
          { icon: '🎯', label: 'Last Target',   value: activeScan?.target || 'None',              color: C.cyan   },
          { icon: '📊', label: 'Current Phase', value: currentStage || '—',                        color: C.purple },
          { icon: '📈', label: 'Progress',      value: activeScan ? `${Math.round(syncedPct)}%` : '—', color: C.green },
          { icon: '⚡', label: 'Commands Run',  value: `${activeScan?.commands.length ?? 0}`,     color: C.orange },
        ].map(stat => (
          <div key={stat.label} style={s.statCard}>
            <div style={s.statIcon}>{stat.icon}</div>
            <div style={{ ...s.statVal, color: stat.color }}>{stat.value}</div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── ATTACK PHASES ── */}
      {activeScan && activeScan.status === 'scanning' && (
        <div style={s.phasesWrapper}>

          <div style={s.phasesHeader}>
            <div style={s.phasesTitleRow}>
              <span style={{ fontSize: 16 }}>⚔</span>
              <span style={s.phasesTitle}>ATTACK PHASES</span>
            </div>
            <div style={s.headerRight}>
              <span style={s.pctLabel}>SCAN PROGRESS</span>
              <span style={s.pctValue}>{Math.round(syncedPct)}%</span>
            </div>
          </div>

          {/* Master bar — driven by syncedPct, not raw pct */}
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${syncedPct}%` }}>
              <div style={s.barShimmer} />
            </div>
          </div>

          {/* Phase cards */}
          <div style={s.phasesGrid}>
            {PHASES.map((phase, i) => {
              const status  = getStatus(i);
              const done    = status === 'done';
              const active  = status === 'active';
              const pending = status === 'pending';

              // 🎨 Dull grey/slate palette for pending (queued) cards
              const greyAccent = {
                bg: 'linear-gradient(135deg,#2a2a2e,#1e1e24)',
                border: '#4a4a55',
                glow: '#6b6b7a',
                text: '#b0b0c0',
                toolBg: '#3a3a44',
                toolText: '#c0c0d0',
                numColor: '#9ca3af'
              };
              const accent = greyAccent; // all pending cards use the same muted grey scheme

              let cardStyle: React.CSSProperties;
              if (done) {
                cardStyle = { ...s.card, ...s.cardDone };
              } else if (active) {
                cardStyle = { ...s.card, ...s.cardActive };
              } else {
                cardStyle = {
                  ...s.card,
                  background: accent.bg,
                  border: `1px solid ${accent.border}`,
                  boxShadow: `0 2px 12px ${accent.glow}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
                };
              }

              return (
                <div
                  key={phase.name}
                  style={cardStyle}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.transform = 'translateY(-4px) scale(1.03)';
                    if (done)        el.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)';
                    else if (active) el.style.boxShadow = `0 8px 28px rgba(0,153,204,0.35)`;
                    else             el.style.boxShadow = `0 8px 24px ${accent.glow}44`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.transform = '';
                    if (done)        el.style.boxShadow = '0 2px 12px rgba(16,185,129,0.12)';
                    else if (active) el.style.boxShadow = `0 4px 20px rgba(0,153,204,0.18)`;
                    else             el.style.boxShadow = `0 2px 12px ${accent.glow}22`;
                  }}
                >
                  {/* Status badge */}
                  <div style={s.badgeRow}>
                    {done && <div style={s.badgeDone}>✓ DONE</div>}
                    {active && (
                      <div style={s.badgeRunning}>
                        <span style={s.dot as React.CSSProperties} />RUNNING
                      </div>
                    )}
                    {pending && (
                      <div style={{ ...s.badgePending, color: accent.text, borderColor: accent.border }}>
                        QUEUED
                      </div>
                    )}
                  </div>

                  {/* Icon */}
                  <div style={{
                    ...s.iconWrap,
                    background: done ? 'rgba(255,255,255,0.85)' : active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
                    boxShadow:  done ? '0 1px 4px rgba(0,0,0,0.07)' : active ? `0 0 16px ${C.cyan}44` : `0 0 12px ${accent.glow}33`,
                  }}>
                    <span style={{ fontSize: 17, lineHeight: '1', filter: pending ? 'brightness(1.3) saturate(1.2)' : 'none' }}>
                      {phase.icon}
                    </span>
                    {active && <div style={s.iconPulse as React.CSSProperties} />}
                  </div>

                  {/* Name */}
                  <div style={{
                    ...s.phaseName,
                    color: done ? '#fa9494' : active ? '#fbfbfc' : accent.text,
                  }}>
                    {phase.name}
                  </div>

                  {/* Tool chip */}
                  <div style={{
                    ...s.toolChip,
                    background: done   ? '#d1fae5'           : active ? '#e0f2fe'      : accent.toolBg,
                    color:      done   ? '#065f46'           : active ? '#0369a1'      : accent.toolText,
                    border:     done   ? '1px solid #6ee7b7' : active ? '1px solid #7dd3fc' : `1px solid ${accent.border}`,
                  }}>
                    {phase.tool}
                  </div>

                  {/* Animated bottom bar */}
                  {active  && <div style={s.activeBar as React.CSSProperties} />}
                  {done    && <div style={s.doneBar} />}
                  {pending && <div style={{ ...s.pendingBar, background: `linear-gradient(90deg,${accent.glow}66,${accent.glow}22)` }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latest Commands */}
      {activeScan && activeScan.commands.length > 0 && (
        <div style={s.commandsSummary}>
          <div style={s.commandsTitle}>📟 LATEST COMMANDS</div>
          <div style={s.commandsList}>
            {activeScan.commands.slice(0, 5).map((cmd, idx) => (
              <div key={cmd.id || idx} style={s.commandItem}>
                <span style={{
                  ...s.commandStatus,
                  background: cmd.status === 'running' ? C.cyan :
                               cmd.status === 'success' ? C.green :
                               cmd.status === 'error'   ? C.red : C.gray
                }} />
                <span style={s.commandStage}>[{cmd.stage}]</span>
                <span style={s.commandText}>{cmd.command.substring(0, 60)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeScan?.aiAnalysis && (
        <AIAnalysis analysis={activeScan.aiAnalysis} target={activeScan.target} />
      )}

      {!activeScan && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>🛡️</div>
          <div style={s.emptyTitle}>No Active Scan</div>
          <div style={s.emptyDesc}>Start a new scan to see live hacking phases and AI analysis here.</div>
          <button style={s.emptyBtn} onClick={() => onNavigate('New Scan')}>▶ Start New Scan</button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes shimmer   { 0%{left:-60%} 100%{left:140%} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes ping      { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.9);opacity:0} }
        @keyframes pulse-bar { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 },
  statCard:  { background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' },
  statIcon:  { fontSize:'1.6em', marginBottom:8 },
  statVal:   { fontSize:'1.05em', fontWeight:800, marginBottom:4, fontFamily:'JetBrains Mono, monospace' },
  statLabel: { fontSize:'0.6em', color:C.textSecondary, letterSpacing:'0.08em', fontWeight:600, textTransform:'uppercase' },

  phasesWrapper: { background:'#f2f4f7', border:'1px solid #21262d', borderRadius:16, padding:'22px 22px 18px', marginBottom:20, boxShadow:'0 4px 32px rgba(0,0,0,0.4)' },
  phasesHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  phasesTitleRow:{ display:'flex', alignItems:'center', gap:8 },
  phasesTitle:   { fontSize:14, fontWeight:700, color:'#01090f', letterSpacing:'0.15em' },
  headerRight:   { display:'flex', alignItems:'center', gap:10 },
  pctLabel:      { fontSize:10, fontWeight:600, color:'#8b949e', letterSpacing:'0.08em' },
  pctValue:      { fontSize:16, fontWeight:800, color:C.cyan, fontFamily:'JetBrains Mono, monospace' },

  barTrack:   { height:6, background:'#21262d', borderRadius:99, overflow:'hidden', marginBottom:18, position:'relative' },
  barFill:    { height:'100%', background:`linear-gradient(90deg,${C.cyan},${C.green})`, borderRadius:99, transition:'width 0.6s ease', position:'relative', overflow:'hidden' },
  barShimmer: { position:'absolute', top:0, left:'-60%', width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation:'shimmer 2s infinite' },

  phasesGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },

  card: { position:'relative', borderRadius:12, padding:'12px 12px 10px', display:'flex', flexDirection:'column', alignItems:'flex-start', overflow:'hidden', transition:'transform 0.2s ease, box-shadow 0.2s ease', minHeight:130, cursor:'default' },

  cardDone:   { background:'linear-gradient(135deg,#0d2818,#0a2010)', border:'1px solid #2ea043', boxShadow:'0 2px 12px rgba(46,160,67,0.2),inset 0 1px 0 rgba(255,255,255,0.05)' },
  cardActive: { background:'linear-gradient(135deg,#001f3d,#003060)', border:`2px solid ${C.cyan}`, boxShadow:`0 4px 24px rgba(0,153,204,0.3),inset 0 1px 0 rgba(0,204,255,0.1)` },

  badgeRow:     { width:'100%', display:'flex', justifyContent:'flex-end', marginBottom:5, minHeight:18 },
  badgeDone:    { fontSize:12, fontWeight:800, color:'#3fb950', background:'rgba(46,160,67,0.15)', border:'1px solid #2ea043', borderRadius:99, padding:'2px 8px', letterSpacing:'0.05em' },
  badgeRunning: { display:'flex', alignItems:'center', gap:4, fontSize:9, fontWeight:800, color:'#58a6ff', background:'rgba(56,139,253,0.15)', border:'1px solid #388bfd', borderRadius:99, padding:'2px 8px', letterSpacing:'0.05em' },
  badgePending: { fontSize:12, fontWeight:700, background:'transparent', borderRadius:99, border:'1px solid', padding:'2px 8px', letterSpacing:'0.05em', opacity:0.7 },
  dot: { display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#58a6ff', animation:'blink 1s infinite' },

  iconWrap:  { position:'relative', width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, transition:'all 0.2s' },
  iconPulse: { position:'absolute', inset:-5, borderRadius:15, border:`2px solid rgba(0,153,204,0.4)`, animation:'ping 1.5s ease-out infinite' },

  phaseName: { fontSize:13, fontWeight:900, lineHeight:1.3, marginBottom:5, letterSpacing:'-0.01em' },
  toolChip:  { fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono, monospace', borderRadius:6, padding:'2px 7px', marginBottom:8 },

  activeBar:  { position:'absolute', bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${C.cyan},#38bdf8)`, borderRadius:'0 0 12px 12px', animation:'pulse-bar 2s infinite' },
  doneBar:    { position:'absolute', bottom:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#2ea043,#56d364)', borderRadius:'0 0 12px 12px' },
  pendingBar: { position:'absolute', bottom:0, left:0, right:0, height:2, borderRadius:'0 0 12px 12px', opacity:0.6 },

  commandsSummary: { background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px', marginBottom:20 },
  commandsTitle:   { fontSize:'0.85em', fontWeight:700, color:C.textSecondary, letterSpacing:'0.08em', marginBottom:12, textTransform:'uppercase' },
  commandsList:    { display:'flex', flexDirection:'column' as const, gap:8 },
  commandItem:     { display:'flex', alignItems:'center', gap:12, padding:'8px', background:C.bgDark, borderRadius:6, fontSize:'0.75em', fontFamily:'monospace' },
  commandStatus:   { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  commandStage:    { color:C.cyan, fontWeight:600, flexShrink:0 },
  commandText:     { color:C.textSecondary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const },

  empty:     { background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:'60px 24px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' },
  emptyIcon: { fontSize:'3em', marginBottom:16 },
  emptyTitle:{ fontSize:'1.2em', fontWeight:700, color:C.textPrimary, marginBottom:8 },
  emptyDesc: { fontSize:'0.85em', color:C.textSecondary, marginBottom:24 },
  emptyBtn:  { background:C.cyan, color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontSize:'0.9em', fontWeight:700, cursor:'pointer' },
};