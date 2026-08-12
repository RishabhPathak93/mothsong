import { Link } from 'react-router-dom';
import GameCanvas from '../game/GameCanvas';
import { useAuth } from '../lib/auth';

export default function Play() {
  const { user } = useAuth();
  return (
    <main className="container play-wrap">
      <div className="play-head spread rise">
        <div>
          <p className="eyebrow">Now drifting</p>
          <h2>The Lantern Grove</h2>
        </div>
        {!user && (
          <p className="muted play-guest">
            Playing as a guest — <Link to="/register">begin a drift</Link> to save your glow to the grove.
          </p>
        )}
      </div>
      <div className="rise rise-1">
        <GameCanvas />
      </div>
      <p className="muted play-foot rise rise-2">
        Move with WASD or the arrow keys. Hold <kbd className="k">space</kbd> to glide upward and
        release to fall gently. Gather spores until your glow brims — then watch the grove answer.
      </p>
      <style>{`
        .play-wrap { padding-top: clamp(1.4rem, 4vw, 2.4rem); padding-bottom: 2rem; }
        .play-head { margin-bottom: 1rem; align-items: flex-end; }
        .play-head h2 { margin: 0; }
        .play-guest { font-size: 0.9rem; }
        .play-foot { max-width: 60ch; margin-top: 1.2rem; font-size: 0.92rem; }
        .k { background: rgba(255,255,255,0.08); border: 1px solid var(--line-strong); border-radius: 5px; padding: 0.05em 0.4em; font-family: var(--font-ui); font-size: 0.85em; color: var(--cream); }
      `}</style>
    </main>
  );
}
