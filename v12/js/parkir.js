// Parkir Tipo 600 — a parking game built on the showcase's car model.
// World units are metres. Heading is rotation about Y: 0 faces +X, positive
// turns left (towards -Z), so "north" on the lot is -Z.
import * as THREE from '../vendor/three.bundle.min.js';
import { createMaterials, applyFinish } from './materials.js';
import { buildCar } from './car.js';
import { CAR } from './car-body.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;
const WHEELBASE = 2.72, HALF_L = 2.3, HALF_W = 0.97;
const BAY_L = 5.5, BAY_W = 2.7;
const MAX_HITS = 3;
const COLORS = ['#0b1c46', '#aeb1b6', '#0a2c20', '#3f4247', '#dedcd4', '#070708', '#cf9d06'];

// ------------------------------------------------------------------ levels
// start/target: [x, z, heading°]. cars: parked cars. walls: [x, z, length, width, heading°].
// cones/posts: [x, z]. lines: bay rows as [x0, z, count, facing] (facing 1 = opens south).
const row = (x0, z, n, dir, skip = []) => ({ x0, z, n, dir, skip });
const LEVELS = [
  {
    name: 'Parkir Maju', hint: 'Masuk lurus ke petak yang menyala di antara dua mobil.', par: 22,
    size: [38, 26], start: [-13, 4, 0], target: [0, -10.2, 90], flip: true,
    rows: [row(-10.8, -10.2, 9, 1), row(-10.8, 10.2, 9, -1)],
    cars: [[-2.7, -10.2, 90], [2.7, -10.1, 90], [-8.1, -10.3, 90], [8.1, -10.2, 270], [5.4, 10.2, 270], [-5.4, 10.1, 90]],
  },
  {
    name: 'Parkir Mundur', hint: 'Mundur ke petak. Moncong mobil harus menghadap keluar.', par: 32,
    size: [38, 26], start: [-11, 2.5, 0], target: [2.7, 10.2, 90], flip: false,
    rows: [row(-10.8, -10.2, 9, 1), row(-10.8, 10.2, 9, -1)],
    cars: [[0, 10.2, 90], [5.4, 10.3, 90], [-8.1, 10.2, 270], [-2.7, -10.2, 90], [8.1, -10.2, 90]],
    posts: [[-1.35, 6.9], [6.75, 6.9]],
  },
  {
    name: 'Parkir Paralel', hint: 'Lewati celahnya, lalu mundur masuk sejajar trotoar.', par: 40,
    size: [40, 11], start: [-14, 0.6, 0], target: [0, -3.9, 0], flip: false, bay: [6.6, 2.5],
    cars: [[-6.2, -3.95, 0], [6.2, -3.9, 0], [12.4, -3.95, 0], [-12.6, -3.9, 180]],
    walls: [[0, 4.4, 40, 0.5, 0]],
  },
  {
    name: 'Slalom Kerucut', hint: 'Meliuk di antara kerucut tanpa menjatuhkannya, lalu parkir.', par: 34,
    size: [48, 18], start: [-19, 0, 0], target: [18.5, 0, 0], flip: false,
    cones: [[-11, -1.6], [-11, 3.4], [-4, 1.6], [-4, -3.4], [3, -1.6], [3, 3.4], [10, 1.6], [10, -3.4],
      [15.4, -1.75], [15.4, 1.75], [21.4, -1.75], [21.4, 1.75], [18.4, -1.75], [18.4, 1.75]],
  },
  {
    name: 'Garasi Sempit', hint: 'Garasinya hanya selebar mobil lebih sedikit. Pelan-pelan.', par: 36,
    size: [30, 24], start: [-9, 6, 0], target: [4, -7.6, 90], flip: true, bay: [5.6, 2.9],
    walls: [[2.25, -7.6, 6.4, 0.3, 90], [5.75, -7.6, 6.4, 0.3, 90], [4, -10.95, 3.8, 0.3, 0], [-6, -4, 10, 0.4, 0], [12, -2, 0.4, 9, 0]],
    posts: [[1.6, -3.4], [6.4, -3.4], [-1.5, 1.5], [9, 3]],
    cars: [[-8, -8.5, 90], [10, 8.6, 0]],
  },
  {
    name: 'Jalan Buntu', hint: 'Putar balik di jalan sempit, lalu parkir menghadap barat.', par: 48,
    size: [30, 8.4], start: [5, 0.4, 0], target: [-9, 1.5, 180], flip: false,
    cars: [[-9, -2.9, 0], [-3, -2.95, 0]],
    cones: [[-12.4, 0.1], [-5.6, 0.1]],
  },
];

