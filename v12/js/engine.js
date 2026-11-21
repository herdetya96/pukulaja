// Procedural 60° V12. Every surface is generated here from the dimensions in
// config.js: no imported models. Lengths are millimetres; the root group is
// scaled to scene units (1 unit = 100 mm).
import * as THREE from '../vendor/three.bundle.min.js';
import { RoundedBoxGeometry } from '../vendor/three.bundle.min.js';
import { E, CYL, THROW_ANGLE, throwX, valveLift, pinHeight, VALVE } from './config.js';
import {
  DEG, Part, multi, mat4, alignY, arcPts, shapeFrom, circlePath, circleShape, rrectShape, rrectPath,
  extrudeX, extrudeY, cylX, cylY, cylZ, box, lathe, gearShape,
} from './geo.js';

const S30 = Math.sin(E.bankHalf * DEG), C30 = Math.cos(E.bankHalf * DEG);
// [z, y] of a point `a` up the bore axis and `lat` outboard of it, for the +Z bank
const bankPt = (a, lat) => [S30 * a + C30 * lat, C30 * a - S30 * lat];
const bankMatrix = s => new THREE.Matrix4().makeRotationX(s * E.bankHalf * DEG).multiply(new THREE.Matrix4().makeScale(1, 1, s));
const bankToWorld = (s, x, y, z) => [x, y * C30 - z * S30, s * (y * S30 + z * C30)];
const rbox = (x, y, z, r = 3, seg = 3) => new RoundedBoxGeometry(x, y, z, seg, r);
const mod = (a, n) => ((a % n) + n) % n;
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

const CHAIN_X = { 1: 342, [-1]: 358 };
const SPROCKET_R = 19;
const CHAMBER = 13;
const SPRING_Y0 = 56, SPRING_LEN = 28, BUCKET_Y = 82;

