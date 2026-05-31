import React, { useState } from 'react';
import { ScanCommand } from '../../types';
import { C } from '../../theme';

interface Props {
  commands: ScanCommand[];
  target?: string;
  scanning?: boolean;
 
}

export const CommandLog: React.FC<Props> = ({ commands, target, scanning }) => (
  <div style={s.card}>
    <div style={s.header}>
      <div style={s.titleRow}>
        <div style={s.dot} />
        <span style={s.title}>TERMINAL</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {target && <span style={s.target}>{target}</span>}
       
      </div>
    </div>

    <div style={s.list}>
      {commands.length === 0 ? (
        <div style={s.empty}>
          <div style={s.cursor}>◌</div>
          <div style={s.emptyText}>Awaiting commands...</div>
        </div>
      ) : (
        commands.map((cmd, idx) => <CommandItem key={idx} cmd={cmd} />)
      )}
    </div>
  </div>
);

// ── Parse raw output into structured sections ─────────────
function parseToolOutput(tool: string, raw: string): ParsedSection[] {
  if (!raw || raw === 'No output received') return [];

  const sections: ParsedSection[] = [];

  if (tool?.includes('nmap') || tool?.includes('run_nmap')) {
    // Extract open ports
    const portLines = raw.split('\n').filter(l => /\d+\/tcp\s+open/.test(l));
    if (portLines.length > 0) {
      sections.push({
        label: `🔓 Open Ports (${portLines.length})`,
        color: '#00ff88',
        items: portLines.map(l => l.trim()),
      });
    }

    // Extract OS detection
    const osLines = raw.split('\n').filter(l =>
      l.toLowerCase().includes('os:') ||
      l.toLowerCase().includes('running:') ||
      l.toLowerCase().includes('os details')
    );
    if (osLines.length > 0) {
      sections.push({
        label: '💻 OS Detection',
        color: '#00d4ff',
        items: osLines.map(l => l.trim()),
      });
    }

    // Extract script results
    const scriptLines = raw.split('\n').filter(l =>
      l.includes('|') && !l.startsWith('PORT') && !l.startsWith('Not shown')
    );
    if (scriptLines.length > 0) {
      sections.push({
        label: '📜 Script Results',
        color: '#ffd700',
        items: scriptLines.slice(0, 20).map(l => l.trim()),
      });
    }
  }

  else if (tool?.includes('gobuster') || tool?.includes('run_gobuster')) {
    const dirLines = raw.split('\n').filter(l =>
      l.includes('Status:') || l.includes('Found:') || l.startsWith('/')
    );
    const sensitive = dirLines.filter(l =>
      ['/admin','/backup','/config','/.git','/.env','/api','/login',
       '/dashboard','/upload','/shell','/console'].some(p => l.includes(p))
    );
    const normal = dirLines.filter(l => !sensitive.includes(l));

    if (sensitive.length > 0) {
      sections.push({
        label: `⚠️ Sensitive Paths (${sensitive.length})`,
        color: '#ff4444',
        items: sensitive.map(l => l.trim()),
      });
    }
    if (normal.length > 0) {
      sections.push({
        label: `📁 Directories Found (${normal.length})`,
        color: '#00ff88',
        items: normal.slice(0, 30).map(l => l.trim()),
      });
    }
  }

  else if (tool?.includes('nuclei') || tool?.includes('run_nuclei')) {
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of severities) {
      const lines = raw.split('\n').filter(l =>
        l.toLowerCase().includes(`[${sev}]`)
      );
      if (lines.length > 0) {
        const color =
          sev === 'critical' ? '#ff0044' :
          sev === 'high'     ? '#ff6600' :
          sev === 'medium'   ? '#ffd700' :
          sev === 'low'      ? '#00d4ff' : '#aaa';
        sections.push({
          label: `${sev.toUpperCase()} (${lines.length})`,
          color,
          items: lines.map(l => l.trim()),
        });
      }
    }
  }

  else if (tool?.includes('fetch_cves') || tool?.includes('cve')) {
    const cveLines = raw.split('\n').filter(l => l.includes('CVE-'));
    if (cveLines.length > 0) {
      sections.push({
        label: `🛡️ CVEs Found (${cveLines.length})`,
        color: '#ff6600',
        items: cveLines.map(l => l.trim()),
      });
    }
  }

  return sections;
}