// ---------------------------------------------------------------- geometry
const fwd = h => ({ x: Math.cos(h), z: -Math.sin(h) });
const obb = (x, z, hl, hw, h) => ({ x, z, hl, hw, h, f: fwd(h) });
function corners(o) {
  const f = o.f, r = { x: -f.z, z: f.x };
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({ x: o.x + f.x * o.hl * a + r.x * o.hw * b, z: o.z + f.z * o.hl * a + r.z * o.hw * b }));
}
function overlap(a, b) {
  const ca = corners(a), cb = corners(b);
  for (const o of [a, b]) for (const ax of [o.f, { x: -o.f.z, z: o.f.x }]) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of ca) { const d = p.x * ax.x + p.z * ax.z; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const p of cb) { const d = p.x * ax.x + p.z * ax.z; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
// distance from a point to a box (0 inside)
function distPoint(o, px, pz) {
  const dx = px - o.x, dz = pz - o.z, f = o.f;
  const u = dx * f.x + dz * f.z, v = -dx * f.z + dz * f.x;
  return Math.hypot(Math.max(0, Math.abs(u) - o.hl), Math.max(0, Math.abs(v) - o.hw));
}
function distBoxes(a, b) {
  if (overlap(a, b)) return 0;
  let d = Infinity;
  for (const p of corners(a)) d = Math.min(d, distPoint(b, p.x, p.z));
  for (const p of corners(b)) d = Math.min(d, distPoint(a, p.x, p.z));
  return d;
}

// ------------------------------------------------------------------- stage
const mobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const lite = location.hash === '#lite';
const renderer = new THREE.WebGLRenderer({ antialias: !lite, powerPreference: 'high-performance' });
renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = lite ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const stageEl = $('stage');
stageEl.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#aebccb');
scene.fog = new THREE.Fog('#aebccb', 60, 170);
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 400);

