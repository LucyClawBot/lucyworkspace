import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// Pixel Art Office Component
function PixelOffice({ agents, conversations }) {
  const canvasRef = useRef(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const hour = time.getHours();
    const isNight = hour < 6 || hour > 20;

    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    if (isNight) {
      gradient.addColorStop(0, '#0f0f23');
      gradient.addColorStop(1, '#1a1a2e');
    } else {
      gradient.addColorStop(0, '#74b9ff');
      gradient.addColorStop(1, '#dfe6e9');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 150);

    // City skyline
    ctx.fillStyle = isNight ? '#2d3436' : '#636e72';
    const buildings = [20, 40, 30, 50, 35, 45, 25, 55, 30];
    let x = 0;
    buildings.forEach((h, i) => {
      ctx.fillRect(x, 150 - h * 2, 45, h * 2);
      if (isNight && Math.random() > 0.5) {
        ctx.fillStyle = '#ffeaa7';
        for (let wy = 150 - h * 2 + 10; wy < 140; wy += 15) {
          if (Math.random() > 0.3) ctx.fillRect(x + 10 + (Math.random() * 20), wy, 8, 8);
        }
        ctx.fillStyle = isNight ? '#2d3436' : '#636e72';
      }
      x += 50;
    });

    // Office floor
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(0, 150, canvas.width, canvas.height - 150);

    // Desks
    const deskPositions = [
      { x: 60, y: 200, agent: 'coordinator' },
      { x: 180, y: 200, agent: 'scout' },
      { x: 300, y: 200, agent: 'quill' },
      { x: 60, y: 320, agent: 'sage' },
      { x: 180, y: 320, agent: 'observer' },
      { x: 300, y: 320, agent: 'xalt' },
    ];

    deskPositions.forEach((desk, i) => {
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(desk.x, desk.y, 80, 50);
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(desk.x + 25, desk.y - 15, 30, 20);

      const agentColor = {
        coordinator: '#ff6b6b',
        scout: '#4ecdc4',
        quill: '#ffe66d',
        sage: '#a8e6cf',
        observer: '#ff8b94',
        xalt: '#c7ceea'
      }[desk.agent] || '#fff';

      const bobOffset = Math.sin(Date.now() / 500 + i) * 3;
      ctx.fillStyle = agentColor;
      ctx.fillRect(desk.x + 35, desk.y - 35 + bobOffset, 10, 10);
      ctx.fillRect(desk.x + 32, desk.y - 25 + bobOffset, 16, 15);

      const isActive = agents?.find(a => a.id === desk.agent)?.is_active;
      ctx.fillStyle = isActive ? '#00ff88' : '#ff4757';
      ctx.beginPath();
      ctx.arc(desk.x + 70, desk.y + 10, 4, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [time, agents, conversations]);

  return <canvas ref={canvasRef} width={500} height={400} className="pixel-canvas" />;
}

// Animated counter
function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const start = displayValue;
    const end = value || 0;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(start + (end - start) * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);
  
  return <span>{displayValue}</span>;
}

// Health Indicator
function HealthIndicator({ status }) {
  const colors = { healthy: '#00ff88', degraded: '#ffd700', critical: '#ff4757' };
  return (
    <div className="health-indicator">
      <span className="pulse-dot" style={{ background: colors[status] || '#888' }} />
      <span style={{ color: colors[status] || '#888' }}>{status?.toUpperCase()}</span>
    </div>
  );
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
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Initializing LucyClawBot...</p>
      </div>
    );
  }

  return (
    <>
      <Head><title>LucyClawBot</title></Head>
      <div className="dashboard">
        <header>
          <div className="brand">
            <span className="logo">💼</span>
            <div>
              <h1>LucyClawBot</h1>
              <small>Multi-Agent AI System</small>
            </div>
          </div>
          <div className="status">
            <HealthIndicator status={status?.health?.status} />
            <span className="live"><span className="dot"/> LIVE</span>
          </div>
        </header>

        <nav>
          {['overview', 'agents', 'missions', 'memory'].map(tab => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        <main>
          {activeTab === 'overview' && (
            <>
              <div className="stats">
                <div className="card">
                  <h3>📋 Proposals</h3>
                  <div className="big"><AnimatedNumber value={status?.counts?.proposals?.pending} /></div>
                  <div className="bar"><div style={{ width: `${Math.min((status?.counts?.proposals?.pending || 0) * 10, 100)}%` }} /></div>
                </div>
                <div className="card">
                  <h3>🎯 Missions</h3>
                  <div className="big"><AnimatedNumber value={status?.counts?.missions?.running} /></div>
                  <div className="row"><span className="ok">{status?.counts?.missions?.succeeded} ✅</span> <span className="bad">{status?.counts?.missions?.failed} ❌</span></div>
                </div>
                <div className="card">
                  <h3>⚡ Steps</h3>
                  <div className="big"><AnimatedNumber value={status?.counts?.steps?.queued} /></div>
                  <div className="dots">
                    <span className="queued" />
                    <span className="running" />
                    <span className="failed" />
                  </div>
                </div>
                <div className="card">
                  <h3>💬 Conversations</h3>
                  <div className="big"><AnimatedNumber value={status?.counts?.conversations?.completed} /></div>
                </div>
              </div>

              <div className="office-card">
                <h3>🏢 Agent Office</h3>
                <PixelOffice agents={status?.agents} conversations={status?.counts?.conversations} />
              </div>

              <div className="agents-list">
                {status?.agents?.map(agent => (
                  <div key={agent.id} className="agent-mini">
                    <img 
                      src={`/avatars/${agent.id}-pfp.png`} 
                      alt={agent.display_name}
                      className="avatar"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <span className="avatar fallback" style={{ display: 'none', background: { coordinator: '#ff6b6b', scout: '#4ecdc4', quill: '#ffe66d', sage: '#a8e6cf', observer: '#ff8b94', xalt: '#c7ceea' }[agent.id] }}>{agent.display_name[0]}</span>
                    <span>{agent.display_name}</span>
                    <span className={agent.is_active ? 'on' : 'off'}>●</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'agents' && (
            <div className="agents-grid">
              {status?.agents?.map(agent => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-header">
                    <img 
                      src={`/avatars/${agent.id}-pfp.png`} 
                      alt={agent.display_name}
                      className="avatar"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="avatar fallback" style={{ display: 'none', background: { coordinator: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)', scout: 'linear-gradient(135deg, #4ecdc4, #44a08d)', quill: 'linear-gradient(135deg, #ffe66d, #f4d03f)', sage: 'linear-gradient(135deg, #a8e6cf, #7fcdbb)', observer: 'linear-gradient(135deg, #ff8b94, #ff6b8a)', xalt: 'linear-gradient(135deg, #c7ceea, #a8b5e0)' }[agent.id] }}>{agent.display_name[0]}</div>
                    <div><h4>{agent.display_name}</h4><small>{agent.role}</small></div>
                    <span className={agent.is_active ? 'badge on' : 'badge off'}>{agent.is_active ? 'Active' : 'Off'}</span>
                  </div>
                  <p className="tone">{agent.tone}</p>
                  <p className="quirk">💭 {agent.quirk}</p>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer>
          Last update: {new Date(status?.timestamp).toLocaleString()} | LucyClawBot v0.2.0
        </footer>
      </div>

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          background: #0a0a0f; 
          color: #fff; 
          font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
          min-height: 100vh;
        }
        .loading { 
          min-height: 100vh; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          gap: 20px;
        }
        .spinner { 
          width: 60px; 
          height: 60px; 
          border: 3px solid rgba(139, 92, 246, 0.2); 
          border-top-color: #8b5cf6; 
          border-radius: 50%; 
          animation: spin 1s linear infinite; 
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .dashboard { padding: 20px; max-width: 1400px; margin: 0 auto; }
        
        header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 20px 0; 
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .brand { display: flex; align-items: center; gap: 15px; }
        .logo { font-size: 2.5rem; }
        .brand h1 { 
          font-size: 1.8rem; 
          background: linear-gradient(135deg, #8b5cf6, #ec4899); 
          -webkit-background-clip: text; 
          -webkit-text-fill-color: transparent; 
        }
        .status { display: flex; align-items: center; gap: 20px; }
        .health-indicator { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(255,255,255,0.05); border-radius: 20px; }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .live { display: flex; align-items: center; gap: 6px; color: #10b981; }
        .dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        
        nav { display: flex; gap: 10px; margin-bottom: 30px; padding: 5px; background: rgba(255,255,255,0.05); border-radius: 12px; width: fit-content; }
        nav button { 
          padding: 10px 20px; 
          border: none; 
          background: transparent; 
          color: #a0a0b0; 
          border-radius: 8px; 
          cursor: pointer; 
          transition: all 0.3s;
        }
        nav button:hover { color: #fff; background: rgba(255,255,255,0.05); }
        nav button.active { 
          color: #fff; 
          background: linear-gradient(135deg, #8b5cf6, #ec4899); 
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }
        
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 16px; 
          padding: 24px;
          transition: transform 0.3s, border-color 0.3s;
        }
        .card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.2); }
        .card h3 { color: #a0a0b0; font-size: 0.9rem; margin-bottom: 12px; }
        .big { font-size: 3rem; font-weight: 800; margin-bottom: 8px; }
        .bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
        .bar > div { height: 100%; background: linear-gradient(90deg, #8b5cf6, #ec4899); border-radius: 2px; transition: width 0.5s ease; }
        .row { display: flex; gap: 15px; font-size: 0.9rem; }
        .ok { color: #10b981; }
        .bad { color: #ef4444; }
        .dots { display: flex; gap: 8px; }
        .dots span { width: 12px; height: 12px; border-radius: 50%; }
        .dots .queued { background: #f59e0b; }
        .dots .running { background: #3b82f6; }
        .dots .failed { background: #ef4444; }
        
        .office-card { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 16px; 
          padding: 24px; 
          margin-bottom: 20px;
        }
        .office-card h3 { color: #a0a0b0; margin-bottom: 20px; }
        .pixel-canvas { 
          width: 100%; 
          max-width: 500px; 
          border-radius: 12px; 
          display: block; 
          margin: 0 auto;
        }
        
        .agents-list { 
          display: flex; 
          gap: 15px; 
          flex-wrap: wrap; 
          justify-content: center;
          padding: 20px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
        }
        .agent-mini { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: rgba(255,255,255,0.05); border-radius: 20px; }
        .agent-mini .avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .agent-mini .on { color: #10b981; }
        .agent-mini .off { color: #ef4444; }
        
        .agents-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .agent-card { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 16px; 
          padding: 24px;
        }
        .agent-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .agent-header .avatar { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; object-fit: cover; }
        .agent-header h4 { font-size: 1.1rem; }
        .agent-header small { color: #a0a0b0; }
        .badge { padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; margin-left: auto; }
        .badge.on { background: #10b981; color: #000; }
        .badge.off { background: #ef4444; color: #fff; }
        .tone { color: #a0a0b0; font-size: 0.9rem; margin-bottom: 10px; }
        .quirk { font-size: 0.85rem; color: #c0c0d0; }
        
        footer { 
          text-align: center; 
          padding: 40px 20px; 
          color: #606070; 
          font-size: 0.9rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          margin-top: 40px;
        }
      `}</style>
    </>
  );
}