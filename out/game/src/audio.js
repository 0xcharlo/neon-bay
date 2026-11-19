// Neon Bay — all sound is synthesized with WebAudio. No audio files are
// loaded, so the game stays silent on the network and small on disk.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    gunshot() { noise(0.12, 0.5, 900); tone(160, 0.1, 'square', 0.25, 60); },
    crash() { noise(0.25, 0.5, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.12, 'sine', 0.25), 90); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 120));
    },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    denied() { tone(180, 0.15, 'square', 0.2); },
    // Call every frame while driving: pitch follows speed.
    engine(speed01, driving) {
      if (!ensure()) return;
      if (!driving) {
        if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + speed01 * 0.05, t, 0.1);
    },
    // Call every frame; the two-tone siren only sounds while wanted.
    siren(dt, wanted) {
      if (!ensure() || muted || wanted < 1) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        tone(sirenHigh ? 880 : 660, 0.4, 'sine', 0.06);
      }
    },
  };
}
