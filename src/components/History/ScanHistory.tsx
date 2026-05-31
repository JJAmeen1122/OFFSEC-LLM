import React from 'react';
import { ScanResult } from '../../types';

interface Props {
  scans: ScanResult[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export const ScanHistory: React.FC<Props> = ({ scans, activeId, onSelect }) => {
  const past = scans.filter(s => s.status !== 'scanning');
  if (past.length === 0) return null;

  return (
    <div style={s.card}>
      <div style={s.title}>📜 Scan History</div>
      <div style={s.list}>
        {past.map(scan => (
          <div
            key={scan.id}
            style={{ ...s.item, ...(activeId === scan.id ? s.active : {}) }}
            onClick={() => onSelect(scan.id)}
          >
            <div style={s.itemLeft}>
              <span style={{ ...s.dot, background: scan.status === 'completed' ? '#52c41a' : '#ff4d4f' }} />
              <div>
                <div style={s.itemTarget}>{scan.target}</div>
                <div style={s.itemMeta}>{scan.scanType} · {new Date(scan.startTime).toLocaleString()}</div>
              </div>
            </div>
            <span style={{
              ...s.badge,
              background: scan.status === 'completed' ? '#f6ffed' : '#fff2f0',
              color:      scan.status === 'completed' ? '#52c41a' : '#ff4d4f',
              border:     `1px solid ${scan.status === 'completed' ? '#b7eb8f' : '#ffccc7'}`,
            }}>
              {scan.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0', marginBottom: 24 },
  title:      { fontSize: '0.95em', fontWeight: 700, color: '#1a1a2e', marginBottom: 12 },
  list:       { display: 'flex', flexDirection: 'column', gap: 6 },
  item:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1px solid #f0f0f0', cursor: 'pointer', transition: 'all 0.15s' },
  active:     { background: '#e6f4ff', border: '1px solid #91caff' },
  itemLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  dot:        { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  itemTarget: { fontSize: '0.85em', fontWeight: 600, color: '#1a1a2e' },
  itemMeta:   { fontSize: '0.7em', color: '#8c8c8c', marginTop: 2 },
  badge:      { fontSize: '0.65em', padding: '3px 9px', borderRadius: 10, fontWeight: 600 },
};