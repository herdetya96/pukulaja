// Bodywork of the Tipo 600 GT, generated as one lofted surface.
//
// The body is a grid: stations run rear to front, and at each station a half
// cross-section is drawn from the floor centreline, up the flank, across the
// glass and over the roof or bonnet to the top centreline. Everything visible
// (paint, glass, bonnet, doors, lamps, vents) is a set of cells of that one
// grid, so panels meet exactly and shutlines follow real grid lines.
// Lengths are millimetres: X forward, Y up, Z to the right. Ground is Y = 0.
import * as THREE from '../vendor/three.bundle.min.js';

export const CAR = {
  rear: -2260, front: 2390, wheelbase: 2720,
  axle: { f: { x: 1360, y: 350, R: 392, track: 840, tyreR: 350, tyreW: 275, rimR: 254 }, r: { x: -1360, y: 362, R: 406, track: 832, tyreR: 362, tyreW: 315, rimR: 267 } },
  cowl: 700, header: 130, rearHeader: -650, glassBase: -1620, tail: -1750,
  door: [-560, 640], hood: [735, 2190], sideGlass: [-1060, 640],
  engine: [1020, 330, 0],
};

// Smooth curve through a table of [x, value] pairs.
export function keyed(pts) {
  return x => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    let i = 1;
    while (pts[i][0] < x) i++;
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p2 = pts[i], p3 = pts[Math.min(pts.length - 1, i + 1)];
    const t = (x - p1[0]) / (p2[0] - p1[0]), h = p2[0] - p1[0];
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

// ---- the design, as curves along the length of the car ---------------------
const yTop = keyed([[-2260, 868], [-2200, 906], [-2100, 918], [-1900, 946], [-1620, 1004], [-1300, 1100], [-900, 1200], [-500, 1262],
  [-250, 1272], [0, 1256], [130, 1228], [400, 1085], [660, 946], [760, 902], [1000, 866], [1360, 814], [1800, 722], [2150, 606], [2330, 502], [2390, 448]]);
const yBot = keyed([[-2260, 345], [-2050, 235], [-1780, 150], [-1360, 138], [1360, 138], [2000, 148], [2250, 196], [2390, 240]]);
const wMax = keyed([[-2260, 800], [-2150, 884], [-1900, 958], [-1360, 994], [-900, 966], [-300, 950], [300, 948], [900, 962], [1360, 988],
  [1800, 952], [2150, 858], [2330, 706], [2390, 600]]);
const ySh = keyed([[-2260, 800], [-2100, 884], [-1900, 928], [-1360, 968], [-900, 946], [-300, 916], [300, 896], [700, 886], [1000, 852],
  [1360, 808], [1800, 716], [2150, 598], [2330, 486], [2390, 432]]);
const shIn = keyed([[-2260, 40], [-1900, 70], [-1360, 86], [-300, 72], [700, 70], [1360, 80], [2150, 60], [2390, 30]]);
const tuck = keyed([[-2260, 40], [-1800, 70], [1800, 70], [2390, 40]]);
const bow = keyed([[-2260, -200], [-1900, -90], [-1600, 0], [-1100, 0], [-500, 0], [130, 40], [700, 80], [1000, 30], [1250, 0], [1500, 0],
  [1750, 40], [2100, 150], [2390, 290]]);
const bulge = keyed([[700, 0], [900, 16], [1500, 24], [2000, 10], [2300, 0]]);
const wSh = x => wMax(x) - shIn(x);
const railY = keyed([[CAR.tail, ySh(CAR.tail)], [-1500, 992], [-1200, 1076], [-900, 1160], [-500, 1222], [-250, 1236], [0, 1222], [130, 1198],
  [400, 1062], [CAR.cowl, ySh(CAR.cowl)]]);
const railZ = keyed([[CAR.tail, wSh(CAR.tail)], [-1500, 806], [-1200, 704], [-900, 632], [-500, 600], [-250, 595], [0, 600], [130, 612],
  [400, 724], [CAR.cowl, wSh(CAR.cowl)]]);
const inCabin = x => x > CAR.tail + 1 && x < CAR.cowl - 1;

// rows of one half section
const NA = 5, NB = 27, NC = 7, ND = 17;
const J = { A: 0, B: NA, C: NA + NB, D: NA + NB + NC, N: NA + NB + NC + ND };
const bez = (p0, c1, c2, p3, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]];
};

