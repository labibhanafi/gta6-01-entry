// WebAudio synth only — no audio files. Engine hum by speed, two-tone siren,
// gunshots, pickup blip, mission sting, and a simple bassline music loop.
// Created lazily on first user gesture; shot scenes never touch it.
import { clamp } from './random.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine hum: low sawtooth through a lowpass, gain follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren: sine that alternates 660/880 Hz
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot(kind) {
    if (kind === 'shotgun') this._noise(0.28, 0.5, 900);
    else if (kind === 'smg') this._noise(0.09, 0.32, 1600);
    else if (kind === 'pistol') this._noise(0.14, 0.4, 1300);
    else this._noise(0.07, 0.25, 700);
  }

  punch() { this._noise(0.06, 0.3, 500); }
  reload() { this._blip(900, 0.08, 'square', 0.12, 500); }
  pickup() { this._blip(880, 0.12, 'sine', 0.22, 1320); }
  coin() { this._blip(1046, 0.1, 'sine', 0.2, 1568); }
  crash() { this._noise(0.35, 0.5, 500); }
  explosion() { this._noise(0.7, 0.7, 300); this._blip(90, 0.6, 'sine', 0.4, 35); }
  sting() {
    // mission-complete arpeggio
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.22, 'triangle', 0.22), i * 110);
    });
  }
  fail() { this._blip(220, 0.4, 'sawtooth', 0.2, 110); }
  siren(on) {
    if (this.sirenGain) this.sirenGain.gain.value = on && !this.muted ? 0.05 : 0;
  }

  // Called every frame: engine pitch by speed, siren wail, bassline step.
  update(dt, speedNorm, wanted, started) {
    if (!this.ctx) return;
    if (this.engineOsc && this.engineGain) {
      this.engineOsc.frequency.value = 45 + speedNorm * 140;
      this.engineGain.gain.value = started ? 0.02 + speedNorm * 0.06 : 0;
    }
    if (this.sirenOsc && wanted > 0) {
      this.sirenPhase += dt * 2.2;
      const hi = Math.floor(this.sirenPhase) % 2 === 0;
      this.sirenOsc.frequency.value = hi ? 880 : 660;
    }
    // bassline: A minor walk, one note per 0.22 s
    this.musicTimer += dt;
    if (started && this.musicTimer > 0.22) {
      this.musicTimer = 0;
      const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
      const f = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      this._blip(f, 0.2, 'triangle', 0.07);
      if (this.musicStep % 4 === 0) this._blip(f * 2, 0.08, 'sine', 0.03);
    }
  }
}
