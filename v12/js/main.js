// Tipo 600 — boot and main loop.
import { createMaterials, applyFinish } from './materials.js';
import { buildEngine } from './engine.js';
import { createStage, SECTIONS } from './stage.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { E, PARTS, LAYERS, FINISHES } from './config.js';

const TAU = Math.PI * 2;
const state = {
  running: false, rpm: 0, rpmShown: 0, throttle: 0, theta: 0, slow: 1 / 32, heat: 0,
  explode: 0, explodeTarget: 0,
  mode: 'studio', section: 'cross', sectionPos: 0.27,
  selected: null, isolated: false,
  callouts: true, spin: false, sound: false, clean: false,
  finishes: { covers: 'rosso', block: 'cast', intake: 'polished', exhaust: 'titanium' },
  layers: {},
};

async function boot() {
  // the nameplate texture wants the display face; don't wait long for it
  try { await Promise.race([document.fonts.load('700 54px Syncopate'), new Promise(r => setTimeout(r, 1200))]); } catch { /* fallback face */ }
  await new Promise(r => requestAnimationFrame(() => r()));

  const M = createMaterials();
  const engine = buildEngine(M);
  const stageEl = document.getElementById('stage');
  let stage;
  try {
    // add #lite to the address for a reduced-effects renderer on slow machines
    stage = createStage(stageEl, M, engine, { lite: location.hash === '#lite' });
  } catch (err) {
    document.getElementById('veil-msg').textContent = 'This browser could not start WebGL 2, which the showcase needs.';
    document.querySelector('#veil .bar').hidden = true;
    console.error(err);
    return;
  }
  const audio = createAudio();
  if (stage.mobile) state.callouts = false;

  const layerParts = id => Object.keys(PARTS).filter(p => PARTS[p].layer === id);
  const partOn = pid => {
    if (state.layers[PARTS[pid].layer] === false) return false;
    if (pid === 'airbox') return FINISHES.intake.options.find(o => o.id === state.finishes.intake).airbox === true;
    return true;
  };
  const refreshVisibility = () => { for (const pid of Object.keys(PARTS)) stage.setPartVisible(pid, partOn(pid)); };

  const sectionValue = () => {
    const s = SECTIONS[state.section];
    return s.range[1] + (s.range[0] - s.range[1]) * state.sectionPos;
  };

  const fades = [];
  const app = {
    anchors: engine.anchors,
    setMode(m) {
      state.mode = m;
      stage.setMode(m);
      if (m === 'section') { stage.setSection(state.section, sectionValue()); stage.setView(SECTIONS[state.section].view); }
      ui.sync();
    },
    setFinish(group, id) {
      state.finishes[group] = id;
      // cross-fade the paint rather than snapping it
      const mats = { covers: [M.cover], block: [M.cast, M.castHead], intake: [M.stack], exhaust: [M.exhaust] }[group];
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
    showAllLayers() { for (const L of LAYERS) state.layers[L.id] = true; state.isolated = false; refreshVisibility(); ui.sync(); },
    toggleRun() { state.running = !state.running; ui.sync(); },
    setThrottle(v) { state.throttle = v; if (v > 0 && !state.running) state.running = true; engine.setThrottle(v); ui.sync(); },
    setCrank(deg) { if (!state.running) { state.theta = deg * Math.PI / 180; state.rpm = 0; } },
    setExplode(v) { state.explodeTarget = v; ui.sync(); },
    setSlow(v) { state.slow = v; ui.sync(); },
    setSection(name, pos) {
      if (name) { state.section = name; state.sectionPos = (SECTIONS[name].range[1] - SECTIONS[name].start) / (SECTIONS[name].range[1] - SECTIONS[name].range[0]); stage.setView(SECTIONS[name].view); }
      if (pos != null) state.sectionPos = pos;
      stage.setSection(state.section, sectionValue());
      ui.sync();
    },
    setView(name) { stage.setView(name); },
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
      for (const L of LAYERS) state.layers[L.id] = L.id === keep;
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
      if (key === 'sound') state.sound = audio.setEnabled(!state.sound);
      else state[key] = !state[key];
      if (key === 'spin') stage.controls.autoRotate = state.spin;
      if (key === 'clean') measure();
      ui.sync();
    },
  };
  const ui = createUI(app, state);

  for (const [g, id] of Object.entries(state.finishes)) applyFinish(M, g, id);
  refreshVisibility();
  state.sectionPos = (SECTIONS.cross.range[1] - SECTIONS.cross.start) / (SECTIONS.cross.range[1] - SECTIONS.cross.range[0]);
  stage.setSection('cross', sectionValue());
  stage.setMode('studio');
  stage.snapView('hero');
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
    if (e.key === ' ') { if (e.target.closest?.('button')) return; e.preventDefault(); app.toggleRun(); }
    else if (e.key === 'h' || e.key === 'H') app.toggle('clean');
    else if (e.key === 'e' || e.key === 'E') app.setExplode(state.explodeTarget > 0.5 ? 0 : 1);
    else if (e.key === '1') app.setMode('studio');
    else if (e.key === '2') app.setMode('xray');
    else if (e.key === '3') app.setMode('section');
    else if (e.key === 'Escape') app.select(null);
  });

  // ------------------------------------------------------------------ loop
  let last = performance.now(), frames = 0, jitter = 0;
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

    const load = state.running ? Math.pow(state.rpm / E.redline, 1.6) * (0.3 + 0.7 * state.throttle) : 0;
    state.heat += (load - state.heat) * (1 - Math.exp(-dt * (load > state.heat ? 0.5 : 0.2)));
    stage.setExhaustGlow(Math.pow(state.heat, 1.5) * 2.1);

    if (Math.abs(state.explodeTarget - state.explode) > 1e-4) {
      state.explode += (state.explodeTarget - state.explode) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(state.explodeTarget - state.explode) < 1e-4) state.explode = state.explodeTarget;
      engine.setExplode(state.explode);
      stage.setFrame(4.9 + 3.5 * state.explode, 0.6 + 3.4 * state.explode);
      stage.setExploded(state.explode > 0.04);
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
    audio.update(state.rpmShown, state.throttle);
    if (++frames === 2) {
      document.getElementById('veil').classList.add('done');
      state.running = true; ui.sync();
      // settle into the hero angle from a low, wide pass
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && location.hash !== '#lite') {
        stage.snapView({ az: 68, pol: 82, r: 1.45, ty: 0.3 });
        stage.setView('hero', 2.6);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // handle for automated checks
  window.__v12 = { state, app, stage, engine };
}

boot().catch(err => {
  console.error(err);
  const msg = document.getElementById('veil-msg');
  if (msg) msg.textContent = 'Something went wrong while building the engine. Reload to try again.';
});
