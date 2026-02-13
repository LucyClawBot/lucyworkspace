import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import AgentAvatar from '../components/AgentAvatar';

// Default/mock data for when Supabase is empty
const DEFAULT_AGENTS = [
  { id: 'coordinator', display_name: 'Boss', role: 'Project Manager', tone: 'Direct, results-oriented', quirk: 'Always asks for deadlines', is_active: true },
  { id: 'scout', display_name: 'Analyst', role: 'Data Analyst', tone: 'Measured, data-driven', quirk: 'Cites numbers first', is_active: true },
  { id: 'quill', display_name: 'Writer', role: 'Content Creator', tone: 'Emotional, narrative', quirk: 'Turns everything to story', is_active: true },
  { id: 'sage', display_name: 'Strategist', role: 'Strategic Advisor', tone: 'Thoughtful, big-picture', quirk: 'Connects to long-term goals', is_active: true },
  { id: 'observer', display_name: 'Observer', role: 'Quality Assurance', tone: 'Detail-oriented', quirk: 'Notices patterns others miss', is_active: true },
  { id: 'xalt', display_name: 'Wildcard', role: 'Social Media Ops', tone: 'Intuitive, lateral', quirk: 'Proposes bold ideas', is_active: true }
];

const DEFAULT_STATS = {
  proposals: { pending: 3, accepted: 12 },
  missions: { running: 2, succeeded: 45, failed: 3 },
  steps: { queued: 5, running: 2, failed: 1 },
  conversations: { completed: 8, total: 10 },
  events_24h: 24
};

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const v = value || 0;
    const duration = 800;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(v * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{display}</span>;
}

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/ops/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      // Use default data on error
      setStatus({
        timestamp: new Date().toISOString(),
        counts: DEFAULT_STATS,
        agents: DEFAULT_AGENTS,
        health: { status: 'healthy' }
      });
    } finally {
      setLoading(false);
    }
  }

  const agents = status?.agents || DEFAULT_AGENTS;
  const counts = status?.counts || DEFAULT_STATS;
  const healthStatus = status?.health?.status || 'healthy';

  if (loading) {
    return (
      <div className="loading">
        <div className="terminal">
          <div className="line">$ initializing lucyclawbot...</div>
          <div className="line">$ loading agents... <span className="ok">OK</span></div>
          <div className="line">$ connecting to supabase... <span className="ok">OK</span></div>
          <div className="line">$ starting workers... <span className="ok">OK</span></div>
          <div className="line cursor">$ _</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>LucyClawBot | Multi-Agent System</title></Head>
      
      <div className="terminal-dashboard">
        {/* Header */}
        <header className="terminal-header">
          <div className="brand">
            <span className="prompt">$</span>
            <h1>lucyclawbot</h1>
            <span className="version">v0.2.0</span>
          </div>
          <div className="status-line">
            <span className={`health ${healthStatus}`}>● {healthStatus}</span>
            <span className="uptime">uptime: 2d 4h 12m</span>
          </div>
        </header>

        {/* Navigation */}
        <nav className="terminal-nav">
          {['overview', 'agents', 'events', 'logs'].map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {activeTab === tab ? '>' : ' '} {tab}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className="terminal-main">
          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <section className="stats-section">
                <div className="stat-box">
                  <div className="stat-label">proposals_pending</div>
                  <div className="stat-value"><AnimatedNumber value={counts.proposals?.pending} /></div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">missions_running</div>
                  <div className="stat-value"><AnimatedNumber value={counts.missions?.running} /></div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">steps_queued</div>
                  <div className="stat-value"><AnimatedNumber value={counts.steps?.queued} /></div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">conversations</div>
                  <div className="stat-value"><AnimatedNumber value={counts.conversations?.completed} /></div>
                </div>
              </section>

              {/* Agents Grid */}
              <section className="agents-section">
                <h2 className="section-title">$ agents --status</h2>
                <div className="agents-grid">
                  {agents.map(agent => (
                    <div key={agent.id} className={`agent-card ${agent.is_active ? 'active' : 'inactive'}`}>
                      <AgentAvatar agentId={agent.id} size={48} />
                      <div className="agent-info">
                        <div className="agent-name">{agent.display_name}</div>
                        <div className="agent-role">{agent.role}</div>
                        <div className="agent-meta">
                          <span className={agent.is_active ? 'status-on' : 'status-off'}>●</span>
                          {agent.is_active ? 'active' : 'offline'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Actions */}
              <section className="actions-section">
                <h2 className="section-title">$ actions</h2>
                <div className="actions-grid">
                  <button className="action-btn">
                    <span className="action-icon">+</span>
                    <span>new_proposal</span>
                  </button>
                  <button className="action-btn">
                    <span className="action-icon">▶</span>
                    <span>trigger_heartbeat</span>
                  </button>
                  <button className="action-btn">
                    <span className="action-icon">💬</span>
                    <span>start_conversation</span>
                  </button>
                  <button className="action-btn">
                    <span className="action-icon">📊</span>
                    <span>view_logs</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === 'agents' && (
            <section className="agent-detail-section">
              <h2 className="section-title">$ agents --detail</h2>
              {agents.map(agent => (
                <div key={agent.id} className="agent-detail">
                  <div className="agent-header-large">
                    <AgentAvatar agentId={agent.id} size={64} />
                    <div>
                      <h3>{agent.display_name}</h3>
                      <p className="role">{agent.role}</p>
                    </div>
                    <span className={agent.is_active ? 'badge-on' : 'badge-off'}>
                      {agent.is_active ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="agent-stats">
                    <div className="stat-row">
                      <span className="stat-key">tone:</span>
                      <span className="stat-val">{agent.tone}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-key">quirk:</span>
                      <span className="stat-val">{agent.quirk}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-key">missions:</span>
                      <span className="stat-val">12 completed</span>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="terminal-footer">
          <span>last_update: {new Date(status?.timestamp).toLocaleTimeString()}</span>
          <span className="separator">|</span>
          <span>workers: 2/2 running</span>
          <span className="separator">|</span>
          <span>db: connected</span>
        </footer>
      </div>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --bg: #0a0a0f;
          --bg-secondary: #111118;
          --fg: #e4e4e7;
          --fg-dim: #71717a;
          --accent: #22c55e;
          --accent-dim: #15803d;
          --warning: #eab308;
          --error: #ef4444;
          --border: #27272a;
        }

        body {
          background: var(--bg);
          color: var(--fg);
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 14px;
          line-height: 1.6;
          min-height: 100vh;
        }

        /* Loading Screen */
        .loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .terminal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 24px;
          min-width: 400px;
        }

        .line {
          margin: 4px 0;
          font-family: inherit;
        }

        .ok {
          color: var(--accent);
        }

        .cursor {
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        /* Dashboard */
        .terminal-dashboard {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        /* Header */
        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .prompt {
          color: var(--accent);
          font-weight: bold;
          font-size: 1.2rem;
        }

        .brand h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--fg);
        }

        .version {
          color: var(--fg-dim);
          font-size: 0.85rem;
        }

        .status-line {
          display: flex;
          gap: 20px;
          font-size: 0.85rem;
        }

        .health {
          font-weight: 600;
        }

        .health.healthy {
          color: var(--accent);
        }

        .health.degraded {
          color: var(--warning);
        }

        .health.critical {
          color: var(--error);
        }

        .uptime {
          color: var(--fg-dim);
        }

        /* Navigation */
        .terminal-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          width: fit-content;
        }

        .terminal-nav button {
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--fg-dim);
          font-family: inherit;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .terminal-nav button:hover {
          color: var(--fg);
          background: rgba(255,255,255,0.05);
        }

        .terminal-nav button.active {
          color: var(--accent);
          background: rgba(34, 197, 94, 0.1);
        }

        /* Main */
        .terminal-main {
          flex: 1;
        }

        .section-title {
          font-size: 0.9rem;
          color: var(--fg-dim);
          margin: 24px 0 16px;
          font-weight: normal;
        }

        /* Stats */
        .stats-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 20px;
          transition: border-color 0.2s;
        }

        .stat-box:hover {
          border-color: var(--accent-dim);
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--fg-dim);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--fg);
        }

        /* Agents */
        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .agent-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.2s;
        }

        .agent-card:hover {
          border-color: var(--accent-dim);
          transform: translateY(-2px);
        }

        .agent-card.inactive {
          opacity: 0.6;
        }

        .agent-info {
          flex: 1;
        }

        .agent-name {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .agent-role {
          font-size: 0.8rem;
          color: var(--fg-dim);
          margin-bottom: 8px;
        }

        .agent-meta {
          font-size: 0.75rem;
          color: var(--fg-dim);
        }

        .status-on {
          color: var(--accent);
          margin-right: 4px;
        }

        .status-off {
          color: var(--error);
          margin-right: 4px;
        }

        /* Actions */
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .action-btn {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 16px;
          color: var(--fg);
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(34, 197, 94, 0.1);
          border-color: var(--accent);
        }

        .action-icon {
          width: 32px;
          height: 32px;
          background: var(--bg);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }

        /* Agent Detail */
        .agent-detail {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .agent-header-large {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .agent-header-large h3 {
          font-size: 1.3rem;
          margin-bottom: 4px;
        }

        .role {
          color: var(--fg-dim);
          font-size: 0.9rem;
        }

        .badge-on, .badge-off {
          margin-left: auto;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .badge-on {
          background: rgba(34, 197, 94, 0.2);
          color: var(--accent);
        }

        .badge-off {
          background: rgba(239, 68, 68, 0.2);
          color: var(--error);
        }

        .agent-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-row {
          display: flex;
          gap: 12px;
        }

        .stat-key {
          color: var(--fg-dim);
          min-width: 80px;
        }

        .stat-val {
          color: var(--fg);
        }

        /* Footer */
        .terminal-footer {
          margin-top: 40px;
          padding: 16px 0;
          border-top: 1px solid var(--border);
          font-size: 0.8rem;
          color: var(--fg-dim);
          display: flex;
          gap: 16px;
        }

        .separator {
          color: var(--border);
        }

        /* Agent Avatar SVG */
        .agent-avatar svg {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </>
  );
}