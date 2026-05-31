import React, { useState, useRef, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { CommandLog } from './components/Scanner/CommandLog';
import { DashboardPage } from './pages/DashboardPage';
import { NewScanPage } from './pages/NewScanPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { VulnerabilitiesPage } from './pages/VulnerabilitiesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ChatbotPage } from './pages/Chatbotpage';
import { LoginPage }   from './pages/LoginPage';
import { ScanResult, ScanCommand } from './types';
import { HelpDocsPage } from './pages/HelpDocsPage';
import { C } from './theme';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

const API_BASE = 'http://localhost:9000';

const App: React.FC = () => {
  // ── Firebase auth state ───────────────────────────────
  const [firebaseUser,  setFirebaseUser]  = useState<User | null>(null);
  const [authLoading,   setAuthLoading]   = useState(true);  // true while Firebase checks saved session

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return unsub; // cleanup listener on unmount
  }, []);

  const [page, setPage]                 = useState('Dashboard');
  const [scanning, setScanning]         = useState(false);
  const [results, setResults]           = useState<ScanResult[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  const stopRequested  = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null); // FIX: track SSE ref manually
  const activeScan     = results.find(r => r.id === activeScanId) || null;

  // ── State helpers ─────────────────────────────────────
  const updateScan = (id: string, patch: Partial<ScanResult>) =>
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const addCommand = (scanId: string, cmd: ScanCommand) =>
    setResults(prev => prev.map(r =>
      r.id === scanId ? { ...r, commands: [cmd, ...r.commands] } : r
    ));

  const updateCommand = (scanId: string, cmdId: string, patch: Partial<ScanCommand>) =>
    setResults(prev => prev.map(r =>
      r.id === scanId
        ? { ...r, commands: r.commands.map(c => c.id === cmdId ? { ...c, ...patch } : c) }
        : r
    ));

  const handleStopScan = () => {
    stopRequested.current = true;
    // FIX: also close SSE immediately on stop
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setScanning(false);
  };

  // ── Open SSE stream for a given scanId ────────────────
  // FIX: extracted into a function called AFTER the POST succeeds
  // This eliminates the race condition where SSE opened before
  // the backend had created the queue for this scan_id.
  const openSSEStream = (scanId: string) => {
    // Close any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('📡 SSE connecting for scan:', scanId);
    const eventSource = new EventSource(
      `${API_BASE}/api/agent/stream/${scanId}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => console.log('✅ SSE open');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE:', data.type, data);

        switch (data.type) {

          case 'scan_started':
            updateScan(scanId, {
              currentStage: 'Initializing',
              progress: 5,
            });
            break;

          case 'phase_started':
            updateScan(scanId, {
              currentStage: data.phase,
              progress: data.progress || 20,
            });
            addCommand(scanId, {
              id: uuidv4(),
              stage: data.phase,
              command: `Starting ${data.tool}...`,
              output: data.message || `Running ${data.tool}`,
              status: 'running',
              tool: data.tool,
            });
            break;

          case 'progress':
            updateScan(scanId, { progress: data.progress });
            break;

          case 'phase_completed':
            setResults(prev => prev.map(r => {
              if (r.id !== scanId) return r;
              const commands = r.commands.map(c =>
                c.status === 'running'
                  ? { ...c, status: 'success' as const, output: data.summary || '' }
                  : c
              );
              return { ...r, commands, progress: data.progress || r.progress };
            }));

            addCommand(scanId, {
              id: uuidv4(),
              stage: data.phase,
              command: `Completed ${data.tool}`,
              output: data.summary  || 'Done',
              rawOutput: data.output || '',
              summary: data.summary  || 'Done',
              tool: data.tool        || '',
              status: 'success',
            });

            updateScan(scanId, { progress: data.progress || 50 });
            break;

          case 'scan_completed':
            updateScan(scanId, {
              status: 'completed',
              progress: 100,
              currentStage: 'Completed',
              aiAnalysis:  data.analysis      || '',
              toolsCalled: data.tools_called  || [],
              pdfUrl:      data.pdf_url       || undefined,
              pdfFilename: data.pdf_filename  || undefined,
            });
            setScanning(false);
            eventSource.close();
            eventSourceRef.current = null;
            break;

          case 'error':
            console.error('❌ Scan error:', data.error);
            addCommand(scanId, {
              id: uuidv4(),
              stage: data.tool || 'Error',
              command: `Error in ${data.tool || 'scan'}`,
              output: data.error || 'Unknown error',
              status: 'error',
              tool: data.tool,
            });
            updateScan(scanId, {
              status: 'error',
              currentStage: 'Error',
            });
            setScanning(false);
            eventSource.close();
            eventSourceRef.current = null;
            break;

          default:
            console.log('Unknown SSE type:', data.type);
        }
      } catch (err) {
        console.error('SSE parse error:', err, event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Browser auto-reconnects on transient errors — don't close here
    };
  };

  // FIX: cleanup SSE on unmount only
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // ── Launch scan ───────────────────────────────────────
  const handleStartScan = async (target: string, scanType: string) => {
    if (scanning) return;

    const scanId = uuidv4();
    stopRequested.current = false;

    const newScan: ScanResult = {
      id: scanId,
      target,
      scanType,
      status: 'scanning',
      progress: 0,
      currentStage: 'Initializing',
      startTime: new Date().toISOString(),
      commands: [],
      toolsCalled: [],
    };

    setResults(prev => [newScan, ...prev]);
    setActiveScanId(scanId);
    setScanning(true);
    setPage('Dashboard');

    const agentCmdId = uuidv4();
    addCommand(scanId, {
      id: agentCmdId,
      stage: 'Agent',
      command: `AI Agent starting autonomous scan of ${target}...`,
      output: 'Model is deciding which tools to run...',
      status: 'running',
      tool: 'agent',
    });

    try {
      // FIX: POST first, then open SSE — avoids "no queue" race condition
      const response = await fetch(
        `${API_BASE}/api/agent/run/${scanId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, scan_type: scanType }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      // FIX: open SSE only after POST is confirmed
      openSSEStream(scanId);

      const data = await response.json();
      updateCommand(scanId, agentCmdId, {
        output: `Agent started. Tools planned: ${data.tools_called?.join(', ') || 'pending...'}`,
        status: 'success',
      });

    } catch (err) {
      console.error('Scan launch error:', err);
      updateCommand(scanId, agentCmdId, {
        output: `Launch error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        status: 'error',
      });
      updateScan(scanId, { status: 'error', currentStage: 'Error' });
      setScanning(false);
    }
  };

  // ── Page router ───────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'Dashboard':
        return (
          <DashboardPage
            activeScan={activeScan}
            onNavigate={setPage}
            onStop={handleStopScan}
            scanning={scanning}
          />
        );
      case 'New Scan':
        return (
          <NewScanPage
            onStart={handleStartScan}
            scanning={scanning}
            activeScan={activeScan}
            onStop={handleStopScan}
          />
        );
      case 'Scan History':
        return <ScanHistoryPage scans={results} />;
      case 'Vulnerabilities':
        return <VulnerabilitiesPage scans={results} />;
      case 'Reports':
        return <ReportsPage scans={results} />;
      case 'AI Assistant':
        return <ChatbotPage />;
      case 'Help & Docs':
        return <HelpDocsPage />;
      default:
        return (
          <DashboardPage
            activeScan={activeScan}
            onNavigate={setPage}
          />
        );
    }
  };

  // ── AUTH GATE ─────────────────────────────────────────
  // Show spinner while Firebase checks saved session
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080d16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(204,26,46,0.3)', borderTopColor: '#cc1a2e', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  // Show login if not authenticated
  if (!firebaseUser) {
    return <LoginPage onLogin={() => {}} />;
  }

  // ── Layout ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar selected={page} onSelect={setPage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header + user pill + logout */}
        <div style={{ position: 'relative' }}>
          <Header scanning={scanning} totalScans={results.length} currentPage={page} />
          <div style={{ position: 'absolute', top: '50%', right: 20, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(204,26,46,0.08)', border: '1px solid rgba(204,26,46,0.18)', borderRadius: 20, padding: '4px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#cc1a2e', boxShadow: '0 0 6px rgba(204,26,46,0.6)' }} />
              <span style={{ fontSize: '0.65em', color: '#c0a0a8', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>
                {firebaseUser.email}
              </span>
            </div>
            <button
              onClick={() => signOut(auth)}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 12px', fontSize: '0.62em', color: '#3a5070', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: '"JetBrains Mono", monospace' }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = 'rgba(204,26,46,0.4)'; (e.currentTarget).style.color = '#cc1a2e'; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget).style.color = '#3a5070'; }}
            >
              LOGOUT
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* ── Main content area ── */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: C.bg,
          }}>
            {renderPage()}
          </div>

          {/* ── Terminal panel ── */}
          <div style={{
            width: 320,
            borderLeft: `1px solid ${C.borderDark}`,
            background: C.bgDark,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <CommandLog
              commands={activeScan?.commands || []}
              target={activeScan?.target}
              scanning={scanning}
              onStop={handleStopScan}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;