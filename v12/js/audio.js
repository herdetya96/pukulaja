// Engine note, modelled as a source and a filter rather than stacked tones.
//
// Source: one oscillator per cylinder bank plays a single 720° engine cycle as
// its waveform: six exhaust pressure pulses, 120° apart, each with a fast rise,
// a decay and a rarefaction behind it. The two banks are 60° out of step and
// panned apart, the way a twin exhaust is. Small fixed differences between
// cylinders put energy between the main orders, which is where a real engine
// gets its texture. Turbulence is noise gated by the same pulses.
//
// Filter: the pulses then pass through fixed resonances standing in for the
// exhaust system, so as revs rise the harmonics sweep through them and the
// note hardens into a wail instead of simply rising in pitch.
//
// Add induction roar from the open trumpets, a little valvetrain hiss, a short
// room reverb, and crackle on a closed throttle at high revs.

export const VOICES = {
  berlinetta: {
    label: 'Berlinetta', spread: 0.03, drive: 1.5, rasp: 0.22, intake: 0.55, bright: 1.0, pops: 0.5,
    formants: [[170, 1.1, 4], [410, 1.5, 7], [880, 2.2, 9], [1850, 2.6, 7], [3300, 3, 4]],
  },
  corsa: {
    label: 'Corsa', spread: 0.085, drive: 3.2, rasp: 0.5, intake: 0.32, bright: 1.35, pops: 1.2,
    formants: [[140, 1.3, 6], [520, 2.2, 9], [1240, 3, 10], [2550, 3.2, 8], [4200, 3, 4]],
  },
};
export const VOICE_ORDER = ['berlinetta', 'corsa'];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// One engine cycle of a six-cylinder bank as harmonic coefficients.
function cycleWave(ctx, offsetDeg, spread, seed, intake = false) {
  const N = 4096, H = 900, buf = new Float32Array(N), rand = rng(seed);
  for (let c = 0; c < 6; c++) {
    const amp = 1 + (rand() - 0.5) * 2 * spread * 2.2, t0 = offsetDeg + c * 120 + (rand() - 0.5) * spread * 90;
    for (let n = 0; n < N; n++) {
      let th = (n / N * 720 - t0) % 720; if (th < 0) th += 720;
      if (th > 400) continue;
      const v = intake
        ? -(Math.sin(Math.PI * Math.min(1, th / 170)) ** 2)
        : (1 - Math.exp(-th / 3.2)) * Math.exp(-th / 33) - 0.32 * Math.exp(-(((th - 104) / 40) ** 2));
      buf[n] += amp * v;
    }
  }
  const real = new Float32Array(H + 1), imag = new Float32Array(H + 1);
  for (let k = 1; k <= H; k++) {
    let re = 0, im = 0;
    const w = 2 * Math.PI * k / N;
    for (let n = 0; n < N; n++) { re += buf[n] * Math.cos(w * n); im += buf[n] * Math.sin(w * n); }
    real[k] = re * 2 / N; imag[k] = im * 2 / N;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function noiseBuffer(ctx, seconds, seed) {
  const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = rng(seed);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return b;
}

// Build the whole voice on any (live or offline) audio context.
export function buildVoice(ctx, id = 'berlinetta') {
  const V = VOICES[id];
  const out = ctx.createGain(); out.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.18;
  out.connect(comp); comp.connect(ctx.destination);

  // short room, so it does not sound like it is inside your head
  const room = ctx.createConvolver(), ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 0.7), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch), r = rng(77 + ch);
    for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3.2);
  }
  room.buffer = ir;
  const send = ctx.createGain(); send.gain.value = 0.16;
  out.connect(send); send.connect(room); room.connect(comp);

  // exhaust: two banks, pulses 60° apart, into shaper and fixed resonances
  const pre = ctx.createGain(); pre.gain.value = 1;
  const shaper = ctx.createWaveShaper(), curve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
  shaper.curve = curve; shaper.oversample = '2x';
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55; hp.Q.value = 0.7;
  pre.connect(shaper); shaper.connect(hp);
  let node = hp;
  for (const [f, q, g] of V.formants) {
    const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = q; b.gain.value = g;
    node.connect(b); node = b;
  }
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6; tone.frequency.value = 900;
  const exGain = ctx.createGain(); exGain.gain.value = 0.2;
  node.connect(tone); tone.connect(exGain); exGain.connect(out);

  const banks = [[0, 11, -0.42], [60, 29, 0.42]].map(([offset, seed, panTo]) => {
    const o = ctx.createOscillator(); o.setPeriodicWave(cycleWave(ctx, offset, V.spread, seed)); o.frequency.value = 8;
    const pan = ctx.createStereoPanner(); pan.pan.value = panTo;
    o.connect(pan); pan.connect(pre); o.start();
    return o;
  });

  // turbulence: noise whose level follows the pressure pulses
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer(ctx, 2, 4242); noise.loop = true; noise.start();
  const raspBand = ctx.createBiquadFilter(); raspBand.type = 'bandpass'; raspBand.frequency.value = 2100; raspBand.Q.value = 0.6;
  const rasp = ctx.createGain(); rasp.gain.value = 0;
  const raspDepth = ctx.createGain(); raspDepth.gain.value = 0;
  for (const o of banks) o.connect(raspDepth);
  raspDepth.connect(rasp.gain);
  noise.connect(raspBand); raspBand.connect(rasp); rasp.connect(pre);

  // induction through twelve open trumpets
  const intakeOsc = ctx.createOscillator(); intakeOsc.setPeriodicWave(cycleWave(ctx, 20, V.spread * 0.5, 53, true)); intakeOsc.frequency.value = 8;
  const intakeOsc2 = ctx.createOscillator(); intakeOsc2.setPeriodicWave(cycleWave(ctx, 80, V.spread * 0.5, 67, true)); intakeOsc2.frequency.value = 8;
  const intakeLp = ctx.createBiquadFilter(); intakeLp.type = 'lowpass'; intakeLp.frequency.value = 700; intakeLp.Q.value = 1.2;
  const intakeGain = ctx.createGain(); intakeGain.gain.value = 0;
  intakeOsc.connect(intakeLp); intakeOsc2.connect(intakeLp); intakeLp.connect(intakeGain); intakeGain.connect(out);
  intakeOsc.start(); intakeOsc2.start();
  const hiss = ctx.createBiquadFilter(); hiss.type = 'bandpass'; hiss.frequency.value = 3200; hiss.Q.value = 0.5;
  const hissGain = ctx.createGain(); hissGain.gain.value = 0;
  noise.connect(hiss); hiss.connect(hissGain); hissGain.connect(out);

  const crackle = noiseBuffer(ctx, 0.25, 909);
  function pop(at, level) {
    const s = ctx.createBufferSource(); s.buffer = crackle;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 260 + Math.random() * 900; f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.07 + Math.random() * 0.06);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(at, Math.random() * 0.1); s.stop(at + 0.2);
  }

  let lastThrottle = 0, popBudget = 0;
  // instant = jump straight to the values (used when rendering offline)
  function update(rpm, throttle, dt = 0.016, instant = false) {
    const t = ctx.currentTime, k = Math.min(1, rpm / 9000), on = rpm > 80;
    const set = (param, v, tc) => { if (instant) param.value = v; else param.setTargetAtTime(v, t, tc); };
    const f = Math.max(0.5, rpm / 120);                       // one engine cycle per two revolutions
    for (const o of banks) set(o.frequency, f, 0.022);
    set(intakeOsc.frequency, f, 0.022); set(intakeOsc2.frequency, f, 0.022);
    const load = 0.22 + 0.78 * Math.max(throttle, 0.6 * (1 - k));      // an idling engine is not a quiet one
    set(pre.gain, 0.5 + V.drive * (0.25 + 0.75 * throttle) * (0.45 + 0.55 * k), 0.05);
    set(tone.frequency, Math.min(15000, (650 + 6200 * k * (0.4 + 0.6 * throttle)) * V.bright), 0.06);
    set(exGain.gain, on ? 0.2 * load * (0.55 + 0.45 * k) / (0.5 + 0.22 * V.drive) : 0, 0.06);
    set(raspDepth.gain, V.rasp * (0.25 + 0.75 * throttle) * (0.3 + 0.7 * k), 0.06);
    set(raspBand.frequency, 1500 + 2600 * k, 0.1);
    set(intakeLp.frequency, 380 + 1500 * k, 0.08);
    set(intakeGain.gain, on ? V.intake * 0.5 * throttle * (0.35 + 0.65 * k) : 0, 0.07);
    set(hissGain.gain, on ? 0.003 + 0.022 * k : 0, 0.1);
    set(out.gain, on ? 0.9 : 0, 0.08);
    // overrun: lifting off at high revs lets unburnt charge crackle in the pipes
    if (!instant) {
      if (lastThrottle - throttle > 0.25 && rpm > 4200) popBudget = 5 + Math.random() * 5;
      if (popBudget > 0 && throttle < 0.08 && rpm > 2800 && Math.random() < dt * 11 * V.pops) {
        pop(t + Math.random() * 0.03, 0.1 + Math.random() * 0.16 * V.pops); popBudget--;
      }
      if (throttle > 0.15) popBudget = 0;
    }
    lastThrottle = throttle;
  }
  function stop() { out.gain.setTargetAtTime(0, ctx.currentTime, 0.04); }
  return { update, stop, out };
}

export function createAudio() {
  let ctx = null, voice = null, current = null;
  // id: a key of VOICES, or null/false for silence. Returns what is now playing.
  function setVoice(id) {
    if (!id) { voice?.stop(); current = null; return null; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    ctx.resume?.();
    if (voice && current !== id) { const old = voice; old.stop(); setTimeout(() => old.out.disconnect(), 400); voice = null; }
    if (!voice) voice = buildVoice(ctx, id);
    current = id;
    return id;
  }
  function update(rpm, throttle, dt) { if (current && voice) voice.update(rpm, throttle, dt); }
  return { setVoice, update, get voice() { return current; } };
}
