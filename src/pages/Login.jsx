import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useShake } from '../components/Transitions';
import GradientLayer from '../components/GradientLayer'

export default function Login() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardRef, shake] = useShake();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(login, password);
    } catch (e) {
      setError('Неверный логин или пароль');
      shake();
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDEFF3' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}><GradientLayer /></div>
      <div ref={cardRef} className="ios-widget login-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo-full.svg" alt="AV2" style={{ height: 56, margin: '0 auto 18px', display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: '-0.025em', color: '#0E1726' }}>А2 Group CRM</div>
          <div style={{ fontSize: 15, color: '#8A93A0', marginTop: 4 }}>Войдите в систему</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* как вход в iOS: два поля в одной скруглённой группе с тонким разделителем */}
          <div className="login-group">
            <input value={login} onChange={e => setLogin(e.target.value)} placeholder="Логин" aria-label="Логин" autoComplete="username" autoCapitalize="none" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" aria-label="Пароль" autoComplete="current-password" />
          </div>
          {error && <div style={{ fontSize: 13, color: '#FF3B30', textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ height: 50, justifyContent: 'center', fontSize: 16, fontWeight: 600, marginTop: 6, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