// late-afternoon sky as the environment for paint and glass
{
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(100, 32, 16);
  const col = [], p = sky.attributes.position, top = new THREE.Color('#5f8fd0'), hor = new THREE.Color('#f3e2c6'), low = new THREE.Color('#3a3d42'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 100;
    if (t >= 0) c.lerpColors(hor, top, Math.pow(t, 0.55)); else c.lerpColors(hor, low, Math.min(1, -t * 6));
    col.push(c.r * 1.25, c.g * 1.25, c.b * 1.25);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2d6').multiplyScalar(9) }));
  sun.position.set(-48, 52, 30); sun.lookAt(0, 0, 0); env.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  pm.dispose();
}
scene.add(new THREE.HemisphereLight('#cfe0ff', '#57503f', 0.55));
const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 5, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ assets
const M = createMaterials();
for (const [g, id] of [['paint', 'rosso'], ['roof', 'body'], ['wheels', 'silver'], ['calipers', 'yellow'], ['interior', 'cuoio']]) applyFinish(M, g, id);
M.drl.emissiveIntensity = 3; M.lampLens.emissiveIntensity = 1.6; M.tailLit.emissiveIntensity = 0.9;

const car = buildCar(M);
car.root.scale.setScalar(0.001);
for (const id of ['tub', 'chassis', 'suspension', 'drivetrain']) for (const o of car.parts[id] || []) o.visible = false;
const player = new THREE.Group();
player.add(car.root);
scene.add(player);
const shell = car.parts.body[0].parent;

// parked cars: the same bodyshell repainted, on plain wheels
const tyreGeo = new THREE.CylinderGeometry(1, 1, 1, 22).rotateX(Math.PI / 2);
function parkedCar(color) {
  const g = new THREE.Group(), s = shell.clone(true);
  const paint = M.paint.clone(); paint.color.set(color); paint.normalMap = null;
  s.traverse(m => {
    if (!m.isMesh) return;
    const k = m.userData.matKey;
    if (k === 'paint' || k === 'roof') m.material = paint;
    else if (k === 'liner') m.visible = false;
    else if (k === 'drl' || k === 'lampLens') m.material = M.chrome;
    else if (k === 'tailLit') m.material = M.tail;
  });
  s.position.set(0, 0, 0);
  const inner = new THREE.Group(); inner.scale.setScalar(0.001); inner.add(s);
  for (const a of [CAR.axle.f, CAR.axle.r]) for (const sg of [1, -1]) {
    const t = new THREE.Mesh(tyreGeo, M.tyre); t.scale.set(a.tyreR, a.tyreR, a.tyreW); t.position.set(a.x, a.y, sg * a.track); t.castShadow = true;
    const r = new THREE.Mesh(tyreGeo, M.rim); r.scale.set(a.rimR, a.rimR, a.tyreW + 6); r.position.copy(t.position);
    inner.add(t, r);
  }
  g.add(inner);
  return g;
}

// asphalt
function asphalt() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#3b3d40'; g.fillRect(0, 0, 256, 256);
  let s = 99; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 5200; i++) { const v = 40 + r() * 70; g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + r() * 0.5})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 1.6, 1 + r() * 1.6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const MAT = {
  ground: new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.94, metalness: 0 }),
  line: new THREE.MeshStandardMaterial({ color: '#e9e7df', roughness: 0.8 }),
  wall: new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.9 }),
  kerb: new THREE.MeshStandardMaterial({ color: '#8f9094', roughness: 0.85 }),
  cone: new THREE.MeshStandardMaterial({ color: '#f26a12', roughness: 0.55 }),
  coneBand: new THREE.MeshStandardMaterial({ color: '#f4f2ea', roughness: 0.5 }),
  post: new THREE.MeshStandardMaterial({ color: '#e7b416', roughness: 0.45, metalness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.7 }),
  lamp: new THREE.MeshBasicMaterial({ color: '#fff3d0' }),
  bay: new THREE.MeshBasicMaterial({ color: '#ffb454', transparent: true, opacity: 0.9, depthWrite: false }),
  bayFill: new THREE.MeshBasicMaterial({ color: '#ffb454', transparent: true, opacity: 0.14, depthWrite: false }),
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.ground);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const coneGeo = new THREE.LatheGeometry([[0.2, 0], [0.2, 0.03], [0.15, 0.03], [0.035, 0.62], [0, 0.62]].map(p => new THREE.Vector2(p[0], p[1])), 18);
const bandGeo = new THREE.LatheGeometry([[0.118, 0.22], [0.088, 0.38]].map(p => new THREE.Vector2(p[0] + 0.004, p[1])), 18);
const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 16).translate(0, 0.5, 0);

