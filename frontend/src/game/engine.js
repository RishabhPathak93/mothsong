// ═══════════════════════════════════════════════════════════════════════════
// Mothsong — game engine (Canvas 2D)
//
// A calm drift, not a platformer race. You are a small luminous moth; hold glide to
// rise, release to fall gently. Gather spores of light; when your glow brims, the
// garden answers — The Bloom. No death, no game-over: fall too far and you settle on
// the grass and lift off again.
//
// Fixed-timestep (60fps) logic decoupled from render. Everything is drawn procedurally
// so there are no image assets to load.
// ═══════════════════════════════════════════════════════════════════════════

const STEP = 1000 / 60;

// Dusk Amber palette (kept in sync with the CSS design system).
const C = {
  sky0: '#0d0a1c',
  sky1: '#1b1533',
  sky2: '#2a1f4d',
  petrol: '#1f4b52',
  amber: '#f5c26b',
  amberDeep: '#e0a24a',
  rose: '#e88fa0',
  cream: '#fef3d0',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
// deterministic pseudo-random so the world is stable across frames
function mulberry(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default class MothsongGame {
  constructor(canvas, { level, audio, onStats } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.audio = audio || null;
    this.onStats = onStats || (() => {});
    this.level = normalizeLevel(level);

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;
    this.groundY = 0;

    this.keys = new Set();
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.acc = 0;
    this.t = 0; // total sim time (ms)

    this.reset();
    this._bind();
  }

  reset() {
    const rng = mulberry(0x5eed ^ this.level.length);
    this.rng = rng;

    // Player (the moth), in world coordinates.
    this.moth = {
      x: 220,
      y: 240,
      vx: 0,
      vy: 0,
      facing: 1,
      wing: 0, // wingbeat phase
      bob: 0,
      resting: false,
      gliding: false,
    };
    this.cam = { x: 0, y: 0 };

    // Score + glow.
    this.spent = 0; // seconds
    this.collected = 0;
    this.blooms = 0;
    this.glow = 0.14; // 0..1 — brims at 1 → Bloom
    this.bloomT = 0; // active-bloom timer (ms)
    this.bloomWave = 0; // expanding radius during a bloom
    this.flash = 0; // white-ish overlay strength

    // World props.
    this.spores = this.level.spores.map((s, i) => ({
      x: s.x,
      y: s.y,
      kind: s.kind || 'warm',
      taken: false,
      pop: 0,
      phase: rng() * Math.PI * 2,
      seed: i,
    }));
    this.lanterns = this.level.lanterns.map((l) => ({
      x: l.x,
      y: l.y,
      lit: 0.28,
      target: 0.28,
      sway: rng() * Math.PI * 2,
    }));

    this.particles = [];
    this.fireflies = Array.from({ length: 46 }, () => ({
      x: rng() * 1600,
      y: rng() * 500 + 40,
      z: 0.3 + rng() * 0.7,
      p: rng() * Math.PI * 2,
      s: 0.6 + rng() * 1.6,
    }));

    // Parallax silhouettes (far + mid), generated once.
    this.farTrees = makeTreeline(rng, this.level.length + 1200, 0.34, 120, 240);
    this.midTrees = makeTreeline(rng, this.level.length + 1200, 0.58, 180, 340);
    this.grass = Array.from({ length: 140 }, () => ({
      x: rng() * (this.level.length + 1200),
      h: 20 + rng() * 46,
      p: rng() * Math.PI * 2,
    }));
    this.stars = Array.from({ length: 90 }, () => ({
      x: rng(),
      y: rng() * 0.6,
      s: rng() * 1.4 + 0.3,
      tw: rng() * Math.PI * 2,
    }));

    this._statTick = 0;
  }

  _bind() {
    this._kd = (e) => {
      const k = e.key.toLowerCase();
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k)
      ) {
        e.preventDefault();
      }
      this.keys.add(k);
    };
    this._ku = (e) => this.keys.delete(e.key.toLowerCase());
    this._resize = () => this.resize();
    // pointer/touch: hold to glide (mobile)
    this._pd = () => this.keys.add(' ');
    this._pu = () => this.keys.delete(' ');
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('keydown', this._kd, { passive: false });
    window.addEventListener('keyup', this._ku);
    window.addEventListener('resize', this._resize);
    this.canvas.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointerup', this._pu);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('pointerdown', this._pd);
    window.removeEventListener('pointerup', this._pu);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(320, rect.width);
    this.h = Math.max(240, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundY = this.h - 74;
  }

  loop(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((n) => this.loop(n));
    let frame = now - this.last;
    this.last = now;
    if (frame > 250) frame = 250; // tab was backgrounded — don't spiral
    this.acc += frame;
    let steps = 0;
    while (this.acc >= STEP && steps < 6) {
      this.update(STEP);
      this.acc -= STEP;
      steps++;
    }
    this.render(this.acc / STEP);
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    this.spent += dt / 1000;
    const m = this.moth;
    const lvl = this.level;

    const up = this.keys.has('arrowup') || this.keys.has('w');
    const down = this.keys.has('arrowdown') || this.keys.has('s');
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const glide = this.keys.has(' ') || up;

    // Horizontal drift.
    const accel = 0.55;
    if (left) m.vx -= accel;
    if (right) m.vx += accel;
    if (left || right) m.facing = right ? 1 : -1;
    m.vx *= 0.9; // air friction
    m.vx = clamp(m.vx, -6, 6);

    // Vertical: gravity always, glide gives soft lift, down nudges descent.
    m.vy += lvl.gravity; // gravity
    if (glide) m.vy -= lvl.gravity + 0.62; // net gentle rise
    if (down) m.vy += 0.5;
    if (glide && m.vy > 0) m.vy *= lvl.glideDrag; // gliding slows the fall
    m.vy = clamp(m.vy, -6.5, 7.5);
    m.gliding = glide;

    m.x = clamp(m.x + m.vx, 40, lvl.length);
    m.y += m.vy;

    // Soft ceiling.
    if (m.y < 40) {
      m.y = 40;
      m.vy = Math.max(m.vy, 0) * 0.4;
    }
    // Soft ground: settle, never a hard reset.
    const restY = this.groundY - 8;
    if (m.y > restY) {
      m.y = lerp(m.y, restY, 0.35);
      m.vy = 0;
      m.resting = true;
    } else {
      m.resting = false;
    }

    // Wingbeat + idle bob.
    const activity = Math.min(1, (Math.abs(m.vx) + Math.abs(m.vy)) / 6);
    m.wing += dt * (0.006 + activity * 0.012) + (glide ? 0.004 : 0);
    m.bob += dt * 0.004;

    // Eased camera (lags behind the moth) — keeps it ~40% from the left.
    const targetX = m.x - this.w * 0.4;
    const targetY = m.y - this.h * 0.52;
    this.cam.x = lerp(this.cam.x, clamp(targetX, 0, lvl.length - this.w + 200), 0.06);
    this.cam.y = lerp(this.cam.y, clamp(targetY, -160, 120), 0.05);

    // Spore pickups.
    for (const s of this.spores) {
      if (s.taken) {
        s.pop = Math.min(1, s.pop + dt * 0.004);
        continue;
      }
      s.phase += dt * 0.003;
      const dx = s.x - m.x;
      const dy = s.y - m.y;
      if (dx * dx + dy * dy < 34 * 34) {
        s.taken = true;
        s.pop = 0.001;
        this.collected++;
        this.glow = Math.min(1, this.glow + 0.145);
        this._burst(s.x, s.y, s.kind === 'rose' ? C.rose : C.amber);
        if (this.audio) this.audio.chime();
        if (this.glow >= 1 && this.bloomT <= 0) this._triggerBloom();
      }
    }

    // Bloom lifecycle.
    if (this.bloomT > 0) {
      this.bloomT -= dt;
      this.bloomWave += dt * 1.5;
      for (const l of this.lanterns) {
        const d = Math.abs(l.x - m.x);
        if (d < this.bloomWave) l.target = 1;
      }
      this.flash = clamp(this.flash + dt * 0.002, 0, 0.4);
      if (this.bloomT <= 0) {
        this.glow = 0.2;
        for (const l of this.lanterns) l.target = 0.32;
      }
    } else {
      this.flash = Math.max(0, this.flash - dt * 0.0015);
    }
    for (const l of this.lanterns) {
      l.lit = lerp(l.lit, l.target, 0.06);
      l.sway += dt * 0.0016;
    }

    // Fireflies drift + slow parallax scroll.
    for (const f of this.fireflies) {
      f.p += dt * 0.002 * f.z;
      f.x += Math.sin(f.p) * 0.15 * f.z;
      f.y += Math.cos(f.p * 0.7) * 0.12 * f.z;
    }

    // Particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.vx *= 0.97;
    }

    // Emit HUD stats a few times per second.
    this._statTick += dt;
    if (this._statTick > 120) {
      this._statTick = 0;
      this.onStats({
        spores: this.collected,
        blooms: this.blooms,
        seconds: Math.round(this.spent),
        glow: this.glow,
        resting: m.resting,
        total: this.spores.length,
      });
    }
  }

  _triggerBloom() {
    this.blooms++;
    this.bloomT = 2600;
    this.bloomWave = 0;
    if (this.audio) this.audio.bloom();
    // a ring of light from the moth
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      this.particles.push({
        x: this.moth.x,
        y: this.moth.y,
        vx: Math.cos(a) * (2 + this.rng() * 2),
        vy: Math.sin(a) * (2 + this.rng() * 2),
        life: 900,
        max: 900,
        size: 2 + this.rng() * 2,
        color: i % 2 ? C.amber : C.cream,
      });
    }
  }

  _burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 1 + this.rng() * 2.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 520 + this.rng() * 260,
        max: 700,
        size: 1.4 + this.rng() * 2.4,
        color,
      });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const { w, h } = this;
    const cx = this.cam.x;
    const cy = this.cam.y;

    // Sky gradient (parallax layer 0).
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C.sky0);
    sky.addColorStop(0.45, C.sky1);
    sky.addColorStop(1, C.sky2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Warm glow low on the horizon.
    const hg = ctx.createRadialGradient(w * 0.7, h * 0.9, 20, w * 0.7, h * 0.9, h * 0.9);
    hg.addColorStop(0, 'rgba(245,194,107,0.12)');
    hg.addColorStop(1, 'rgba(245,194,107,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);

    // Stars (twinkle, drift very slowly).
    for (const st of this.stars) {
      const sx = (st.x * w - cx * 0.06) % (w + 40);
      const x = sx < 0 ? sx + w + 40 : sx;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 0.002 + st.tw);
      ctx.globalAlpha = 0.25 + tw * 0.6;
      ctx.fillStyle = C.cream;
      ctx.fillRect(x, st.y * h + 8, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // Far treeline (layer 1).
    this._drawTrees(this.farTrees, cx * 0.34, '#150f2b', 0.36);
    // Mid treeline (layer 2).
    this._drawTrees(this.midTrees, cx * 0.58, '#0f1f28', 0.55);

    // Fireflies behind play layer.
    this._drawFireflies(cx, 0.7);

    // Ground band (play layer base, layer 3).
    ctx.fillStyle = C.petrol;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, this.groundY + 24, w, h - this.groundY);
    ctx.globalAlpha = 1;
    const gg = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 30);
    gg.addColorStop(0, 'rgba(31,75,82,0)');
    gg.addColorStop(1, 'rgba(15,31,40,0.9)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, this.groundY - 6, w, 40);

    // Lanterns (play layer) — they light up during The Bloom.
    for (const l of this.lanterns) {
      const x = l.x - cx;
      if (x < -80 || x > w + 80) continue;
      this._drawLantern(x, l.y - cy * 0.9, l.lit, l.sway);
    }

    // Spores.
    for (const s of this.spores) {
      const x = s.x - cx;
      if (x < -40 || x > w + 40) continue;
      this._drawSpore(x, s.y - cy, s);
    }

    // Particles.
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cx, p.y - cy, p.size * (0.4 + a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The moth.
    this._drawMoth(this.moth.x - cx, this.moth.y - cy);

    // Foreground grass (layer 4, drifts fastest, slightly blurred feel).
    this._drawGrass(cx * 1.15);

    // Bloom flash overlay.
    if (this.flash > 0.001) {
      ctx.fillStyle = `rgba(254,243,208,${this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Soft vignette.
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  _drawTrees(list, offset, color, alpha) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (const tr of list) {
      const x = tr.x - offset;
      if (x < -tr.w || x > this.w + tr.w) continue;
      const baseY = this.groundY + 24;
      ctx.beginPath();
      ctx.moveTo(x - tr.w / 2, baseY);
      ctx.quadraticCurveTo(x - tr.w * 0.2, baseY - tr.h * 0.7, x, baseY - tr.h);
      ctx.quadraticCurveTo(x + tr.w * 0.2, baseY - tr.h * 0.7, x + tr.w / 2, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFireflies(cx, factor) {
    const ctx = this.ctx;
    for (const f of this.fireflies) {
      const x = ((f.x - cx * factor * f.z) % (this.w + 200) + this.w + 200) % (this.w + 200) - 100;
      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * 0.004 + f.p));
      ctx.globalAlpha = glow * 0.8;
      const r = f.s * (1.4 + glow);
      const g = ctx.createRadialGradient(x, f.y, 0, x, f.y, r * 3);
      g.addColorStop(0, C.amber);
      g.addColorStop(1, 'rgba(245,194,107,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, f.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawGrass(offset) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#0b1a20';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const bl of this.grass) {
      const x = bl.x - offset;
      if (x < -20 || x > this.w + 20) continue;
      const sway = Math.sin(this.t * 0.001 + bl.p) * 8;
      const baseY = this.h + 4;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway * 0.5, baseY - bl.h * 0.6, x + sway, baseY - bl.h);
      ctx.stroke();
    }
  }

  _drawLantern(x, y, lit, sway) {
    const ctx = this.ctx;
    const s = Math.sin(sway) * 3;
    // glow halo
    const r = 40 + lit * 34;
    const g = ctx.createRadialGradient(x + s, y, 0, x + s, y, r);
    g.addColorStop(0, `rgba(245,194,107,${0.15 + lit * 0.5})`);
    g.addColorStop(1, 'rgba(245,194,107,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + s, y, r, 0, Math.PI * 2);
    ctx.fill();
    // string
    ctx.strokeStyle = 'rgba(234,227,245,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 60);
    ctx.lineTo(x + s, y);
    ctx.stroke();
    // body
    ctx.fillStyle = lit > 0.6 ? C.cream : C.amberDeep;
    ctx.globalAlpha = 0.5 + lit * 0.5;
    roundRect(ctx, x + s - 8, y - 10, 16, 22, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawSpore(x, y, s) {
    const ctx = this.ctx;
    const color = s.kind === 'rose' ? C.rose : C.amber;
    if (s.taken) {
      // pop: expand + fade
      const p = s.pop;
      ctx.globalAlpha = 1 - p;
      const rr = 10 + p * 28;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (1 - p);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    const pulse = 1 + Math.sin(s.phase) * 0.14;
    const float = Math.sin(s.phase * 0.9) * 4;
    const yy = y + float;
    // halo
    const g = ctx.createRadialGradient(x, yy, 0, x, yy, 26 * pulse);
    g.addColorStop(0, color);
    g.addColorStop(0.3, color);
    g.addColorStop(1, 'rgba(245,194,107,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, yy, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // core
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x, yy, 4.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawMoth(x, y) {
    const ctx = this.ctx;
    const m = this.moth;
    const bob = Math.sin(m.bob) * (m.resting ? 1.5 : 3);
    const yy = y + bob;
    const flap = m.gliding
      ? 0.15 + Math.sin(m.wing) * 0.08 // wide, slow when gliding
      : 0.5 + Math.sin(m.wing) * 0.5; // full beat when flapping
    const glowR = 34 + this.glow * 46;

    // aura (grows with glow meter — the visible "charge" toward The Bloom)
    const ag = ctx.createRadialGradient(x, yy, 0, x, yy, glowR);
    ag.addColorStop(0, `rgba(245,194,107,${0.22 + this.glow * 0.4})`);
    ag.addColorStop(1, 'rgba(245,194,107,0)');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(x, yy, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, yy);
    ctx.scale(m.facing, 1);
    const tilt = clamp(m.vy * 0.02, -0.3, 0.3) + clamp(m.vx * 0.02, -0.2, 0.2);
    ctx.rotate(tilt);

    // wings (two per side), drawn with a flap scale on width
    const wingW = lerp(10, 26, flap);
    this._wing(-1, wingW, 1); // back-left
    this._wing(1, wingW, 1); // back-right
    this._wing(-1, wingW * 0.8, 0.7, true); // fore
    this._wing(1, wingW * 0.8, 0.7, true, true);

    // body
    const bg = ctx.createLinearGradient(0, -10, 0, 12);
    bg.addColorStop(0, '#3a2c5e');
    bg.addColorStop(1, '#241b45');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // glowing core
    ctx.fillStyle = C.cream;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, -1, 2.6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // antennae
    ctx.strokeStyle = C.rose;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 2, -9);
      ctx.quadraticCurveTo(dir * 7, -18, dir * 5, -22);
      ctx.stroke();
      ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.arc(dir * 5, -22, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _wing(side, wById, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(side, 1);
    const g = ctx.createLinearGradient(0, 0, wById + 14, 0);
    g.addColorStop(0, 'rgba(232,143,160,0.9)');
    g.addColorStop(0.6, 'rgba(245,194,107,0.55)');
    g.addColorStop(1, 'rgba(245,194,107,0.05)');
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(wById + 14, -18, wById + 12, -2);
    ctx.quadraticCurveTo(wById + 16, 12, 2, 8);
    ctx.closePath();
    ctx.fill();
    // glowing wing edge
    ctx.strokeStyle = 'rgba(254,243,208,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  getScore() {
    return {
      spores: this.collected,
      blooms: this.blooms,
      seconds: Math.round(this.spent),
    };
  }
}

// ── helpers ───────────────────────────────────────────────────────────────
function normalizeLevel(level) {
  const base = {
    length: 4200,
    gravity: 0.42,
    glideDrag: 0.86,
    spores: [],
    lanterns: [],
  };
  if (!level) {
    // fallback so the game is playable even if the API is down
    const spores = [];
    for (let i = 0; i < 12; i++) {
      spores.push({ x: 340 + i * 320, y: 180 + Math.sin(i) * 90 + 160, kind: i % 4 === 3 ? 'rose' : 'warm' });
    }
    const lanterns = [];
    for (let i = 0; i < 7; i++) lanterns.push({ x: 300 + i * 560, y: 420 });
    return { ...base, spores, lanterns };
  }
  return {
    length: level.length || base.length,
    gravity: level.gravity || base.gravity,
    glideDrag: level.glideDrag || base.glideDrag,
    spores: level.spores || [],
    lanterns: level.lanterns || [],
  };
}

function makeTreeline(rng, span, density, minH, maxH) {
  const trees = [];
  const gap = 120 / density;
  for (let x = 0; x < span; x += gap * (0.6 + rng() * 0.8)) {
    trees.push({ x, w: 90 + rng() * 130, h: minH + rng() * (maxH - minH) });
  }
  return trees;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
