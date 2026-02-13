// pages/index.js
// CEO Dashboard with 6 agents

import { useEffect, useState } from 'react';

const AGENTS = [
  { id: 'lucy', name: 'Lucy', emoji: '💼', role: 'CEO', status: 'active', description: 'Ejecución directa. Override total. Manda sobre todos.' },
  { id: 'minion', name: 'Minion', emoji: '👑', role: 'Decision Maker', status: 'standby', description: 'Toma decisiones finales. Aprobaciones que necesitan juicio human-level.' },
  { id: 'sage', name: 'Sage', emoji: '🧠', role: 'Strategic Analyst', status: 'standby', description: 'Análisis estratégico. Diagnóstico de fallos. Pensamiento a largo plazo.' },
  { id: 'scout', name: 'Scout', emoji: '🔭', role: 'Intel Gatherer', status: 'standby', description: 'Recolección de inteligencia. Monitoreo de tendencias. Oportunidades.' },
  { id: 'quill', name: 'Quill', emoji: '✍️', role: 'Content Writer', status: 'standby', description: 'Escritura de contenido. Drafts. Reportes y documentación.' },
  { id: 'xalt', name: 'Xalt', emoji: '📱', role: 'Social Media Manager', status: 'standby', description: 'Gestión de redes sociales. Posts. Engage con la comunidad.' },
  { id: 'observer', name: 'Observer', emoji: '👁️', role: 'Quality Checker', status: 'standby', description: 'Revisión de calidad. Verificación de outputs. Estándares.' },
];

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ops/status');
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const healthColor = {
    healthy: '#4ade80',
    degraded: '#fbbf24',
    critical: '#f87171',
    unknown: '#666',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: '24px 40px',
        borderBottom: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>💼 LucyWorkspace</h1>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>
            Sistema Autónomo VoxYZ — CEO Mode
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: '#111',
            borderRadius: '20px',
            border: `1px solid ${healthColor[status?.health?.status] || '#333'}`,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: healthColor[status?.health?.status] || '#666',
            }} />
            <span style={{ fontSize: '13px', color: '#aaa', textTransform: 'uppercase' }}>
              {status?.health?.status || 'unknown'}
            </span>
          </div>
          {lastUpdate && (
            <p style={{ margin: '8px 0 0 0', color: '#444', fontSize: '11px' }}>
              Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </header>

      <main style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <StatCard 
            title="🎯 Proposals" 
            value={loading ? '-' : `${status?.counts?.proposals?.pending || 0} / ${status?.counts?.proposals?.accepted || 0}`}
            subtitle="pending / accepted"
          />
          <StatCard 
            title="⚡ Missions" 
            value={loading ? '-' : status?.counts?.missions?.running || 0}
            subtitle={`${status?.counts?.missions?.succeeded || 0} succeeded · ${status?.counts?.missions?.failed || 0} failed`}
          />
          <StatCard 
            title="📋 Queue" 
            value={loading ? '-' : status?.counts?.steps?.queued || 0}
            subtitle={`${status?.counts?.steps?.running || 0} running · ${status?.counts?.steps?.failed || 0} failed`}
          />
          <StatCard 
            title="📊 Events" 
            value={loading ? '-' : status?.counts?.events_24h || 0}
            subtitle="last 24h"
          />
        </div>

        {/* Agents Grid */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#aaa' }}>
            👥 Equipo de Agentes
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {AGENTS.map(agent => (
              <AgentCard 
                key={agent.id}
                agent={agent}
                isActive={agent.id === 'lucy'}
              />
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section style={{
          background: '#111',
          borderRadius: '12px',
          border: '1px solid #222',
          padding: '24px',
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#aaa' }}>
            📈 Actividad Reciente
          </h2>
          
          {loading ? (
            <p style={{ color: '#666' }}>Cargando...</p>
          ) : status?.recent_missions?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {status.recent_missions.slice(0, 5).map(mission => (
                <MissionRow key={mission.id} mission={mission} />
              ))}
            </div>
          ) : (
            <p style={{ color: '#444', fontSize: '14px' }}>
              No hay actividad reciente. El sistema está listo para operar.
            </p>
          )}
        </section>

        {/* System Info */}
        <footer style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#444',
          fontSize: '12px',
        }}>
          <span>LucyWorkspace v0.2 | Closed-Loop System</span>
          <span>Refresh: 30s | Kimi K2.5 Optimized</span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div style={{
      background: '#111',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #222',
    }}>
      <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </p>
      <p style={{ margin: '0 0 4px 0', fontSize: '32px', fontWeight: 700, color: '#fff' }}>
        {value}
      </p>
      <p style={{ margin: 0, color: '#555', fontSize: '12px' }}>
        {subtitle}
      </p>
    </div>
  );
}

function AgentCard({ agent, isActive }) {
  return (
    <div style={{
      background: '#111',
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${isActive ? '#3b82f6' : '#222'}`,
      position: 'relative',
    }}>
      {isActive && (
        <div style={{
          position: 'absolute',
          top: -1,
          right: -1,
          padding: '4px 12px',
          background: '#3b82f6',
          borderRadius: '0 12px 0 8px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          CEO Active
        </div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>{agent.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>{agent.name}</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              background: agent.status === 'active' ? '#166534' : '#333',
              color: agent.status === 'active' ? '#86efac' : '#888',
            }}>
              {agent.status}
            </span>
          </div>
          <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '13px' }}>
            {agent.role}
          </p>
          <p style={{ margin: 0, color: '#444', fontSize: '12px', lineHeight: 1.5 }}>
            {agent.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function MissionRow({ mission }) {
  const statusColors = {
    succeeded: '#4ade80',
    failed: '#f87171',
    running: '#fbbf24',
    pending: '#666',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '12px 16px',
      background: '#0a0a0a',
      borderRadius: '8px',
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: statusColors[mission.status] || '#666',
      }} />
      <span style={{ fontSize: '14px', color: '#fff', minWidth: 80 }}>
        {mission.proposal?.agent || 'unknown'}
      </span>
      <span style={{ fontSize: '14px', color: '#888', flex: 1 }}>
        {mission.proposal?.action || 'unknown'}
      </span>
      <span style={{
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: '4px',
        background: mission.status === 'failed' ? '#371b1b' : mission.status === 'succeeded' ? '#1b3729' : '#2a2a1b',
        color: statusColors[mission.status] || '#666',
        textTransform: 'uppercase',
      }}>
        {mission.status}
      </span>
    </div>
  );
}
