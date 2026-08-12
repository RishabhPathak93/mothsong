import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarMsg, setAvatarMsg] = useState(null);
  const [mods, setMods] = useState([]);
  const [modMsg, setModMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myMods().then((d) => setMods(d.mods || [])).catch(() => {});
  }, []);

  async function importAvatar(e) {
    e.preventDefault();
    setAvatarMsg(null);
    setBusy(true);
    try {
      const r = await api.avatarImport(avatarUrl);
      setAvatarMsg({ kind: 'ok', text: `Avatar imported (${r.bytes} bytes, ${r.contentType}).` });
      await refresh();
    } catch (err) {
      // The server's debug payload is surfaced here — realistic "helpful" error UI.
      const debug = err.data && err.data.debug ? JSON.stringify(err.data.debug, null, 2) : '';
      setAvatarMsg({ kind: 'error', text: err.message, debug });
    } finally {
      setBusy(false);
    }
  }

  async function uploadMod(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setModMsg(null);
    try {
      const r = await api.uploadMod(file);
      setModMsg({ kind: 'ok', text: `Uploaded ${r.file} (${r.bytes} bytes). Mods are reviewed before they appear in your level list.` });
      const d = await api.myMods();
      setMods(d.mods || []);
    } catch (err) {
      setModMsg({ kind: 'error', text: err.message });
    }
    e.target.value = '';
  }

  return (
    <main className="container profile-wrap">
      <header className="profile-head rise">
        <div className="avatar" aria-hidden="true">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials(user?.username)}</span>}
        </div>
        <div>
          <p className="eyebrow">Your drift</p>
          <h2>{user?.username}</h2>
          <div className="profile-meta">
            <span className="pill">{user?.role === 'admin' ? 'grove curator' : 'drifter'}</span>
            <span className="muted">Best glow · {(user?.bestScore || 0).toLocaleString()} spores</span>
          </div>
        </div>
      </header>

      {user?.secretNote && (
        <div className="card curator-note rise rise-1">
          <span className="pill pill-rose">curator's note</span>
          <p style={{ marginTop: '0.7rem', marginBottom: 0 }}>{user.secretNote}</p>
        </div>
      )}

      <div className="grid-2 profile-grid">
        {/* Avatar import — fetches a URL server-side (this is the SSRF surface, #2) */}
        <section className="card rise rise-1">
          <h3>Import an avatar</h3>
          <p className="muted">Paste an image URL and we'll fetch it for you and set it as your wings' crest.</p>
          <form onSubmit={importAvatar}>
            <div className="field">
              <label htmlFor="av">Image URL</label>
              <input
                id="av"
                className="input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/moth.png"
              />
            </div>
            <button className="btn btn-primary" disabled={busy || !avatarUrl}>
              {busy ? 'Fetching…' : 'Import avatar'}
            </button>
          </form>
          {avatarMsg && (
            <div className={`alert ${avatarMsg.kind === 'ok' ? 'alert-ok' : 'alert-error'}`} style={{ marginTop: '1rem' }}>
              {avatarMsg.text}
              {avatarMsg.debug && <pre className="debug">{avatarMsg.debug}</pre>}
            </div>
          )}
        </section>

        {/* Custom level mods — upload a .js mod (this is the upload surface, #4) */}
        <section className="card rise rise-2">
          <h3>Custom level mods</h3>
          <p className="muted">
            Tinkering with your own grove? Upload a <code>.js</code> mod. Mods are queued for review
            before they appear in your level list.
          </p>
          <label className="btn btn-ghost file-btn">
            Choose a .js mod
            <input type="file" accept=".js,text/javascript" onChange={uploadMod} hidden />
          </label>
          {modMsg && (
            <div className={`alert ${modMsg.kind === 'ok' ? 'alert-ok' : 'alert-error'}`} style={{ marginTop: '1rem' }}>
              {modMsg.text}
            </div>
          )}
          {mods.length > 0 ? (
            <ul className="mod-list">
              {mods.map((m) => (
                <li key={m.file}><span className="mod-dot" />{m.file}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: '1rem', marginBottom: 0 }}>No mods uploaded yet.</p>
          )}
        </section>
      </div>

      <style>{`
        .profile-wrap { padding-top: clamp(1.8rem, 5vw, 3rem); }
        .profile-head { display: flex; align-items: center; gap: 1.3rem; margin-bottom: 1.4rem; }
        .avatar {
          width: 76px; height: 76px; border-radius: 50%; flex: none;
          display: grid; place-items: center; overflow: hidden;
          background: radial-gradient(circle at 50% 40%, rgba(245,194,107,0.3), var(--night-2));
          border: 1px solid var(--line-strong); color: var(--cream);
          font-family: var(--font-display); font-size: 1.6rem;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .profile-meta { display: flex; align-items: center; gap: 0.8rem; margin-top: 0.5rem; flex-wrap: wrap; }
        .curator-note { margin-bottom: 1.4rem; border-color: rgba(232,143,160,0.3); }
        .profile-grid { align-items: start; }
        .file-btn { cursor: pointer; }
        .debug {
          margin: 0.7rem 0 0; padding: 0.7rem; border-radius: var(--r-sm);
          background: rgba(13,10,28,0.7); border: 1px solid var(--line);
          font-size: 0.74rem; color: var(--text-dim); white-space: pre-wrap; word-break: break-all;
          max-height: 220px; overflow: auto;
        }
        .mod-list { list-style: none; padding: 0; margin: 1rem 0 0; }
        .mod-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; font-size: 0.86rem; color: var(--text-dim); border-bottom: 1px solid var(--line); }
        .mod-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 8px var(--amber); }
        code { background: rgba(255,255,255,0.07); padding: 0.05em 0.35em; border-radius: 4px; font-size: 0.88em; }
      `}</style>
    </main>
  );
}

function initials(name) {
  if (!name) return '✶';
  return name.slice(0, 2).toUpperCase();
}