// ------------------------------------------------------------------- level
const world = new THREE.Group(); scene.add(world);
let level = null, solids = [], cones = [], bay = null, bayMesh = null;
function box(x, z, len, wid, h, height, mat, y0 = 0) {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(len, height, wid); m.position.set(x, y0 + height / 2, z); m.rotation.y = h;
  m.castShadow = height > 0.05; m.receiveShadow = true; world.add(m);
  return m;
}
function loadLevel(i) {
  level = LEVELS[i]; level.index = i;
  while (world.children.length) world.remove(world.children[0]);
  solids = []; cones = [];
  const [W, D] = level.size, hw = W / 2, hd = D / 2;
  // kerbed perimeter
  for (const [x, z, len, wid] of [[0, -hd - 0.2, W + 0.8, 0.4], [0, hd + 0.2, W + 0.8, 0.4], [-hw - 0.2, 0, 0.4, D], [hw + 0.2, 0, 0.4, D]]) {
    box(x, z, len, wid, 0, 0.16, MAT.kerb);
    solids.push(obb(x, z, len / 2, wid / 2, 0));
  }
  // bay markings
  for (const r of level.rows || []) {
    for (let k = 0; k <= r.n; k++) box(r.x0 - BAY_W / 2 + k * BAY_W, r.z, 0.12, BAY_L, 0, 0.012, MAT.line);
    box(r.x0 - BAY_W / 2 + r.n * BAY_W / 2, r.z - r.dir * BAY_L / 2, r.n * BAY_W + 0.12, 0.12, 0, 0.012, MAT.line);
  }
  for (const [x, z, len, wid, h] of level.walls || []) { box(x, z, len, wid, h * DEG, 2.4, MAT.wall); solids.push(obb(x, z, len / 2, wid / 2, h * DEG)); }
  (level.cars || []).forEach(([x, z, h], k) => {
    const c = parkedCar(COLORS[(k + i * 2) % COLORS.length]); c.position.set(x, 0, z); c.rotation.y = h * DEG;
    c.traverse(m => { if (m.isMesh) { m.castShadow = m.userData.matKey !== 'carGlass'; } });
    world.add(c); solids.push(obb(x, z, HALF_L + 0.03, HALF_W + 0.02, h * DEG));
  });
  for (const [x, z] of level.posts || []) {
    const p = new THREE.Mesh(postGeo, MAT.post); p.position.set(x, 0, z); p.castShadow = true; world.add(p);
    const cap = new THREE.Mesh(postGeo, MAT.dark); cap.scale.set(1.15, 0.12, 1.15); cap.position.set(x, 0.62, z); world.add(cap);
    solids.push(obb(x, z, 0.1, 0.1, 0));
  }
  for (const [x, z] of level.cones || []) {
    const g = new THREE.Group(); const a = new THREE.Mesh(coneGeo, MAT.cone), b = new THREE.Mesh(bandGeo, MAT.coneBand);
    a.castShadow = true; g.add(a, b); g.position.set(x, 0, z); world.add(g);
    cones.push({ g, x, z, down: false, t: 0, dir: 0 });
  }
  // lamp posts in the corners for scale
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx * (hw + 1.4), z = sz * (hd + 1.4);
    const pole = new THREE.Mesh(postGeo, MAT.dark); pole.scale.set(0.9, 6, 0.9); pole.position.set(x, 0, z); pole.castShadow = true;
    const arm = box(x - sx * 0.7, z - sz * 0.7, 1.9, 0.12, Math.atan2(sz, -sx), 0.1, MAT.dark, 5.9);
    const head = box(x - sx * 1.3, z - sz * 1.3, 0.7, 0.26, Math.atan2(sz, -sx), 0.07, MAT.lamp, 5.8); head.castShadow = false; arm.castShadow = false;
    world.add(pole);
  }
  // the target bay
  const [tx, tz, th] = level.target, [bl, bw] = level.bay || [BAY_L, BAY_W];
  bay = { ...obb(tx, tz, bl / 2, bw / 2, th * DEG), flip: level.flip };
  bayMesh = new THREE.Group(); bayMesh.position.set(tx, 0.02, tz); bayMesh.rotation.y = th * DEG;
  const edge = (x, z, l, w) => { const m = new THREE.Mesh(unitBox, MAT.bay); m.scale.set(l, 0.02, w); m.position.set(x, 0, z); bayMesh.add(m); };
  edge(0, -bw / 2, bl, 0.14); edge(0, bw / 2, bl, 0.14); edge(-bl / 2, 0, 0.14, bw); edge(bl / 2, 0, 0.14, bw);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(bl, bw), MAT.bayFill); fill.rotation.x = -Math.PI / 2; bayMesh.add(fill);
  const arrow = new THREE.Shape(); arrow.moveTo(1.0, 0); arrow.lineTo(0.2, 0.6); arrow.lineTo(0.2, 0.22); arrow.lineTo(-0.9, 0.22); arrow.lineTo(-0.9, -0.22); arrow.lineTo(0.2, -0.22); arrow.lineTo(0.2, -0.6); arrow.closePath();
  const am = new THREE.Mesh(new THREE.ShapeGeometry(arrow), MAT.bay); am.rotation.x = -Math.PI / 2; am.position.y = 0.005; bayMesh.add(am);
  if (level.flip) { const a2 = am.clone(); a2.rotation.z = Math.PI; a2.scale.setScalar(0.6); a2.position.x = -1.5; am.position.x = 0.6; bayMesh.add(a2); }
  world.add(bayMesh);
  resetRun();
}