// Half cross-section at station x: J.N points as [z, y].
export function section(x) {
  const yb = yBot(x), wm = wMax(x), wb = wm - tuck(x), ws = wSh(x), ys = ySh(x), H = ys - yb;
  const cab = inCabin(x);
  const wr = cab ? railZ(x) : ws, yr = cab ? railY(x) : ys, yt = yTop(x);
  const pts = [];
  for (const f of [0, 0.35, 0.68, 0.86, 1]) pts.push([wb * f, yb]);
  const cz = (8 * wm - wb - ws) / 6;
  // a scallop drawn back from the front wheel along the door, and a faint one
  // ahead of the rear wheel: these are what catch the light on the flank
  const sc = 26 * Math.exp(-(((x - 760) / 520) ** 2)) * (x < 960 ? 1 : Math.max(0, 1 - (x - 960) / 60)) + 9 * Math.exp(-(((x + 620) / 300) ** 2));
  for (let k = 0; k < NB; k++) {
    const t = k / (NB - 1), p = bez([wb, yb], [cz, yb + 0.1 * H], [cz, ys - 0.16 * H], [ws, ys], t);
    p[0] -= sc * Math.exp(-(((t - 0.36) / 0.17) ** 2));
    pts.push(p);
  }
  const dz = wr - ws, dy = yr - ys, len = Math.hypot(dz, dy) || 1, nz = dy / len, ny = -dz / len, bowC = Math.min(14, len * 0.05);
  for (let k = 0; k < NC; k++) {
    const t = k / (NC - 1), s = Math.sin(Math.PI * t) * bowC;
    pts.push([ws + dz * t + nz * s, ys + dy * t + ny * s]);
  }
  const hb = bulge(x);
  for (let k = 0; k < ND; k++) {
    const t = k / (ND - 1);
    const p = bez([wr, yr], [wr * 0.72, yr + (yt - yr) * 0.78], [wr * 0.42, yt], [0, yt], t);
    if (hb > 0) p[1] += hb * Math.exp(-((p[0] / 300) ** 2));
    pts.push(p);
  }
  return pts;
}

function stations() {
  const xs = [];
  let x = CAR.rear;
  while (x < CAR.front - 4) {
    xs.push(x);
    const end = Math.min(x - CAR.rear, CAR.front - x);
    let step = 34;
    if (end < 280) step = 7 + 27 * end / 280;
    for (const a of [CAR.axle.f, CAR.axle.r]) if (Math.abs(x - a.x) < a.R + 80) step = Math.min(step, 15);
    x += step;
  }
  xs.push(CAR.front);
  return xs;
}

const BOW_REF = 990;
export const bowAt = (x, z) => bow(x) * (z / BOW_REF) ** 2;
export const bodyCurves = { yTop, yBot, wMax, ySh, wSh, railY, railZ };

