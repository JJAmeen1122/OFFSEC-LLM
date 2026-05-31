// HelpDocsPage.tsx – Single column, big logo, no sidebars
import React from 'react';
import { C } from '../theme';
import logo from '../assets/logo.png';

interface Props {
  onNavigate?: (page: string) => void;
}

export const HelpDocsPage: React.FC<Props> = () => {
  return (
    <div style={s.container}>
      {/* Big logo at top center */}
      <div style={s.logoWrapper}>
        <div style={s.logoBox}>
          <img src={logo} alt="OffSec Logo" style={s.logoImg} />
        </div>
        <h1 style={s.title}>OffSec Dashboard</h1>
        <p style={s.tagline}>AI‑powered penetration testing – simple, fast, professional</p>
      </div>

      {/* About Us */}
      <section style={s.section}>
        <h2 style={s.h2}>About Us</h2>
        <p style={s.text}>
          OffSec Dashboard is built by security researchers and AI engineers to automate 
          the tedious parts of penetration testing. We combine industry‑standard tools 
          (Nmap, Gobuster, Nuclei, SQLMap, ZAP) with Groq’s LLM to produce human‑readable 
          reports – so you can focus on finding real vulnerabilities.
        </p>
        <p style={s.text}>
          Our mission is to make professional security assessments accessible, fast, 
          and responsible. All scans are ephemeral, and we never store your data.
        </p>
      </section>

      {/* How to use tools */}
      <section style={s.section}>
        <h2 style={s.h2}>How to use the tools</h2>
        <div style={s.steps}>
          <div style={s.step}>
            <div style={s.stepNumber}>1</div>
            <div style={s.stepContent}>
              <strong>Go to "New Scan"</strong> – enter a target (domain or IP address).
            </div>
          </div>
          <div style={s.step}>
            <div style={s.stepNumber}>2</div>
            <div style={s.stepContent}>
              <strong>Choose scan type</strong> – Quick (fast), Full (balanced), Stealth (slow, quiet), Deep (all ports).
            </div>
          </div>
          <div style={s.step}>
            <div style={s.stepNumber}>3</div>
            <div style={s.stepContent}>
              <strong>Start the scan</strong> – the AI agent will run tools in the correct order.
            </div>
          </div>
          <div style={s.step}>
            <div style={s.stepNumber}>4</div>
            <div style={s.stepContent}>
              <strong>Watch live progress</strong> – the Dashboard shows each phase and command output.
            </div>
          </div>
          <div style={s.step}>
            <div style={s.stepNumber}>5</div>
            <div style={s.stepContent}>
              <strong>Download report</strong> – when finished, you get a full PDF with AI analysis.
            </div>
          </div>
        </div>
      </section>

      {/* 6 FAQs */}
      <section style={s.section}>
        <h2 style={s.h2}>Frequently asked questions</h2>
        <div style={s.faqList}>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>Why does the scan need Docker?</summary>
            <p style={s.faqAnswer}>All security tools run inside Docker containers – no need to install anything on your host, and they are completely isolated.</p>
          </details>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>Can I scan HTTPS websites?</summary>
            <p style={s.faqAnswer}>Yes – the system automatically detects HTTPS ports and uses the correct protocol for every tool.</p>
          </details>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>What if a tool fails or times out?</summary>
            <p style={s.faqAnswer}>The AI agent logs the error and continues with the remaining tools. The final report will include any failures.</p>
          </details>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>How do I get a Groq API key?</summary>
            <p style={s.faqAnswer}>Sign up at console.groq.com, create an API key, and set it as the environment variable <code>GROQ_API_KEY</code> before starting the backend.</p>
          </details>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>Is my scan data stored anywhere?</summary>
            <p style={s.faqAnswer}>No – scans are ephemeral. The only thing saved is the optional PDF report you download.</p>
          </details>
          <details style={s.faqItem}>
            <summary style={s.faqQuestion}>Can I scan localhost or private IPs?</summary>
            <p style={s.faqAnswer}>For safety, the system blocks 127.0.0.1, 10.x.x.x, 172.16‑31.x.x, and 192.168.x.x. Use only public targets you own or have permission to test.</p>
          </details>
        </div>
      </section>

      {/* Footer note */}
      <div style={s.footer}>
        <p>💬 Need more help? Check the GitHub repository or contact our support team.</p>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 24px 80px',
    background: C.bgDark,
    color: C.textPrimary,
  },
  logoWrapper: {
    textAlign: 'center',
    marginBottom: 56,
  },
  logoBox: {
    display: 'inline-block',
    marginBottom: 24,
  },
  logoImg: {
    width: 200,
    height: 200,
    objectFit: 'contain',
    borderRadius: '50%',
    background: C.bgCard,
    padding: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
    color: C.textPrimary,
  },
  tagline: {
    fontSize: '1rem',
    color: C.textSecondary,
    margin: 0,
  },
  section: {
    marginBottom: 56,
  },
  h2: {
    fontSize: '1.8rem',
    fontWeight: 600,
    marginBottom: 24,
    paddingBottom: 8,
    borderBottom: `2px solid ${C.cyan}`,
    display: 'inline-block',
    color: C.textPrimary,
  },
  text: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: C.textSecondary,
    marginBottom: 16,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: C.bgCard,
    padding: '12px 20px',
    borderRadius: 16,
    border: `1px solid ${C.border}`,
  },
  stepNumber: {
    width: 32,
    height: 32,
    background: C.cyan,
    color: '#fff',
    fontWeight: 700,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepContent: {
    fontSize: '0.95rem',
    color: C.textSecondary,
  },
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  faqItem: {
    background: C.bgCard,
    borderRadius: 12,
    padding: '12px 20px',
    border: `1px solid ${C.border}`,
    cursor: 'pointer',
  },
  faqQuestion: {
    fontWeight: 600,
    fontSize: '1rem',
    color: C.textPrimary,
  },
  faqAnswer: {
    marginTop: 12,
    paddingLeft: 8,
    color: C.textSecondary,
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 48,
    paddingTop: 24,
    borderTop: `1px solid ${C.border}`,
    textAlign: 'center',
    fontSize: '0.85rem',
    color: C.textSecondary,
  },
};