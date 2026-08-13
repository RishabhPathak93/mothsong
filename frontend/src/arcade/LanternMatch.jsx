import { useMemo, useState } from 'react';

// Lantern Match — a quiet memory game. Flip two tiles; matching glyphs stay lit.
// No timer, no fail; light the whole grove at your own pace.

const GLYPHS = ['moth', 'lantern', 'spore', 'star', 'leaf', 'ripple'];
const COLORS = { moth: '#e88fa0', lantern: '#f5c26b', spore: '#fef3d0', star: '#f5c26b', leaf: '#2f6b70', ripple: '#e88fa0' };

function Glyph({ type }) {
  const c = COLORS[type];
  const paths = {
    moth: <path d="M16 16 C9 8 4 9 5 14 C6 18 12 17 16 16 C20 17 26 18 27 14 C28 9 23 8 16 16Z" fill={c} />,
    lantern: <g><rect x="11" y="8" width="10" height="16" rx="4" fill={c} /><line x1="16" y1="3" x2="16" y2="8" stroke={c} strokeWidth="1.5" /></g>,
    spore: <g><circle cx="16" cy="16" r="4" fill={c} /><circle cx="16" cy="16" r="9" fill="none" stroke={c} strokeWidth="1" opacity="0.5" /></g>,
    star: <path d="M16 4 L18.5 13 L27 13 L20 18 L23 27 L16 21 L9 27 L12 18 L5 13 L13.5 13Z" fill={c} />,
    leaf: <path d="M16 4 C8 10 8 22 16 28 C24 22 24 10 16 4Z" fill={c} />,
    ripple: <g fill="none" stroke={c} strokeWidth="1.5"><circle cx="16" cy="16" r="4" /><circle cx="16" cy="16" r="9" opacity="0.6" /></g>,
  };
  return <svg width="46" height="46" viewBox="0 0 32 32" style={{ filter: `drop-shadow(0 0 8px ${c}66)` }}>{paths[type]}</svg>;
}

function shuffled() {
  const deck = [...GLYPHS, ...GLYPHS].map((type, i) => ({ id: i, type, up: false, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function LanternMatch() {
  const [round, setRound] = useState(0);
  const initial = useMemo(() => shuffled(), [round]);
  const [cards, setCards] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);

  const open = cards.filter((c) => c.up && !c.matched);
  const won = cards.every((c) => c.matched);

  function flip(id) {
    if (busy || won) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.up || card.matched) return;
    const next = cards.map((c) => (c.id === id ? { ...c, up: true } : c));
    setCards(next);

    const nowOpen = next.filter((c) => c.up && !c.matched);
    if (nowOpen.length === 2) {
      setMoves((m) => m + 1);
      setBusy(true);
      const [a, b] = nowOpen;
      if (a.type === b.type) {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.type === a.type ? { ...c, matched: true } : c)));
          setBusy(false);
        }, 400);
      } else {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.up && !c.matched ? { ...c, up: false } : c)));
          setBusy(false);
        }, 850);
      }
    }
  }

  function reset() { setRound((r) => r + 1); setCards(shuffled()); setMoves(0); setBusy(false); }

  const matched = cards.filter((c) => c.matched).length / 2;

  return (
    <div className="mini" style={{ background: 'linear-gradient(160deg,#150f2b,#241b45)' }}>
      <div className="mini-hud" style={{ position: 'static', background: 'none' }}>
        <div className="stat"><b>{matched}/6</b><span>pairs lit</span></div>
        <div className="stat" style={{ textAlign: 'right' }}><b>{moves}</b><span>flips</span></div>
      </div>
      <div className="match-grid">
        {cards.map((c) => (
          <div className="match-cell" key={c.id}>
            <div
              className={`match-inner ${c.up || c.matched ? 'up' : ''} ${c.matched ? 'matched' : ''}`}
              onClick={() => flip(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && flip(c.id)}
              aria-label={c.up || c.matched ? c.type : 'hidden tile'}
            >
              <div className="match-face match-back" />
              <div className="match-face match-front"><Glyph type={c.type} /></div>
            </div>
          </div>
        ))}
      </div>
      {won && (
        <div className="mini-overlay">
          <div className="panel">
            <h3>The grove is lit</h3>
            <p className="muted">Every lantern paired in {moves} flips.</p>
            <button className="btn btn-primary" onClick={reset}>Shuffle again</button>
          </div>
        </div>
      )}
    </div>
  );
}
