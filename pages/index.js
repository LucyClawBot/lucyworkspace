// pages/index.js - CEO Dashboard
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ops/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: '40px'
    }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '32px' }}>💼 LucyWorkspace</h1>
        <p style={{ margin: 0, color: '#888' }}>
          CEO Mode | Sistema Autónomo
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <StatCard title="🎯 Propuestas" value={status?.counts?.pending_proposals ?? '-'} loading={loading} />
        <StatCard title="⚡ Misiones" value={status?.counts?.running_missions ?? '-'} loading={loading} />
        <StatCard title="📋 Cola" value={status?.counts?.queued_steps ?? '-'} loading={loading} />
        <StatCard title="🔴 Fallos" value={status?.counts?.failed_steps ?? '-'} loading={loading} alert={status?.counts?.failed_steps > 0} />
      </div>

      <section style={{
        background: '#111',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #222'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>👥 Equipo</h2>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <AgentRow 
            name="Lucy" 
            role="CEO" 
            status="Activa" 
            emoji="💼"
            description="Ejecución directa, todas las funciones. Recibe órdenes del jefe."
          />
          <AgentRow 
            name="Delegado" 
            role="Asistente" 
            status="Standby" 
            emoji="🎯"
            description="En espera de asignación de funciones. No activo."
          />
        </div>
      </section>

      <section style={{
        marginTop: '30px',
        background: '#111',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #222'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>📊 Estado</h2>
        
        {loading ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : status ? (
          <div style={{ fontSize: '14px', color: '#888' }}>
            <p>Última actualización: {new Date(status.timestamp).toLocaleString()}</p>
            <p>Eventos 24h: {status.counts?.events_24h ?? 0}</p>
            
            {status.recent_missions?.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '10px' }}>
                  Misiones recientes:
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {status.recent_missions.slice(0, 5).map(m => (
                    <li key={m.id} style={{ marginBottom: '8px' }}>
                      <span style={{ 
                        color: m.status === 'succeeded' ? '#4ade80' : 
                               m.status === 'failed' ? '#f87171' : '#fbbf24'
                      }}>●</span>{' '}
                      {m.proposal?.agent} — {m.proposal?.action} ({m.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: '#666' }}>Sistema listo. Esperando datos de Supabase.</p>
        )}
      </section>

      <footer style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #222', color: '#444', fontSize: '12px' }}>
        <p>LucyWorkspace v0.1 | CEO directo | Optimizado para eficiencia</p>
      </footer>
    </div>
  );
}

function StatCard({ title, value, loading, alert }) {
  return (
    <div style={{
      background: '#111',
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${alert ? '#ef4444' : '#222'}`
    }}>
      <p style={{ margin: '0 0 8px 0', color: '#888', fontSize: '14px' }}>{title}</p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: alert ? '#ef4444' : '#fff' }}>
        {loading ? '...' : value}
      </p>
    </div>
  );
}

function AgentRow({ name, role, status, emoji, description }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      background: '#0a0a0a',
      borderRadius: '8px'
    }}>
      <span style={{ fontSize: '32px' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{name}</span>
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '12px',
            background: status === 'Activa' ? '#166534' : '#444',
            color: status === 'Activa' ? '#86efac' : '#aaa'
          }}>{status}</span>
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>{role}</p>
        <p style={{ margin: '4px 0 0 0', color: '#444', fontSize: '12px' }}>{description}</p>
      </div>
    </div>
  );
}
