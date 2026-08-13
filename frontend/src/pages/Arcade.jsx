import { useState } from 'react';
import FireflyCatch from '../arcade/FireflyCatch';
import LanternMatch from '../arcade/LanternMatch';
import MothsongEcho from '../arcade/MothsongEcho';

const GAMES = [
  {
    id: 'firefly',
    name: 'Firefly Catch',
    blurb: 'A 45-second gather. Tap the drifting lights before they wander off. No losing — just a gentle haul.',
    color: '#f5c26b',
    Comp: FireflyCatch,
    emblem: (c) => <circle cx="16" cy="16" r="5" fill={c} />,
  },
  {
    id: 'match',
    name: 'Lantern Match',
    blurb: 'A quiet memory game. Flip tiles to pair the grove’s glyphs and light every lantern, at your own pace.',
    color: '#e88fa0',
    Comp: LanternMatch,
    emblem: (c) => <rect x="11" y="8" width="10" height="16" rx="4" fill={c} />,
  },
  {
    id: 'echo',
    name: 'Mothsong Echo',
    blurb: 'Call and response. Watch the lanterns sing a sequence, then echo it back. Miss a note and it simply plays again.',
    color: '#fef3d0',
    Comp: MothsongEcho,
    emblem: (c) => <path d="M16 6 v20 M10 10 v12 M22 10 v12" stroke={c} strokeWidth="2.4" strokeLinecap="round" />,
  },
];

export default function Arcade() {
  const [active, setActive] = useState(null);
  const game = GAMES.find((g) => g.id === active);

  return (
    <main className="container arcade-wrap">
      <header className="arcade-head rise">
        <p className="eyebrow">Between drifts</p>
        <h2>The Arcade</h2>
        <p className="lede">Three small, calm diversions from the grove — quick to pick up, easy to put down.</p>
      </header>

      {!game && (
        <div className="arcade-gallery">
          {GAMES.map((g, i) => (
            <button key={g.id} className={`arcade-card rise rise-${i + 1}`} onClick={() => setActive(g.id)}>
              <div className="arcade-emblem">
                <svg width="30" height="30" viewBox="0 0 32 32" fill="none">{g.emblem(g.color)}</svg>
              </div>
              <h3>{g.name}</h3>
              <p className="muted">{g.blurb}</p>
              <span className="pill" style={{ marginTop: '0.6rem', alignSelf: 'flex-start' }}>Play →</span>
            </button>
          ))}
        </div>
      )}

      {game && (
        <div className="arcade-stage rise">
          <div className="stage-bar">
            <h2>{game.name}</h2>
            <button className="btn btn-ghost" onClick={() => setActive(null)}>← All games</button>
          </div>
          <game.Comp />
        </div>
      )}
    </main>
  );
}