// Closed path of a belt or chain wrapped round a set of pulleys, given
// counter-clockwise in (z, y). Returns sample points and the loop length.
function beltLoop(circles, step = 3) {
  const pts = [], n = circles.length;
  const tangent = i => {
    const a = circles[i], b = circles[(i + 1) % n];
    const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1], D = Math.hypot(dx, dy);
    const cb = (a.r - b.r) / D, sb = Math.sqrt(1 - cb * cb);
    const ux = dx / D, uy = dy / D;
    return Math.atan2(uy * cb - ux * sb, ux * cb + uy * sb);       // normal = d·cosβ + right·sinβ
  };
  const tans = circles.map((_, i) => tangent(i));
  for (let i = 0; i < n; i++) {
    const c = circles[i];
    let aIn = tans[(i - 1 + n) % n], aOut = tans[i];
    while (aOut < aIn) aOut += Math.PI * 2;
    const steps = Math.max(4, Math.ceil((aOut - aIn) * c.r / step));
    for (let k = 0; k <= steps; k++) {
      const a = aIn + (aOut - aIn) * k / steps;
      pts.push([c.c[0] + c.r * Math.cos(a), c.c[1] + c.r * Math.sin(a)]);
    }
    const nx = circles[(i + 1) % n];
    const p0 = [c.c[0] + c.r * Math.cos(aOut), c.c[1] + c.r * Math.sin(aOut)];
    const p1 = [nx.c[0] + nx.r * Math.cos(aOut), nx.c[1] + nx.r * Math.sin(aOut)];
    const seg = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (step * 4));
    for (let k = 1; k < seg; k++) pts.push([p0[0] + (p1[0] - p0[0]) * k / seg, p0[1] + (p1[1] - p0[1]) * k / seg]);
  }
  let len = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return { pts, len };
}

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'engine';
  root.scale.setScalar(0.01);

  const parts = {};
  const explodes = [];
  const anchors = [];
  const reg = (id, obj) => { (parts[id] ??= []).push(obj); obj.userData.part = id; return obj; };
  const ex = (obj, vec, order) => { explodes.push({ obj, base: obj.position.clone(), vec: new THREE.Vector3(...vec), order }); return obj; };
  // callout anchor: a point on the part and the direction its surface faces
  const anchor = (id, parent, p, label, n = [0, 1, 0], side = 'r') => {
    const o = new THREE.Object3D(); o.position.set(...p); parent.add(o);
    anchors.push({ part: id, obj: o, label, side, normal: n && new THREE.Vector3(...n) });
  };

  const Mb = { 1: bankMatrix(1), [-1]: bankMatrix(-1) };
  const bankG = {}, kinG = {};
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.name = 'bank' + s;
    g.rotation.x = s * E.bankHalf * DEG; g.scale.z = s;
    root.add(g); bankG[s] = g; ex(g, [0, 250, 0], 0.2);
    const k = new THREE.Group(); k.name = 'kin' + s;
    k.rotation.x = s * E.bankHalf * DEG;
    root.add(k); kinG[s] = k;
  }
  const cylOf = s => CYL.filter(c => c.bank === s);

  // ------------------------------------------------------------------ block
  {
    const P = new Part('block', M);
    const Rc = 82, bl = E.bore / 2 + 2.5;
    const j = bankPt(Math.sqrt(Rc * Rc - bl * bl), bl);
    const jAng = Math.atan2(j[1], j[0]);
    const foot = E.blockFoot + 1;
    const top0 = bankPt(foot, bl), top1 = bankPt(foot, 60);
    const wall = [top1, [101, 10], [99, -68], [109, -68], [109, -84], [80, -84],
      ...arcPts(0, 0, Rc, -20 * DEG, jAng, 10), top0];
    for (const sg of [1, -1]) {
      P.add(extrudeX(shapeFrom(wall.map(p => [p[0] * sg, p[1]])), -E.halfLen, E.halfLen, { bevel: 0 }), 'cast');
    }
    // main bearing bulkheads with bay-to-bay breather windows
    const bh = circleShape(Rc + 0.6);
    bh.holes.push(circlePath(0, 0, E.mainR + 0.5), circlePath(52, 14, 11), circlePath(-52, 14, 11), circlePath(0, -58, 9));
    for (let i = 0; i <= 6; i++) {
      const x = (3 - i) * E.pitch;
      const x0 = Math.max(-320.5, x - 11), x1 = Math.min(320.5, x + 11);
      P.add(extrudeX(bh, x0, x1, { bevel: 0.8, seg: 40 }), 'cast');
    }
    // end plates
    const apex = [0, foot / C30];
    const half = [top1, [101, 10], [99, -68], [109, -68], [109, -84]];
    const outline = [apex, ...half, ...half.slice().reverse().map(p => [-p[0], p[1]])];
    const plate = shapeFrom(outline);
    plate.holes.push(circlePath(0, 0, E.mainR + 1.5));
    P.add(extrudeX(plate, 320, E.halfLen, { bevel: 1, seg: 40 }), 'cast');
    P.add(extrudeX(plate, -E.halfLen, -320, { bevel: 1, seg: 40 }), 'cast');
    // rear seal housing
    const seal = circleShape(62); seal.holes.push(circlePath(0, 0, 45));
    P.add(extrudeX(seal, -338, -E.halfLen, { bevel: 1, seg: 40 }), 'machined');

    // the two cylinder banks, each with six real bores
    for (const s of [1, -1]) {
      const sh = rrectShape(-E.halfLen, -E.bankHalfW, E.halfLen, E.bankHalfW, 10);
      for (const c of cylOf(s)) sh.holes.push(circlePath(c.x, 0, bl));
      P.add(extrudeY(sh, E.blockFoot, E.deck, { bevel: 1.2, seg: 44 }), 'cast', Mb[s]);
      // core plugs and stiffening ribs on the outboard face
      for (let i = 0; i < 5; i++) {
        const x = (2 - i) * E.pitch + s * E.stagger / 2;
        P.add(cylZ(15, 4, 28), 'steel', Mb[s].clone().multiply(T(x, 150, E.bankHalfW + 0.5)));
        P.add(box(8, 86, 6), 'cast', Mb[s].clone().multiply(T(x, 150, E.bankHalfW + 1)));
      }
      P.add(box(620, 7, 6), 'cast', Mb[s].clone().multiply(T(0, 192, E.bankHalfW + 1)));
      P.add(box(620, 7, 6), 'cast', Mb[s].clone().multiply(T(0, 110, E.bankHalfW + 1)));
    }
    // crankcase ribs, mounts
    for (const sg of [1, -1]) {
      for (let i = 0; i <= 6; i++) {
        const x = THREE.MathUtils.clamp((3 - i) * E.pitch, -318, 318);
        P.add(box(9, 112, 8), 'cast', T(x, -10, sg * 102));
      }
      P.add(box(640, 8, 7), 'cast', T(0, -34, sg * 101.5));
      for (const x of [205, -205]) {
        P.add(rbox(92, 64, 18, 4), 'cast', T(x, -8, sg * 108));
        P.add(box(80, 52, 3), 'machined', T(x, -8, sg * 118));
        P.bolts([[-28, -14], [28, -14], [-28, 14], [28, 14]].map(([dx, dy]) => ({ p: [x + dx, -8 + dy, sg * 119.5], n: [0, 0, sg] })), 5);
      }
    }
    // oil filter on the left flank
    P.add(rbox(70, 50, 30, 5), 'cast', T(262, -22, -112));
    P.add(cylY(36, 92, 40), 'plastic', mat4({ p: [262, -22, -172], r: [Math.PI / 2, 0, 0] }));
    P.add(cylY(37.5, 10, 12), 'plastic', mat4({ p: [262, -22, -213], r: [Math.PI / 2, 0, 0] }));
    P.add(cylY(38, 6, 40), 'machined', mat4({ p: [262, -22, -127], r: [Math.PI / 2, 0, 0] }));

    const g = P.build();
    reg('block', g); root.add(g); ex(g, [0, 250, 0], 0.2);
    anchor('block', g, [-60, 20, -106], 'Cylinder block', [0, 0, -1]);

    // liners
    const L = new Part('liners', M);
    for (const c of CYL) {
      const sh = circleShape(bl); sh.holes.push(circlePath(0, 0, E.bore / 2 + 0.05));
      L.add(extrudeY(sh, 90, E.deck - 0.2, { bevel: 0, seg: 44 }), 'liner', Mb[c.bank].clone().multiply(T(c.x, 0, 0)));
    }
    const lg = L.build(); reg('liners', lg); g.add(lg);
  }

  // ------------------------------------------------------------------- sump
  {
    const P = new Part('sump', M);
    const chan = [[86, -84], [109, -84], [109, -91], [93, -91], [81, -138], [-81, -138], [-93, -91], [-109, -91], [-109, -84], [-86, -84], [-76, -132], [76, -132]];
    P.add(extrudeX(shapeFrom(chan), -324, 324, { bevel: 0 }), 'castDark');
    const cap = [[109, -84], [109, -91], [93, -91], [81, -138], [-81, -138], [-93, -91], [-109, -91], [-109, -84]];
    P.add(extrudeX(shapeFrom(cap), 324, E.halfLen, { bevel: 1 }), 'castDark');
    P.add(extrudeX(shapeFrom(cap), -E.halfLen, -324, { bevel: 1 }), 'castDark');
    for (let i = -4; i <= 4; i++) P.add(box(600, 10, 3.2), 'castDark', T(0, -142.5, i * 17));
    // scavenge pump stack with braided-line fittings
    P.add(cylX(25, 230, 32), 'machined', T(40, -112, 128));
    for (const x of [-60, 40, 140]) {
      P.add(cylX(27, 6, 32), 'steelDark', T(x - 50, -112, 128));
      P.add(cylY(8, 22, 6), 'anoBlue', mat4({ p: [x, -112, 160], r: [Math.PI / 2, 0, 0] }));
      P.add(cylY(10, 9, 6), 'anoRed', mat4({ p: [x, -112, 150], r: [Math.PI / 2, 0, 0] }));
    }
    P.add(rbox(60, 30, 40, 4), 'castDark', T(40, -108, 100));
    P.add(cylY(9, 6, 6), 'brass', T(-180, -141, 0));
    const b = [];
    for (let x = -300; x <= 300; x += 60) for (const sg of [1, -1]) b.push({ p: [x, -91, sg * 101.5], n: [0, -1, 0] });
    P.bolts(b, 4.2);
    const g = P.build(); reg('sump', g); root.add(g); ex(g, [0, -70, 0], 0.5);
    anchor('sump', g, [-120, -112, 96], 'Dry sump', [0, -0.2, 1], 'l');
  }

  // ------------------------------------------------------------- crankshaft
  const crankG = new THREE.Group(); crankG.name = 'crank'; root.add(crankG);
  {
    const P = new Part('crank', M);
    for (let i = 0; i <= 6; i++) P.add(cylX(E.mainR, 24, 40), 'journal', T((3 - i) * E.pitch, 0, 0));
    const pr = 34, cw = 66, r = E.crankR;
    const web = new THREE.Shape();
    web.moveTo(pr, r);
    web.absarc(0, r, pr, 0, Math.PI, false);
    web.lineTo(-44, -6);
    web.lineTo(cw * Math.cos(205 * DEG), cw * Math.sin(205 * DEG));
    web.absarc(0, 0, cw, 205 * DEG, 335 * DEG, false);
    web.lineTo(44, -6);
    web.closePath();
    for (let k = 0; k < 6; k++) {
      const a = THROW_ANGLE[k] * DEG, x = throwX(k);
      const rot = new THREE.Matrix4().makeRotationX(a);
      P.add(cylX(E.pinR, 44, 36), 'journal', T(x, r * Math.cos(a), r * Math.sin(a)));
      for (const sg of [1, -1]) P.add(extrudeX(web, x + sg * 31 - 9, x + sg * 31 + 9, { bevel: 1.6, seg: 28 }), 'forged', rot);
    }
    P.add(cylX(22, 100, 32), 'forged', T(374, 0, 0));
    P.add(cylX(46, 22, 40), 'forged', T(-335, 0, 0));
    for (const x of [CHAIN_X[1], CHAIN_X[-1]]) {
      P.add(extrudeX(gearShape(19, SPROCKET_R - 2.4, SPROCKET_R + 1.6), x - 4.5, x + 4.5, { bevel: 0.6, seg: 6, crease: 0 }), 'steelDark');
    }
    const g = P.build(); reg('crank', g); crankG.add(g);

    // crank damper, on the nose
    const D = new Part('damper', M);
    const prof = [[14, 378], [30, 378], [30, 386], [66, 386], [70, 384], [80, 384]];
    for (let i = 0; i < 6; i++) { const x = 386 + i * 4.4; prof.push([80, x], [76.6, x + 2.2]); }
    prof.push([80, 412.4], [80, 414], [70, 414], [66, 411], [48, 411], [44, 416], [30, 416], [30, 422], [14, 422]);
    const toX = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);
    D.add(lathe(prof.map(p => [p[0], p[1]]), 64, 30), 'steelDark', toX);
    D.add(cylX(15, 9, 6), 'steel', T(426, 0, 0));
    D.add(cylX(23, 2, 32), 'steel', T(422.5, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      D.add(cylX(5.5, 4, 6), 'bolt', T(413, 38 * Math.cos(a), 38 * Math.sin(a)));
    }
    const dg = D.build(); reg('damper', dg); crankG.add(dg); ex(dg, [330, 0, 0], 0.8);
    anchor('damper', dg, [428, 0, 0], 'Crank damper', [1, 0, 0]);

    // flywheel with ring gear
    const F = new Part('flywheel', M);
    const disc = circleShape(128);
    disc.holes.push(circlePath(0, 0, 21));
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; disc.holes.push(circlePath(86 * Math.cos(a), 86 * Math.sin(a), 15)); }
    F.add(extrudeX(disc, -361, -349, { bevel: 1.2, seg: 48 }), 'machined');
    F.add(extrudeX(gearShape(132, 138.2, 143, 126), -362, -350, { bevel: 0, seg: 6, crease: 0 }), 'steelDark');
    const face = circleShape(120); face.holes.push(circlePath(0, 0, 108));
    F.add(extrudeX(face, -363.5, -361, { bevel: 0, seg: 48 }), 'steelDark');
    const hub = circleShape(52); hub.holes.push(circlePath(0, 0, 21));
    F.add(extrudeX(hub, -366, -361, { bevel: 1, seg: 40 }), 'steel');
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      F.bolts([{ p: [-366, 36 * Math.cos(a), 36 * Math.sin(a)], n: [-1, 0, 0] }], 5.5);
    }
    const fg = F.build(); reg('flywheel', fg); crankG.add(fg); ex(fg, [-170, 0, 0], 0.8);
    anchor('flywheel', fg, [-368, 0, 0], 'Flywheel', [-1, 0, 0], 'l');
  }

  // ------------------------------------------------------- rods and pistons
  const cyl = [];
  {
    const L = E.rod, Rb = 35, Rs = 15.5;
    const a0 = -40 * DEG, a1 = 220 * DEG, b0 = 115 * DEG, b1 = 425 * DEG;
    const outline = [...arcPts(0, 0, Rs, a0, a1, 22), ...arcPts(0, -L, Rb, b0, b1, 40)];
    const big = circleShape(Rb, 0, -L); big.holes.push(circlePath(0, -L, E.pinR + 0.05));
    const small = circleShape(Rs); small.holes.push(circlePath(0, 0, 10.6));
    const railPts = sg => {
      const t = [Rs * Math.cos(a1) * -sg, Rs * Math.sin(a1)], b = [Rb * Math.cos(b0) * -sg, -L + Rb * Math.sin(b0)];
      return [t, b, [b[0] - sg * 3.4, b[1]], [t[0] - sg * 3.4, t[1]]];
    };
    const webPlate = shapeFrom(outline);
    webPlate.holes.push(circlePath(0, -L, E.pinR + 0.05), circlePath(0, 0, 10.6));
    const rodGeo = multi([
      [extrudeX(webPlate, -4.2, 4.2, { bevel: 0, seg: 36 })],
      [extrudeX(big, -10.2, 10.2, { bevel: 1, seg: 40 })],
      [extrudeX(small, -10.4, 10.4, { bevel: 0.8, seg: 28 })],
      [extrudeX(shapeFrom(railPts(1)), -8.2, 8.2, { bevel: 0.6 })],
      [extrudeX(shapeFrom(railPts(-1)), -8.2, 8.2, { bevel: 0.6 })],
      [cylY(4.4, 30, 6), T(0, -L - 3, 30)],
      [cylY(4.4, 30, 6), T(0, -L - 3, -30)],
    ]);
    // collapse groups: first five are the rod, last two the cap bolts
    const gr = rodGeo.groups;
    const split = gr[5].start;
    rodGeo.clearGroups();
    rodGeo.addGroup(0, split, 0);
    rodGeo.addGroup(split, gr[6].start + gr[6].count - split, 1);

    // piston
    const pr = E.bore / 2 - 0.3, gr0 = pr - 1.5;
    const body = [[0, 21], [36, 21], [39.5, -16], [pr, -16], [pr, 6.5], [gr0, 6.5], [gr0, 9.5], [pr, 9.5], [pr, 12.5], [gr0, 12.5],
      [gr0, 14.1], [pr, 14.1], [pr, 18.5], [gr0, 18.5], [gr0, 20.1], [pr, 20.1], [pr, 28.6], [pr - 1.2, 29.9], [0, 29.9]];
    const ringBand = (y0, y1) => lathe([[gr0, y0], [E.bore / 2 - 0.05, y0], [E.bore / 2 - 0.05, y1], [gr0, y1]], 48, 30);
    const crown = new THREE.CircleGeometry(pr - 1.3, 48); crown.rotateX(-Math.PI / 2); crown.translate(0, 30, 0);
    const pistonGeo = multi([
      [lathe(body, 56, 30)],
      [ringBand(6.9, 9.1)], [ringBand(12.7, 13.9)], [ringBand(18.7, 19.9)],
      [crown],
      [cylX(10.5, E.bore - 0.4, 24)],
    ]);
    const pg = pistonGeo.groups;
    const rs = pg[1].start, cs = pg[4].start, ps = pg[5].start, end = pg[5].start + pg[5].count;
    pistonGeo.clearGroups();
    pistonGeo.addGroup(0, rs, 0); pistonGeo.addGroup(rs, cs - rs, 1); pistonGeo.addGroup(cs, ps - cs, 2); pistonGeo.addGroup(ps, end - ps, 3);

    const gasGeo = new THREE.CylinderGeometry(E.bore / 2 - 0.7, E.bore / 2 - 0.7, 1, 36, 1, false);
    gasGeo.translate(0, 0.5, 0);

    for (const c of CYL) {
      const g = kinG[c.bank];
      const rod = new THREE.Mesh(rodGeo, [M.titanium, M.steelDark]);
      rod.position.x = c.x; rod.castShadow = true; rod.receiveShadow = true;
      reg('rods', rod); g.add(rod);
      const piston = new THREE.Mesh(pistonGeo, [M.piston, M.ring, M.pistonCrown, M.steel]);
      piston.position.x = c.x; piston.castShadow = true; piston.receiveShadow = true;
      reg('pistons', piston); g.add(piston);
      const gas = new THREE.Mesh(gasGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      gas.position.x = c.x; gas.raycast = () => {}; gas.renderOrder = 3;
      g.add(gas);
      const mid = bankToWorld(c.bank, c.x, 150, 0);
      cyl.push({ ...c, rod, piston, gas, phase: 0, pos: 0, lift: { intake: 0, exhaust: 0 }, cut: false, mid: new THREE.Vector3(mid[0], mid[1], mid[2]).multiplyScalar(0.01) });
    }
  }

  // ---------------------------------------------------- per-bank top end
  const cams = [];
  const valveSets = [];
  for (const s of [1, -1]) {
    const bg = bankG[s];
    const cs = cylOf(s);
    const xs = cs.map(c => c.x);
    const saddles = [xs[0] + 52, ...xs.slice(0, 5).map(x => x - 52), xs[5] - 52];

    // gasket
    {
      const P = new Part('gasket', M);
      const sh = rrectShape(-E.halfLen, -E.bankHalfW, E.halfLen, E.bankHalfW, 10);
      for (const x of xs) sh.holes.push(circlePath(x, 0, E.bore / 2 + 1.2));
      P.add(extrudeY(sh, E.deck, E.deck + 0.8, { bevel: 0, seg: 40 }), 'gasket');
      const g = P.build(); reg('gasket', g); bg.add(g); ex(g, [0, 60, 0], 0.3);
    }

    // head
    {
      const P = new Part('heads', M);
      const y0 = E.deck + 0.8, y1 = E.deck + 14, y2 = E.deck + 56, y3 = E.headTop;
      const l1 = rrectShape(-E.halfLen, -E.bankHalfW, E.halfLen, E.bankHalfW, 10);
      for (const x of xs) l1.holes.push(circlePath(x, 0, 45));
      P.add(extrudeY(l1, y0, y1, { bevel: 0, seg: 44 }), 'castHead');
      const l2 = rrectShape(-E.halfLen, -E.bankHalfW, E.halfLen, E.bankHalfW, 10);
      for (const x of xs) l2.holes.push(circlePath(x, 0, 7));
      P.add(extrudeY(l2, y1, y2, { bevel: 0, seg: 20 }), 'castHead');
      // cam carrier: spring wells and plug wells (shape v = -z)
      const l3 = rrectShape(-E.halfLen, -80, E.halfLen, 80, 12);
      for (const x of xs) {
        l3.holes.push(circlePath(x, 0, 13));
        l3.holes.push(rrectPath(x - 39.5, 18.5, x + 39.5, 58.5, 19.9));     // intake side (z < 0)
        l3.holes.push(rrectPath(x - 37, -56, x + 37, -19, 18.4));          // exhaust side (z > 0)
      }
      P.add(extrudeY(l3, y2, y3, { bevel: 1.2, seg: 20 }), 'castHead');
      for (const x of xs) {
        P.add(cylZ(29, 14, 32), 'castHead', T(x, E.deck + 30, -E.bankHalfW - 4));
        P.add(cylZ(26, 12, 32), 'castHead', T(x, E.deck + 34, E.bankHalfW + 4));
      }
      for (const x of saddles) for (const z of [E.camZ, -E.camZ]) {
        P.add(box(20, E.camY - y3 - 1, 38), 'castHead', T(x, (E.camY - 1 + y3) / 2, z));
      }
      const g = P.build(); reg('heads', g); bg.add(g); ex(g, [0, 150, 0], 0.4);
      if (s === 1) anchor('heads', g, [-190, E.deck + 70, 80], 'Cylinder head', [0, 0, 1], 'l');
    }

    // camshafts
    {
      const P = new Part('cams', M);
      const b = [];
      for (const x of saddles) for (const z of [E.camZ, -E.camZ]) {
        P.add(rbox(20, 15, 38, 3), 'machined', T(x, E.camY + 7.5, z));
        b.push({ p: [x, E.camY + 15, z - 14] }, { p: [x, E.camY + 15, z + 14] });
      }
      P.bolts(b, 3.4);
      const g = P.build(); reg('cams', g); bg.add(g); ex(g, [0, 330, 0], 0.7);
      g.userData.ends = [-3.3, 3.3].map(x => { const w = bankToWorld(s, 0, E.camY, 0); return new THREE.Vector3(x, w[1] * 0.01, w[2] * 0.01); });
      for (const kind of ['intake', 'exhaust']) {
        const z = kind === 'intake' ? -E.camZ : E.camZ;
        const tilt = E.valveAngle * DEG;
        const delta = kind === 'intake' ? Math.atan2(Math.sin(tilt), -Math.cos(tilt)) : Math.atan2(-Math.sin(tilt), -Math.cos(tilt));
        const v = VALVE[kind];
        const centre = (v.open + v.close) / 2;
        const C = new Part('cams', M);
        const sx = CHAIN_X[s];
        C.add(cylX(9.5, sx + 6 + 326, 20), 'cam', T((sx + 6 - 326) / 2, 0, 0));
        for (const x of saddles) C.add(cylX(13, 20, 28), 'journal', T(x, 0, 0));
        // lobe profile, peak along +v
        const w = 66 * DEG, pts = [];
        for (let i = 0; i < 72; i++) {
          const a = -Math.PI + i / 72 * Math.PI * 2;
          const c2 = Math.abs(a) < w ? Math.cos(Math.PI * a / (2 * w)) : 0;
          const rr = E.camBaseR + v.lift * c2 * c2;
          pts.push([rr * Math.sin(a), rr * Math.cos(a)]);
        }
        const lobe = shapeFrom(pts);
        for (const c of cs) {
          const ang = delta - s * (c.fire + centre) / 2 * DEG;
          const rot = new THREE.Matrix4().makeRotationX(ang);
          for (const dx of [E.valveX, -E.valveX]) {
            C.add(extrudeX(lobe, c.x + dx - 7, c.x + dx + 7, { bevel: 0.8, seg: 4, crease: 50 }), 'cam', rot);
          }
        }
        const sp = gearShape(38, SPROCKET_R * 2 - 2.4, SPROCKET_R * 2 + 1.6, 10);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; sp.holes.push(circlePath(23 * Math.cos(a), 23 * Math.sin(a), 6.5)); }
        C.add(extrudeX(sp, sx - 4.5, sx + 4.5, { bevel: 0.6, seg: 10, crease: 0 }), 'steelDark');
        C.add(cylX(14, 12, 6), 'steel', T(sx + 4, 0, 0));
        const cg = C.build();
        cg.position.set(0, E.camY, z);
        reg('cams', cg); g.add(cg);
        cams.push({ group: cg, s });
      }
    }

    // valves, springs, buckets (instanced, animated every frame)
    {
      const g = new THREE.Group(); g.name = 'valves'; reg('valves', g); bg.add(g); ex(g, [0, 235, 0], 0.55);
      const vProfile = R => [[0, 0], [R, 0], [R, 1.4], [R - 1.6, 3], [9, 8.5], [5, 14], [3.1, 22], [3.1, E.valveLen - 5], [2.5, E.valveLen - 4.4],
        [2.5, E.valveLen - 3], [3.1, E.valveLen - 2.4], [3.1, E.valveLen], [0, E.valveLen]];
      const helix = new THREE.Curve();
      helix.getPoint = (t, target = new THREE.Vector3()) => {
        const a = t * Math.PI * 2 * 5.5;
        return target.set(11.6 * Math.cos(a), t * SPRING_LEN, 11.6 * Math.sin(a));
      };
      const springGeo = new THREE.TubeGeometry(helix, 110, 1.75, 6, false);
      const bucketGeo = lathe([[0, 0], [14.6, 0], [15.5, 0.9], [15.5, 19.5], [0, 19.5]], 28, 40);
      const mk = (geo, mat, n) => {
        const im = new THREE.InstancedMesh(geo, mat, n);
        im.castShadow = true; im.receiveShadow = true; im.userData.part = 'valves';
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        g.add(im); return im;
      };
      const set = {
        s,
        intake: mk(lathe(vProfile(E.intakeValveR), 28, 30), M.valveIn, 12),
        exhaust: mk(lathe(vProfile(E.exhaustValveR), 28, 30), M.valveEx, 12),
        springs: mk(springGeo, M.spring, 24),
        buckets: mk(bucketGeo, M.bucket, 24),
        items: [],
      };
      const tilt = E.valveAngle * DEG;
      for (const c of cs) for (const kind of ['intake', 'exhaust']) for (const dx of [E.valveX, -E.valveX]) {
        const sg = kind === 'intake' ? -1 : 1;
        const tau = sg * tilt;
        const w = bankToWorld(s, c.x + dx, E.valveSeatY + 40, sg * E.valveZ);
        set.items.push({
          cyl: c.n, kind, cut: false, world: new THREE.Vector3(w[0], w[1], w[2]).multiplyScalar(0.01),
          seat: new THREE.Vector3(c.x + dx, E.valveSeatY, sg * E.valveZ),
          axis: new THREE.Vector3(0, Math.cos(tau), Math.sin(tau)),
          quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tau),
        });
      }
      valveSets.push(set);
    }

    // cam cover
    {
      const P = new Part('covers', M);
      const R0 = 30.5, R1 = 27.5, y0 = E.headTop, cy = E.camY, cz = E.camZ;
      const band = [
        [-cz - R0, y0], ...arcPts(-cz, cy, R0, Math.PI, 0, 22), ...arcPts(cz, cy, R0, Math.PI, 0, 22), [cz + R0, y0],
        [cz + R1, y0], ...arcPts(cz, cy, R1, 0, Math.PI, 22), [cz - R1, cy - 3], [-cz + R1, cy - 3],
        ...arcPts(-cz, cy, R1, 0, Math.PI, 22), [-cz - R1, y0],
      ];
      P.add(extrudeX(shapeFrom(band), -E.halfLen + 3, E.halfLen - 3, { bevel: 0, crease: 30 }), 'cover');
      const endCap = [[-cz - R0, y0], ...arcPts(-cz, cy, R0, Math.PI, 0, 22), ...arcPts(cz, cy, R0, Math.PI, 0, 22), [cz + R0, y0]];
      P.add(extrudeX(shapeFrom(endCap), E.halfLen - 3.2, E.halfLen, { bevel: 1.2, crease: 30 }), 'cover');
      P.add(extrudeX(shapeFrom(endCap), -E.halfLen, -E.halfLen + 3.2, { bevel: 1.2, crease: 30 }), 'cover');
      // polished ribs along each hump
      for (const z of [cz, -cz]) for (const a of [62, 76, 90, 104, 118]) {
        const m = mat4({ p: [0, cy + (R0 + 0.9) * Math.sin(a * DEG), z + (R0 + 0.9) * Math.cos(a * DEG)], r: [-(a - 90) * DEG, 0, 0] });
        P.add(rbox(596, 2.6, 3.4, 1, 2), 'coverRib', m);
      }
      // perimeter bolt bosses
      const b = [];
      for (let i = 0; i < 9; i++) {
        const x = -292 + i * 73;
        for (const sg of [1, -1]) {
          P.add(cylY(6.8, 12, 16), 'cover', T(x, y0 + 6, sg * (cz + R0 + 0.4)));
          b.push({ p: [x, y0 + 12, sg * (cz + R0 + 0.4)] });
        }
      }
      P.bolts(b, 3.8);
      if (s === -1) {
        P.add(cylY(19, 9, 20), 'machined', T(214, cy + R0 + 3, -cz));
        P.add(cylY(15, 5, 6), 'plastic', T(214, cy + R0 + 9.5, -cz));
      }
      const g = P.build(); reg('covers', g); bg.add(g); ex(g, [0, 430, 0], 0.85);
      if (s === 1) anchor('covers', g, [60, cy + R0 + 2, cz], 'Cam cover');
    }

    // coil-on-plug units
    {
      const P = new Part('coils', M);
      for (const x of xs) {
        P.add(cylY(3.2, 6, 12), 'steel', T(x, E.deck + 11, 0));
        P.add(cylY(7, 8, 6), 'steel', T(x, E.deck + 18, 0));
        P.add(cylY(5.6, 50, 16), 'ceramic', T(x, E.deck + 47, 0));
        P.add(cylY(10, E.camY + 4 - (E.deck + 70), 20), 'plastic', T(x, (E.camY + 4 + E.deck + 70) / 2, 0));
        P.add(rbox(30, 15, 22, 3), 'plastic', T(x, E.camY + 11, 0));
        P.add(rbox(12, 9, 14, 2), 'anoRed', T(x + 19, E.camY + 10, 0));
        P.bolts([{ p: [x - 22, E.camY + 0.5, 0] }], 3.2);
      }
      // harness rail
      P.add(cylX(4, 600, 10), 'rubber', T(26, E.camY + 10, 9));
      const g = P.build(); reg('coils', g); bg.add(g); ex(g, [0, 520, 0], 1);
      if (s === -1) anchor('coils', g, [-150, E.camY + 20, 0], 'Coil-on-plug');
    }
  }

  // ----------------------------------------------------------------- intake
  let butterflies;
  const intakeG = new THREE.Group(); intakeG.name = 'intake'; root.add(intakeG); ex(intakeG, [0, 650, 0], 0.9);
  {
    const P = new Part('intake', M);
    const Fp = new Part('fuel', M);
    const trumpet = [[25.5, 0], [25.5, 12], [26.2, 30], [28.5, 48], [32.5, 61], [37.5, 68.5], [40.5, 69.6], [42.2, 68.2], [42.4, 70.4],
      [41, 72], [38.6, 71.6], [36, 69.6], [31.5, 62.4], [27.4, 49], [25, 30.5], [24, 12], [24, 0]];
    const tbY = 338;
    const bfPos = [];
    for (const c of CYL) {
      const s = c.bank;
      const p0 = bankToWorld(s, c.x, E.deck + 30, -E.bankHalfW - 10);
      const d = [0, S30, -s * C30];
      const end = [c.x, tbY, s * 44];
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(...p0),
        new THREE.Vector3(p0[0], p0[1] + 38 * d[1], p0[2] + 38 * d[2]),
        new THREE.Vector3(end[0], end[1] - 46, end[2]),
        new THREE.Vector3(...end));
      P.add(new THREE.TubeGeometry(curve, 22, 23.5, 22, false), 'throttle');
      P.add(cylY(27.5, 34, 32), 'throttle', T(c.x, tbY + 17, s * 44));
      P.add(cylY(29.5, 4, 32), 'machined', T(c.x, tbY + 1, s * 44));
      P.add(cylY(29.5, 4, 32), 'machined', T(c.x, tbY + 34, s * 44));
      P.add(lathe(trumpet, 48, 34), 'stack', T(c.x, tbY + 36, s * 44));
      bfPos.push([c.x, tbY + 17, s * 44]);
      // injector, aimed at the back of the valves
      const inj0 = [c.x, 326, s * 82], inj1 = [c.x, 296, s * 60];
      const dir = [0, inj1[1] - inj0[1], inj1[2] - inj0[2]];
      const mid = [c.x, (inj0[1] + inj1[1]) / 2, (inj0[2] + inj1[2]) / 2];
      Fp.add(cylY(5.6, 30, 12), 'plastic', alignY(dir, mid));
      Fp.add(cylY(7.4, 7, 12), 'brass', alignY(dir, [c.x, inj0[1] - 6, inj0[2] - s * 4.4]));
    }
    for (const s of [1, -1]) {
      P.add(cylX(3.2, 590, 10), 'steel', T(0, tbY + 17, s * 44));
      P.add(rbox(18, 10, 40, 2), 'steelDark', T(300 * s, tbY + 17, s * 44));
      Fp.add(rbox(600, 16, 14, 4), 'rail', T(0, 328, s * 83));
      Fp.add(cylX(7, 16, 6), 'anoBlue', T(308, 328, s * 83));
      Fp.add(cylX(5.4, 12, 12), 'anoRed', T(320, 328, s * 83));
      Fp.add(cylX(7, 10, 6), 'anoBlue', T(-305, 328, s * 83));
    }
    // throttle link across the banks
    P.add(cylZ(3, 88, 10), 'steel', T(318, tbY + 26, 0));
    const g = P.build(); reg('intake', g); intakeG.add(g);
    const fg = Fp.build(); reg('fuel', fg); intakeG.add(fg);
    anchor('intake', g, [-52, tbY + 110, -44], 'Intake trumpets', null);

    const bfGeo = cylY(23.3, 1.6, 32);
    butterflies = new THREE.InstancedMesh(bfGeo, M.brass, 12);
    butterflies.userData.part = 'intake'; butterflies.userData.pos = bfPos;
    butterflies.castShadow = true;
    g.add(butterflies);

    // optional carbon airbox
    const A = new Part('airbox', M);
    A.add(rbox(700, 104, 206, 22, 6), 'carbon', T(0, tbY + 76, 0));
    A.add(rbox(716, 8, 222, 3, 2), 'machined', T(0, tbY + 26, 0));
    for (const sg of [1, -1]) {
      A.add(cylX(40, 70, 40), 'carbon', T(372, tbY + 76, sg * 50));
      A.add(cylX(43, 10, 40), 'machined', T(408, tbY + 76, sg * 50));
    }
    const plane = new THREE.PlaneGeometry(230, 58); plane.rotateX(-Math.PI / 2);
    A.add(plane, 'badge', T(0, tbY + 128.4, 0));
    const ag = A.build(); reg('airbox', ag); intakeG.add(ag); ex(ag, [0, 190, 0], 1);
    ag.visible = false;
  }

  // ---------------------------------------------------------------- exhaust
  for (const s of [1, -1]) {
    const eg = new THREE.Group(); eg.name = 'exhaust' + s; eg.scale.z = s; root.add(eg);
    ex(eg, [0, 265, 274 * s], 0.6);
    const P = new Part('exhaust', M);
    const xs = cylOf(s).map(c => c.x);
    const m1 = bankMatrix(1);
    const cdir = new THREE.Vector3(-0.34, -1, 0.04).normalize();
    const e1 = new THREE.Vector3(0, 0, 1).cross(cdir).normalize(), e2 = cdir.clone().cross(e1).normalize();
    const out = new THREE.Vector3(0, -S30, C30);
    for (let grp = 0; grp < 2; grp++) {
      const ix = [0, 1, 2].map(i => i + grp * 3);
      const xm = (xs[ix[0]] + xs[ix[1]] + xs[ix[2]]) / 3 - 58;
      const merge = new THREE.Vector3(xm, 34, 268);
      ix.forEach((i, jx) => {
        const p0 = new THREE.Vector3(...bankToWorld(1, xs[i], E.deck + 34, E.bankHalfW + 6));
        const a = jx / 3 * Math.PI * 2 + 0.5;
        const b3 = merge.clone().addScaledVector(e1, 19 * Math.cos(a)).addScaledVector(e2, 19 * Math.sin(a));
        const curve = new THREE.CubicBezierCurve3(p0, p0.clone().addScaledVector(out, 104), b3.clone().addScaledVector(cdir, -96), b3);
        P.add(new THREE.TubeGeometry(curve, 44, 21, 18, false), 'exhaust');
        P.add(rbox(66, 56, 9, 3), 'exhaustFlange', m1.clone().multiply(T(xs[i], E.deck + 34, E.bankHalfW + 14.5)));
        P.bolts([-1, 1].map(k => ({ p: [xs[i] + k * 27, E.deck + 34 + k * 20, E.bankHalfW + 19], n: [0, 0, 1] })), 4.4, 'brass', m1);
      });
      // merge collector and outlet
      const along = (g, t0, t1) => {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) { const v = uv.getY(i); uv.setXY(i, t0 + (t1 - t0) * v, uv.getX(i)); }
        return g;
      };
      const q = pos => alignY(cdir.toArray(), merge.clone().addScaledVector(cdir, pos).toArray());
      P.add(along(new THREE.CylinderGeometry(30, 40.5, 78, 32, 1, true), 0.62, 0.8), 'exhaust', q(22));
      P.add(along(new THREE.CylinderGeometry(30, 30, 96, 32, 1, true), 0.8, 1), 'exhaust', q(109));
      P.add(cylY(35, 9, 32), 'exhaustFlange', q(155));
      P.add(cylY(8, 20, 6), 'steel', alignY([0.2, 0.2, 1], merge.clone().addScaledVector(cdir, 84).add(new THREE.Vector3(0, 0, 30)).toArray()));
    }
    const g = P.build(); reg('exhaust', g); eg.add(g);
    if (s === 1) anchor('exhaust', g, [40, 60, 290], 'Exhaust manifold', [0, 0, 1]);
  }

  // ----------------------------------------------------------------- timing
  const chainTex = M.chain.map;
  let chainTexB;
  {
    const tg = new THREE.Group(); tg.name = 'timing'; root.add(tg); ex(tg, [120, 250, 0], 0.5);
    reg('timing', tg);
    const circles = [
      { c: [0, 0], r: SPROCKET_R + 1 },
      { c: [E.camY * S30 + E.camZ * C30, E.camY * C30 - E.camZ * S30], r: SPROCKET_R * 2 + 1 },
      { c: [E.camY * S30 - E.camZ * C30, E.camY * C30 + E.camZ * S30], r: SPROCKET_R * 2 + 1 },
    ];
    const { pts, len } = beltLoop(circles, 3);
    const links = Math.round(len / 19.05);
    chainTex.repeat.set(links, 1);
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(0, p[1], p[0])), true, 'centripetal');
    const tube = new THREE.TubeGeometry(curve, pts.length * 2, 4.4, 6, true);
    tube.scale(1.9, 1, 1);
    const chainMats = { 1: M.chain, [-1]: M.chain.clone() };
    tg.userData.x = 3.5;
    chainMats[-1].map = chainTex.clone();
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(tube, chainMats[s]);
      m.position.x = CHAIN_X[s]; m.scale.z = s;
      m.castShadow = true; m.userData.part = 'timing';
      tg.add(m);
    }
    chainTexB = chainMats[-1].map;

    // front cover
    const C = new Part('timingcover', M);
    const top1 = bankPt(E.blockFoot + 1, 60);
    const half = [top1, [101, 10], [99, -68], [109, -68], [109, -84]];
    const outline = [[0, (E.blockFoot + 1) / C30], ...half, ...half.slice().reverse().map(p => [-p[0], p[1]])];
    C.add(extrudeX(shapeFrom(outline), E.halfLen + 0.5, 372, { bevel: 4 }), 'cast');
    C.add(cylX(47, 8, 40), 'machined', T(375, 0, 0));
    const b = [];
    for (const s of [1, -1]) {
      const mb = Mb[s];
      C.add(rbox(41.5, 266, 176, 9, 4), 'cast', mb.clone().multiply(T(351.25, 233, 0)));
      for (const z of [34, -34]) C.add(rbox(5, 150, 7, 2, 2), 'cast', mb.clone().multiply(T(373, 205, z)));
      C.add(rbox(5, 7, 120, 2, 2), 'cast', mb.clone().multiply(T(373, 128, 0)));
      for (const z of [E.camZ, -E.camZ]) {
        C.add(cylX(34, 8, 36), 'machined', mb.clone().multiply(T(374.5, E.camY, z)));
        C.add(cylX(12, 5, 6), 'steelDark', mb.clone().multiply(T(380, E.camY, z)));
      }
      for (const [y, z] of [[112, 80], [200, 82], [290, 82], [358, 60], [358, -60], [290, -82], [200, -82]]) {
        const w = new THREE.Vector3(372, y, z).applyMatrix4(mb);
        b.push({ p: w.toArray(), n: [1, 0, 0] });
      }
      for (const y of [-60, -10, 40]) b.push({ p: [372, y, s * 98], n: [1, 0, 0] });
    }
    for (const z of [-70, 0, 70]) b.push({ p: [372, -78, z], n: [1, 0, 0] });
    C.bolts(b, 4.4);
    const cg = C.build(); reg('timingcover', cg); root.add(cg); ex(cg, [230, 250, 0], 0.75);
    anchor('timingcover', cg, [374, 96, 0], 'Timing cover', [1, 0, 0]);
  }

  // ------------------------------------------------------- accessory drive
  const pulleys = [];
  {
    const ag = new THREE.Group(); ag.name = 'accessory'; root.add(ag); ex(ag, [290, 250, 0], 0.7);
    reg('accessory', ag);
    const ALT = [176, 40], PUMP = [0, 170], BX = 399;
    const P = new Part('accessory', M);
    // water pump on the cover apex, outlet neck pointing up
    P.add(cylX(47, 18, 36), 'cast', T(381, PUMP[1], 0));
    P.add(cylY(17, 46, 24), 'cast', T(381, PUMP[1] + 58, 0));
    P.add(cylY(20, 8, 24), 'machined', T(381, PUMP[1] + 80, 0));
    P.add(cylY(18.5, 36, 20), 'rubber', T(381, PUMP[1] + 100, 0));
    P.bolts([0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2 + 0.3; return { p: [390, PUMP[1] + 39 * Math.cos(a), 39 * Math.sin(a)], n: [1, 0, 0] }; }), 3.6);
    // alternator, low on the right flank
    P.add(cylX(47, 74, 40), 'cast', T(348, ALT[1], ALT[0]));
    for (let i = 0; i < 7; i++) P.add(cylX(49.5, 3, 40), 'machined', T(318 + i * 8, ALT[1], ALT[0]));
    P.add(cylX(40, 10, 32), 'plastic', T(307, ALT[1], ALT[0]));
    P.add(cylX(14, 12, 20), 'steel', T(389, ALT[1], ALT[0]));
    P.add(rbox(62, 26, 70, 5), 'cast', T(338, ALT[1] - 6, 122));
    P.add(rbox(14, 96, 12, 3), 'steelDark', mat4({ p: [380, ALT[1] + 62, ALT[0] - 34], r: [0.55, 0, 0] }));
    const g = P.build(); ag.add(g);
    // grooved pulleys that turn with the belt
    const pulley = (r, c, ratio) => {
      const prof = [[10, -12], [r - 4, -12], [r + 2, -13], [r + 2, -11]];
      for (let i = 0; i < 5; i++) prof.push([r, -10 + i * 4.2], [r - 2.6, -7.9 + i * 4.2]);
      prof.push([r, 11], [r + 2, 11], [r + 2, 13], [r - 4, 12], [10, 12]);
      const face = circleShape(r - 6);
      face.holes.push(circlePath(0, 0, 7));
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; face.holes.push(circlePath((r - 6) * 0.58 * Math.cos(a), (r - 6) * 0.58 * Math.sin(a), (r - 6) * 0.2)); }
      const Q = new Part('accessory', M);
      Q.add(lathe(prof, 40, 30), 'steelDark', new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
      Q.add(extrudeX(face, 8, 13, { bevel: 0.8, seg: 20 }), 'machined');
      Q.add(cylX(9, 8, 6), 'steel', T(15, 0, 0));
      const pg = Q.build();
      pg.position.set(BX, c[1], c[0]);
      ag.add(pg); pulleys.push({ group: pg, ratio });
    };
    pulley(30, ALT, 80 / 30);
    pulley(40, PUMP, 80 / 40);
    const { pts } = beltLoop([{ c: [0, 0], r: 82.2 }, { c: ALT, r: 32.2 }, { c: PUMP, r: 42.2 }], 4);
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(0, p[1], p[0])), true, 'centripetal');
    const beltGeo = new THREE.TubeGeometry(curve, pts.length * 2, 2.1, 6, true);
    beltGeo.scale(5.4, 1, 1);
    const belt = new THREE.Mesh(beltGeo, M.rubber);
    belt.position.x = BX; belt.castShadow = true; belt.userData.part = 'accessory'; belt.userData.matKey = 'rubber';
    ag.add(belt);
  }

  // ------------------------------------------------------------------ stand
  {
    const P = new Part('stand', M);
    for (const x of [205, -205]) {
      for (const sg of [1, -1]) {
        P.add(cylY(13, 252, 20), 'stand', T(x, -166, sg * 138));
        P.add(rbox(84, 10, 60, 3), 'stand', mat4({ p: [x, -36, sg * 126] }));
        P.add(rbox(84, 56, 8, 3), 'stand', T(x, -10, sg * 124));
        P.add(cylY(22, 8, 24), 'standDark', T(x, -294, sg * 138));
      }
      P.add(rbox(34, 22, 300, 5), 'stand', T(x, -272, 0));
    }
    for (const sg of [1, -1]) P.add(rbox(440, 20, 30, 5), 'stand', T(0, -250, sg * 138));
    const g = P.build(); reg('stand', g); root.add(g);
  }

  // ------------------------------------------------------------- animation
  const zero = new THREE.Vector3(0, 0, 0);
  let gasOn = false;
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3(), q0 = new THREE.Quaternion();
  const col = new THREE.Color();

  function gasColor(phase, target) {
    // power → exhaust → intake → compression, as additive light
    if (phase < 180) {
      const t = phase / 180;
      const flash = Math.exp(-phase / 14);
      target.setRGB(2.6 * flash + 1.5 * (1 - t) * (1 - t), 2.0 * flash + 0.5 * (1 - t) ** 3, 1.2 * flash + 0.06 * (1 - t));
    } else if (phase < 360) {
      const t = (phase - 180) / 180;
      target.setRGB(0.22 * (1 - t) + 0.04, 0.06 * (1 - t) + 0.035, 0.03 + 0.02 * t);
    } else if (phase < 540) {
      const t = (phase - 360) / 180;
      const k = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.9 + 0.1;
      target.setRGB(0.03 * k, 0.12 * k, 0.3 * k);
    } else {
      const t = (phase - 540) / 180;
      const k = t * t;
      target.setRGB(0.04 + 0.5 * k, 0.1 + 0.22 * k, 0.26 + 0.75 * k);
      if (phase > 705) target.addScalar((phase - 705) / 15 * 1.6);
    }
    return target;
  }

  function update(theta) {
    crankG.rotation.x = theta;
    const thDeg = theta / DEG;
    for (const c of cyl) {
      const psi = (THROW_ANGLE[c.k] + thDeg - c.bank * E.bankHalf) * DEG;
      const h = pinHeight(psi);
      c.piston.position.y = h;
      c.rod.position.y = h;
      c.rod.rotation.x = Math.asin(-E.crankR * Math.sin(psi) / E.rod);
      c.phase = mod(thDeg - c.fire, 720);
      c.pos = (h - (E.rod - E.crankR)) / E.stroke;
      c.lift.intake = valveLift(c.phase, 'intake');
      c.lift.exhaust = valveLift(c.phase, 'exhaust');
      c.gas.position.y = h + E.compHeight;
      c.gas.scale.y = Math.max(0.5, E.deck + CHAMBER - h - E.compHeight);
      gasColor(c.phase, c.gas.material.color);
    }
    for (const cam of cams) cam.group.rotation.x = cam.s * theta / 2;
    for (const p of pulleys) p.group.rotation.x = theta * p.ratio;
    for (const set of valveSets) {
      const idx = { intake: 0, exhaust: 0 };
      set.items.forEach((it, i) => {
        const lift = cyl[it.cyl - 1].lift[it.kind];
        const vis = it.cut ? zero : one;
        v3.copy(it.seat).addScaledVector(it.axis, -lift);
        m4.compose(v3, it.quat, vis);
        set[it.kind].setMatrixAt(idx[it.kind]++, m4);
        v3.copy(it.seat).addScaledVector(it.axis, SPRING_Y0);
        sc.set(1, (SPRING_LEN - lift) / SPRING_LEN, 1);
        m4.compose(v3, it.quat, it.cut ? zero : sc);
        set.springs.setMatrixAt(i, m4);
        v3.copy(it.seat).addScaledVector(it.axis, BUCKET_Y - lift);
        m4.compose(v3, it.quat, vis);
        set.buckets.setMatrixAt(i, m4);
      });
      set.intake.instanceMatrix.needsUpdate = true;
      set.exhaust.instanceMatrix.needsUpdate = true;
      set.springs.instanceMatrix.needsUpdate = true;
      set.buckets.instanceMatrix.needsUpdate = true;
    }
    const co = mod(theta * SPROCKET_R / 19.05, 1);
    chainTex.offset.x = co; chainTexB.offset.x = 1 - co;
  }

  function setThrottle(t) {
    const a = (6 + 80 * t) * DEG;
    q0.setFromAxisAngle(v3.set(1, 0, 0), a);
    butterflies.userData.pos.forEach((p, i) => {
      m4.compose(v3.set(p[0], p[1], p[2]), q0, one);
      butterflies.setMatrixAt(i, m4);
    });
    butterflies.instanceMatrix.needsUpdate = true;
  }

  // Section view: drop the per-cylinder moving parts that sit well in front of
  // the cutting plane, so they don't float in the removed half.
  function setCut(plane) {
    for (const c of cyl) {
      c.cut = !!plane && plane.distanceToPoint(c.mid) < -0.5;
      c.piston.userData.cutHidden = c.rod.userData.cutHidden = c.cut;
      c.gas.visible = gasOn && !c.cut;
    }
    for (const set of valveSets) for (const it of set.items) it.cut = !!plane && plane.distanceToPoint(it.world) < -0.5;
    for (const o of parts.cams) if (o.userData.ends) o.userData.cutHidden = !!plane && Math.max(...o.userData.ends.map(e => plane.distanceToPoint(e))) < -0.5;
    for (const o of parts.valves) o.userData.cutHidden = false;
    for (const o of parts.timing) o.userData.cutHidden = !!plane && plane.normal.x * 3.5 + plane.constant < -0.3;
  }
  function setGas(on) { gasOn = on; for (const c of cyl) c.gas.visible = on && !c.cut; }

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function setExplode(t) {
    for (const e of explodes) {
      const delay = 0.38 * (1 - e.order);
      const k = ease(THREE.MathUtils.clamp((t - delay) / 0.62, 0, 1));
      e.obj.position.copy(e.base).addScaledVector(e.vec, k);
    }
    for (const o of parts.stand) o.userData.fade = t > 0.02;
  }

  // bounding spheres for the instanced valves (static enough)
  update(0); setThrottle(0); setExplode(0);
  for (const set of valveSets) for (const k of ['intake', 'exhaust', 'springs', 'buckets']) set[k].computeBoundingSphere();
  butterflies.computeBoundingSphere();

  setGas(false);
  return { root, parts, anchors, cyl, update, setThrottle, setExplode, setCut, setGas, crankG };
}
