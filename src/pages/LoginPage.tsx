// src/pages/LoginPage.tsx

import React, { useState, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo.png';

interface Props {
  onLogin: () => void;
}

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const emailRef = useRef<HTMLDivElement>(null);
  const passRef  = useRef<HTMLDivElement>(null);

  const focus = (r: React.RefObject<HTMLDivElement>) => {
    if (r.current) { r.current.style.borderColor = '#cc1a2e'; r.current.style.boxShadow = '0 0 0 3px rgba(204,26,46,0.12)'; }
  };
  const blur = (r: React.RefObject<HTMLDivElement>) => {
    if (r.current) { r.current.style.borderColor = 'rgba(255,255,255,0.1)'; r.current.style.boxShadow = 'none'; }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onLogin();
    } catch (err: any) {
      const c = err?.code || '';
      if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential','auth/invalid-email'].includes(c))
        setError('Invalid email or password.');
      else if (c === 'auth/too-many-requests') setError('Too many attempts. Please wait.');
      else if (c === 'auth/network-request-failed') setError('Network error. Check connection.');
      else setError('Authentication failed. Try again.');
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* ══════════ ANIMATED BACKGROUND ══════════ */}
      {/* Deep space gradient */}
      <div style={s.bgBase} />

      {/* Large radial glows */}
      <div style={s.glow1} />
      <div style={s.glow2} />
      <div style={s.glow3} />

      {/* Animated grid */}
      <div style={s.grid} />

      {/* Scanning horizontal line */}
      <div style={s.scanLine} />

      {/* Floating hexagon shapes */}
      <svg style={s.hexBg} viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Large background hexagons */}
        <polygon points="150,80 230,40 310,80 310,160 230,200 150,160" stroke="rgba(204,26,46,0.08)" strokeWidth="1" fill="rgba(204,26,46,0.02)"/>
        <polygon points="900,100 980,60 1060,100 1060,180 980,220 900,180" stroke="rgba(204,26,46,0.06)" strokeWidth="1" fill="none"/>
        <polygon points="50,400 130,360 210,400 210,480 130,520 50,480" stroke="rgba(204,26,46,0.05)" strokeWidth="1" fill="none"/>
        <polygon points="1000,500 1080,460 1160,500 1160,580 1080,620 1000,580" stroke="rgba(204,26,46,0.07)" strokeWidth="1" fill="rgba(204,26,46,0.015)"/>
        <polygon points="400,650 480,610 560,650 560,730 480,770 400,730" stroke="rgba(204,26,46,0.06)" strokeWidth="1" fill="none"/>
        {/* Small accent dots */}
        <circle cx="230" cy="120" r="3" fill="rgba(204,26,46,0.25)"/>
        <circle cx="980" cy="140" r="2" fill="rgba(204,26,46,0.2)"/>
        <circle cx="130" cy="440" r="2" fill="rgba(204,26,46,0.15)"/>
        <circle cx="1080" cy="540" r="3" fill="rgba(204,26,46,0.2)"/>
        <circle cx="480" cy="690" r="2" fill="rgba(204,26,46,0.18)"/>
        {/* Circuit-like lines */}
        <path d="M 0 200 L 80 200 L 80 300 L 160 300" stroke="rgba(204,26,46,0.06)" strokeWidth="1" strokeDasharray="4 6"/>
        <path d="M 1200 350 L 1100 350 L 1100 450 L 1000 450" stroke="rgba(204,26,46,0.05)" strokeWidth="1" strokeDasharray="4 6"/>
        <path d="M 300 0 L 300 80 L 400 80 L 400 160" stroke="rgba(204,26,46,0.04)" strokeWidth="1" strokeDasharray="4 6"/>
        <path d="M 800 800 L 800 700 L 900 700 L 900 620" stroke="rgba(204,26,46,0.05)" strokeWidth="1" strokeDasharray="4 6"/>
        {/* Crosshair / targeting element */}
        <circle cx="600" cy="400" r="180" stroke="rgba(204,26,46,0.03)" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" stroke="rgba(204,26,46,0.02)" strokeWidth="1" strokeDasharray="8 16"/>
        <line x1="420" y1="400" x2="780" y2="400" stroke="rgba(204,26,46,0.04)" strokeWidth="1"/>
        <line x1="600" y1="220" x2="600" y2="580" stroke="rgba(204,26,46,0.04)" strokeWidth="1"/>
      </svg>

      {/* Top accent bar */}
      <div style={s.topAccent} />

      {/* ══════════ CONTENT LAYOUT ══════════ */}
      <div style={s.layout}>

        {/* ─── LEFT BRAND PANEL ─── */}
        <div style={s.leftPanel}>

          {/* Logo with rings */}
          <div style={s.logoWrap}>
            <div style={s.ring3} />
            <div style={s.ring2} />
            <div style={s.ring1} />
            <img src={logo} alt="OffSec LLM" style={s.logoImg}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Brand name */}
          <div style={s.brandName}>OFFSEC<span style={s.brandAccent}> LLM</span></div>
          <div style={s.brandTagline}>Automated AI Red Team Platform</div>

          {/* Divider */}
          <div style={s.brandDivider} />

          {/* Feature pills */}
          <div style={s.features}>
            {[
              { icon: '⬡', text: 'Autonomous Pentesting'     },
              { icon: '⬡', text: 'AI Exploit Generation'     },
              { icon: '⬡', text: 'Real-time Vuln Scanning'   },
              { icon: '⬡', text: 'Comprehensive Reporting'   },
            ].map((f, i) => (
              <div key={i} style={s.featureRow}>
                <div style={s.featureDot} />
                <span style={s.featureText}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div style={s.statusBadge}>
            <div style={s.statusDot} />
            <span>System Online</span>
            <div style={s.statusSep} />
            <span style={{ opacity: 0.6 }}>v1.0.0</span>
          </div>

        </div>

        {/* ─── RIGHT FORM PANEL ─── */}
        <div style={s.rightPanel}>
          <div style={s.card}>

            {/* Card top crimson glow line */}
            <div style={s.cardGlow} />

            {/* Card header */}
            <div style={s.cardHeader}>
              <img src={logo} alt="" style={s.cardLogo}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <div style={s.cardTitle}>Welcome back</div>
                <div style={s.cardSub}>Sign in to your operator account</div>
              </div>
            </div>

            {/* Section label */}
            <div style={s.sectionRow}>
              <div style={s.sectionLine} />
              <span style={s.sectionLabel}>CREDENTIALS</span>
              <div style={s.sectionLine} />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} style={s.form}>

              {/* Email */}
              <div style={s.field}>
                <label style={s.label}>EMAIL ADDRESS</label>
                <div ref={emailRef} style={s.inputBox}>
                  <svg style={s.inputIcon} viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M2 13.5c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <input type="email" value={email} required autoFocus autoComplete="email"
                    placeholder="operator@domain.com"
                    style={s.input}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onFocus={() => focus(emailRef)}
                    onBlur={()  => blur(emailRef)}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={s.field}>
                <label style={s.label}>PASSWORD</label>
                <div ref={passRef} style={s.inputBox}>
                  <svg style={s.inputIcon} viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="7" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <input type={showPass ? 'text' : 'password'} value={password} required
                    autoComplete="current-password" placeholder="••••••••"
                    style={{ ...s.input, paddingRight: 40 }}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={() => focus(passRef)}
                    onBlur={()  => blur(passRef)}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)} style={s.eyeBtn}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 7.5s2.5-4.5 6-4.5 6 4.5 6 4.5-2.5 4.5-6 4.5-6-4.5-6-4.5z" stroke="currentColor" strokeWidth="1.1"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.1"/><line x1="2" y1="2" x2="13" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1.5 7.5s2.5-4.5 6-4.5 6 4.5 6 4.5-2.5 4.5-6 4.5-6-4.5-6-4.5z" stroke="currentColor" strokeWidth="1.1"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.1"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={s.error}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.2"/>
                    <path d="M7 4v3.5M7 9.5v.5" stroke="#f87171" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Button */}
              <button type="submit"
                disabled={loading || !email.trim() || !password}
                style={{
                  ...s.btn,
                  opacity: (loading || !email.trim() || !password) ? 0.5 : 1,
                  cursor:  (loading || !email.trim() || !password) ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <><span style={s.spinner} /> Authenticating...</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <rect x="2" y="7" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Access System
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto' }}>
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>

            </form>

            {/* Footer notice */}
            <div style={s.notice}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                <path d="M5 1L9 3v3C9 8.2 7.2 9.8 5 10 2.8 9.8 1 8.2 1 6V3L5 1z" stroke="rgba(204,26,46,0.4)" strokeWidth="0.8"/>
              </svg>
              Secured by Firebase · Sessions are encrypted and monitored
            </div>

          </div>

          <div style={s.versionTag}>OffSec LLM v1.0 · Offense for Defense · JJ Security Society</div>
        </div>
      </div>

      <style>{`
        @keyframes spin        { to{ transform:rotate(360deg); } }
        @keyframes scanMove    { 0%{ top:-2px; } 100%{ top:100%; } }
        @keyframes ring1Rotate { to{ transform:rotate(360deg); } }
        @keyframes ring2Rotate { to{ transform:rotate(-360deg); } }
        @keyframes glow1Drift  { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(40px,-30px) scale(1.1); } }
        @keyframes glow2Drift  { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(-30px,40px) scale(1.08); } }
        @keyframes glow3Drift  { 0%,100%{ transform:translate(0,0); } 50%{ transform:translate(20px,20px); } }
        @keyframes dotPulse    { 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:0.4; transform:scale(0.7); } }
        @keyframes fadeUp      { from{ opacity:0; transform:translateY(20px); } to{ opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {

  page: {
    minHeight:   '100vh',
    display:     'flex',
    flexDirection: 'column',
    position:    'relative',
    overflow:    'hidden',
    fontFamily:  '"Inter","Segoe UI",sans-serif',
  },

  // ── Background layers ──
  bgBase: {
    position:   'absolute', inset: 0, zIndex: 0,
    background: 'linear-gradient(135deg, #02060f 0%, #060c1a 30%, #0a0614 60%, #060c1a 100%)',
  },
  glow1: {
    position:      'absolute', zIndex: 1,
    width:          700, height: 700,
    borderRadius:  '50%',
    background:    'radial-gradient(circle, rgba(204,26,46,0.12) 0%, rgba(204,26,46,0.04) 40%, transparent 70%)',
    top: -200, left: -200,
    animation:     'glow1Drift 10s ease-in-out infinite',
    pointerEvents: 'none',
  },
  glow2: {
    position:      'absolute', zIndex: 1,
    width:          600, height: 600,
    borderRadius:  '50%',
    background:    'radial-gradient(circle, rgba(0,80,180,0.08) 0%, transparent 70%)',
    bottom: -150, right: -150,
    animation:     'glow2Drift 14s ease-in-out infinite',
    pointerEvents: 'none',
  },
  glow3: {
    position:      'absolute', zIndex: 1,
    width:          400, height: 400,
    borderRadius:  '50%',
    background:    'radial-gradient(circle, rgba(204,26,46,0.06) 0%, transparent 70%)',
    top: '40%', left: '40%',
    transform:     'translate(-50%,-50%)',
    animation:     'glow3Drift 18s ease-in-out infinite',
    pointerEvents: 'none',
  },
  grid: {
    position:   'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(rgba(204,26,46,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(204,26,46,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '50px 50px',
  },
  scanLine: {
    position:   'absolute', left: 0, right: 0, zIndex: 3,
    height:     2, pointerEvents: 'none',
    background: 'linear-gradient(90deg, transparent, rgba(204,26,46,0.3), rgba(204,26,46,0.6), rgba(204,26,46,0.3), transparent)',
    boxShadow:  '0 0 20px rgba(204,26,46,0.3)',
    animation:  'scanMove 6s linear infinite',
    top:        0,
  },
  hexBg: {
    position:   'absolute', inset: 0, zIndex: 2,
    width: '100%', height: '100%',
    pointerEvents: 'none',
  },
  topAccent: {
    position:   'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    height:     3,
    background: 'linear-gradient(90deg, transparent 0%, #cc1a2e 20%, #ff6060 50%, #cc1a2e 80%, transparent 100%)',
    boxShadow:  '0 0 20px rgba(204,26,46,0.5)',
  },

  // ── Layout ──
  layout: {
    position:       'relative', zIndex: 10,
    display:        'flex',
    minHeight:      '100vh',
    flex:           1,
  },

  // ── Left Panel ──
  leftPanel: {
    flex:           '0 0 45%',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '60px 48px',
    borderRight:    '1px solid rgba(204,26,46,0.1)',
    background:     'linear-gradient(160deg, rgba(204,26,46,0.04) 0%, transparent 50%)',
    animation:      'fadeUp 0.7s ease both',
  },

  logoWrap: {
    position:   'relative',
    width:       140, height: 140,
    display:    'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  ring1: {
    position:     'absolute', inset: -10, borderRadius: '50%',
    border:       '1.5px solid rgba(204,26,46,0.4)',
    borderTopColor: 'rgba(204,26,46,0.9)',
    animation:    'ring1Rotate 5s linear infinite',
  },
  ring2: {
    position:     'absolute', inset: -22, borderRadius: '50%',
    border:       '1px dashed rgba(204,26,46,0.2)',
    animation:    'ring2Rotate 12s linear infinite',
  },
  ring3: {
    position:     'absolute', inset: -36, borderRadius: '50%',
    border:       '1px solid rgba(204,26,46,0.07)',
  },
  logoImg: {
    width:        130, height: 130, borderRadius: '50%',
    objectFit:    'cover', display: 'block',
    border:       '3px solid rgba(204,26,46,0.5)',
    boxShadow:    '0 0 50px rgba(204,26,46,0.3), 0 0 100px rgba(204,26,46,0.1), 0 8px 32px rgba(0,0,0,0.7)',
  },

  brandName: {
    fontSize:      36, fontWeight: 800,
    color:         '#fff',
    letterSpacing: '0.15em',
    marginBottom:  8,
    fontFamily:    '"JetBrains Mono","Fira Code",monospace',
    textShadow:    '0 0 40px rgba(204,26,46,0.3)',
  },
  brandAccent: { color: '#cc1a2e' },
  brandTagline: {
    fontSize:      13, color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.08em', marginBottom: 36,
  },
  brandDivider: {
    width: 60, height: 2, marginBottom: 28,
    background: 'linear-gradient(90deg, transparent, #cc1a2e, transparent)',
    borderRadius: 2,
  },

  features: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40, width: '100%', maxWidth: 280 },
  featureRow: { display: 'flex', alignItems: 'center', gap: 12 },
  featureDot: {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    background: '#cc1a2e', boxShadow: '0 0 8px rgba(204,26,46,0.6)',
  },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' },

  statusBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(16,185,129,0.07)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 20, padding: '7px 16px',
    fontSize: 12, color: 'rgba(16,185,129,0.8)',
    letterSpacing: '0.06em',
  },
  statusDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.7)',
    animation: 'dotPulse 2s ease-in-out infinite',
  },
  statusSep: { width: 1, height: 12, background: 'rgba(16,185,129,0.3)' },

  // ── Right Panel ──
  rightPanel: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 32px',
    animation:      'fadeUp 0.7s 0.15s ease both',
  },

  card: {
    width: '100%', maxWidth: 430,
    background:     'linear-gradient(160deg, rgba(12,20,38,0.97) 0%, rgba(8,12,22,0.99) 100%)',
    border:         '1px solid rgba(255,255,255,0.07)',
    borderRadius:   20, padding: '36px 32px',
    position:       'relative', overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    boxShadow:      '0 0 0 1px rgba(204,26,46,0.05), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(204,26,46,0.04)',
  },
  cardGlow: {
    position: 'absolute', top: 0, left: '5%', right: '5%', height: 2,
    background: 'linear-gradient(90deg, transparent, #cc1a2e 30%, #ff8080 50%, #cc1a2e 70%, transparent)',
    boxShadow:  '0 0 16px rgba(204,26,46,0.5)',
    borderRadius: '0 0 8px 8px',
  },

  cardHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  cardLogo: {
    width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0,
    border: '1px solid rgba(204,26,46,0.35)',
    boxShadow: '0 0 16px rgba(204,26,46,0.2)',
  },
  cardTitle:   { fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.01em' },
  cardSub:     { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 3 },

  sectionRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 },
  sectionLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: 'rgba(204,26,46,0.55)',
    letterSpacing: '0.16em', fontFamily: '"JetBrains Mono",monospace',
  },

  form:  { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: {
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
    letterSpacing: '0.14em', fontFamily: '"JetBrains Mono",monospace',
  },
  inputBox: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(4,8,18,0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '0 14px',
    transition: 'border-color 0.2s, box-shadow 0.2s', position: 'relative',
  } as React.CSSProperties,
  inputIcon: { width: 14, height: 14, color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginRight: 10 },
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#e2e8f0', fontSize: 14, padding: '13px 0', fontFamily: 'inherit',
  } as React.CSSProperties,
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)',
    cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
  },

  error: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171',
  },

  btn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, #cc1a2e 0%, #9e1424 100%)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '14px 20px', fontSize: 14, fontWeight: 600,
    letterSpacing: '0.03em', transition: 'opacity 0.15s, transform 0.15s',
    fontFamily: 'inherit', marginTop: 4,
    boxShadow: '0 4px 20px rgba(204,26,46,0.3)',
  },
  spinner: {
    width: 14, height: 14, flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },

  notice: {
    display: 'flex', alignItems: 'center', gap: 7, marginTop: 20,
    fontSize: 11, color: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', letterSpacing: '0.02em',
  },

  versionTag: {
    marginTop: 16, fontSize: 11,
    color: 'rgba(255,255,255,0.1)', letterSpacing: '0.04em',
    fontFamily: '"JetBrains Mono",monospace', textAlign: 'center' as const,
  },
};