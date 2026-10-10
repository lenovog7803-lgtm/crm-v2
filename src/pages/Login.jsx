import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useShake } from '../components/Transitions';

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      // тот же спокойный голубой фон, что и в CRM (aurora-bg)
      background: 'radial-gradient(ellipse 80% 60% at 10% 10%, rgba(90,150,255,0.14) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 90% 5%, rgba(19,102,240,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 85% 90%, rgba(120,180,255,0.12) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 5% 85%, rgba(70,120,230,0.1) 0%, transparent 60%), #EDEFF3' }}>
      <div ref={cardRef} className="ios-widget login-card">
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          {/* логотип как иконка приложения iOS */}
          <div className="login-icon"><img src="/logo-full.svg" alt="AV2" /></div>
          <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: '#0E1726' }}>A2 Group CRM</div>
          <div style={{ fontSize: 15, color: 'rgba(60,60,67,0.6)', marginTop: 6 }}>Войдите, чтобы продолжить</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="login-field">
            <span>Логин</span>
            <input value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" />
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div style={{ fontSize: 13, color: '#FF3B30', textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary" style={{ height: 54, justifyContent: 'center', fontSize: 17, fontWeight: 600, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
