// DOM side of the showcase: configurator controls, drive rail, telemetry.
import { E, CYL, FIRING_ORDER, FINISHES, LAYERS, PARTS, PEAK, torqueAt, powerAt } from './config.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent) {
  const svgTag = ['svg', 'path', 'line', 'circle', 'text', 'g', 'rect'].includes(tag);
  const n = svgTag ? document.createElementNS(NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  }
  if (parent) parent.appendChild(n);
  return n;
}
const fmt = n => Math.round(n).toLocaleString('en-US');
const pressed = (group, match) => { for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(match(b))); };
const fill = input => input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min) * 100) + '%');

export function createUI(app, state) {
  const root = $('app');

  // ------------------------------------------------------------- finishes
  const finWrap = $('finishes');
  const finNames = {};
  for (const [gid, grp] of Object.entries(FINISHES)) {
    const row = el('div', { class: 'fin' }, finWrap);
    const head = el('div', { class: 'fin-head' }, row);
    el('b', { text: grp.label }, head);
    finNames[gid] = el('span', {}, head);
    const sw = el('div', { class: 'swatches', role: 'group', 'aria-label': grp.label }, row);
    for (const o of grp.options) {
      const b = el('button', { class: 'sw', title: o.name, 'aria-label': o.name, 'aria-pressed': 'false', 'data-id': o.id, style: `--c:${o.color}` }, sw);
      if (o.airbox) b.setAttribute('data-airbox', '');
      b.addEventListener('click', () => app.setFinish(gid, o.id));
    }
    row.dataset.group = gid;
  }
  function syncFinishes() {
    for (const row of finWrap.children) {
      const gid = row.dataset.group, cur = state.finishes[gid];
      pressed(row, b => b.dataset.id === cur);
      finNames[gid].textContent = FINISHES[gid].options.find(o => o.id === cur).name;
    }
  }

  // --------------------------------------------------------------- layers
  const layerWrap = $('layers');
  const layerInputs = {};
  for (const L of LAYERS) {
    const lab = el('label', {}, layerWrap);
    const inp = el('input', { type: 'checkbox', id: 'layer-' + L.id }, lab);
    inp.checked = true;
    el('span', { text: L.name }, lab);
    inp.addEventListener('change', () => app.setLayer(L.id, inp.checked));
    layerInputs[L.id] = inp;
  }
  $('layers-all').addEventListener('click', () => app.showAllLayers());
  function syncLayers() { for (const L of LAYERS) layerInputs[L.id].checked = state.layers[L.id] !== false; }

  // ----------------------------------------------------------------- tach
  const tach = $('tach');
  const TC = { cx: 130, cy: 128, r: 104, a0: 205, sweep: 230, max: 10000 };
  const tAng = v => (TC.a0 - v / TC.max * TC.sweep) * Math.PI / 180;
  const tPt = (v, r) => [TC.cx + r * Math.cos(tAng(v)), TC.cy - r * Math.sin(tAng(v))];
  const arc = (v0, v1, r) => {
    const [x0, y0] = tPt(v0, r), [x1, y1] = tPt(v1, r);
    const large = (v1 - v0) / TC.max * TC.sweep > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  el('path', { d: arc(0, TC.max, TC.r), fill: 'none', stroke: 'rgba(236,232,224,.14)', 'stroke-width': 2 }, tach);
  el('path', { d: arc(E.redline, TC.max, TC.r), fill: 'none', stroke: 'var(--hot)', 'stroke-width': 4 }, tach);
  for (let v = 0; v <= TC.max; v += 500) {
    const major = v % 1000 === 0;
    const [x0, y0] = tPt(v, TC.r - 5), [x1, y1] = tPt(v, TC.r - (major ? 13 : 9));
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: v >= E.redline ? 'var(--hot)' : major ? 'var(--fg-2)' : 'var(--fg-3)', 'stroke-width': major ? 1.4 : 1 }, tach);
    if (major) {
      const [tx, ty] = tPt(v, TC.r - 24);
      el('text', { x: tx, y: ty + 3.5, 'text-anchor': 'middle', fill: v >= E.redline ? 'var(--hot)' : 'var(--fg-2)', style: 'font:500 10px var(--f-mono)', text: v / 1000 }, tach);
    }
  }
  const tachFill = el('path', { d: arc(0, TC.max, TC.r), fill: 'none', stroke: 'var(--amber)', 'stroke-width': 4, 'stroke-linecap': 'round', pathLength: 1000, 'stroke-dasharray': '0 1000' }, tach);
  const tachDot = el('circle', { r: 4.5, fill: 'var(--fg)' }, tach);

  // ---------------------------------------------------------------- chart
  const chart = $('chart');
  const CH = { x0: 30, x1: 240, y0: 100, y1: 10, rmax: 9000, tmax: 800, pmax: 640 };
  const cx = r => CH.x0 + r / CH.rmax * (CH.x1 - CH.x0);
  const cyT = t => CH.y0 - t / CH.tmax * (CH.y0 - CH.y1);
  const cyP = p => CH.y0 - p / CH.pmax * (CH.y0 - CH.y1);
  for (let r = 0; r <= 9000; r += 1000) {
    el('line', { x1: cx(r), y1: CH.y0, x2: cx(r), y2: CH.y1, stroke: 'rgba(236,232,224,.07)', 'stroke-width': 1 }, chart);
    if (r % 2000 === 0) el('text', { x: cx(r), y: CH.y0 + 11, 'text-anchor': 'middle', text: r / 1000 }, chart);
  }
  for (let t = 0; t <= 800; t += 200) {
    el('line', { x1: CH.x0, y1: cyT(t), x2: CH.x1, y2: cyT(t), stroke: 'rgba(236,232,224,.07)', 'stroke-width': 1 }, chart);
    el('text', { x: CH.x0 - 4, y: cyT(t) + 3, 'text-anchor': 'end', text: t }, chart);
    el('text', { x: CH.x1 + 4, y: cyT(t) + 3, 'text-anchor': 'start', fill: 'var(--amber)', text: t * CH.pmax / CH.tmax }, chart).style.fill = 'var(--amber)';
  }
  el('text', { x: CH.x0 - 4, y: 5, 'text-anchor': 'end', text: 'N·m' }, chart);
  el('text', { x: CH.x1 + 4, y: 5, 'text-anchor': 'start', text: 'kW' }, chart).style.fill = 'var(--amber)';
  let dT = '', dP = '';
  for (let r = 900; r <= 9000; r += 100) {
    dT += (dT ? 'L' : 'M') + cx(r).toFixed(1) + ' ' + cyT(torqueAt(r)).toFixed(1);
    dP += (dP ? 'L' : 'M') + cx(r).toFixed(1) + ' ' + cyP(powerAt(r)).toFixed(1);
  }
  el('path', { d: dP + `L${cx(9000)} ${CH.y0}L${cx(900)} ${CH.y0}Z`, fill: 'rgba(255,180,84,.08)', stroke: 'none' }, chart);
  el('path', { d: dT, fill: 'none', stroke: 'var(--fg)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, chart);
  el('path', { d: dP, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, chart);
  el('circle', { cx: cx(PEAK.torqueRpm), cy: cyT(PEAK.torque), r: 2, fill: 'var(--bg)', stroke: 'var(--fg)', 'stroke-width': 1 }, chart);
  el('circle', { cx: cx(PEAK.powerRpm), cy: cyP(PEAK.power), r: 2, fill: 'var(--bg)', stroke: 'var(--amber)', 'stroke-width': 1 }, chart);
  const mLine = el('line', { y1: CH.y0, y2: CH.y1, stroke: 'rgba(236,232,224,.5)', 'stroke-width': 1, 'stroke-dasharray': '2 2' }, chart);
  const mT = el('circle', { r: 3, fill: 'var(--fg)' }, chart);
  const mP = el('circle', { r: 3, fill: 'var(--amber)' }, chart);

  // ---------------------------------------------------- firing + cylinders
  const firing = $('firing');
  const fireCells = FIRING_ORDER.map(n => el('i', { text: n }, firing));
  const cylWrap = $('cyls');
  const cylCells = [];
  for (const [label, from] of [['A', 0], ['B', 6]]) {
    const row = el('div', { class: 'bankrow' }, cylWrap);
    el('span', { text: label }, row);
    for (let i = 0; i < 6; i++) {
      const c = el('div', { class: 'cylc' }, row);
      el('u', {}, c); el('s', { text: from + i + 1 }, c);
      cylCells[from + i] = c;
    }
  }
  const STROKE = ['var(--hot)', 'var(--spent)', 'var(--cool)', 'var(--violet)'];

  // ---------------------------------------------------------------- specs
  const specs = [
    ['Displacement', fmt(E.displacement) + ' cc'], ['Bore × stroke', `${E.bore.toFixed(1)} × ${E.stroke.toFixed(1)} mm`],
    ['Compression', E.compression.toFixed(1) + ' : 1'], ['Valvetrain', 'DOHC, 48 valves'],
    ['Peak power', `${fmt(PEAK.power)} kW @ ${fmt(PEAK.powerRpm)}`], ['Peak torque', `${fmt(PEAK.torque)} N·m @ ${fmt(PEAK.torqueRpm)}`],
    ['Redline', fmt(E.redline) + ' rpm'], ['Firing order', '1-7-5-11-3-9'], ['', '6-12-2-8-4-10'], ['Lubrication', 'Dry sump'],
  ];
  for (const [k, v] of specs) { el('dt', { text: k }, $('specs')); el('dd', { text: v }, $('specs')); }

  // ------------------------------------------------------------- controls
  const modeSeg = $('modeSeg'), slowSeg = $('slowSeg'), secSeg = $('secSeg');
  modeSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.setMode(b.dataset.mode); });
  slowSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.setSlow(parseFloat(b.dataset.slow)); });
  secSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.setSection(b.dataset.sec, null); });
  $('views').addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.setView(b.dataset.view); });

  const throttle = $('throttle'), crank = $('crank'), explode = $('explode'), secPos = $('secPos');
  throttle.addEventListener('input', () => { app.setThrottle(throttle.value / 100); fill(throttle); });
  crank.addEventListener('input', () => { app.setCrank(+crank.value); fill(crank); });
  explode.addEventListener('input', () => { app.setExplode(explode.value / 100); fill(explode); });
  secPos.addEventListener('input', () => { app.setSection(null, secPos.value / 1000); fill(secPos); });
  for (const r of [throttle, crank, explode, secPos]) fill(r);

  $('ign').addEventListener('click', () => app.toggleRun());
  const tool = (id, key) => $(id).addEventListener('click', () => app.toggle(key));
  tool('tool-callouts', 'callouts'); tool('tool-spin', 'spin'); tool('tool-sound', 'sound'); tool('tool-clean', 'clean'); tool('tool-full', 'full');

  $('part-close').addEventListener('click', () => app.select(null));
  $('part-focus').addEventListener('click', () => app.focus());
  $('part-isolate').addEventListener('click', () => app.isolate());

  // phone tabs
  const tabs = $('tabs');
  function setTab(name) {
    for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    for (const p of document.querySelectorAll('.pane')) p.classList.toggle('active', p.id === 'pane-' + name);
  }
  tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });

  // -------------------------------------------------------------- callouts
  const coWrap = $('callouts');
  const cos = app.anchors.map(a => {
    const n = el('div', { class: 'co' + (a.side === 'l' ? ' l' : '') }, coWrap);
    el('b', { text: a.label }, n);
    n.addEventListener('click', () => app.select(a.part));
    return { a, n, shown: true, p: { x: 0, y: 0, visible: false } };
  });
  let cardBox = null;
  function updateCallouts(project) {
    const on = state.callouts && !state.clean;
    for (const c of cos) {
      let vis = on;
      if (vis) { for (let o = c.a.obj; o; o = o.parent) if (!o.visible) { vis = false; break; } }
      if (vis) { project(c.a.obj, c.p, c.a.normal); vis = c.p.visible; }
      // keep labels clear of the open part card
      if (vis && cardBox && c.p.x > cardBox.l - 150 && c.p.x < cardBox.r + 8 && c.p.y > cardBox.t - 8 && c.p.y < cardBox.b + 44) vis = false;
      if (vis !== c.shown) { c.n.hidden = !vis; c.shown = vis; }
      if (vis) c.n.style.transform = `translate(${c.p.x.toFixed(1)}px,${c.p.y.toFixed(1)}px)`;
    }
  }

  // ------------------------------------------------------------- part card
  const card = $('partcard');
  function showPart(id) {
    if (!id || !PARTS[id]) { card.hidden = true; cardBox = null; return; }
    const p = PARTS[id];
    $('part-name').textContent = p.name;
    $('part-mat').textContent = id === 'exhaust' ? FINISHES.exhaust.options.find(o => o.id === state.finishes.exhaust).name : p.material;
    $('part-text').textContent = p.text;
    const dl = $('part-spec'); dl.textContent = '';
    for (const [k, v] of p.specs) { el('dt', { text: k }, dl); el('dd', { text: v }, dl); }
    dl.hidden = p.specs.length === 0;
    $('part-isolate').textContent = state.isolated ? 'Show all' : 'Isolate';
    card.hidden = false;
    const r = card.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
    cardBox = { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top };
  }

  const tip = $('tip');
  function showTip(text, x, y) {
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text; tip.hidden = false;
    tip.style.transform = `translate(${x + 14}px,${y + 16}px)`;
  }

  // ---------------------------------------------------------------- sync
  function sync() {
    root.dataset.mode = state.mode;
    root.classList.toggle('clean', state.clean);
    pressed(modeSeg, b => b.dataset.mode === state.mode);
    pressed(slowSeg, b => Math.abs(parseFloat(b.dataset.slow) - state.slow) < 1e-6);
    pressed(secSeg, b => b.dataset.sec === state.section);
    $('tool-callouts').setAttribute('aria-pressed', String(state.callouts));
    $('tool-spin').setAttribute('aria-pressed', String(state.spin));
    $('tool-sound').setAttribute('aria-pressed', String(state.sound));
    $('tool-clean').setAttribute('aria-pressed', String(state.clean));
    $('ign').setAttribute('aria-pressed', String(state.running));
    $('ign-label').textContent = state.running ? 'STOP' : 'START';
    throttle.value = Math.round(state.throttle * 100); fill(throttle);
    $('throttle-val').textContent = Math.round(state.throttle * 100) + ' %';
    explode.value = Math.round(state.explodeTarget * 100); fill(explode);
    $('explode-val').textContent = Math.round(state.explodeTarget * 100) + ' %';
    secPos.value = Math.round(state.sectionPos * 1000); fill(secPos);
    crank.disabled = state.running;
    syncFinishes(); syncLayers();
    $('part-isolate').textContent = state.isolated ? 'Show all' : 'Isolate';
  }

  // ---------------------------------------------------------- per-frame
  let slowT = 0;
  const last = { fire: new Array(12).fill(-1), y: new Array(12).fill(-1), st: new Array(12).fill(-1) };
  function update(dt, engine) {
    const rpm = state.rpmShown;
    // tach arc and chart marker every frame (cheap attribute writes)
    const frac = Math.min(1, rpm / TC.max);
    tachFill.setAttribute('stroke-dasharray', `${(frac * 1000).toFixed(1)} 1000`);
    const [dx, dy] = tPt(Math.min(rpm, TC.max), TC.r);
    tachDot.setAttribute('cx', dx.toFixed(1)); tachDot.setAttribute('cy', dy.toFixed(1));
    const tq = torqueAt(rpm), pw = powerAt(rpm), mx = cx(Math.min(rpm, CH.rmax));
    mLine.setAttribute('x1', mx); mLine.setAttribute('x2', mx);
    mT.setAttribute('cx', mx); mT.setAttribute('cy', cyT(tq));
    mP.setAttribute('cx', mx); mP.setAttribute('cy', cyP(pw));

    for (let i = 0; i < 12; i++) {
      const c = engine.cyl[FIRING_ORDER[i] - 1];
      const k = c.phase < 100 && state.rpm > 1 ? Math.round((1 - c.phase / 100) * 20) : 0;
      if (k !== last.fire[i]) {
        last.fire[i] = k;
        fireCells[i].style.setProperty('--k', (k / 20).toFixed(2));
        fireCells[i].classList.toggle('on', k > 9);
      }
    }
    for (let i = 0; i < 12; i++) {
      const c = engine.cyl[i];
      const y = Math.round((1 - c.pos) * 16);
      if (y !== last.y[i]) { last.y[i] = y; cylCells[i].style.setProperty('--y', y + 'px'); }
      const st = Math.floor(c.phase / 180) % 4;
      if (st !== last.st[i]) { last.st[i] = st; cylCells[i].style.setProperty('--sc', STROKE[st]); }
    }

    slowT += dt;
    if (slowT < 0.09) return;
    slowT = 0;
    $('rpm').textContent = fmt(rpm);
    $('kw').textContent = fmt(pw); $('ps').textContent = fmt(pw * 1.35962) + ' PS';
    $('nm').textContent = fmt(tq); $('lbft').textContent = fmt(tq * 0.737562) + ' lb·ft';
    const deg = ((state.theta * 180 / Math.PI) % 720 + 720) % 720;
    $('st-angle').textContent = deg.toFixed(0) + '° / 720°';
    $('st-piston').textContent = (2 * E.stroke / 1000 * rpm / 60).toFixed(1) + ' m/s';
    $('st-fire').textContent = (rpm / 10).toFixed(0) + ' Hz';
    $('st-heat').textContent = fmt(20 + 880 * Math.pow(state.heat, 0.7)) + ' °C';
    if (state.running || state.rpm > 0) {
      crank.value = Math.round(deg); fill(crank);
    }
    $('crank-val').textContent = deg.toFixed(0) + '°';
  }

  return { sync, update, updateCallouts, showPart, showTip, setTab };
}
