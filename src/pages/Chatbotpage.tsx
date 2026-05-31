// src/pages/ChatbotPage.tsx
// OffSec LLM — AI Security Assistant
// Streaming chat UI with syntax-highlighted code blocks, matching the
// existing navy/crimson theme from theme.ts

import React, { useState, useRef, useEffect } from 'react';
import { C } from '../theme';
import { auth } from '../firebase';
import logo from '../assets/logo.png';

const API_BASE = 'http://localhost:9000';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  loading?: boolean;
}

// ── Suggested prompts shown on empty state ────────────────────────────────────
const SUGGESTIONS = [
  { label: 'SQL Injection payloads',     prompt: 'Write me a list of SQL injection payloads for bypassing login forms, including blind SQLi and error-based techniques.' },
  { label: 'XSS exploit examples',       prompt: 'Show me XSS payload examples including stored, reflected, and DOM-based. Include payloads that bypass common WAFs.' },
  { label: 'Reverse shell one-liners',   prompt: 'Give me reverse shell one-liners for bash, Python, PHP, and PowerShell.' },
  { label: 'Nmap scan cheatsheet',       prompt: 'Give me a complete Nmap scanning cheatsheet with examples for service detection, OS fingerprinting, and stealth scans.' },
  { label: 'SSRF exploitation guide',    prompt: 'Explain SSRF vulnerabilities with real-world exploit examples and payloads to access internal services.' },
  { label: 'Metasploit module example',  prompt: 'Write a basic Metasploit auxiliary module in Ruby for banner grabbing on port 80.' },
];

// ── Markdown-like renderer — handles code blocks and inline code ──────────────
const renderContent = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  // Split on ```lang\n...\n``` blocks
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before this code block
    if (match.index > last) {
      parts.push(
        <span key={`t-${last}`} style={{ whiteSpace: 'pre-wrap' }}>
          {renderInline(text.slice(last, match.index))}
        </span>
      );
    }
    // Code block
    const lang = match[1] || 'text';
    const code = match[2].trim();
    parts.push(
      <div key={`cb-${match.index}`} style={s.codeBlock}>
        <div style={s.codeHeader}>
          <span style={s.codeLang}>{lang}</span>
          <button
            style={s.copyBtn}
            onClick={() => navigator.clipboard.writeText(code)}
          >
            Copy
          </button>
        </div>
        <pre style={s.codePre}><code>{code}</code></pre>
      </div>
    );
    last = match.index + match[0].length;
  }

  // Remaining text
  if (last < text.length) {
    parts.push(
      <span key={`t-end`} style={{ whiteSpace: 'pre-wrap' }}>
        {renderInline(text.slice(last))}
      </span>
    );
  }

  return parts;
};

