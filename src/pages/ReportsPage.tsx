import React, { useState } from 'react';
import { ScanResult } from '../types';
import { C } from '../theme';

const API_BASE = 'http://localhost:9000';

interface Props {
  scans: ScanResult[];
}

// ── Main Page ─────────────────────────────────────────────
export const ReportsPage: React.FC<Props> = ({ scans }) => {
  const completed = scans.filter(s => s.status === 'completed');
  const [previewing, setPreviewing] = useState<string | null>(null);

  const handleDownload = (scan: ScanResult) => {
    if (scan.pdfUrl) {
      const fullUrl = scan.pdfUrl.startsWith('http') ? scan.pdfUrl : `${API_BASE}${scan.pdfUrl}`;
      window.open(fullUrl, '_blank');
      return;
    }
    const html = buildHtmlReport(scan);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `offsec-report-${scan.target.replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (completed.length === 0) return (
    <div style={s.emptyWrap}>
      <div style={s.emptyInner}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
          <rect x="8" y="4" width="28" height="36" rx="4" stroke={C.borderDark} strokeWidth="2" fill="none"/>
          <rect x="8" y="4" width="28" height="36" rx="4" stroke={C.cyan} strokeWidth="2" fill={C.cyanLight} opacity="0.3"/>
          <line x1="16" y1="16" x2="32" y2="16" stroke={C.cyan} strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="22" x2="28" y2="22" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="28" x2="26" y2="28" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div style={s.emptyTitle}>No Reports Yet</div>
        <div style={s.emptyDesc}>Complete a scan to generate a security report.</div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Security Reports</div>
          <div style={s.pageSub}>{completed.length} report{completed.length !== 1 ? 's' : ''} available</div>
        </div>
      </div>

      {/* Cards grid */}
      <div style={s.grid}>
        {completed.map((scan, idx) => {
          const tools     = scan.commands.filter(c => c.status === 'success');
          const aiReady   = !!scan.aiAnalysis;
          const hasPdf    = !!scan.pdfUrl;
          const isOpen    = previewing === scan.id;
          const duration  = scan.endTime
            ? Math.round((new Date(scan.endTime).getTime() - new Date(scan.startTime).getTime()) / 1000)
            : null;

          return (
            <div key={scan.id} style={{ ...s.card, animationDelay: `${idx * 60}ms` }}>

              {/* Top accent bar */}
              <div style={s.cardAccent} />

              {/* Card header */}
              <div style={s.cardHead}>
                <div style={s.iconWrap}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14 2 14 8 20 8" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="10" y1="9" x2="8" y2="9" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.targetText}>{scan.target}</div>
                  <div style={s.metaLine}>
                    <span>{new Date(scan.startTime).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
                    <span style={s.dot}>·</span>
                    <span style={s.scanTypeBadge}>{scan.scanType}</span>
                    {duration && <><span style={s.dot}>·</span><span>{duration}s</span></>}
                  </div>
                </div>
                {hasPdf
                  ? <span style={s.pdfBadge}>PDF</span>
                  : <span style={s.htmlBadge}>HTML</span>
                }
              </div>

              {/* Stats row */}
              <div style={s.statsRow}>
                <div style={s.stat}>
                  <div style={s.statNum}>{tools.length}</div>
                  <div style={s.statLabel}>Tools Run</div>
                </div>
                <div style={s.statDivider}/>
                <div style={s.stat}>
                  <div style={{ ...s.statNum, color: aiReady ? C.green : C.textDim }}>
                    {aiReady ? '✓' : '—'}
                  </div>
                  <div style={s.statLabel}>AI Analysis</div>
                </div>
                <div style={s.statDivider}/>
                <div style={s.stat}>
                  <div style={{ ...s.statNum, color: C.green }}>✓</div>
                  <div style={s.statLabel}>Completed</div>
                </div>
              </div>

              {/* AI analysis excerpt */}
              {scan.aiAnalysis && (
                <div style={s.excerpt}>
                  <div style={s.excerptLabel}>AI ANALYSIS EXCERPT</div>
                  <div style={s.excerptText}>
                    {scan.aiAnalysis.slice(0, 140).replace(/[#*`]/g, '')}…
                  </div>
                </div>
              )}

              {/* Inline preview */}
              {isOpen && (
                <div style={s.previewBox}>
                  <InlinePreview scan={scan} />
                </div>
              )}

              {/* Action buttons */}
              <div style={s.btnRow}>
                <button
                  style={s.previewBtn}
                  onClick={() => setPreviewing(isOpen ? null : scan.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginRight: 5 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  {isOpen ? 'Hide' : 'Preview'}
                </button>
                <button
                  style={s.downloadBtn}
                  onClick={() => handleDownload(scan)}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <polyline points="7 10 12 15 17 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {hasPdf ? 'Download PDF' : 'Download Report'}
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Inline Preview Component ──────────────────────────────
const InlinePreview: React.FC<{ scan: ScanResult }> = ({ scan }) => {
  const tools = scan.commands.filter(c => c.status === 'success');
  return (
    <div style={ip.wrap}>
      <div style={ip.headerRow}>
        <div style={ip.headerItem}><span style={ip.headerKey}>TARGET</span><span style={ip.headerVal}>{scan.target}</span></div>
        <div style={ip.headerItem}><span style={ip.headerKey}>TYPE</span><span style={ip.headerVal}>{scan.scanType}</span></div>
        <div style={ip.headerItem}><span style={ip.headerKey}>DATE</span><span style={ip.headerVal}>{new Date(scan.startTime).toLocaleDateString()}</span></div>
      </div>

      {tools.map((cmd, i) => (
        <div key={i} style={ip.toolBlock}>
          <div style={ip.toolHead}>
            <span style={ip.toolDot}/>
            <span style={ip.toolName}>{cmd.stage}</span>
            {cmd.tool && <span style={ip.toolTag}>{cmd.tool}</span>}
          </div>
          <pre style={ip.toolPre}>
            {((cmd as any).rawOutput || cmd.output || '').slice(0, 500)}
          </pre>
        </div>
      ))}

      {scan.aiAnalysis && (
        <div style={ip.aiBlock}>
          <div style={ip.aiLabel}>AI SECURITY ANALYSIS</div>
          <div style={ip.aiText}>{scan.aiAnalysis.replace(/[#*`]/g, '')}</div>
        </div>
      )}
    </div>
  );
};

// ── HTML Report Builder ───────────────────────────────────
function buildHtmlReport(scan: ScanResult): string {
  const tools    = scan.commands.filter(c => c.status === 'success');
  const dateStr  = new Date(scan.startTime).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const duration = scan.endTime
    ? Math.round((new Date(scan.endTime).getTime() - new Date(scan.startTime).getTime()) / 1000)
    : null;

  const toolRows = tools.map(cmd => {
    const raw = ((cmd as any).rawOutput || cmd.output || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `
    <div class="tool-card">
      <div class="tool-header">
        <div class="tool-left">
          <span class="tool-dot"></span>
          <span class="tool-stage">${cmd.stage}</span>
          ${cmd.tool ? `<span class="tool-chip">${cmd.tool}</span>` : ''}
        </div>
        <span class="tool-ok">✓ SUCCESS</span>
      </div>
      <pre class="tool-pre">${raw || 'No output captured.'}</pre>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OffSec Report — ${scan.target}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --navy:#0a1628;
  --navy2:#0f1f3d;
  --navy3:#162040;
  --cyan:#0099cc;
  --cyan-dim:rgba(0,153,204,0.12);
  --cyan-border:rgba(0,153,204,0.25);
  --green:#10b981;
  --red:#ef4444;
  --orange:#f59e0b;
  --text:#e2e8f0;
  --text2:#94a3b8;
  --text3:#64748b;
  --border:rgba(255,255,255,0.07);
  --card:#0f1f3d;
  --mono:'DM Mono',monospace;
  --sans:'Outfit',sans-serif;
}

body{
  font-family:var(--sans);
  background:var(--navy);
  color:var(--text);
  line-height:1.6;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

/* ── COVER ── */
.cover{
  background: linear-gradient(135deg, #08111f 0%, #0a1628 40%, #0c1e3a 100%);
  padding: 56px 64px 48px;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}
.cover::before{
  content:'';
  position:absolute;
  top:-80px;right:-80px;
  width:400px;height:400px;
  background:radial-gradient(circle,rgba(0,153,204,0.07) 0%,transparent 65%);
  pointer-events:none;
}
.cover::after{
  content:'';
  position:absolute;
  bottom:-40px;left:120px;
  width:250px;height:250px;
  background:radial-gradient(circle,rgba(16,185,129,0.04) 0%,transparent 65%);
  pointer-events:none;
}
.cover-eyebrow{
  display:flex;align-items:center;gap:10px;
  font-family:var(--mono);font-size:11px;letter-spacing:0.18em;
  text-transform:uppercase;color:var(--cyan);
  margin-bottom:24px;
}
.cover-eyebrow::before{
  content:'';display:block;
  width:28px;height:1px;background:var(--cyan);
}
.cover-title{
  font-size:2.6em;font-weight:800;line-height:1.1;
  color:#fff;margin-bottom:8px;letter-spacing:-0.02em;
}
.cover-target{
  font-size:2.6em;font-weight:800;
  color:var(--cyan);letter-spacing:-0.02em;
}
.cover-sub{
  font-size:0.95em;color:var(--text3);margin-top:14px;margin-bottom:36px;
  font-weight:400;
}
.meta-strip{
  display:flex;flex-wrap:wrap;gap:0;
  border:1px solid var(--border);border-radius:10px;
  overflow:hidden;background:rgba(255,255,255,0.02);
  width:fit-content;
}
.meta-cell{
  padding:14px 28px;
  border-right:1px solid var(--border);
}
.meta-cell:last-child{border-right:none;}
.meta-key{
  font-family:var(--mono);font-size:9px;letter-spacing:0.2em;
  text-transform:uppercase;color:var(--text3);margin-bottom:5px;
}
.meta-val{
  font-size:13px;font-weight:600;color:var(--text);
  font-family:var(--mono);
}
.meta-val.ok{color:var(--green);}
.meta-val.cyan{color:var(--cyan);}

/* ── BODY ── */
.body{max-width:960px;margin:0 auto;padding:52px 64px;}

.section{margin-bottom:52px;}

.section-label{
  display:flex;align-items:center;gap:12px;
  font-family:var(--mono);font-size:10px;letter-spacing:0.22em;
  text-transform:uppercase;color:var(--cyan);
  font-weight:500;margin-bottom:24px;
}
.section-label::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,var(--cyan-border),transparent);
}

/* ── TOOL CARDS ── */
.tool-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:10px;
  margin-bottom:14px;
  overflow:hidden;
  transition:border-color 0.2s;
}
.tool-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:11px 18px;
  background:rgba(255,255,255,0.025);
  border-bottom:1px solid var(--border);
}
.tool-left{display:flex;align-items:center;gap:10px;}
.tool-dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--cyan);flex-shrink:0;
  box-shadow:0 0 6px var(--cyan);
}
.tool-stage{font-size:13px;font-weight:600;color:var(--text);}
.tool-chip{
  font-family:var(--mono);font-size:10px;
  background:var(--cyan-dim);border:1px solid var(--cyan-border);
  color:var(--cyan);padding:2px 9px;border-radius:4px;
}
.tool-ok{
  font-family:var(--mono);font-size:10px;
  color:var(--green);letter-spacing:0.08em;
}
.tool-pre{
  padding:16px 18px;
  font-family:var(--mono);font-size:11px;line-height:1.75;
  color:#8fb3cc;
  white-space:pre-wrap;word-break:break-word;
  max-height:380px;overflow-y:auto;
}

/* ── AI ANALYSIS ── */
.ai-card{
  background:linear-gradient(135deg,rgba(0,153,204,0.04),rgba(16,185,129,0.03));
  border:1px solid var(--cyan-border);
  border-radius:12px;
  padding:28px 32px;
  position:relative;
  overflow:hidden;
}
.ai-card::before{
  content:'';position:absolute;
  top:0;left:0;width:3px;height:100%;
  background:linear-gradient(180deg,var(--cyan),var(--green));
}
.ai-text{
  font-size:14px;line-height:1.9;color:#b8d0e4;
  white-space:pre-wrap;
}

/* ── FOOTER ── */
.footer{
  text-align:center;
  padding:28px 64px;
  border-top:1px solid var(--border);
  background:rgba(255,255,255,0.01);
}
.footer-text{
  font-family:var(--mono);font-size:10px;
  letter-spacing:0.14em;color:var(--text3);
}
.footer-brand{color:var(--cyan);}

/* ── PRINT ── */
@media print{
  body{background:#fff !important;color:#111 !important;}
  .cover{background:#0a1628 !important;}
  .tool-card,.ai-card{break-inside:avoid;}
}
</style>
</head>
<body>

<div class="cover">
  <div class="cover-eyebrow">OffSec AI Platform · Penetration Test Report</div>
  <div class="cover-title">Security Assessment</div>
  <div class="cover-target">${scan.target}</div>
  <div class="cover-sub">Automated AI-guided penetration test — ${scan.scanType} scan</div>

  <div class="meta-strip">
    <div class="meta-cell">
      <div class="meta-key">Target</div>
      <div class="meta-val cyan">${scan.target}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-key">Scan Type</div>
      <div class="meta-val">${scan.scanType}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-key">Date</div>
      <div class="meta-val">${dateStr}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-key">Tools Run</div>
      <div class="meta-val cyan">${tools.length}</div>
    </div>
    ${duration ? `
    <div class="meta-cell">
      <div class="meta-key">Duration</div>
      <div class="meta-val">${duration}s</div>
    </div>` : ''}
    <div class="meta-cell">
      <div class="meta-key">Status</div>
      <div class="meta-val ok">✓ COMPLETED</div>
    </div>
  </div>
</div>

<div class="body">

  ${tools.length > 0 ? `
  <div class="section">
    <div class="section-label">Tool Results &amp; Findings</div>
    ${toolRows}
  </div>` : ''}

  ${scan.aiAnalysis ? `
  <div class="section">
    <div class="section-label">AI Security Analysis</div>
    <div class="ai-card">
      <div class="ai-text">${scan.aiAnalysis.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    </div>
  </div>` : ''}

</div>

<div class="footer">
  <div class="footer-text">
    Generated by <span class="footer-brand">OffSec AI Platform</span>
    &nbsp;·&nbsp; ${dateStr}
    &nbsp;·&nbsp; ${scan.target}
  </div>
</div>

</body>
</html>`;
}

// ── Page Styles ───────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    animation: 'fadeIn 0.25s ease',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: '1.25em',
    fontWeight: 800,
    color: C.textPrimary,
    letterSpacing: '-0.01em',
  },
  pageSub: {
    fontSize: '0.78em',
    color: C.textSecondary,
    marginTop: 3,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 18,
  },
  card: {
    background: C.bgCard,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(15,31,61,0.06)',
    position: 'relative',
    animation: 'fadeIn 0.3s ease both',
  },
  cardAccent: {
    height: 3,
    background: `linear-gradient(90deg, ${C.cyan}, ${C.green})`,
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px 14px',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 9,
    background: C.cyanLight,
    border: `1px solid ${C.cyan}33`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  targetText: {
    fontSize: '0.92em',
    fontWeight: 700,
    color: C.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metaLine: {
    fontSize: '0.7em',
    color: C.textSecondary,
    marginTop: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  dot: { color: C.textDim },
  scanTypeBadge: {
    background: C.bgHover,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: '0.95em',
    color: C.textSecondary,
    fontFamily: 'JetBrains Mono, monospace',
  },
  pdfBadge: {
    fontSize: '0.6em',
    fontWeight: 700,
    background: '#e6f4ff',
    color: C.cyan,
    border: `1px solid ${C.cyan}44`,
    borderRadius: 5,
    padding: '3px 9px',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  htmlBadge: {
    fontSize: '0.6em',
    fontWeight: 700,
    background: C.orangeLight,
    color: C.orange,
    border: `1px solid ${C.orange}44`,
    borderRadius: 5,
    padding: '3px 9px',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    margin: '0 18px',
    padding: '12px 0',
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
  },
  stat: {
    flex: 1,
    textAlign: 'center',
  },
  statNum: {
    fontSize: '1em',
    fontWeight: 800,
    color: C.textPrimary,
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: '0.6em',
    color: C.textDim,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  statDivider: {
    width: 1,
    height: 28,
    background: C.border,
  },
  excerpt: {
    margin: '14px 18px 0',
    padding: '11px 14px',
    background: C.bgHover,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
  },
  excerptLabel: {
    fontSize: '0.58em',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: C.textDim,
    marginBottom: 5,
    fontFamily: 'JetBrains Mono, monospace',
  },
  excerptText: {
    fontSize: '0.74em',
    color: C.textSecondary,
    lineHeight: 1.65,
  },
  previewBox: {
    margin: '14px 18px 0',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    overflow: 'hidden',
    maxHeight: 420,
    overflowY: 'auto',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    padding: '14px 18px 18px',
    marginTop: 14,
  },
  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 14px',
    background: 'transparent',
    color: C.textSecondary,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: '0.78em',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Space Grotesk, sans-serif',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '9px 14px',
    background: `linear-gradient(135deg, ${C.cyan}, #007aa8)`,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.82em',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: `0 4px 14px ${C.cyan}33`,
    transition: 'opacity 0.15s',
    fontFamily: 'Space Grotesk, sans-serif',
  },
  emptyWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  emptyInner: {
    textAlign: 'center',
    padding: '48px 32px',
    background: C.bgCard,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },
  emptyTitle: {
    fontSize: '1.05em',
    fontWeight: 700,
    color: C.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: '0.82em',
    color: C.textSecondary,
  },
};

// ── Inline Preview Styles ─────────────────────────────────
const ip: Record<string, React.CSSProperties> = {
  wrap: {
    background: C.bgDark,
    padding: '14px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  headerRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 14,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  headerItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  headerKey: {
    fontSize: '8px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: C.textLight,
    opacity: 0.6,
  },
  headerVal: {
    fontSize: '11px',
    fontWeight: 700,
    color: C.cyan,
  },
  toolBlock: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 7,
    marginBottom: 8,
    overflow: 'hidden',
  },
  toolHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  toolDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: C.cyan,
    flexShrink: 0,
  },
  toolName: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#c8ddef',
    flex: 1,
  },
  toolTag: {
    fontSize: '9px',
    background: 'rgba(0,153,204,0.15)',
    color: C.cyan,
    border: '1px solid rgba(0,153,204,0.25)',
    padding: '1px 7px',
    borderRadius: 4,
  },
  toolPre: {
    fontSize: '10px',
    lineHeight: 1.7,
    color: '#7a9cc4',
    padding: '10px 12px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    maxHeight: 180,
    overflowY: 'auto' as const,
  },
  aiBlock: {
    background: 'rgba(0,153,204,0.05)',
    border: '1px solid rgba(0,153,204,0.2)',
    borderLeft: `3px solid ${C.cyan}`,
    borderRadius: 7,
    padding: '12px 14px',
    marginTop: 4,
  },
  aiLabel: {
    fontSize: '8px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: C.cyan,
    marginBottom: 7,
    opacity: 0.8,
  },
  aiText: {
    fontSize: '11px',
    lineHeight: 1.75,
    color: '#a0bcd4',
    whiteSpace: 'pre-wrap' as const,
  },
};