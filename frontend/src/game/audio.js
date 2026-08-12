// Mothsong ambient audio — generated entirely with the Web Audio API (no asset files).
//
// Design: a low, slow pad drone; soft pentatonic chimes on each spore pickup (always
// consonant, so rapid pickups sound musical); and a warm major chord for The Bloom.
//
// It never autoplays. The AudioContext is created and resumed only when the player
// explicitly turns sound on (respecting browser autoplay policies + the brief's
// "muted by default, no loud autoplay").

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 D5 E5 G5 A5
const BLOOM_CHORD = [261.63, 329.63, 392.0, 493.88, 587.33]; // Cmaj9-ish

export default class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padGain = null;
    this.enabled = false;
    this._pickupIx = 0;
  }

  // Called on an explicit user gesture (the sound toggle).
  enable() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(this.ctx.destination);
      this._startPad();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.enabled = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.5, t + 0.8);
  }

  mute() {
    this.enabled = false;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.5);
  }

  _startPad() {
    const ctx = this.ctx;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.12;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.7;

    // Two detuned voices a fifth apart for a soft, wide bed.
    [110, 164.81].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = i === 0 ? -6 : 5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.32;
      osc.connect(g).connect(filter);
      osc.start();
    });

    // Slow filter sweep so the pad "breathes".
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    filter.connect(this.padGain).connect(this.master);
  }

  chime() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Walk up the scale as you collect, then wrap — feels like an ascending phrase.
    const base = PENTATONIC[this._pickupIx % PENTATONIC.length];
    this._pickupIx++;
    const octave = Math.random() > 0.7 ? 2 : 1;
    this._voice(base * octave, t, 0.9, 0.18, 'triangle');
    this._voice(base * octave * 1.5, t + 0.02, 0.6, 0.06, 'sine');
  }

  bloom() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    BLOOM_CHORD.forEach((f, i) => {
      this._voice(f, t + i * 0.06, 2.4, 0.14, 'triangle');
      this._voice(f * 2, t + i * 0.06 + 0.01, 1.8, 0.05, 'sine');
    });
    this._pickupIx = 0;
  }

  _voice(freq, start, dur, peak, type) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  destroy() {
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
