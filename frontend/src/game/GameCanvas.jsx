import { useEffect, useRef, useState, useCallback } from 'react';
import MothsongGame from './engine';
import AmbientAudio from './audio';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

const LEVELS = [
  { id: 'grove', file: 'grove.json', name: 'The Lantern Grove' },
  { id: 'hollow', file: 'hollow.json', name: 'The Singing Hollow' },
];

export default function GameCanvas() {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);

  const [levelId, setLevelId] = useState('grove');
  const [sound, setSound] = useState(false);
  const [hint, setHint] = useState(true);
  const [saved, setSaved] = useState('');
  const [stats, setStats] = useState({ spores: 0, blooms: 0, seconds: 0, glow: 0.14, total: 12, resting: false });

  const onStats = useCallback((s) => setStats(s), []);

  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (!audioRef.current) audioRef.current = new AmbientAudio();

    async function boot() {
      let level = null;
      try {
        const file = LEVELS.find((l) => l.id === levelId)?.file || 'grove.json';
        level = await api.levelAsset(file);
      } catch (_e) {
        /* engine falls back to a built-in level */
      }
      if (!alive) return;
      const game = new MothsongGame(canvas, { level, audio: audioRef.current, onStats });
      gameRef.current = game;
      game.start();
    }
    boot();

    const t = setTimeout(() => setHint(false), 6000);
    return () => {
      alive = false;
      clearTimeout(t);
      if (gameRef.current) gameRef.current.stop();
      gameRef.current = null;
    };
  }, [levelId, onStats]);

  useEffect(() => () => audioRef.current && audioRef.current.destroy(), []);

  function toggleSound() {
    const a = audioRef.current;
    if (!a) return;
    if (sound) {
      a.mute();
      setSound(false);
    } else {
      a.enable();
      setSound(true);
    }
  }

  async function saveDrift() {
    if (!gameRef.current) return;
    const score = gameRef.current.getScore();
    if (!user) {
      setSaved('Sign in to save your drift to the grove.');
      return;
    }
    try {
      await api.submitScore(score);
      setSaved(`Saved — ${score.spores} spores, ${score.blooms} blooms.`);
    } catch (_e) {
      setSaved('Could not save right now.');
    }
    setTimeout(() => setSaved(''), 4000);
  }

  const glowPct = Math.round((stats.glow || 0) * 100);

  return (
    <div className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Mothsong — a drifting moth in a nocturnal garden" />

      {/* Top HUD */}
      <div className="hud hud-top">
        <div className="hud-left">
          <div className="hud-stat">
            <span className="hud-num tnum">{stats.spores}</span>
            <span className="hud-lbl">spores</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num tnum">{stats.blooms}</span>
            <span className="hud-lbl">blooms</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num tnum">{formatTime(stats.seconds)}</span>
            <span className="hud-lbl">adrift</span>
          </div>
        </div>
        <div className="hud-right">
          <select
            className="hud-select"
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            aria-label="Choose a place to drift"
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="hud-btn" onClick={toggleSound} aria-pressed={sound} title="Ambient sound">
            {sound ? '♪ on' : '♪ off'}
          </button>
        </div>
      </div>

      {/* Glow meter — the charge toward The Bloom */}
      <div className="hud hud-glow" role="progressbar" aria-valuenow={glowPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="glow-track">
          <div className="glow-fill" style={{ width: `${glowPct}%` }} />
        </div>
        <span className="glow-lbl">{glowPct < 100 ? 'gathering light' : 'the garden answers'}</span>
      </div>

      {/* Save + rest note */}
      <div className="hud hud-bottom">
        {stats.resting && <span className="rest-note">resting on the grass — hold glide to lift</span>}
        <button className="hud-btn hud-save" onClick={saveDrift}>Save this drift</button>
      </div>

      {saved && <div className="save-toast">{saved}</div>}

      {/* Control hint (fades) */}
      <div className={`controls-hint ${hint ? '' : 'hide'}`}>
        <kbd>WASD</kbd> / <kbd>↑↓←→</kbd> drift · <kbd>space</kbd> glide · that's all
      </div>
    </div>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}