// ------------------------------------------------------------------- state
const S = { mode: 'menu', x: 0, z: 0, h: 0, v: 0, steer: 0, t: 0, hits: 0, hold: 0, cam: mobile ? 1 : 0, roll: 0, flash: 0, shake: 0, sound: false, bump: 0, best: {} };
try { S.best = JSON.parse(localStorage.getItem('parkir-tipo600') || '{}'); } catch { S.best = {}; }
const input = { gas: 0, brake: 0, left: 0, right: 0, hand: 0 };
function resetRun() {
  const [x, z, h] = level.start;
  Object.assign(S, { x, z, h: h * DEG, v: 0, steer: 0, t: 0, hits: 0, hold: 0, roll: 0, flash: 0, shake: 0, bump: 0, started: false });
  for (const c of cones) { c.down = false; c.t = 0; c.g.rotation.set(0, 0, 0); c.g.position.set(c.x, 0, c.z); }
  camPos.set(0, 0, 0); camReady = false;
  syncCar();
}
const carBox = () => obb(S.x, S.z, HALF_L, HALF_W, S.h);
function syncCar() {
  player.position.set(S.x, 0, S.z); player.rotation.y = S.h;
  car.setSteer(S.steer);
  for (const c of car.corners) c.spin.rotation.z = -c.s * S.roll;
}

