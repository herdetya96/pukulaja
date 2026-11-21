// Synthesised engine note. A V12 fires six times per crank revolution, so the
// fundamental is rpm / 10 Hz; the stack below is locked to that and its orders.
export function createAudio() {
  let ctx = null, n = null, enabled = false;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.8; tone.frequency.value = 600;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 360; body.Q.value = 1.1; body.gain.value = 6;
    const pipe = ctx.createBiquadFilter(); pipe.type = 'peaking'; pipe.frequency.value = 1250; pipe.Q.value = 1.4; pipe.gain.value = 5;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(2.2 * x); }
    shaper.curve = curve; shaper.oversample = '2x';
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    mix.connect(shaper); shaper.connect(tone); tone.connect(body); body.connect(pipe); pipe.connect(master);

    // [order relative to firing frequency, waveform, level]
    const orders = [[1 / 6, 'sine', 0.5], [0.5, 'sawtooth', 0.34], [1, 'sawtooth', 0.5], [1.004, 'sawtooth', 0.3], [2, 'square', 0.1], [3, 'sawtooth', 0.05]];
    const osc = orders.map(([mult, type, level]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 60 * mult;
      const g = ctx.createGain(); g.gain.value = level;
      o.connect(g); g.connect(mix); o.start();
      return { o, g, mult, level };
    });

    // induction noise through the trumpets
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 0.9; nf.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.value = 0;
    noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start();

    n = { master, tone, osc, nf, ng };
    return true;
  }

  function setEnabled(on) {
    if (on && !ctx && !build()) return false;
    enabled = on;
    if (ctx) {
      if (on) ctx.resume?.();
      else n.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
    return enabled;
  }

  function update(rpm, throttle) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime, k = Math.min(1, rpm / 9000);
    const f = Math.max(8, rpm / 10);
    for (const o of n.osc) {
      o.o.frequency.setTargetAtTime(f * o.mult, t, 0.03);
      // the crank-order rumble fades as revs build; the 12th order comes in
      const lvl = o.mult < 0.2 ? o.level * (1 - k) : o.mult >= 2 ? o.level * (0.4 + 1.6 * k) : o.level;
      o.g.gain.setTargetAtTime(lvl, t, 0.05);
    }
    n.tone.frequency.setTargetAtTime(380 + rpm * 0.5 + throttle * 2200, t, 0.06);
    n.nf.frequency.setTargetAtTime(700 + rpm * 0.32, t, 0.08);
    n.ng.gain.setTargetAtTime(rpm > 60 ? 0.012 + 0.09 * throttle * k : 0, t, 0.08);
    const vol = rpm > 60 ? 0.07 + 0.09 * k + 0.05 * throttle : 0;
    n.master.gain.setTargetAtTime(vol, t, 0.08);
  }

  return { setEnabled, update, get enabled() { return enabled; } };
}
