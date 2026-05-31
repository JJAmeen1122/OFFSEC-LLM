import React, { useState } from 'react';
import { ScanResult } from '../types';
import { CommandLog } from '../components/Scanner/CommandLog';
import { AIAnalysis } from '../components/Scanner/AIAnalysis';

interface Props {
  scans: ScanResult[];
}

const progressFill = (pct: number): React.CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  background: 'linear-gradient(90deg, #1677ff, #52c41a)',
  borderRadius: 2,
});

export const ScanHistoryPage: React.FC<Props> = ({ scans }) => {
  const [selected, setSelected] = useState<string | null>(scans[0]?.id || null);
  const selectedScan = scans.find(s => s.id === selected) || null;

  if (scans.length === 0) return (
    <div style={s.empty}>
      <div style={s.emptyIcon}>📜</div>
      <div style={s.emptyTitle}>No Scans Yet</div>
      <div style={s.emptyDesc}>Run a scan and results will appear here permanently.</div>
    </div>
  );

  return (
    <div style={s.layout}>

      {/* Left — scan list */}
      <div style={s.list}>
        <div style={s.listTitle}>All Scans ({scans.length})</div>
        {scans.map(scan => (
          <div
            key={scan.id}
            style={{ ...s.item, ...(selected === scan.id ? s.itemActive : {}) }}
            onClick={() => setSelected(scan.id)}
          >
            <div style={s.itemTop}>
              <span style={s.itemTarget}>{scan.target}</span>
              <span style={{
                ...s.itemBadge,
                background: scan.status === 'completed' ? '#f6ffed'
                          : scan.status === 'scanning'   ? '#e6f4ff'
                          : '#fff2f0',
                color:      scan.status === 'completed' ? '#52c41a'
                          : scan.status === 'scanning'   ? '#1677ff'
                          : '#ff4d4f',
                border:     `1px solid ${
                              scan.status === 'completed' ? '#b7eb8f'
                            : scan.status === 'scanning'  ? '#91caff'
                            : '#ffccc7'
                          }`,
              }}>
                {scan.status}
              </span>
            </div>
            <div style={s.itemMeta}>
              {scan.scanType} · {new Date(scan.startTime).toLocaleString()}
            </div>
            <div style={s.itemProgress}>
              <div style={progressFill(scan.progress)} />
            </div>
          </div>
        ))}
      </div>

      {/* Right — scan detail */}
      <div style={s.detail}>
        {selectedScan ? (
          <>
            <div style={s.detailHeader}>
              <div>
                <div style={s.detailTarget}>{selectedScan.target}</div>
                <div style={s.detailMeta}>
                  {selectedScan.scanType} · Started {new Date(selectedScan.startTime).toLocaleString()}
                  {selectedScan.endTime && ` · Ended ${new Date(selectedScan.endTime).toLocaleString()}`}
                </div>
              </div>
              <div style={s.detailProgress}>{selectedScan.progress}%</div>
            </div>

            {selectedScan.aiAnalysis && (
              <div style={{ marginBottom: 20 }}>
                <AIAnalysis
                  analysis={selectedScan.aiAnalysis}
                  target={selectedScan.target}
                />
              </div>
            )}

            <CommandLog
              commands={selectedScan.commands}
              target={selectedScan.target}
            />
          </>
        ) : (
          <div style={s.emptyDetail}>
            Select a scan from the left to view its details.
          </div>
        )}
      </div>

    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  layout:        { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' },
  list:          { background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' },
  listTitle:     { fontSize: '0.85em', fontWeight: 700, color: '#8c8c8c', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' },
  item:          { padding: '12px', borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' },
  itemActive:    { background: '#e6f4ff', border: '1px solid #91caff' },
  itemTop:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTarget:    { fontSize: '0.85em', fontWeight: 600, color: '#1a1a2e' },
  itemBadge:     { fontSize: '0.62em', padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  itemMeta:      { fontSize: '0.7em', color: '#8c8c8c', marginBottom: 6 },
  itemProgress:  { height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  detail:        { background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' },
  detailHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  detailTarget:  { fontSize: '1.1em', fontWeight: 700, color: '#1a1a2e', marginBottom: 4 },
  detailMeta:    { fontSize: '0.75em', color: '#8c8c8c' },
  detailProgress:{ fontSize: '1.8em', fontWeight: 800, color: '#1677ff' },
  empty:         { background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  emptyIcon:     { fontSize: '3em', marginBottom: 16 },
  emptyTitle:    { fontSize: '1.1em', fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  emptyDesc:     { fontSize: '0.85em', color: '#8c8c8c' },
  emptyDetail:   { textAlign: 'center', color: '#8c8c8c', padding: '60px 24px', fontSize: '0.85em' },
};