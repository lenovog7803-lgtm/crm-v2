import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(login, password);
    } catch (e) {
      setError('Неверный логин или пароль');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDEFF3' }}>
      <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(24px)', borderRadius: 24, padding: 40, width: 380, border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 20px 60px rgba(20,30,55,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo-full.svg" alt="AV2" style={{ height: 64, margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 24, color: '#0E1726' }}>А2 Group CRM</div>
          <div style={{ fontSize: 13, color: '#8A93A0', marginTop: 4 }}>Войдите в систему</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Логин</div>
            <input value={login} onChange={e => setLogin(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 14, color: '#0E1726', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Пароль</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 14, color: '#0E1726', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#E0473B', textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: 12, border: 'none', background: '#1366F0', color: '#fff', fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
