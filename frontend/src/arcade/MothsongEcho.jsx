import { useEffect, useRef, useState } from 'react';

// Mothsong Echo — a gentle call-and-response memory game (Simon, but kind). Watch the
// lanterns light in sequence, then repeat it. Miss a note and it simply plays again —
// no game-over. Each round adds one note; your best length is remembered.

const TONES = [329.63, 392.0, 493.88, 587.33]; // pentatonic-ish, always consonant

export default function MothsongEcho() {
  const [seq, setSeq] = useState([]);
  const [lit, setLit] = useState(-1);
  const [phase, setPhase] = useState('idle'); // idle | showing | input | miss
  const [best, setBest] = useState(0);
  const inputIx = useRef(0);
  const audioRef = useRef(null);

  function ctx() {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioRef.current = AC ? new AC() : null;
    }
    if (audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function tone(i) {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = TONES[i];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.55);
  }

  function playSequence(s) {
    setPhase('showing');
    let i = 0;
    const step = () => {
      if (i >= s.length) { setLit(-1); setPhase('input'); inputIx.current = 0; return; }
      const pad = s[i];
      setLit(pad); tone(pad);
      setTimeout(() => { setLit(-1); setTimeout(() => { i++; step(); }, 180); }, 480);
    };
    setTimeout(step, 500);
  }

  function nextRound(prev) {
    const s = [...prev, Math.floor(Math.random() * 4)];
    setSeq(s);
    setBest((b) => Math.max(b, s.length - 1));
    playSequence(s);
  }

  function start() { ctx(); setSeq([]); nextRound([]); }

  function tap(pad) {
    if (phase !== 'input') return;
    setLit(pad); tone(pad);
    setTimeout(() => setLit(-1), 160);
    if (seq[inputIx.current] === pad) {
      inputIx.current += 1;
      if (inputIx.current === seq.length) {
        setPhase('showing');
        setTimeout(() => nextRound(seq), 700);
      }
    } else {
      // gentle: replay the same sequence, no reset
      setPhase('miss');
      setTimeout(() => playSequence(seq), 900);
    }
  }

  useEffect(() => () => audioRef.current && audioRef.current.close && audioRef.current.close(), []);

  const label = { idle: 'Press begin, then echo the light', showing: 'Listen…', input: 'Your turn — echo it', miss: 'Not quite — listen again' }[phase];

  return (
    <div className="mini" style={{ background: 'linear-gradient(160deg,#0d0a1c,#1f2b3a)' }}>
      <div className="mini-hud" style={{ position: 'static', background: 'none' }}>
        <div className="stat"><b>{seq.length}</b><span>notes</span></div>
        <div className="stat" style={{ textAlign: 'right' }}><b>{best}</b><span>best echo</span></div>
      </div>
      <div className="echo-board">
        {[0, 1, 2, 3].map((p) => (
          <div
            key={p}
            className={`echo-pad p${p} ${lit === p ? 'lit' : ''}`}
            onClick={() => tap(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tap(p)}
            aria-label={`lantern ${p + 1}`}
          />
        ))}
      </div>
      <div style={{ textAlign: 'center', paddingBottom: '1.4rem' }}>
        <p className="muted" style={{ marginBottom: '0.8rem' }}>{label}</p>
        {(phase === 'idle') && <button className="btn btn-primary" onClick={start}>Begin the song</button>}
        {phase !== 'idle' && <button className="btn btn-ghost" onClick={start}>Start over</button>}
      </div>
    </div>
  );
}
