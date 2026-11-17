// SOLMAR — WebAudio synth sound only. No audio files: engine hum by speed,
// two-tone siren, gunshots, pickup blip, mission sting, bassline music loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenHi = false, sirenT = 0;
  let musicTimer = 0, musicStep = 0, musicOn = false;
  let muted = false;
  const BASS = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 0, 65.4, 58.3];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // engine hum
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      // siren
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

  function blip(freq, dur, type = 'sine', vol = 0.25, slideTo = 0) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is garnish, never fatal */ }
  }

  function noise(dur, vol, freq = 1200) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    unlock,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    gunshot(w) {
      if (w === 'shotgun') { noise(0.28, 0.5, 900); blip(120, 0.12, 'square', 0.3, 50); }
      else if (w === 'smg') { noise(0.09, 0.3, 1600); }
      else if (w === 'pistol') { noise(0.16, 0.4, 1400); blip(220, 0.08, 'square', 0.18, 70); }
      else blip(180, 0.06, 'square', 0.2, 90);
    },
    enemyShot(d) { if (d < 45) noise(0.12, Math.max(0.05, 0.3 - d / 200), 1300); },
    explosion() { noise(0.7, 0.6, 500); blip(70, 0.5, 'sine', 0.4, 28); },
    thud() { noise(0.12, 0.35, 300); blip(90, 0.1, 'sine', 0.25, 45); },
    click() { blip(1400, 0.04, 'square', 0.12); },
    reload() { blip(700, 0.05, 'square', 0.14); setTimeout(() => blip(950, 0.05, 'square', 0.14), 120); },
    pickup() { blip(880, 0.09, 'sine', 0.25); setTimeout(() => blip(1320, 0.12, 'sine', 0.25), 90); },
    coin() { blip(1046, 0.08, 'sine', 0.22); setTimeout(() => blip(1568, 0.14, 'sine', 0.22), 80); },
    sting() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.28), i * 110));
    },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.18), i * 140)); },
    step(dt, speed, wanted) {
      if (!ctx || muted) return;
      // engine hum follows speed
      if (engineGain && engineOsc) {
        const target = speed > 0.5 ? 0.05 + Math.min(0.12, Math.abs(speed) / 500) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 2.4, ctx.currentTime, 0.1);
      }
      // two-tone siren while wanted
      if (sirenOsc && sirenGain) {
        if (wanted >= 1) {
          sirenT += dt;
          if (sirenT > 0.42) { sirenT = 0; sirenHi = !sirenHi; sirenOsc.frequency.setTargetAtTime(sirenHi ? 960 : 720, ctx.currentTime, 0.05); }
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        } else sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
      // simple bassline loop (16 steps, ~0.22 s each)
      musicTimer += dt;
      if (musicTimer > 0.22) {
        musicTimer = 0;
        const f = BASS[musicStep % BASS.length];
        musicStep++;
        if (f > 0) blip(f, 0.2, 'triangle', 0.07);
        if (musicStep % 4 === 0) blip(220, 0.05, 'sine', 0.03);
      }
    },
  };
}