// --------------------------------------------------------------------- sound
const audio = createAudio();
let actx = null;
function blip(freq, dur, vol, type = 'sine') {
  if (!S.sound) return;
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function setSound(on) {
  S.sound = on;
  audio.setVoice(on ? 'berlinetta' : null);
  $('btn-sound').setAttribute('aria-pressed', String(on));
}

// ------------------------------------------------------------------ physics
let beepT = 0, nearest = 9;
function step(dt) {
  const fwdIn = input.gas, backIn = input.brake;
  if ((fwdIn || backIn) && !S.started) S.started = true;
  if (S.started) S.t += dt;
  // pedals: accelerate in the direction asked for, brake when it opposes travel
  let a = 0;
  if (fwdIn) a += S.v < -0.05 ? 9 : 3.4 * (1 - Math.max(0, S.v) / 10);
  if (backIn) a -= S.v > 0.05 ? 9 : 2.6 * (1 - Math.max(0, -S.v) / 4.5);
  if (!fwdIn && !backIn) a -= Math.sign(S.v) * Math.min(Math.abs(S.v) / dt, 1.1 + 0.18 * Math.abs(S.v));
  if (input.hand) a = -Math.sign(S.v) * Math.min(Math.abs(S.v) / dt, 11);
  S.v = THREE.MathUtils.clamp(S.v + a * dt, -4.5, 10);
  // steering: wheel turns at a fixed rate, and centres itself only while rolling
  const want = (input.left - input.right) * 36 * DEG;
  if (input.left || input.right) S.steer += Math.sign(want - S.steer) * Math.min(Math.abs(want - S.steer), 62 * DEG * dt);
  else S.steer -= Math.sign(S.steer) * Math.min(Math.abs(S.steer), 48 * DEG * dt * Math.min(1, Math.abs(S.v) / 1.5));

  // bicycle model about the rear axle
  const f = fwd(S.h), rx = S.x - f.x * WHEELBASE / 2, rz = S.z - f.z * WHEELBASE / 2;
  const nh = S.h + S.v / WHEELBASE * Math.tan(S.steer) * dt, nf = fwd(nh);
  const nrx = rx + f.x * S.v * dt, nrz = rz + f.z * S.v * dt;
  const prev = { x: S.x, z: S.z, h: S.h };
  S.x = nrx + nf.x * WHEELBASE / 2; S.z = nrz + nf.z * WHEELBASE / 2; S.h = nh;
  S.roll += S.v * dt / 0.356;

  const me = carBox();
  nearest = 9;
  let hit = false;
  for (const o of solids) {
    const d = distBoxes(me, o);
    if (d === 0) hit = true;
    nearest = Math.min(nearest, d);
  }
  if (hit) {
    Object.assign(S, prev);
    if (Math.abs(S.v) > 0.5 && S.bump <= 0) { S.hits++; S.flash = 1; S.shake = 0.5; blip(90, 0.25, 0.5, 'square'); }
    S.bump = 0.5;
    S.v *= -0.25;
  }
  S.bump -= dt;
  for (const c of cones) {
    if (c.down) continue;
    const d = distPoint(me, c.x, c.z);
    nearest = Math.min(nearest, d);
    if (d < 0.16) { c.down = true; c.dir = Math.atan2(c.z - S.z, c.x - S.x); S.hits++; S.flash = 0.7; blip(240, 0.12, 0.35, 'triangle'); }
  }
  for (const c of cones) if (c.down && c.t < 1) {
    c.t = Math.min(1, c.t + dt * 3.2);
    c.g.rotation.set(0, -c.dir, 0); c.g.rotateZ(-c.t * 1.45);
    c.g.position.set(c.x + Math.cos(c.dir) * c.t * 0.5, 0.05 * Math.sin(c.t * Math.PI), c.z + Math.sin(c.dir) * c.t * 0.5);
  }
  // parking sensors
  beepT -= dt;
  if (nearest < 1.1 && Math.abs(S.v) > 0.05 && beepT <= 0) { blip(1250, 0.05, 0.12); beepT = nearest < 0.3 ? 0.07 : 0.1 + nearest * 0.42; }

  // parked?
  const d = fwd(bay.h), rel = { x: S.x - bay.x, z: S.z - bay.z };
  const along = rel.x * d.x + rel.z * d.z, across = -rel.x * d.z + rel.z * d.x;
  let dh = ((S.h - bay.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const flipped = Math.abs(dh) > Math.PI / 2;
  if (flipped && bay.flip) dh = dh > 0 ? dh - Math.PI : dh + Math.PI;
  const inside = corners(me).every(p => distPoint(bay, p.x, p.z) < 0.06);
  const aligned = Math.abs(dh) < 9 * DEG && (bay.flip || !flipped);
  S.guide = { along, across, dh, inside, aligned, dist: Math.hypot(rel.x, rel.z), wrongWay: flipped && !bay.flip };
  if (inside && aligned && Math.abs(S.v) < 0.12) S.hold += dt; else S.hold = Math.max(0, S.hold - dt * 2);
  if (S.hits >= MAX_HITS) finish(false);
  else if (S.hold >= 1.1) finish(true);
}

function finish(ok) {
  S.mode = ok ? 'done' : 'fail';
  const g = S.guide, acc = Math.round(Math.max(0, 100 - Math.hypot(g.along, g.across) / 0.7 * 50 - Math.abs(g.dh) / (8 * DEG) * 50));
  let stars = 0;
  if (ok) {
    stars = S.hits === 0 && S.t <= level.par ? 3 : S.hits <= 1 && S.t <= level.par * 1.6 ? 2 : 1;
    if ((S.best[level.index] || 0) < stars) { S.best[level.index] = stars; try { localStorage.setItem('parkir-tipo600', JSON.stringify(S.best)); } catch { /* private mode */ } }
    blip(660, 0.14, 0.25); setTimeout(() => blip(990, 0.3, 0.25), 140);
  }
  $('res-title').textContent = ok ? 'Terparkir!' : 'Mobil rusak';
  $('res-stars').textContent = ok ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('res-stars').hidden = !ok;
  $('res-body').innerHTML = ok
    ? `<dt>Waktu</dt><dd>${S.t.toFixed(1)} dtk <small>target ${level.par} dtk</small></dd><dt>Benturan</dt><dd>${S.hits}</dd><dt>Akurasi</dt><dd>${acc}%</dd>`
    : `<dt>Benturan</dt><dd>${S.hits} dari ${MAX_HITS}</dd><dt>Saran</dt><dd>Lebih pelan, dan lepas gas sebelum membelok.</dd>`;
  $('res-next').hidden = !ok || level.index === LEVELS.length - 1;
  $('result').hidden = false; $('pads').hidden = true;
  input.gas = input.brake = input.left = input.right = 0;
}

// ------------------------------------------------------------------- camera
const camPos = new THREE.Vector3(), camAim = new THREE.Vector3(), tmp = new THREE.Vector3();
let camReady = false;
function updateCamera(dt) {
  const f = fwd(S.h), want = tmp, aim = new THREE.Vector3(S.x + f.x * 1.2, 0.7, S.z + f.z * 1.2);
  const portrait = camera.aspect < 0.9;
  if (S.cam === 0) want.set(S.x - f.x * (portrait ? 11 : 8.2), portrait ? 5.6 : 3.7, S.z - f.z * (portrait ? 11 : 8.2));
  else {
    // look down between the car and the bay, so the way in is in view
    const dx = bay.x - S.x, dz = bay.z - S.z, d = Math.hypot(dx, dz) || 1, lead = Math.min(d, 12) * 0.5;
    aim.set(S.x + dx / d * lead, 0, S.z + dz / d * lead);
    want.set(aim.x, portrait ? 46 : 30, aim.z + 0.01);
  }
  const k = camReady ? 1 - Math.exp(-dt * (S.cam === 0 ? 4.5 : 9)) : 1;
  camPos.lerp(want, k); camAim.lerp(aim, camReady ? 1 - Math.exp(-dt * 9) : 1); camReady = true;
  camera.position.copy(camPos);
  if (S.shake > 0) { camera.position.x += (Math.random() - 0.5) * S.shake * 0.25; camera.position.y += (Math.random() - 0.5) * S.shake * 0.2; }
  camera.up.set(0, 1, 0);
  if (S.cam === 1) camera.up.set(0, 0, -1);
  camera.lookAt(camAim);
  sun.position.set(S.x - 26, 34, S.z + 18); sun.target.position.set(S.x, 0, S.z);
}

// ---------------------------------------------------------------------- HUD
function hud() {
  $('hud-time').textContent = S.t.toFixed(1);
  $('hud-speed').textContent = Math.round(Math.abs(S.v) * 3.6);
  $('hud-gear').textContent = S.v < -0.05 ? 'R' : S.v > 0.05 || input.gas ? 'D' : 'N';
  $('hud-hits').textContent = '●'.repeat(MAX_HITS - S.hits) + '○'.repeat(Math.min(S.hits, MAX_HITS));
  const g = S.guide; let msg = '';
  if (g) {
    if (g.inside && g.aligned) msg = Math.abs(S.v) < 0.12 ? 'Tahan…' : 'Berhenti di sini';
    else if (g.wrongWay && g.dist < 4) msg = 'Arah terbalik: moncong harus searah panah';
    else if (g.inside) msg = `Luruskan ${Math.round(Math.abs(g.dh) / DEG)}°`;
    else if (g.dist < 4) msg = `Geser ${Math.abs(g.across) > Math.abs(g.along) ? 'ke samping' : 'maju/mundur'} ${Math.max(Math.abs(g.across), Math.abs(g.along)).toFixed(1)} m`;
    else msg = `Petak ${g.dist.toFixed(0)} m lagi`;
  }
  $('hud-guide').textContent = msg;
  // arrow towards the bay while it is still some way off
  const arrow = $('hud-arrow');
  if (g && g.dist > 4) {
    const a = tmp.set(S.x, 0, S.z).project(camera), ax = a.x, ay = a.y, b = tmp.set(bay.x, 0, bay.z).project(camera);
    const behind = b.z > 1, bx = behind ? -b.x : b.x, by = behind ? -b.y : b.y;
    arrow.style.transform = `rotate(${Math.atan2((bx - ax) * camera.aspect, by - ay)}rad)`;
    arrow.removeAttribute('hidden');
  } else arrow.setAttribute('hidden', '');
  $('hold').style.setProperty('--p', Math.min(1, S.hold / 1.1));
  $('hold').hidden = S.hold <= 0.02;
  $('sensor').dataset.level = nearest < 0.3 ? '3' : nearest < 0.7 ? '2' : nearest < 1.1 ? '1' : '0';
  $('flash').style.opacity = S.flash;
}

// --------------------------------------------------------------------- loop
function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 52 : 42; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stageEl); resize();

let last = performance.now(), menuSpin = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === 'play') {
    const n = Math.max(1, Math.ceil(dt / 0.012));
    for (let i = 0; i < n && S.mode === 'play'; i++) step(dt / n);
    S.flash = Math.max(0, S.flash - dt * 2.5); S.shake = Math.max(0, S.shake - dt * 1.6);
    syncCar(); updateCamera(dt); hud();
    const braking = (input.brake && S.v > 0.05) || (input.gas && S.v < -0.05) || input.hand;
    M.tailLit.emissiveIntensity = braking ? 2.4 : 0.9;
    audio.update(950 + Math.abs(S.v) * 330 + (input.gas || input.brake ? 900 : 0), input.gas || input.brake ? 0.35 : 0, dt);
  } else {
    // idle orbit behind the menu and the result card
    menuSpin += dt * 0.25;
    const r = 9.5;
    camera.up.set(0, 1, 0);
    camera.position.set(S.x + Math.cos(menuSpin) * r, 3.4, S.z + Math.sin(menuSpin) * r);
    camera.lookAt(S.x, 0.6, S.z);
    sun.position.set(S.x - 26, 34, S.z + 18); sun.target.position.set(S.x, 0, S.z);
    S.flash = Math.max(0, S.flash - dt * 2.5); $('flash').style.opacity = S.flash;
    audio.update(950, 0, dt);
  }
  const pulse = 0.55 + 0.35 * Math.sin(now / 260);
  MAT.bay.opacity = pulse; MAT.bay.color.set(S.guide?.inside && S.guide?.aligned ? '#7fd4a0' : '#ffb454'); MAT.bayFill.color.copy(MAT.bay.color);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------------- UI
function start(i) {
  loadLevel(i);
  S.mode = 'play';
  $('menu').hidden = true; $('result').hidden = true; $('hud').hidden = false; $('pads').hidden = false;
  $('hud-level').textContent = `${i + 1} · ${level.name}`;
  $('hud-hint').textContent = level.hint;
  $('hud-hint').hidden = false; clearTimeout(start.t); start.t = setTimeout(() => { $('hud-hint').hidden = true; }, 6000);
}
function menu() {
  S.mode = 'menu';
  $('menu').hidden = false; $('result').hidden = true; $('hud').hidden = true; $('pads').hidden = true;
  const list = $('levels'); list.textContent = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'lvl';
    const st = S.best[i] || 0;
    b.innerHTML = `<i>${i + 1}</i><b></b><span></span><em>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</em>`;
    b.querySelector('b').textContent = L.name; b.querySelector('span').textContent = L.hint;
    b.addEventListener('click', () => { if (!S.asked) { S.asked = true; setSound(true); } start(i); });
    list.appendChild(b);
  });
}
$('btn-restart').addEventListener('click', () => start(level.index));
$('btn-cam').addEventListener('click', () => { S.cam = 1 - S.cam; camReady = false; });
$('btn-sound').addEventListener('click', () => setSound(!S.sound));
$('btn-menu').addEventListener('click', menu);
$('res-retry').addEventListener('click', () => start(level.index));
$('res-next').addEventListener('click', () => start(Math.min(LEVELS.length - 1, level.index + 1)));
$('res-menu').addEventListener('click', menu);

const KEYS = { ArrowUp: 'gas', w: 'gas', ArrowDown: 'brake', s: 'brake', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'hand' };
addEventListener('keydown', e => {
  const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k && S.mode === 'play') { input[k] = 1; e.preventDefault(); return; }
  if (e.repeat) return;
  const c = e.key.toLowerCase();
  if (c === 'r' && level && S.mode !== 'menu') start(level.index);
  else if (c === 'c') { S.cam = 1 - S.cam; camReady = false; }
  else if (c === 'm') setSound(!S.sound);
  else if (e.key === 'Escape') menu();
  else if (e.key === 'Enter' && S.mode === 'done' && !$('res-next').hidden) $('res-next').click();
});
addEventListener('keyup', e => { const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) input[k] = 0; });
addEventListener('blur', () => { for (const k in input) input[k] = 0; });
for (const el of document.querySelectorAll('[data-pad]')) {
  const k = el.dataset.pad;
  const on = e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); input[k] = 1; el.classList.add('on'); };
  const off = () => { input[k] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

loadLevel(0);
menu();
$('veil').classList.add('done');
requestAnimationFrame(frame);
window.__parkir = { S, input, start, LEVELS, step, loadLevel, get level() { return level; }, get bay() { return bay; } };
