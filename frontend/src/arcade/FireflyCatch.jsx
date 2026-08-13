import { useEffect, useRef, useState } from 'react';

// Firefly Catch — a calm 45-second gather. Fireflies drift and blink; tap one to catch it
// in a soft burst. No fail state; when time's up you see how many you gathered.
export default function FireflyCatch() {
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  const [caught, setCaught] = useState(0);
  const [time, setTime] = useState(45);
  const [phase, setPhase] = useState('play'); // 'play' | 'done'

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, last = performance.now(), acc = 0, remaining = 45000;
    let running = true;

    const flies = [];
    const particles = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(n) {
      for (let i = 0; i < n; i++) {
        flies.push({ x: rand(40, w - 40), y: rand(40, h - 40), vx: rand(-0.4, 0.4), vy: rand(-0.3, 0.3), p: rand(0, 6.28), r: rand(4, 6) });
      }
    }
    resize();
    spawn(12);
    stateRef.current = { flies, particles, canvas };

    function onDown(e) {
      if (!running) return;
      const r = canvas.getBoundingClientRect();
      const mx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const my = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      for (let i = flies.length - 1; i >= 0; i--) {
        const f = flies[i];
        const d = Math.hypot(f.x - mx, f.y - my);
        if (d < 26) {
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * 6.28, s = rand(1, 3);
            particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 500, max: 500 });
          }
          flies.splice(i, 1);
          setCaught((c) => c + 1);
          setTimeout(() => running && spawn(1), 700);
          break;
        }
      }
    }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', resize);

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(now - last, 60); last = now;
      if (running) { remaining -= dt; acc += dt; if (acc > 250) { acc = 0; setTime(Math.max(0, Math.ceil(remaining / 1000))); } if (remaining <= 0) { running = false; setPhase('done'); } }

      // bg
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0d0a1c'); g.addColorStop(1, '#241b45');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      for (const f of flies) {
        f.p += dt * 0.004; f.x += f.vx; f.y += f.vy;
        if (f.x < 30 || f.x > w - 30) f.vx *= -1;
        if (f.y < 30 || f.y > h - 30) f.vy *= -1;
        const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(f.p));
        const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
        rg.addColorStop(0, `rgba(245,194,107,${glow})`); rg.addColorStop(1, 'rgba(245,194,107,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 4, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#fef3d0'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.5, 0, 6.29); ctx.fill();
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
        ctx.globalAlpha = p.life / p.max; ctx.fillStyle = '#fef3d0';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('resize', resize); };
  }, []);

  function replay() {
    setCaught(0); setTime(45); setPhase('play');
    // re-mount by toggling key handled in parent; simplest: reload component state via location
    window.location.reload();
  }

  return (
    <div className="mini">
      <canvas ref={canvasRef} className="mini-canvas" aria-label="Firefly Catch" />
      <div className="mini-hud">
        <div className="stat"><b>{caught}</b><span>gathered</span></div>
        <div className="stat" style={{ textAlign: 'right' }}><b>{time}</b><span>seconds</span></div>
      </div>
      {phase === 'done' && (
        <div className="mini-overlay">
          <div className="panel">
            <h3>You gathered {caught} lights</h3>
            <p className="muted">A gentle haul. The fireflies drift on.</p>
            <button className="btn btn-primary" onClick={replay}>Drift again</button>
          </div>
        </div>
      )}
    </div>
  );
}
