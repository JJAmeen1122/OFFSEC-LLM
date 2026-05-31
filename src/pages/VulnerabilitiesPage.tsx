import React, { useState } from 'react';
import { ScanResult } from '../types';
import { C } from '../theme';

interface Props {
  scans: ScanResult[];
}

interface Vuln {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  target: string;
  tool: string;
  detail: string;
}

// ── Extract vulns from real tool outputs ──────────────────
function extractVulns(scans: ScanResult[]): Vuln[] {
  const vulns: Vuln[] = [];
  let counter = 0;

  scans.forEach(scan => {
    scan.commands.forEach(cmd => {
      // rawOutput has the full tool output; output is just the short summary
      // We need the full output for parsing — fall back to output if rawOutput absent
      const output = (cmd as any).rawOutput || cmd.output || '';

      // ── Nuclei output ─────────────────────────────────
      // [critical] [cve-2021-41773] [http] http://target
      const nucleiRegex = /\[(critical|high|medium|low|info)\]\s+\[([^\]]+)\]/gi;
      let match;
      while ((match = nucleiRegex.exec(output)) !== null) {
        vulns.push({
          id:       `vuln-${counter++}`,
          name:     match[2],
          severity: match[1].toLowerCase() as Vuln['severity'],
          target:   scan.target,
          tool:     'Nuclei',
          detail:   match[0].substring(0, 120),
        });
      }

      // ── Nmap VULNERABLE keyword ────────────────────────
      const nmapVulnRegex = /(\S+):\s*VULNERABLE/gi;
      while ((match = nmapVulnRegex.exec(output)) !== null) {
        vulns.push({
          id:       `vuln-${counter++}`,
          name:     match[1],
          severity: 'critical',
          target:   scan.target,
          tool:     'Nmap',
          detail:   match[0].substring(0, 120),
        });
      }

      // ── Nmap CVE detection ─────────────────────────────
      const cveRegex = /(CVE-\d{4}-\d+)/gi;
      while ((match = cveRegex.exec(output)) !== null) {
        vulns.push({
          id:       `vuln-${counter++}`,
          name:     match[1],
          severity: 'high',
          target:   scan.target,
          tool:     'Nmap',
          detail:   `CVE detected: ${match[1]}`,
        });
      }

      // ── Nmap open ports — risk rated by service ────────
      const portRegex = /(\d+)\/tcp\s+open\s+(\S+)\s*(.*)/gi;
      while ((match = portRegex.exec(output)) !== null) {
        const port    = match[1];
        const service = match[2].toLowerCase();
        const version = match[3].trim();

        // Risk rating by service type
        let severity: Vuln['severity'] = 'info';

        const critical = ['telnet', 'rexec', 'rlogin'];
        const high     = ['ftp', 'smtp', 'snmp', 'rdp', 'vnc', 'mysql', 'mssql', 'oracle', 'mongodb', 'redis', 'elasticsearch', 'memcached', 'cassandra', 'couchdb'];
        const medium   = ['ssh', 'http', 'https', 'smb', 'ldap', 'pop3', 'imap', 'nfs', 'postgresql'];
        const low      = ['dns', 'dhcp', 'ntp', 'http-alt'];

        if (critical.some(s => service.includes(s)))      severity = 'critical';
        else if (high.some(s => service.includes(s)))     severity = 'high';
        else if (medium.some(s => service.includes(s)))   severity = 'medium';
        else if (low.some(s => service.includes(s)))      severity = 'low';

        // Outdated version detection → bump severity
        const outdated = ['apache 2.2', 'apache 2.4.4', 'nginx 1.14', 'nginx 1.16', 'openssh 5', 'openssh 6', 'openssh 7', 'php/5', 'php/7.0', 'php/7.1'];
        if (outdated.some(o => version.toLowerCase().includes(o))) {
          severity = severity === 'info' ? 'medium' : severity;
        }

        vulns.push({
          id:       `vuln-${counter++}`,
          name:     `Open Port ${port} — ${service}${version ? ' (' + version + ')' : ''}`,
          severity,
          target:   scan.target,
          tool:     'Nmap',
          detail:   `Port ${port}/tcp open · Service: ${service} · ${version || 'version unknown'}`,
        });
      }

      // ── Gobuster sensitive paths ───────────────────────
      const gobusterRegex = /^(\/\S+)\s+\(Status:\s*(\d+)\)/gm;
      while ((match = gobusterRegex.exec(output)) !== null) {
        const path   = match[1].toLowerCase();
        const status = match[2];

        let severity: Vuln['severity'] = 'info';
        let name = `Exposed Path: ${match[1]}`;

        const criticalPaths = ['/.env', '/config.php', '/wp-config', '/credentials', '/passwd', '/shadow'];
        const highPaths     = ['/phpmyadmin', '/adminer', '/shell', '/webshell', '/backdoor', '/cmd'];
        const mediumPaths   = ['/admin', '/administrator', '/backup', '/.git', '/api', '/swagger', '/graphql'];
        const lowPaths      = ['/login', '/upload', '/uploads', '/images', '/static', '/assets'];

        if (criticalPaths.some(p => path.includes(p)))      { severity = 'critical'; name = `Sensitive File Exposed: ${match[1]}`; }
        else if (highPaths.some(p => path.includes(p)))     { severity = 'high';     name = `Admin Panel Found: ${match[1]}`; }
        else if (mediumPaths.some(p => path.includes(p)))   { severity = 'medium';   name = `Sensitive Path: ${match[1]}`; }
        else if (lowPaths.some(p => path.includes(p)))      { severity = 'low';      name = `Exposed Path: ${match[1]}`; }
        else if (status === '200')                           { severity = 'info';     }
        else return; // skip uninteresting paths

        vulns.push({
          id:       `vuln-${counter++}`,
          name,
          severity,
          target:   scan.target,
          tool:     'Gobuster',
          detail:   `${match[1]} → HTTP ${status}`,
        });
      }
    });
  });

  // Sort by severity
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return vulns.sort((a, b) => order[a.severity] - order[b.severity]);
}

