// Tipo 600 — boot and main loop.
import { createMaterials, applyFinish } from './materials.js';
import { buildEngine } from './engine.js';
import { buildCar } from './car.js';
import { createStage, SECTIONS } from './stage.js';
import { createUI } from './ui.js';
import { createAudio, VOICES, VOICE_ORDER } from './audio.js';
import { E, PARTS, LAYERS, CAR_LAYERS, FINISHES, GEARS, FINAL_DRIVE, TYRE_R } from './config.js';

const TAU = Math.PI * 2;
const state = {
  subject: 'car',
  running: false, rpm: 0, rpmShown: 0, throttle: 0, theta: 0, slow: 1 / 32, heat: 0,
  explode: 0, explodeTarget: 0,
  mode: 'studio', section: 'long', sectionPos: 0.5,
  selected: null, isolated: false,
  callouts: true, spin: false, sound: null, clean: false,
  bonnet: 0, bonnetOpen: false, doors: 0, doorsOpen: false, lights: true, steer: 0, gear: 0, roll: 0, speed: 0,
  finishes: {
    paint: 'rosso', roof: 'body', wheels: 'silver', calipers: 'yellow', interior: 'cuoio',
    covers: 'rosso', block: 'cast', intake: 'polished', exhaust: 'titanium',
  },
  layers: {},
};