export function buildBody(M) {
  const X = stations(), NU = X.length;
  const P = [], Nn = [];
  for (let i = 0; i < NU; i++) {
    const row = section(X[i]).map(([z, y]) => new THREE.Vector3(X[i] - bowAt(X[i], z), y, z));
    P.push(row);
    Nn.push(row.map(() => new THREE.Vector3()));
  }

  // ---- wheel arches: push the flank's vertices out to the arch edge ---------
  const inside = P.map(r => r.map(() => false));
  for (const a of [CAR.axle.f, CAR.axle.r]) {
    for (let i = 0; i < NU; i++) {
      if (Math.abs(X[i] - a.x) > a.R + 140) continue;
      for (let j = 2; j < J.C; j++) {
        const p = P[i][j], dx = p.x - a.x, dy = p.y - a.y;
        if (dy >= 0) {
          const d = Math.hypot(dx, dy);
          if (d < a.R) { inside[i][j] = true; const k = d > 1 ? a.R / d : 0; p.x = a.x + (k ? dx * k : 0); p.y = a.y + (k ? dy * k : a.R); }
        } else if (Math.abs(dx) < a.R) { inside[i][j] = true; p.x = a.x + (dx < 0 ? -a.R : a.R); }
      }
    }
  }

  // ---- normals: smooth inside each band, creased where glass meets metal ----
  const segOf = j => j < J.B ? 0 : j < J.C ? 1 : j < J.D ? 2 : 3;
  const sameSeg = j => segOf(j) === segOf(j + 1);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let i = 0; i < NU - 1; i++) for (let j = 0; j < J.N - 1; j++) {
    if (!sameSeg(j)) continue;
    const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
    fn.crossVectors(e1.subVectors(c, a), e2.subVectors(d, b));
    Nn[i][j].add(fn); Nn[i + 1][j].add(fn); Nn[i + 1][j + 1].add(fn); Nn[i][j + 1].add(fn);
  }
  for (let i = 0; i < NU; i++) {
    if (!inCabin(X[i])) {            // no glass here: shoulder is one soft surface
      const s = Nn[i][J.C - 1].clone().add(Nn[i][J.D]);
      for (let j = J.C - 1; j <= J.D; j++) Nn[i][j].copy(s);
    }
    Nn[i][0].z = 0; Nn[i][J.N - 1].z = 0;
    for (let j = 0; j < J.N; j++) if (Nn[i][j].lengthSq() > 0) Nn[i][j].normalize(); else Nn[i][j].set(0, 1, 0);
  }

  // ---- buckets ---------------------------------------------------------------
  const buckets = new Map();
  const bucket = (mesh, mat) => {
    const k = mesh + '|' + mat;
    if (!buckets.has(k)) buckets.set(k, { mesh, mat, pos: [], nor: [], uv: [] });
    return buckets.get(k);
  };
  const pushV = (b, p, n, sz) => {
    b.pos.push(p.x, p.y, p.z * sz); b.nor.push(n.x, n.y, n.z * sz);
    if (Math.abs(n.x) > 0.75) b.uv.push(p.z * sz * 0.01, p.y * 0.01); else b.uv.push(p.x * 0.01, (p.y + p.z * 0.5) * 0.01);
  };
  const tri = (b, sz, p, n, order) => { for (const k of (sz > 0 ? order : [order[0], order[2], order[1]])) pushV(b, p[k], n[k], sz); };
  const quad = (b, sz, p, n) => { tri(b, sz, p, n, [0, 1, 2]); tri(b, sz, p, n, [0, 2, 3]); };
  const tmpP = [0, 1, 2, 3].map(() => new THREE.Vector3()), tmpN = [0, 1, 2, 3].map(() => new THREE.Vector3());

  const between = (x, r) => x >= r[0] && x < r[1];
  // what a cell of the grid is: returns [mesh, material] or null for a hole
  function classify(i, j, sz) {
    const x = (X[i] + X[i + 1]) / 2, seg = segOf(j), side = sz > 0 ? 'R' : 'L';
    const door = between(x, CAR.door);
    if (seg === 0) {
      if (j >= 2 && inside[i][j] && inside[i + 1][j] && inside[i][j + 1] && inside[i + 1][j + 1]) return null;
      return ['body', 'carUnder'];
    }
    if (seg === 1) {
      const r = j - J.B;
      if (inside[i][j] && inside[i + 1][j] && inside[i][j + 1] && inside[i + 1][j + 1]) return null;
      if (r < 3) return ['body', x > -1830 && x < 1860 ? 'carSill' : 'paint'];
      if (between(x, [1930, 2290]) && r >= 3 && r <= 9) return ['body', 'vent'];
      if (between(x, [1900, 2300]) && r >= (x < 2010 ? 23 : 20)) return ['lights', 'lens'];
      if (x < -2120 && r >= 19 && r <= 23) return ['lights', 'tail'];
      if (between(x, [780, 915]) && r >= 9 && r <= 17) return ['body', 'vent'];
      if (door) return ['door' + side, 'paint'];
      return ['body', 'paint'];
    }
    if (seg === 2) {
      if (!inCabin(x)) return null;
      const r = j - J.C;
      if (x < CAR.sideGlass[0]) return ['body', 'paint'];
      const frame = r === NC - 2 || between(x, [-600, -520]) || x > 610;
      const mesh = door ? 'door' + side : 'body';
      return frame ? [mesh, 'gloss'] : [door ? 'door' + side : 'glass', 'carGlass'];
    }
    const r = j - J.D;
    if (x >= CAR.cowl) {
      if (between(x, CAR.hood) && r >= 3) return ['hood', between(x, [1470, 1770]) && r >= 6 && r <= 9 ? 'vent' : 'paint'];
      return ['body', 'paint'];
    }
    if (x >= CAR.header) return r < 2 || x > CAR.cowl - 46 || x < CAR.header + 36 ? ['body', 'gloss'] : ['glass', 'carGlass'];
    if (x >= CAR.rearHeader) return r < 2 ? ['body', 'paint'] : ['body', 'roof'];
    if (x >= CAR.glassBase) return r < 2 ? ['body', 'paint'] : (x < CAR.glassBase + 44 || x > CAR.rearHeader - 40 ? ['body', 'gloss'] : ['glass', 'carGlass']);
    return ['body', 'paint'];
  }

  const LINED = new Set(['paint', 'roof', 'gloss']);
  for (let i = 0; i < NU - 1; i++) for (let j = 0; j < J.N - 1; j++) {
    if (!sameSeg(j)) continue;
    const p = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]], n = [Nn[i][j], Nn[i + 1][j], Nn[i + 1][j + 1], Nn[i][j + 1]];
    for (const sz of [1, -1]) {
      const c = classify(i, j, sz);
      if (!c) continue;
      quad(bucket(c[0], c[1]), sz, p, n);
      // cabin lining behind every opaque panel that faces the occupants
      const x = (X[i] + X[i + 1]) / 2;
      const opening = c[0] === 'hood' || c[0].startsWith('door');
      if ((LINED.has(c[1]) || (opening && c[1] !== 'carGlass')) && (opening || (x > -1660 && x < CAR.cowl && segOf(j) >= 1 && (segOf(j) > 1 || j - J.B > 4)))) {
        for (let k = 0; k < 4; k++) { tmpP[k].copy(p[k]).addScaledVector(n[k], c[0] === 'hood' ? -9 : -16); tmpN[k].copy(n[k]).negate(); }
        const b = bucket(c[0] === 'body' || c[0] === 'glass' ? 'liner' : c[0], c[0] === 'hood' ? 'carSill' : 'liner');
        tri(b, sz, tmpP, tmpN, [0, 2, 1]); tri(b, sz, tmpP, tmpN, [0, 3, 2]);
      }
    }
  }

  // ---- nose and tail: fill the open ends -----------------------------------
  const endCap = (i, front) => {
    const xe = X[i], K = 12, b = bow(xe), q = new THREE.Vector3();
    const pt = (j, s) => { const z = P[i][j].z * s; return new THREE.Vector3(xe - b * (z / BOW_REF) ** 2, P[i][j].y, z); };
    const nrm = z => q.set(1, 0, 2 * b * z / (BOW_REF * BOW_REF)).normalize().multiplyScalar(front ? 1 : -1).clone();
    for (let j = 0; j < J.N - 1; j++) {
      if (Math.abs(P[i][j].y - P[i][j + 1].y) < 0.5 && j < J.B) continue;
      for (let k = 0; k < K; k++) {
        const s0 = -1 + 2 * k / K, s1 = -1 + 2 * (k + 1) / K;
        const p = front ? [pt(j, s0), pt(j + 1, s0), pt(j + 1, s1), pt(j, s1)] : [pt(j, s0), pt(j, s1), pt(j + 1, s1), pt(j + 1, s0)];
        const n = p.map(v => nrm(v.z));
        const ym = (P[i][j].y + P[i][j + 1].y) / 2;
        const mat = front ? 'grille' : ym < 540 ? 'carUnder' : 'paint';
        quad(bucket('body', mat), 1, p, n);
      }
    }
  };
  endCap(NU - 1, true); endCap(0, false);

  // ---- ribbons: shutlines, lamp blades, bright trim --------------------------
  const iAt = x => { let b = 0; for (let i = 1; i < NU; i++) if (Math.abs(X[i] - x) < Math.abs(X[b] - x)) b = i; return b; };
  const side = new THREE.Vector3(), tan = new THREE.Vector3();
  function ribbon(mesh, mat, pts, nrms, w, lift, both = true) {
    for (const sz of both ? [1, -1] : [1]) {
      const b = bucket(mesh, mat);
      for (let k = 0; k < pts.length - 1; k++) {
        const q = [], qn = [];
        for (const m of [k, k + 1]) {
          tan.subVectors(pts[Math.min(m + 1, pts.length - 1)], pts[Math.max(m - 1, 0)]).normalize();
          side.crossVectors(nrms[m], tan).normalize().multiplyScalar(w / 2);
          const c = pts[m].clone().addScaledVector(nrms[m], lift);
          q.push(c.clone().sub(side), c.clone().add(side)); qn.push(nrms[m], nrms[m]);
        }
        quad(b, sz, [q[0], q[2], q[3], q[1]], [qn[0], qn[2], qn[3], qn[1]]);
        tri(b, sz, [q[0], q[2], q[3]], [qn[0], qn[2], qn[3]], [0, 2, 1]);       // back face, so it never drops out
        tri(b, sz, [q[0], q[3], q[1]], [qn[0], qn[3], qn[1]], [0, 2, 1]);
      }
    }
  }
  const alongRow = (j, x0, x1) => { const a = iAt(x0), b = iAt(x1), p = [], n = []; for (let i = a; i <= b; i++) { p.push(P[i][j]); n.push(Nn[i][j]); } return [p, n]; };
  const alongStation = (x, j0, j1) => { const i = iAt(x), p = [], n = []; for (let j = j0; j <= j1; j++) { p.push(P[i][j]); n.push(Nn[i][j]); } return [p, n]; };
  const gap = (pn, w = 5) => ribbon('body', 'gap', pn[0], pn[1], w, 0.5);
  // bonnet
  gap(alongRow(J.D + 3, CAR.hood[0], CAR.hood[1]));
  gap(alongStation(CAR.hood[0], J.D + 3, J.N - 1)); gap(alongStation(CAR.hood[1], J.D + 3, J.N - 1));
  // doors
  gap(alongStation(CAR.door[0], J.B + 3, J.C - 1)); gap(alongStation(CAR.door[1], J.B + 3, J.C - 1));
  gap(alongRow(J.B + 3, CAR.door[0], CAR.door[1]));
  // boot lid, fuel flap
  gap(alongStation(-1700, J.D + 2, J.N - 1)); gap(alongRow(J.D + 2, CAR.rear + 40, -1700));
  // fuel filler flap on the right rear wing
  {
    const i0 = iAt(-1770), i1 = iAt(-1640), j0 = J.B + 17, j1 = J.B + 22;
    const edge = (pts, nr) => ribbon('body', 'gap', pts, nr, 4, 0.5, false);
    for (const j of [j0, j1]) { const p = [], n = []; for (let i = i0; i <= i1; i++) { p.push(P[i][j]); n.push(Nn[i][j]); } edge(p, n); }
    for (const i of [i0, i1]) { const p = [], n = []; for (let j = j0; j <= j1; j++) { p.push(P[i][j]); n.push(Nn[i][j]); } edge(p, n); }
  }
  // daytime running blades and the tail-lamp wrap
  ribbon('lights', 'drl', ...alongRow(J.B + 24, 1915, 2296), 9, 1.4);
  ribbon('lights', 'drl', ...alongRow(J.B + 21, 2020, 2290), 6, 1.4);
  ribbon('lights', 'tailLit', ...alongRow(J.B + 21, CAR.rear, -2125), 16, 1.4);
  // bright surround to the side glass, and the grille frame
  ribbon('body', 'chrome', ...alongRow(J.C, CAR.sideGlass[0] + 10, 640), 9, 1.2);
  ribbon('body', 'chrome', ...alongStation(CAR.front, J.B, J.N - 1), 16, 1.5);
  // tail-lamp bar across the back
  {
    const i = 0, j = J.B + 21, b = bow(X[i]), pts = [], nr = [];
    for (let k = 0; k <= 30; k++) {
      const z = P[i][j].z * (-1 + 2 * k / 30);
      pts.push(new THREE.Vector3(X[i] - b * (z / BOW_REF) ** 2 - 1.5, P[i][j].y, z));
      nr.push(new THREE.Vector3(-1, 0, -2 * b * z / (BOW_REF * BOW_REF)).normalize());
    }
    ribbon('lights', 'tailLit', pts, nr, 16, 0.5, false);
    const pl = pts.map(p => p.clone().setY(p.y - 150)).filter(p => Math.abs(p.z) < 300);
    ribbon('body', 'gloss', pl, nr.slice(0, pl.length).map(() => new THREE.Vector3(-1, 0, 0)), 150, 1, false);
  }

  // ---- meshes ----------------------------------------------------------------
  const PART = { body: 'body', glass: 'glass', hood: 'bonnet', doorL: 'doors', doorR: 'doors', lights: 'lights', liner: 'cabin' };
  const groups = {};
  for (const b of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, M[b.mat]);
    mesh.name = b.mesh + ':' + b.mat;
    mesh.userData.part = PART[b.mesh]; mesh.userData.matKey = b.mat;
    mesh.castShadow = b.mat !== 'carGlass' && b.mat !== 'gap'; mesh.receiveShadow = b.mat !== 'gap';
    if (b.mat === 'carGlass') mesh.renderOrder = 3;
    (groups[b.mesh] ??= new THREE.Group()).add(mesh);
    groups[b.mesh].name = b.mesh;
  }
  // re-centre the opening panels on their hinges
  const rehinge = (g, pivot) => {
    for (const m of g.children) m.geometry.translate(-pivot.x, -pivot.y, -pivot.z);
    g.position.copy(pivot);
    return g;
  };
  const ih = iAt(CAR.hood[0]), idr = iAt(CAR.door[1]);
  rehinge(groups.hood, new THREE.Vector3(P[ih][J.N - 1].x, P[ih][J.N - 1].y, 0));
  const hingeR = new THREE.Vector3(P[idr][J.B + 14].x, 0, P[idr][J.B + 14].z - 30);
  rehinge(groups.doorR, hingeR);
  rehinge(groups.doorL, hingeR.clone().setZ(-hingeR.z));

  // surface lookup for things that sit on the body (mirrors, wipers, badges)
  const at = (x, j) => { const i = iAt(x); return { p: P[i][j].clone(), n: Nn[i][j].clone() }; };
  return { groups, at, J, X, iAt, P, Nn };
}