// Render inline `code` spans
const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const inlineRegex = /`([^`]+)`/g;
  let last = 0;
  let match;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<code key={match.index} style={s.inlineCode}>{match[1]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

// ── Component ─────────────────────────────────────────────────────────────────
export const ChatbotPage: React.FC = () => {
  // Each user gets their own isolated chat history key
  const userUid = auth.currentUser?.uid || 'guest';
  const STORAGE_KEY = `offsec_chat_${userUid}`;

  // ── Load from localStorage on mount (persists across tab switches) ──
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const readerRef   = useRef<ReadableStreamDefaultReader | null>(null);

  // ── Save to localStorage whenever messages change ──────────
  useEffect(() => {
    try {
      const toSave = messages.filter(m => !m.loading);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage full — fail silently
    }
  }, [messages]);

  // ── Auto-scroll to bottom ──────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uid = () => Math.random().toString(36).slice(2);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput('');

    const userMsg: Message = { id: uid(), role: 'user', content };
    const asstId = uid();
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setStreaming(true);

    // Build history for API (exclude the empty loading message)
    const history = [...messages, userMsg].map(m => ({
      role:    m.role,
      content: m.content,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.done) break;
            if (parsed.token) {
              accumulated += parsed.token;
              setMessages(prev => prev.map(m =>
                m.id === asstId
                  ? { ...m, content: accumulated, loading: false }
                  : m
              ));
            }
          } catch {
            // partial JSON chunk — skip
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: `Connection error: ${err instanceof Error ? err.message : 'Unknown'}`, loading: false }
          : m
      ));
    } finally {
      readerRef.current = null;
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (streaming) {
      readerRef.current?.cancel();
      setStreaming(false);
    }
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>
            <img src={logo} alt="" style={s.cardLogo}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
          </div>
          <div>
            <div style={s.headerTitle}>OffSec Assistant</div>
            <div style={s.headerSub}>AI-powered exploit &amp; payload assistant</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={s.clearBtn}>
            Clear chat
          </button>
        )}
      </div>

      {/* ── Messages area ── */}
      <div style={s.messageArea}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>
              <img src={logo} alt="" style={s.cardLogo}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={s.emptyTitle}>Ask anything about offensive security</div>
            <div style={s.emptySub}>Payloads · Exploits · CVEs · Recon · Post-exploitation</div>

            <div style={s.suggestions}>
              {SUGGESTIONS.map(s_ => (
                <button
                  key={s_.label}
                  style={s.suggestionBtn}
                  onClick={() => sendMessage(s_.prompt)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.crimson)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.borderDark)}
                >
                  {s_.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map(msg => (
          <div key={msg.id} style={{ ...s.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

            {/* Assistant avatar */}
            {msg.role === 'assistant' && (
              <div style={s.avatar}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polygon points="7,1 13,4 13,10 7,13 1,10 1,4" stroke={C.crimson} strokeWidth="1" fill="none"/>
                  <circle cx="7" cy="7" r="2" fill={C.crimson}/>
                </svg>
              </div>
            )}

            <div style={{
              ...s.bubble,
              ...(msg.role === 'user' ? s.bubbleUser : s.bubbleAsst),
              maxWidth: msg.role === 'assistant' ? '85%' : '70%',
            }}>
              {msg.loading ? (
                <div style={s.typing}>
                  <span style={{ ...s.dot, animationDelay: '0ms' }} />
                  <span style={{ ...s.dot, animationDelay: '160ms' }} />
                  <span style={{ ...s.dot, animationDelay: '320ms' }} />
                </div>
              ) : (
                <div style={s.msgContent}>
                  {msg.role === 'assistant'
                    ? renderContent(msg.content)
                    : msg.content
                  }
                </div>
              )}
            </div>

            {/* User avatar */}
            {msg.role === 'user' && (
              <div style={{ ...s.avatar, background: C.bgDark, marginLeft: 8, marginRight: 0 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="4" r="2.5" stroke={C.cyan} strokeWidth="1"/>
                  <path d="M1 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke={C.cyan} strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div style={s.inputArea}>
        <div style={s.inputWrapper}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about exploits, payloads, CVEs, recon techniques..."
            rows={1}
            style={s.textarea}
            disabled={streaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            style={{
              ...s.sendBtn,
              ...((!input.trim() || streaming) ? s.sendBtnDisabled : {}),
            }}
          >
            {streaming ? (
              <span style={s.sendSpinner} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 8M14 8L9 3M14 8L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        <div style={s.inputHint}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      {/* Typing animation keyframes injected once */}
      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100%',
    background:    C.bgCard,
    borderRadius:  12,
    border:        `1px solid ${C.border}`,
    overflow:      'hidden',
  },

  // Header
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '16px 20px',
    borderBottom:   `1px solid ${C.border}`,
    background:     C.bgCard,
    flexShrink:     0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 36, height: 36,
    background:   C.crimsonLight,
    border:       `1px solid ${C.crimson}30`,
    borderRadius: 8,
    display:      'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: 600, color: C.textPrimary },
  headerSub:   { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  clearBtn: {
    background:   'transparent',
    border:       `1px solid ${C.border}`,
    borderRadius: 6,
    padding:      '5px 12px',
    fontSize:     12,
    color:        C.textSecondary,
    cursor:       'pointer',
  },

  // Messages
  messageArea: {
    flex:      1,
    overflowY: 'auto',
    padding:   '20px',
    display:   'flex',
    flexDirection: 'column',
    gap:       16,
  },

  // Empty state
  emptyState: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 20px',
    gap:            12,
  },
  emptyIcon:  { marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: C.textPrimary, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: C.textSecondary, textAlign: 'center' },
  suggestions: {
    display:        'flex',
    flexWrap:       'wrap',
    gap:            8,
    justifyContent: 'center',
    marginTop:      16,
    maxWidth:       600,
  },
  suggestionBtn: {
    background:   C.bgCard,
    border:       `1px solid ${C.borderDark}`,
    borderRadius: 20,
    padding:      '7px 14px',
    fontSize:     12,
    color:        C.textSecondary,
    cursor:       'pointer',
    transition:   'border-color 0.15s',
    fontFamily:   'inherit',
  },
  cardLogo: {
    width: 50, height: 50, borderRadius: 12, objectFit: 'cover', flexShrink: 0,
    border: '1px solid rgba(204,26,46,0.35)',
    boxShadow: '0 0 16px rgba(204,26,46,0.2)',
  },

  // Message rows
  msgRow:   { display: 'flex', alignItems: 'flex-end', gap: 8 },
  avatar: {
    width:          28,
    height:         28,
    borderRadius:   '50%',
    background:     C.crimsonLight,
    border:         `1px solid ${C.crimson}30`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    marginRight:    8,
  },
  bubble: {
    padding:      '12px 16px',
    borderRadius: 12,
    fontSize:     13.5,
    lineHeight:   1.65,
  },
  bubbleUser: {
    background: C.bgDark,
    color:      '#c9d8f0',
    borderBottomRightRadius: 4,
  },
  bubbleAsst: {
    background:            C.bgCard,
    color:                 C.textPrimary,
    border:                `1px solid ${C.border}`,
    borderBottomLeftRadius: 4,
  },
  msgContent: { wordBreak: 'break-word' },

  // Typing dots
  typing: { display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' },
  dot: {
    width:           7,
    height:          7,
    borderRadius:    '50%',
    background:      C.crimson,
    display:         'inline-block',
    animation:       'blink 1.2s infinite ease-in-out',
  } as React.CSSProperties,

  // Code blocks
  codeBlock: {
    background:   '#0f1f3d',
    border:       `1px solid ${C.borderDark}`,
    borderRadius: 8,
    overflow:     'hidden',
    margin:       '8px 0',
  },
  codeHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '6px 12px',
    borderBottom:   `1px solid ${C.borderDark}`,
    background:     '#0a1628',
  },
  codeLang: {
    fontSize:    11,
    color:       C.cyan,
    fontFamily:  "'JetBrains Mono', 'Fira Code', monospace",
    fontWeight:  600,
    letterSpacing: '0.06em',
  },
  copyBtn: {
    background:   'transparent',
    border:       `1px solid ${C.borderDark}`,
    borderRadius: 4,
    padding:      '2px 8px',
    fontSize:     11,
    color:        C.textDim,
    cursor:       'pointer',
    fontFamily:   'inherit',
  },
  codePre: {
    margin:     0,
    padding:    '14px 16px',
    overflowX:  'auto',
    fontSize:   12.5,
    lineHeight: 1.7,
    color:      '#c9d8f0',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    whiteSpace: 'pre',
  },
  inlineCode: {
    background:   '#0f1f3d',
    border:       `1px solid ${C.borderDark}`,
    borderRadius: 4,
    padding:      '1px 5px',
    fontSize:     '0.88em',
    color:        C.cyan,
    fontFamily:   "'JetBrains Mono', 'Fira Code', monospace",
  },

  // Input
  inputArea: {
    padding:      '12px 20px 16px',
    borderTop:    `1px solid ${C.border}`,
    background:   C.bgCard,
    flexShrink:   0,
  },
  inputWrapper: {
    display:      'flex',
    alignItems:   'flex-end',
    gap:          8,
    background:   '#0a1428',
    border:       `1px solid ${C.borderDark}`,
    borderRadius: 10,
    padding:      '8px 8px 8px 14px',
  },
  textarea: {
    flex:       1,
    background: 'transparent',
    border:     'none',
    outline:    'none',
    color:      '#c9d8f0',
    fontSize:   13.5,
    lineHeight: 1.5,
    resize:     'none',
    fontFamily: 'inherit',
    maxHeight:  160,
    overflowY:  'auto',
  } as React.CSSProperties,
  sendBtn: {
    width:          36,
    height:         36,
    borderRadius:   8,
    background:     C.crimson,
    border:         'none',
    color:          '#fff',
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    transition:     'background 0.15s',
  },
  sendBtnDisabled: {
    background: '#9f1239',
    cursor:     'not-allowed',
    opacity:    0.5,
  },
  sendSpinner: {
    width:          16,
    height:         16,
    border:         '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius:   '50%',
    animation:      'spin 0.7s linear infinite',
    display:        'inline-block',
  },
  inputHint: {
    fontSize:   11,
    color:      C.textDim,
    marginTop:  6,
    paddingLeft: 2,
  },
};