async function boot() {
  // the nameplate textures want the display face; don't wait long for it
  try { await Promise.race([document.fonts.load('700 54px Syncopate'), new Promise(r => setTimeout(r, 1200))]); } catch { /* fallback face */ }
  await new Promise(r => requestAnimationFrame(() => r()));

  const M = createMaterials();
  const engine = buildEngine(M);
  const car = buildCar(M);
  const stageEl = document.getElementById('stage');
  let stage;
  try {
    // add #lite to the address for a reduced-effects renderer on slow machines
    stage = createStage(stageEl, M, engine, car, { lite: location.hash === '#lite' });
  } catch (err) {
    document.getElementById('veil-msg').textContent = 'This browser could not start WebGL 2, which the showcase needs.';
    document.querySelector('#veil .bar').hidden = true;
    console.error(err);
    return;
  }
  const audio = createAudio();
  if (stage.mobile) state.callouts = false;

  const layersNow = () => state.subject === 'car' ? CAR_LAYERS : LAYERS;
  const partOn = pid => {
    if (state.layers[PARTS[pid].layer] === false) return false;
    if (pid === 'airbox') return FINISHES.intake.options.find(o => o.id === state.finishes.intake).airbox === true;
    return true;
  };
  const refreshVisibility = () => { for (const pid of Object.keys(PARTS)) stage.setPartVisible(pid, partOn(pid)); };
  const sections = () => SECTIONS[state.subject];
  const sectionStart = name => { const s = sections()[name]; return (s.range[1] - s.start) / (s.range[1] - s.range[0]); };
  const sectionValue = () => {
    const s = sections()[state.section];
    return s.range[1] + (s.range[0] - s.range[1]) * state.sectionPos;
  };
  const frameFor = e => state.subject === 'car' ? [6.3 + 2.0 * e, -1.5 + 1.5 * e] : [4.9 + 3.5 * e, 0.6 + 3.4 * e];
  const applyExplode = e => {
    if (state.subject === 'car') { car.setExplode(e); engine.setExplode(0); } else { engine.setExplode(e); car.setExplode(0); }
    stage.setFrame(...frameFor(e));
    stage.setExploded(state.subject === 'engine' && e > 0.04);
  };
  const setLamps = on => {
    M.drl.emissiveIntensity = on ? 2.8 : 0.04; M.tailLit.emissiveIntensity = on ? 1.9 : 0.06; M.tail.emissiveIntensity = on ? 0.25 : 0.02; M.lampLens.emissiveIntensity = on ? 1.1 : 0.02;
    stage.syncClipped();
  };

  const fades = [];
  const fadeGroups = {
    covers: [M.cover], block: [M.cast, M.castHead], intake: [M.stack], exhaust: [M.exhaust],
    paint: [M.paint, M.roof], roof: [M.roof], wheels: [M.rim], calipers: [M.caliper], interior: [M.leather],
  };
  const app = {
    anchors: [...car.anchors.map(a => ({ ...a, subject: 'car' })), ...engine.anchors.map(a => ({ ...a, subject: 'engine' }))],
    setSubject(next) {
      if (next === state.subject) return;
      state.subject = next;
      state.explode = state.explodeTarget = 0;
      if (!sections()[state.section]) state.section = 'long';
      state.sectionPos = sectionStart(state.section);
      stage.setSubject(next);
      applyExplode(0);
      stage.setSection(state.section, sectionValue());
      app.select(null);
      refreshVisibility();
      measure();
      stage.setView(state.mode === 'section' ? sections()[state.section].view : 'hero', 1.5);
      ui.sync();
    },
    setMode(m) {
      state.mode = m;
      stage.setMode(m);
      if (m === 'section') { stage.setSection(state.section, sectionValue()); stage.setView(sections()[state.section].view); }
      ui.sync();
    },
    setFinish(group, id) {
      state.finishes[group] = id;
      // cross-fade the paint rather than snapping it
      const mats = fadeGroups[group];
      const from = mats.map(m => m.color.clone());
      applyFinish(M, group, id);
      fades.push({ mats, from, to: mats.map(m => m.color.clone()), t: 0 });
      mats.forEach((m, i) => m.color.copy(from[i]));
      stage.syncClipped();
      refreshVisibility();
      if (state.selected) ui.showPart(state.selected);
      ui.sync();
    },
    setLayer(id, on) { state.layers[id] = on; state.isolated = false; refreshVisibility(); ui.sync(); },
    showAllLayers() { for (const L of layersNow()) state.layers[L.id] = true; state.isolated = false; refreshVisibility(); ui.sync(); },
    toggleRun() { state.running = !state.running; ui.sync(); },
    setThrottle(v) { state.throttle = v; if (v > 0 && !state.running) state.running = true; engine.setThrottle(v); ui.sync(); },
    setCrank(deg) { if (!state.running) { state.theta = deg * Math.PI / 180; state.rpm = 0; } },
    setExplode(v) { state.explodeTarget = v; ui.sync(); },
    setSlow(v) { state.slow = v; ui.sync(); },
    setSteer(deg) { state.steer = deg; car.setSteer(-deg * Math.PI / 180); ui.sync(); },
    setGear(g) { state.gear = g; if (g > 0 && !state.running) state.running = true; ui.sync(); },
    setSection(name, pos) {
      if (name && sections()[name]) { state.section = name; state.sectionPos = sectionStart(name); stage.setView(sections()[name].view); }
      if (pos != null) state.sectionPos = pos;
      stage.setSection(state.section, sectionValue());
      ui.sync();
    },
    setView(name) {
      if (name === 'valley' && state.subject === 'car' && !state.bonnetOpen) state.bonnetOpen = true;
      stage.setView(name); ui.sync();
    },
    select(id) {
      state.selected = id && PARTS[id] ? id : null;
      stage.highlight(state.selected);
      ui.showPart(state.selected);
    },
    focus() { if (state.selected) stage.focusPart(state.selected); },
    isolate() {
      if (!state.selected) return;
      if (state.isolated) { app.showAllLayers(); return; }
      const keep = PARTS[state.selected].layer;
      for (const L of layersNow()) state.layers[L.id] = L.id === keep;
      state.isolated = true;
      refreshVisibility(); ui.sync();
      stage.focusPart(state.selected);
    },
    toggle(key) {
      if (key === 'full') {
        const elx = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else elx.requestFullscreen?.().catch(() => {});
        return;
      }
      if (key === 'sound') {
        // off → Berlinetta → Corsa → off
        const next = VOICE_ORDER[VOICE_ORDER.indexOf(state.sound) + 1] || null;
        state.sound = audio.setVoice(next);
        ui.toast(state.sound ? 'Sound: ' + VOICES[state.sound].label : next ? 'Sound is not available in this browser' : 'Sound off');
      } else state[key] = !state[key];
      if (key === 'spin') stage.controls.autoRotate = state.spin;
      if (key === 'clean') measure();
      if (key === 'lights') setLamps(state.lights);
      ui.sync();
    },
  };
  const ui = createUI(app, state);

  for (const [g, id] of Object.entries(state.finishes)) applyFinish(M, g, id);
  stage.setSubject(state.subject);
  refreshVisibility();
  state.sectionPos = sectionStart(state.section);
  stage.setSection(state.section, sectionValue());
  stage.setMode('studio');
  applyExplode(0);
  setLamps(true);
  ui.sync();

  // Tell the camera which part of the stage the floating panels leave free.
  const paneRect = id => document.getElementById(id).getBoundingClientRect();
  function measure() {
    const s = stageEl.getBoundingClientRect();
    if (state.clean || getComputedStyle(document.getElementById('tabs')).display !== 'none') {
      stage.setInsets(0, state.clean ? 0 : 8, 0, state.clean ? 0 : 44);
      return;
    }
    const c = paneRect('pane-config'), d = paneRect('pane-data'), r = paneRect('pane-drive');
    stage.setInsets(c.right - s.left + 6, 64, s.right - d.left + 6, s.bottom - r.top + 40);
  }
  addEventListener('resize', measure);
  measure();
  stage.snapView('hero');

  // ---------------------------------------------------- pointer: pick / hover
  const canvas = stage.renderer.domElement;
  let down = null, hoverT = 0;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; ui.showTip(null); });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved < 6 && dt < 450) app.select(stage.pick(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - hoverT < 110) return;
    hoverT = now;
    const id = stage.pick(e.clientX, e.clientY);
    canvas.style.cursor = id ? 'pointer' : 'grab';
    const r = stageEl.getBoundingClientRect();
    ui.showTip(id ? PARTS[id]?.name : null, e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('pointerleave', () => ui.showTip(null));

  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input') && e.key !== 'Escape') return;      // sliders keep their own keys
    const k = e.key.toLowerCase();
    if (e.key === ' ') { if (e.target.closest?.('button')) return; e.preventDefault(); app.toggleRun(); }
    else if (k === 'h') app.toggle('clean');
    else if (k === 'e') app.setExplode(state.explodeTarget > 0.5 ? 0 : 1);
    else if (k === 'c') app.setSubject(state.subject === 'car' ? 'engine' : 'car');
    else if (k === 'b') app.toggle('bonnetOpen');
    else if (k === 'd') app.toggle('doorsOpen');
    else if (k === 'l') app.toggle('lights');
    else if (e.key === '1') app.setMode('studio');
    else if (e.key === '2') app.setMode('xray');
    else if (e.key === '3') app.setMode('section');
    else if (e.key === 'Escape') app.select(null);
  });

  // ------------------------------------------------------------------ loop
  let last = performance.now(), frames = 0, jitter = 0;
  const glide = (cur, target, dt, rate) => Math.abs(target - cur) < 1e-4 ? target : cur + (target - cur) * (1 - Math.exp(-dt * rate));
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;

    const target = state.running ? E.idle + state.throttle * (E.redline - E.idle) : 0;
    const rate = target > state.rpm ? (state.rpm < 700 ? 5 : 2.4) : (state.running ? 1.5 : 1.0);
    state.rpm += (target - state.rpm) * (1 - Math.exp(-dt * rate));
    if (!state.running && state.rpm < 12) state.rpm = 0;
    jitter += dt;
    const lope = state.running && state.throttle < 0.02 ? Math.sin(jitter * 7.1) * 5 + Math.sin(jitter * 2.3) * 4 : 0;
    state.rpmShown = Math.max(0, state.rpm + (state.rpm > 500 ? lope : 0));
    state.theta += state.rpmShown * TAU / 60 * state.slow * dt;
    engine.update(state.theta);

    // driven wheels: engine speed through the selected gear and final drive
    const wheelRate = state.gear > 0 ? state.rpmShown * TAU / 60 / (GEARS[state.gear - 1] * FINAL_DRIVE) : 0;
    state.speed = wheelRate * TYRE_R * 3.6;
    if (state.subject === 'car') {
      state.roll += wheelRate * state.slow * dt;
      car.roll(state.roll);
      const b = glide(state.bonnet, state.bonnetOpen ? 1 : 0, dt, 3.4), d = glide(state.doors, state.doorsOpen ? 1 : 0, dt, 3.0);
      if (b !== state.bonnet) { state.bonnet = b; car.setBonnet(b); }
      if (d !== state.doors) { state.doors = d; car.setDoors(d); }
      // skip drawing an engine nobody can see under a closed bonnet
      stage.setEngineShown(state.mode !== 'studio' || state.bonnet > 0.004 || state.explode > 0.01 || state.layers.body === false);
    }

    const load = state.running ? Math.pow(state.rpm / E.redline, 1.6) * (0.3 + 0.7 * state.throttle) : 0;
    state.heat += (load - state.heat) * (1 - Math.exp(-dt * (load > state.heat ? 0.5 : 0.2)));
    stage.setExhaustGlow(Math.pow(state.heat, 1.5) * 2.1);

    if (Math.abs(state.explodeTarget - state.explode) > 1e-4) {
      state.explode = glide(state.explode, state.explodeTarget, dt, 4.2);
      applyExplode(state.explode);
    }

    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      f.t = Math.min(1, f.t + dt / 0.45);
      f.mats.forEach((m, k) => m.color.lerpColors(f.from[k], f.to[k], f.t * f.t * (3 - 2 * f.t)));
      if (f.t >= 1) fades.splice(i, 1);
      if (state.mode === 'section') stage.syncClipped();
    }

    stage.render(dt, frames > 30);
    ui.update(dt, engine);
    ui.updateCallouts(stage.project);
    audio.update(state.rpmShown, state.throttle, dt);
    if (++frames === 2) {
      document.getElementById('veil').classList.add('done');
      state.running = true; ui.sync();
      // settle into the hero angle from a low, wide pass
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && location.hash !== '#lite') {
        stage.snapView({ az: 78, pol: 86, r: 1.4, ty: 0.2 });
        stage.setView('hero', 2.8);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // handle for automated checks
  window.__v12 = { state, app, stage, engine, car };
}

boot().catch(err => {
  console.error(err);
  const msg = document.getElementById('veil-msg');
  if (msg) msg.textContent = 'Something went wrong while building the model. Reload to try again.';
});
