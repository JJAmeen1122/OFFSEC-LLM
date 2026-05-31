import React from 'react';
import { HACKING_STAGES } from '../../data/scanData';
import { C } from '../../theme';

interface Props {
  currentStage: string;
  progress: number;
}

export const HackingPhases: React.FC<Props> = ({ currentStage, progress }) => (
  <div style={s.card}>
    <div style={s.header}>
      <span style={s.title}>⚔ Attack Phases</span>
      <span style={s.pct}>{progress}%</span>
    </div>

    <div style={s.track}>
      {HACKING_STAGES.map((stage, i) => {
        const done   = progress >= stage.progress;
        const active = currentStage === stage.name && !done;

        const nameStyle: React.CSSProperties = {
          fontSize: '1em', fontWeight: 700, textAlign: 'center',
          maxWidth: 78, lineHeight: 1.3, marginTop: 4,
          color: done ? C.green : active ? C.cyan : C.textDim,
        };

        const circleStyle: React.CSSProperties = {
          ...s.circle,
          background:  done   ? C.green      : active ? C.cyanLight : C.bgHover,
          border:      done   ? `2px solid ${C.green}` : active ? `2px solid ${C.cyan}` : `2px solid ${C.border}`,
          boxShadow:   done   ? `0 0 14px ${C.green}44` : active ? `0 0 16px ${C.cyan}44` : 'none',
          transform:   active ? 'scale(1.12)' : 'scale(1)',
          transition:  'all 0.3s ease',
        };

        const lineStyle: React.CSSProperties = {
          ...s.line,
          background: progress >= HACKING_STAGES[i + 1]?.progress
            ? `linear-gradient(90deg, ${C.green}, ${C.cyan})`
            : active
            ? `linear-gradient(90deg, ${C.cyan}, ${C.border})`
            : C.border,
        };

        return (
          <React.Fragment key={stage.stage}>
            <div style={s.node}>
              <div style={circleStyle}>
                {done
                  ? <span style={{ color: '#fff', fontSize: '0.85em', fontWeight: 800 }}>✓</span>
                  : <span style={{ fontSize: '1.1em', filter: (!active && !done) ? 'grayscale(1) opacity(0.4)' : 'none' }}>
                      {stage.icon}
                    </span>
                }
                {active && <div style={s.pulse} />}
              </div>
              <div style={nameStyle}>{stage.name}</div>
              <div style={s.stageTool}>{stage.tool}</div>
            </div>

            {i < HACKING_STAGES.length - 1 && (
              <div style={lineStyle} />
            )}
          </React.Fragment>
        );
      })}
    </div>

    <div style={s.barTrack}>
      <div style={{
        ...s.barFill,
        width: `${progress}%`,
        boxShadow: progress > 0 && progress < 100 ? `0 0 10px ${C.cyan}66` : 'none',
      }} />
    </div>
  </div>
);

const s: Record<string, React.CSSProperties> = {
  card:      { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '22px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animation: 'fadeIn 0.3s ease' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:     { fontSize: '0.75em', fontWeight: 700, color: C.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' },
  pct:       { fontSize: '1.1em', fontWeight: 800, color: C.cyan, fontFamily: 'JetBrains Mono, monospace' },
  track:     { display: 'flex', alignItems: 'flex-start', marginBottom: 16, overflowX: 'auto', paddingBottom: 4 },
  node:      { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 },
  circle:    { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'default' },
  pulse:     { position: 'absolute', inset: -5, borderRadius: '50%', border: `2px solid ${C.cyan}44`, animation: 'ping 1.5s ease-out infinite' },
  stageTool: { fontSize: '0.55em', color: C.textDim, textAlign: 'center', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' },
  line:      { height: 2, flex: 1, minWidth: 12, marginTop: 22, borderRadius: 2, transition: 'background 0.4s ease' },
  barTrack:  { height: 4, background: C.bg, borderRadius: 4, overflow: 'hidden' },
  barFill:   { height: '100%', background: `linear-gradient(90deg, ${C.cyan}, ${C.green})`, borderRadius: 4, transition: 'width 0.5s ease' },
};