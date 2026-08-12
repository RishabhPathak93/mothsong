import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MothMark from '../components/MothMark';
import { authCss } from './Login';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (username.trim().length < 3) return setError('Choose a name of at least 3 characters.');
    if (password.length < 4) return setError('A passphrase needs at least 4 characters.');
    setBusy(true);
    try {
      await register(username.trim(), password);
      navigate('/play');
    } catch (err) {
      setError(err.message || 'Could not create your drift.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <div className="auth-card card rise">
        <div className="auth-head">
          <MothMark size={40} />
          <h2>Begin drifting</h2>
          <p className="muted">Pick a name to carry through the dark.</p>
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
              placeholder="lampwick, emberdrift, nocturne…"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="p">Passphrase</label>
            <input
              id="p"
              type="password"
              className="input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="something you'll remember"
              required
            />
          </div>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Kindling…' : 'Light my glow'}
          </button>
        </form>
        <p className="auth-alt muted">
          Already drifting? <Link to="/login">Sign in →</Link>
        </p>
      </div>
      <style>{authCss}</style>
    </main>
  );
}