interface ParsedSection {
  label: string;
  color: string;
  items: string[];
}

// ── Single command row ────────────────────────────────────
const CommandItem: React.FC<{ cmd: ScanCommand }> = ({ cmd }) => {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState<'raw' | 'parsed'>('parsed');

  const color  = cmd.status === 'success' ? C.green : cmd.status === 'error' ? C.red : C.cyan;
  const icon   = cmd.status === 'success' ? '●'     : cmd.status === 'error' ? '✗'   : '◌';

  // rawOutput comes from SSE data.output, output is the summary
  const rawText    = (cmd as any).rawOutput || cmd.output || '';
  const summaryTxt = (cmd as any).summary   || cmd.output || '';
  const toolName   = (cmd as any).tool      || cmd.stage  || '';
  const parsed     = parseToolOutput(toolName, rawText);
  const hasRaw     = rawText && rawText !== summaryTxt && rawText.length > 10;

  return (
    <div style={s.item}>
      {/* ── Header row ── */}
      <div style={s.itemHeader} onClick={() => setOpen(!open)}>
        <span style={{
          ...s.statusIcon, color,
          animation: cmd.status === 'running' ? 'pulse 1s infinite' : 'none'
        }}>
          {icon}
        </span>
        <span style={s.cmd}>{cmd.command}</span>
        <span style={{ ...s.chip, color, background: `${color}18`, border: `1px solid ${color}44` }}>
          {cmd.status}
        </span>
        <span style={s.toggle}>{open ? '▲' : '▼'}</span>
      </div>

      {/* ── Expanded area ── */}
      {open && (
        <div style={s.outputWrap}>

          {/* Summary always shown at top */}
          <div style={s.summaryBar}>
            <span style={s.summaryIcon}>ℹ</span>
            <span style={s.summaryText}>{summaryTxt}</span>
          </div>

          {/* Tab switcher — only show if there's real output */}
          {hasRaw && (
            <>
              <div style={s.tabRow}>
                <button
                  style={{ ...s.tabBtn, ...(tab === 'parsed' ? s.tabActive : {}) }}
                  onClick={() => setTab('parsed')}
                >
                  📊 Parsed
                </button>
                <button
                  style={{ ...s.tabBtn, ...(tab === 'raw' ? s.tabActive : {}) }}
                  onClick={() => setTab('raw')}
                >
                  📟 Raw Output
                </button>
              </div>

              {/* ── PARSED TAB ── */}
              {tab === 'parsed' && (
                <div style={s.parsedWrap}>
                  {parsed.length === 0 ? (
                    <div style={s.noData}>No structured data extracted — check Raw Output tab</div>
                  ) : (
                    parsed.map((section, si) => (
                      <div key={si} style={s.section}>
                        <div style={{ ...s.sectionLabel, color: section.color }}>
                          {section.label}
                        </div>
                        {section.items.map((item, ii) => (
                          <div key={ii} style={s.parsedRow}>
                            <span style={{ ...s.bullet, color: section.color }}>›</span>
                            <span style={s.parsedText}>{item}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── RAW TAB ── */}
              {tab === 'raw' && (
                <div style={s.rawWrap}>
                  <pre style={{ ...s.pre, color }}>
                    {rawText}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card: {
    background: C.bgDark,
    border: `1px solid ${C.borderDark}`,
    borderRadius: 10,
    padding: '16px',
    height: '100%',
    maxHeight: '100%',   // ← ADD THIS
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',  // ← ADD THIS
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: `1px solid ${C.borderDark}`,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: {
    width: 7, height: 7,
    borderRadius: '50%',
    background: C.cyan,
    boxShadow: `0 0 6px ${C.cyan}`,
  },
  title: {
    fontSize: '0.65em', fontWeight: 700,
    color: C.textLight, letterSpacing: '0.14em',
  },
  target: {
    fontSize: '0.65em',
    fontFamily: 'JetBrains Mono, monospace',
    color: C.cyan,
    background: `${C.cyan}12`,
    padding: '2px 8px',
    borderRadius: 4,
    border: `1px solid ${C.cyan}33`,
  },

  list: {
  display: 'flex', flexDirection: 'column',
  gap: 4, overflowY: 'auto', flex: 1,
  minHeight: 0,  // ← ADD THIS
},
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    flex: 1, padding: '40px 0',
  },
  cursor: {
    fontSize: '1.5em', color: C.cyan,
    animation: 'pulse 1s infinite', marginBottom: 8,
  },
  emptyText: {
    fontSize: '0.75em', color: C.textLight,
    fontFamily: 'JetBrains Mono, monospace',
  },
  item: {
    border: `1px solid ${C.borderDark}`,
    borderRadius: 6, overflow: 'visible',
  },
  itemHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 10px', cursor: 'pointer',
    background: C.bgInput,
  },
  statusIcon: {
    fontSize: '0.72em', fontWeight: 700,
    width: 14, textAlign: 'center', flexShrink: 0,
  },
  cmd: {
    flex: 1,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.68em', color: '#a0c4e8',
    wordBreak: 'break-all',
  },
  chip: {
    fontSize: '0.58em', padding: '2px 6px',
    borderRadius: 3, fontWeight: 700,
    letterSpacing: '0.04em', whiteSpace: 'nowrap',
  },
  toggle: { fontSize: '0.55em', color: C.textLight },

  // expanded area
  outputWrap: {
  background: '#060d1a',
  borderTop: `1px solid ${C.borderDark}`,
  maxHeight: 400,        // ← ADD THIS
  overflowY: 'auto',    // ← ADD THIS
},
  summaryBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px',
    borderBottom: `1px solid #ffffff0d`,
    background: '#0a1628',
  },
  summaryIcon: { fontSize: '0.7em', color: C.cyan },
  summaryText: {
    fontSize: '0.68em', color: '#7fb3d3',
    fontFamily: 'JetBrains Mono, monospace',
  },

  // tabs
  tabRow: {
    display: 'flex', gap: 4,
    padding: '8px 12px 0',
  },
  tabBtn: {
    fontSize: '0.62em', fontWeight: 600,
    padding: '4px 10px', borderRadius: '4px 4px 0 0',
    border: `1px solid ${C.borderDark}`,
    borderBottom: 'none',
    background: '#0a1628',
    color: C.textLight,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  tabActive: {
    background: '#0f2040',
    color: C.cyan,
    borderColor: C.cyan,
  },

  // parsed tab
  parsedWrap: {
  padding: '10px 12px 12px',
  display: 'flex', flexDirection: 'column', gap: 10,
  maxHeight: 350,       // ← ADD THIS
  overflowY: 'auto',   // ← ADD THIS
},
  noData: {
    fontSize: '0.65em', color: C.textLight,
    fontFamily: 'JetBrains Mono, monospace',
    padding: '8px 0',
  },
  section: {
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  sectionLabel: {
    fontSize: '0.62em', fontWeight: 700,
    letterSpacing: '0.06em',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  parsedRow: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
  },
  bullet: { fontSize: '0.8em', flexShrink: 0, marginTop: 1 },
  parsedText: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.65em', color: '#c8dff0',
    wordBreak: 'break-all', lineHeight: 1.7,
  },

  // raw tab
  rawWrap: { 
  padding: '10px 12px 12px',
  maxHeight: 350,       // ← ADD THIS
  overflowY: 'auto',   // ← ADD THIS
},

};