const SEV_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: C.redLight,    color: C.red,    border: '#fca5a5' },
  high:     { bg: C.orangeLight, color: C.orange, border: '#fcd34d' },
  medium:   { bg: '#fefce8',     color: C.yellow, border: '#fde047' },
  low:      { bg: C.greenLight,  color: C.green,  border: '#a7f3d0' },
  info:     { bg: C.cyanLight,   color: C.cyan,   border: '#b8e6f9' },
};

export const VulnerabilitiesPage: React.FC<Props> = ({ scans }) => {
  const [filter, setFilter] = useState<string>('all');

  const allVulns  = extractVulns(scans);
  const counts    = {
    critical: allVulns.filter(v => v.severity === 'critical').length,
    high:     allVulns.filter(v => v.severity === 'high').length,
    medium:   allVulns.filter(v => v.severity === 'medium').length,
    low:      allVulns.filter(v => v.severity === 'low').length,
    info:     allVulns.filter(v => v.severity === 'info').length,
  };
  const filtered  = filter === 'all' ? allVulns : allVulns.filter(v => v.severity === filter);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>

      {/* Summary cards */}
      <div style={s.grid}>
        {[
          { label: 'Critical', key: 'critical', color: C.red,    bg: C.redLight,    border: '#fca5a5' },
          { label: 'High',     key: 'high',     color: C.orange, bg: C.orangeLight, border: '#fcd34d' },
          { label: 'Medium',   key: 'medium',   color: C.yellow, bg: '#fefce8',     border: '#fde047' },
          { label: 'Low',      key: 'low',      color: C.green,  bg: C.greenLight,  border: '#a7f3d0' },
          { label: 'Info',     key: 'info',     color: C.cyan,   bg: C.cyanLight,   border: '#b8e6f9' },
        ].map(item => (
          <div
            key={item.key}
            style={{ ...s.sevCard, background: item.bg, border: `1px solid ${item.border}`, cursor: 'pointer' }}
            onClick={() => setFilter(filter === item.key ? 'all' : item.key)}
          >
            <div style={{ ...s.sevNum, color: item.color }}>{counts[item.key as keyof typeof counts]}</div>
            <div style={{ ...s.sevLabel, color: item.color }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={s.filterRow}>
        {['all', 'critical', 'high', 'medium', 'low', 'info'].map(f => (
          <button
            key={f}
            style={{
              ...s.filterBtn,
              background: filter === f ? C.cyan : C.bgCard,
              color:      filter === f ? '#fff' : C.textSecondary,
              border:     `1px solid ${filter === f ? C.cyan : C.border}`,
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${counts[f as keyof typeof counts]})`}
            {f === 'all' && ` (${allVulns.length})`}
          </button>
        ))}
      </div>

      {/* Vuln list */}
      {filtered.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>🛡️</div>
          <div style={s.emptyTitle}>
            {allVulns.length === 0
              ? 'No scans yet — run a scan to find vulnerabilities'
              : 'No vulnerabilities found for this filter'
            }
          </div>
          {allVulns.length === 0 && (
            <div style={s.emptyHint}>
              Try scanning <code>testphp.vulnweb.com</code> for demo results
            </div>
          )}
        </div>
      ) : (
        <div style={s.vulnList}>
          {filtered.map(vuln => {
            const col = SEV_COLORS[vuln.severity];
            return (
              <div key={vuln.id} style={{ ...s.vulnItem, borderLeftColor: col.color }}>
                <div style={s.vulnTop}>
                  <span style={s.vulnName}>{vuln.name}</span>
                  <span style={{ ...s.vulnBadge, background: col.bg, color: col.color, border: `1px solid ${col.border}` }}>
                    {vuln.severity.toUpperCase()}
                  </span>
                </div>
                <div style={s.vulnMeta}>
                  🎯 {vuln.target} · 🔧 {vuln.tool}
                </div>
                <div style={s.vulnDetail}>{vuln.detail}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 },
  sevCard:    { borderRadius: 10, padding: '16px', textAlign: 'center', transition: 'transform 0.15s', cursor: 'pointer' },
  sevNum:     { fontSize: '1.8em', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' },
  sevLabel:   { fontSize: '0.62em', fontWeight: 700, letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' },
  filterRow:  { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterBtn:  { padding: '5px 14px', borderRadius: 20, fontSize: '0.75em', fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', transition: 'all 0.15s' },
  empty:      { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyIcon:  { fontSize: '3em', marginBottom: 16 },
  emptyTitle: { fontSize: '1em', fontWeight: 700, color: C.textPrimary, marginBottom: 8 },
  emptyHint:  { fontSize: '0.82em', color: C.textSecondary, marginTop: 8 },
  vulnList:   { display: 'flex', flexDirection: 'column', gap: 10 },
  vulnItem:   { background: C.bgCard, border: `1px solid ${C.border}`, borderLeftWidth: 4, borderRadius: 8, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  vulnTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  vulnName:   { fontSize: '0.88em', fontWeight: 700, color: C.textPrimary },
  vulnBadge:  { fontSize: '0.6em', padding: '3px 10px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' },
  vulnMeta:   { fontSize: '0.72em', color: C.textSecondary, marginBottom: 6 },
  vulnDetail: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7em', color: C.textSecondary, background: C.bg, padding: '6px 10px', borderRadius: 5 },
};