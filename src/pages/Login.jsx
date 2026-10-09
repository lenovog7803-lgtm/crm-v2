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
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          {/* логотип как иконка приложения iOS */}
          <div className="login-icon"><img src="/logo-full.svg" alt="AV2" /></div>
          <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: '#0E1726' }}>A2 Group CRM</div>
          <div style={{ fontSize: 15, color: 'rgba(60,60,67,0.6)', marginTop: 6 }}>Войдите, чтобы продолжить</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* как вход в iOS: два поля в одной скруглённой группе с тонким разделителем */}
          <div className="login-group">
            <input value={login} onChange={e => setLogin(e.target.value)} placeholder="Логин" aria-label="Логин" autoComplete="username" autoCapitalize="none" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" aria-label="Пароль" autoComplete="current-password" />
          </div>
          {error && <div style={{ fontSize: 13, color: '#FF3B30', textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ height: 54, justifyContent: 'center', fontSize: 17, fontWeight: 600, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
