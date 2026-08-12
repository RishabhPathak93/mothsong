import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MothMark from '../components/MothMark';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/play');
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <div className="auth-card card rise">
        <div className="auth-head">
          <MothMark size={40} />
          <h2>Welcome back</h2>
          <p className="muted">The grove has kept your glow warm.</p>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="u">Name</label>
            <input
              id="u"
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="the name you drift under"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="p">Passphrase</label>
            <input
              id="p"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Lighting the way…' : 'Drift in'}
          </button>
        </form>
        <p className="auth-alt muted">
          New here? <Link to="/register">Begin your first drift →</Link>
        </p>
      </div>
      <style>{authCss}</style>
    </main>
  );
}

export const authCss = `
.auth-card { width: min(420px, 92vw); }
.auth-head { text-align: center; margin-bottom: 1.4rem; }
.auth-head h2 { margin: 0.6rem 0 0.2rem; }
.auth-head p { margin: 0; }
.auth-alt { text-align: center; margin: 1.2rem 0 0; font-size: 0.9rem; }
`;
