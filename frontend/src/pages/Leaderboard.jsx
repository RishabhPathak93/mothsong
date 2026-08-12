import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Leaderboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading', entries: [], error: '' });

  useEffect(() => {
    let alive = true;
    api
      .leaderboard(50)
      .then((d) => alive && setState({ status: 'ready', entries: d.entries || [], error: '' }))
      .catch((e) => alive && setState({ status: 'error', entries: [], error: e.message }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="container board-wrap">
      <header className="board-head rise">
        <p className="eyebrow">The grove remembers</p>
        <h2>Drifters by light gathered</h2>
        <p className="lede">Every saved drift lights a lantern here. The brightest glows rise to the top.</p>
      </header>

      <div className="card board-card rise rise-1">
        {state.status === 'loading' && (
          <div className="empty">
            <div className="empty-mark">✶</div>
            Gathering the grove…
          </div>
        )}

        {state.status === 'error' && (
          <div className="empty">
            <div className="empty-mark">⚘</div>
            The grove is quiet right now. {state.error}
          </div>
        )}

        {state.status === 'ready' && state.entries.length === 0 && (
          <div className="empty">
            <div className="empty-mark">🜂</div>
            No drifts saved yet. <Link to="/play">Be the first to light a lantern →</Link>
          </div>
        )}

        {state.status === 'ready' && state.entries.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Drifter</th>
                <th className="tnum">Spores</th>
                <th className="tnum">Blooms</th>
                <th className="tnum">Adrift</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => {
                const mine = user && e.username === user.username;
                return (
                  <tr key={`${e.rank}-${e.username}`} className={mine ? 'you' : ''}>
                    <td className="rank">{e.rank}</td>
                    <td className={mine ? 'you' : ''}>
                      {e.username}
                      {mine && <span className="pill" style={{ marginLeft: 8 }}>you</span>}
                    </td>
                    <td className="tnum">{e.spores.toLocaleString()}</td>
                    <td className="tnum">{e.blooms}</td>
                    <td className="tnum">{formatTime(e.seconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .board-wrap { padding-top: clamp(1.8rem, 5vw, 3rem); }
        .board-head { margin-bottom: 1.4rem; }
        .board-card { padding: 0.6rem; }
        @media (max-width: 560px) { .table th:nth-child(4), .table td:nth-child(4) { display: none; } }
      `}</style>
    </main>
  );
}

function formatTime(s) {
  const m = Math.floor((s || 0) / 60);
  const ss = String((s || 0) % 60).padStart(2, '0');
  return `${m}:${ss}`;
}
