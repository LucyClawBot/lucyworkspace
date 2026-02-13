// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { from } = router.query;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password === 'LucyClawBot') {
      document.cookie = `lucyworkspace-auth=${password}; path=/; max-age=86400`;
      router.push(from || '/');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #333',
        background: '#111',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>💼 LucyWorkspace</h1>
        <p style={{ margin: '0 0 30px 0', color: '#888', fontSize: '14px' }}>
          Área privada de operaciones. CEO mode.
        </p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #333',
              background: '#0a0a0a',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '16px',
              boxSizing: 'border-box'
            }}
          />
          
          {error && (
            <p style={{ color: '#ff4444', fontSize: '14px', margin: '0 0 16px 0' }}>
              {error}
            </p>
          )}
          
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Entrar
          </button>
        </form>
      </div>
      
      <p style={{ marginTop: '30px', color: '#444', fontSize: '12px' }}>
        Sistema autónomo CEO. Modo vitrina privado.
      </p>
    </div>
  );
}
