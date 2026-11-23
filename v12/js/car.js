// Tipo 600 GT: the car the V12 lives in. Bodywork comes from car-body.js; this
// file adds everything else (wheels, brakes, suspension, carbon tub, transaxle,
// exhaust, cooling, cabin) and assembles it. Millimetres throughout; the root
// group is scaled so the car fits the same turntable as the bare engine.
import * as THREE from '../vendor/three.bundle.min.js';
import { RoundedBoxGeometry, toCreasedNormals } from '../vendor/three.bundle.min.js';
import { CYL } from './config.js';
import { DEG, Part, mat4, alignY, shapeFrom, circleShape, circlePath, extrudeX, extrudeY, cylX, cylY, cylZ, box, lathe } from './geo.js';
import { CAR, buildBody, bowAt, bodyCurves } from './car-body.js';

export const CAR_SCALE = 0.0025;
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const rb = (x, y, z, r = 12, seg = 2) => new RoundedBoxGeometry(x, y, z, seg, Math.min(r, x / 2 - 0.1, y / 2 - 0.1, z / 2 - 0.1));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TO_Z = new THREE.Matrix4().makeRotationX(Math.PI / 2);          // lathe axis (Y) to wheel axis (Z)

function rod(P, a, b, r, mat, seg = 12) {
  const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
  P.add(cylY(r, d.length(), seg), mat, alignY(d.toArray(), mid.toArray()));
}
function pipe(P, pts, r, mat, seg = 14) {
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  P.add(new THREE.TubeGeometry(c, Math.max(8, pts.length * 10), r, seg, false), mat);
}
function coil(radius, wire, turns, len) {
  const h = new THREE.Curve();
  h.getPoint = (t, v = new THREE.Vector3()) => { const a = t * Math.PI * 2 * turns; return v.set(radius * Math.cos(a), (t - 0.5) * len, radius * Math.sin(a)); };
  return new THREE.TubeGeometry(h, turns * 16, wire, 6, false);
}
function extrudeZ(shape, z0, z1, bevel = 0, seg = 16) {
  const d = z1 - z0, b = Math.min(bevel, d / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(shape, b > 0
    ? { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: seg }
    : { depth: d, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, z0 + (b > 0 ? b : 0));
  return toCreasedNormals(g, 36 * DEG);
}

// ------------------------------------------------------------------ wheel
function buildWheel(M, a, front, calAngle) {
  const R = a.tyreR, W = a.tyreW, rr = a.rimR, h = R - rr, hw = W / 2;
  const spin = new THREE.Group();
  const P = new Part('wheels', M), B = new Part('brakes', M);

  // tyre carcass with four circumferential grooves
  const prof = [[rr, -hw + 12], [rr + 9, -hw + 3], [rr + h * 0.46, -hw - 5], [R - 24, -hw + 5], [R - 7, -hw + 24], [R, -hw + 42]];
  for (const g of [-0.3, -0.1, 0.1, 0.3]) { const c = g * W; prof.push([R, c - 8], [R - 8, c - 5.5], [R - 8, c + 5.5], [R, c + 8]); }
  prof.push([R, hw - 42], [R - 7, hw - 24], [R - 24, hw - 5], [rr + h * 0.46, hw + 5], [rr + 9, hw - 3], [rr, hw - 12]);
  P.add(lathe(prof, 56, 40), 'tyre', TO_Z);
  const ringGeo = new THREE.RingGeometry(rr + 26, rr + 74, 64);
  P.add(ringGeo, 'tyreText', T(0, 0, hw + 6.4));

  // rim barrel (seen from inside), outer lip, spokes dished towards the hub
  const lip = rr + 12;
  P.add(lathe([[lip, hw - 5], [rr + 3, hw - 11], [rr - 7, hw - 30], [rr - 22, hw - 72], [rr - 22, -hw + 52], [rr - 5, -hw + 22], [lip, -hw + 5]], 56, 40), 'rim', TO_Z);
  P.add(lathe([[lip, -hw + 5], [lip + 3, -hw + 9], [lip + 3, hw - 9], [lip, hw - 5]], 56, 40), 'rim', TO_Z);
  const n = 10, hubR = 66, tipR = rr - 5, pts = [];
  for (let k = 0; k < n; k++) {
    const c = k / n * Math.PI * 2;
    const edge = (sgn, dir) => {
      const out = [];
      for (let m = 0; m <= 4; m++) {
        const t = (dir > 0 ? m : 4 - m) / 4, r = hubR + (tipR - hubR) * t;
        const half = (9.5 * (1 - t) ** 1.6 + 2.5 * t + 1.2 * Math.sin(Math.PI * t)) * DEG;
        out.push([r * Math.cos(c + sgn * half), r * Math.sin(c + sgn * half)]);
      }
      return out;
    };
    pts.push(...edge(-1, 1), ...edge(1, -1));
  }
  const spokes = extrudeZ(shapeFrom(pts), 0, 24, 3.5);
  const sp = spokes.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const r = Math.hypot(sp.getX(i), sp.getY(i)), t = THREE.MathUtils.clamp((r - hubR) / (tipR - hubR), 0, 1);
    sp.setZ(i, sp.getZ(i) * (1 - 0.3 * t) - 52 * Math.pow(1 - t, 1.5));
  }
  spokes.computeVertexNormals();
  P.add(toCreasedNormals(spokes, 42 * DEG), 'rim', T(0, 0, hw - 40));
  P.add(cylZ(hubR + 6, 34, 40), 'rim', T(0, 0, hw - 84));
  P.add(cylZ(31, 20, 6), 'steel', T(0, 0, hw - 62));
  P.add(cylZ(20, 8, 24), 'gloss', T(0, 0, hw - 50));
  const wg = P.build(); spin.add(wg);

  // carbon-ceramic disc, drilled
  const dR = rr * 0.775, zd = hw - 128;
  const disc = circleShape(dR); disc.holes.push(circlePath(0, 0, dR * 0.56));
  for (let k = 0; k < 16; k++) for (let m = 0; m < 3; m++) {
    const an = k / 16 * Math.PI * 2 + m * 0.11, r = dR * (0.66 + m * 0.11);
    disc.holes.push(circlePath(r * Math.cos(an), r * Math.sin(an), 4.6));
  }
  B.add(extrudeZ(disc, zd - 17, zd + 17, 1, 8), 'disc');
  B.add(lathe([[dR * 0.57, zd - 6], [dR * 0.57, zd + 20], [88, zd + 44], [60, zd + 46]], 40, 40), 'steelDark', TO_Z);
  const dg = B.build(); spin.add(dg);

  // six-piston caliper and the upright behind it: these do not turn
  const fixed = new THREE.Group();
  const C = new Part('brakes', M), a0 = calAngle - 34 * DEG, a1 = calAngle + 34 * DEG, ri = dR * 0.62, ro = Math.min(dR + 30, rr - 27);
  const arc = (r, f, t) => { const o = []; for (let k = 0; k <= 12; k++) { const an = f + (t - f) * k / 12; o.push([r * Math.cos(an), r * Math.sin(an)]); } return o; };
  C.add(extrudeZ(shapeFrom([...arc(ro, a0, a1), ...arc(ri, a1, a0)]), zd - 52, zd + 52, 8), 'caliper');
  for (const k of [-0.6, 0, 0.6]) {
    const an = calAngle + k * 30 * DEG, r = (ri + ro) / 2;
    C.add(cylZ(15, 5, 20), 'steel', T(r * Math.cos(an), r * Math.sin(an), zd + 53));
  }
  C.add(cylZ(54, 130, 28), 'forged', T(0, 0, zd - 80));
  C.add(rb(70, 300, 60, 16), 'forged', T(0, 0, zd - 90));
  fixed.add(C.build());
  return { spin, fixed, parts: { wheels: wg, brakes: [dg, fixed.children[0]] } };
}

export function buildCar(M) {
  const root = new THREE.Group();
  root.name = 'car';
  root.scale.setScalar(CAR_SCALE);
  const parts = {}, explodes = [], anchors = [];
  const reg = (id, obj) => { (parts[id] ??= []).push(obj); obj.userData.part ??= id; return obj; };
  const ex = (obj, vec, order = 0.5) => { explodes.push({ obj, base: obj.position.clone(), vec: V(...vec), order }); return obj; };
  const anchor = (id, parent, p, label, n = [0, 1, 0], side = 'r', inner = false) => {
    const o = new THREE.Object3D(); o.position.set(...p); parent.add(o);
    anchors.push({ part: id, obj: o, label, side, inner, normal: n && V(...n) });
  };
  const { yTop, wMax, ySh } = bodyCurves;

  // ------------------------------------------------------------- bodywork
  const body = buildBody(M);
  const G = body.groups;
  const shell = new THREE.Group(); shell.name = 'shell'; root.add(shell); ex(shell, [0, 1180, 0], 0.4);
  for (const k of ['body', 'glass', 'lights', 'liner']) { shell.add(G[k]); reg({ body: 'body', glass: 'glass', lights: 'lights', liner: 'lining' }[k], G[k]); }
  for (const m of G.liner.children) m.userData.part = 'lining';
  const hood = G.hood; shell.add(hood); reg('bonnet', hood); ex(hood, [0, 520, 0], 1);
  const doors = [G.doorR, G.doorL];
  for (const d of doors) { shell.add(d); reg('doors', d); }
  ex(G.doorR, [0, -240, 620], 0.9); ex(G.doorL, [0, -240, -620], 0.9);

  // trim that sits on the skin
  {
    const P = new Part('body', M);
    for (const s of [1, -1]) {
      // mirrors on stalks
      const m = body.at(520, body.J.C);
      const base = V(m.p.x, m.p.y + 30, s * (m.p.z + 6));
      const g = new THREE.SphereGeometry(1, 24, 16); g.scale(92, 58, 108);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) if (gp.getX(i) < -30) gp.setX(i, -30);       // flat back for the glass
      g.computeVertexNormals();
      P.add(g, 'paint', T(base.x + 16, base.y + 86, base.z + s * 118));
      const mg = new THREE.CircleGeometry(1, 28); mg.scale(96, 50, 1); mg.rotateY(-Math.PI / 2);
      P.add(mg, 'mirror', T(base.x - 15, base.y + 86, base.z + s * 118));
      rod(P, base, V(base.x + 12, base.y + 62, base.z + s * 70), 13, 'gloss');
      // wipers
      const w0 = V(CAR.cowl - 20, yTop(CAR.cowl - 20) + 16, s * 250 - 180), w1 = V(CAR.cowl - 150, yTop(CAR.cowl - 150) + 22, s * 250 + 330);
      rod(P, w0, w1, 7, 'gap', 8);
      P.add(cylY(16, 18, 16), 'gap', T(w0.x, w0.y - 6, w0.z));
      // sill blade
      P.add(rb(1700, 14, 60, 5), 'carbon', T(0, 132, s * 905));
      // door release, flush in the shoulder
      const dh = body.at(-420, body.J.C - 3);
      P.add(rb(150, 20, 6, 2), 'chrome', T(dh.p.x, dh.p.y, s * (dh.p.z + 1.5)));
    }
    // shark-fin aerial, high-level brake light, rear reflectors, washer jets
    const fin = shapeFrom([[0, 0], [150, 0], [120, 16], [40, 46], [10, 40]]);
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 16, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 2 }); fg.translate(-75, 0, -8);
    P.add(fg, 'gloss', T(-520, yTop(-520) - 2, 0));
    P.add(rb(10, 9, 320, 3), 'tailLit', T(-700, yTop(-700) - 13, 0));
    for (const s of [1, -1]) {
      P.add(rb(6, 26, 110, 3), 'tail', T(CAR.rear - bowAt(CAR.rear, 640) - 2, 470, s * 640));
      const j = body.at(820, body.J.N - 6);
      P.add(cylY(7, 5, 10), 'gap', T(j.p.x, j.p.y + 1, s * j.p.z));
    }
    // nose badge and rear script plate
    const nb = body.at(CAR.front - 60, body.J.N - 1);
    P.add(cylY(34, 5, 32), 'chrome', alignY([0.4, 1, 0], [nb.p.x, nb.p.y + 1, 0]));
    P.add(cylY(27, 6, 32), 'caliper', alignY([0.4, 1, 0], [nb.p.x, nb.p.y + 1.6, 0]));
    const plate = new THREE.PlaneGeometry(330, 84); plate.rotateY(-Math.PI / 2);
    P.add(plate, 'badge', T(CAR.rear - 3, 600, 0));
    const g = P.build(); shell.add(g); reg('body', g);
  }

  // aero: splitter, diffuser, exhaust surrounds
  {
    const P = new Part('aero', M);
    const pl = [];
    for (let k = -24; k <= 24; k++) { const z = k / 24 * 800; pl.push([CAR.front + 46 - bowAt(CAR.front, z) * 1.08, -z]); }
    pl.push([1880, -800], [1880, 800]);
    P.add(extrudeY(shapeFrom(pl), 112, 128, { bevel: 2 }), 'carbon');
    for (const s of [1, -1]) P.add(rb(150, 70, 10, 4), 'carbon', mat4({ p: [2170, 168, s * 772], r: [0, s * 0.3, 0] }));
    for (let k = -3; k <= 3; k++) {
      const fin = shapeFrom([[0, 150], [0, 176], [420, 330], [420, 300], [140, 150]].map(([u, v]) => [u, v]));
      const g = new THREE.ExtrudeGeometry(fin, { depth: 9, bevelEnabled: false }); g.rotateY(Math.PI); g.translate(-1850, 0, k * 190 + 4.5);
      P.add(g, 'carbon');
    }
    P.add(rb(440, 12, 1560, 4), 'carbon', mat4({ p: [-2040, 232, 0], r: [0, 0, -0.42] }));
    const g = P.build(); shell.add(g); reg('aero', g);
    anchor('aero', g, [CAR.front + 30, 130, 420], 'Splitter', [1, 0, 0]);
  }
  anchor('bonnet', hood, [760, -110, 0], 'Bonnet', [0, 1, 0]);
  anchor('body', shell, [-1500, yTop(-1500) + 4, 0], 'Fastback body', [0, 1, 0], 'l');
  anchor('lights', shell, [2150, ySh(2150), wMax(2150) - 60], 'LED headlamp', [0.5, 0.6, 0.6]);

  // wheel-arch liners
  {
    const P = new Part('body', M);
    for (const a of [CAR.axle.f, CAR.axle.r]) for (const s of [1, -1]) {
      const zi = a.track - 290, zo = wMax(a.x) - 26, R = a.R + 6;
      const tub = new THREE.CylinderGeometry(R, R, zo - zi, 36, 1, true, Math.PI / 2, Math.PI); tub.rotateX(Math.PI / 2);
      P.add(tub, 'archLiner', T(a.x, a.y, s * (zi + zo) / 2));
      const wall = shapeFrom([...Array.from({ length: 25 }, (_, k) => { const an = Math.PI * k / 24; return [a.x + R * Math.cos(an), a.y + R * Math.sin(an)]; }), [a.x - R, 150], [a.x + R, 150]]);
      P.add(new THREE.ShapeGeometry(wall), 'archLiner', T(0, 0, s * zi));
      for (const sx of [1, -1]) P.add(box(4, a.y - 150, zo - zi), 'archLiner', T(a.x + sx * R, (a.y + 150) / 2, s * (zi + zo) / 2));
    }
    const g = P.build({ cast: false }); shell.add(g); reg('body', g);
  }

  // ------------------------------------------------------- wheels and brakes
  const corners = [];
  for (const [a, front] of [[CAR.axle.f, true], [CAR.axle.r, false]]) for (const s of [1, -1]) {
    const corner = new THREE.Group(); corner.position.set(a.x, a.y, s * a.track);
    if (s < 0) corner.rotation.y = Math.PI;
    const steer = new THREE.Group(); corner.add(steer);
    // caliper trails on the front axle and leads on the rear; local X flips on the left
    const rearward = Math.PI, forward = 0, want = front ? rearward : forward;
    const w = buildWheel(M, a, front, s > 0 ? want : Math.PI - want);
    steer.add(w.spin, w.fixed);
    root.add(corner); ex(corner, [0, 0, s * 430], 0.7);
    reg('wheels', w.parts.wheels); for (const b of w.parts.brakes) reg('brakes', b);
    corners.push({ corner, steer, spin: w.spin, s, front });
    if (front && s > 0) {
      anchor('wheels', corner, [0, a.tyreR * 0.72, a.tyreW / 2 + 6], 'Forged wheel', [0, 0, 1]);
      anchor('brakes', corner, [-150, -60, a.tyreW / 2 - 60], 'Carbon-ceramic brake', [0, 0, 1], 'l');
    }
  }

  // --------------------------------------------------------------- carbon tub
  {
    const P = new Part('tub', M);
    P.add(rb(1500, 26, 1420, 8), 'carbon', T(-150, 152, 0));
    for (const s of [1, -1]) P.add(rb(1480, 250, 130, 34), 'carbon', T(-160, 290, s * 700));
    P.add(rb(44, 600, 1420, 14), 'carbon', T(602, 470, 0));
    P.add(rb(44, 600, 1420, 14), 'carbon', T(-902, 460, 0));
    const arch = [[-240, 165], [-240, 372], [-196, 420], [196, 420], [240, 372], [240, 165], [222, 165], [222, 366], [188, 402], [-188, 402], [-222, 366], [-222, 165]];
    P.add(extrudeX(shapeFrom(arch), -900, 600, { bevel: 0 }), 'carbon');
    for (const s of [1, -1]) {       // screen pillars and the roof hoop of the safety cell
      rod(P, V(600, 760, s * 690), V(150, 1170, s * 585), 26, 'carbon');
      rod(P, V(150, 1170, s * 585), V(-640, 1205, s * 560), 24, 'carbon');
      rod(P, V(-640, 1205, s * 560), V(-900, 760, s * 690), 26, 'carbon');
    }
    rod(P, V(150, 1172, -585), V(150, 1172, 585), 22, 'carbon');
    rod(P, V(-640, 1207, -560), V(-640, 1207, 560), 22, 'carbon');
    P.add(cylZ(28, 1380, 20), 'machined', T(560, 800, 0));
    const g = P.build(); root.add(g); reg('tub', g);
    anchor('tub', g, [-160, 420, 770], 'Carbon tub', [0, 0.2, 1], 'r', true);
  }

  // ------------------------------------------------------ structure, cooling
  {
    const P = new Part('chassis', M);
    for (const s of [1, -1]) {
      P.add(rb(1560, 92, 70, 14), 'machined', T(1390, 250, s * 430));
      P.add(rb(240, 104, 92, 12), 'cast', T(2140, 290, s * 430));
      P.add(rb(170, 330, 150, 24), 'cast', T(1360, 570, s * 505));
      P.add(cylY(52, 12, 28), 'machined', T(1360, 741, s * 500));
      for (const dx of [205, -205]) P.add(rb(74, 46, 300, 10), 'cast', T(1020 + dx, 312, s * 268));
      P.add(rb(1150, 300, 10, 4), 'carUnder', T(1290, 490, s * 548));
      // rear
      P.add(rb(1180, 92, 70, 14), 'machined', T(-1480, 284, s * 420));
      P.add(rb(170, 300, 150, 24), 'cast', T(-1360, 568, s * 500));
    }
    P.add(rb(64, 112, 1120, 14), 'machined', T(2244, 300, 0));
    P.add(rb(92, 60, 880, 12), 'machined', T(1020, 172, 0));
    P.add(rb(74, 72, 920, 12), 'machined', T(-1970, 300, 0));
    P.add(rb(60, 26, 900, 8), 'carbon', T(2120, 520, 0));
    // strut brace across the bay
    rod(P, V(1360, 748, -500), V(1360, 748, 500), 17, 'carbon', 16);
    // radiator pack, fans, hoses to the pump
    const rad = mat4({ p: [2080, 392, 0], r: [0, 0, 0.16] });
    P.add(box(46, 340, 900), 'radiator', rad);
    for (const s of [1, -1]) {
      P.add(rb(60, 348, 40, 10), 'machined', rad.clone().multiply(T(0, 0, s * 470)));
      P.add(cylX(150, 34, 40), 'plastic', rad.clone().multiply(T(-48, 0, s * 220)));
      P.add(cylX(40, 40, 20), 'steelDark', rad.clone().multiply(T(-52, 0, s * 220)));
    }
    pipe(P, [V(2030, 548, 300), V(1900, 620, 240), V(1620, 664, 90), V(1420, 650, 10), V(1401, 632, 0)], 19, 'rubber');
    pipe(P, [V(2040, 250, -330), V(1800, 232, -300), V(1560, 250, -250), V(1420, 330, -205)], 19, 'rubber');
    // ancillaries on the bulkhead
    P.add(rb(250, 190, 170, 16), 'plastic', T(700, 560, -470));
    P.add(cylX(108, 110, 32), 'steelDark', T(650, 640, -330));
    P.add(cylY(34, 70, 20), 'ceramic', T(700, 730, -330));
    P.add(cylY(60, 150, 24), 'plastic', T(1900, 560, -420));
    const g = P.build(); root.add(g); reg('chassis', g);
  }

  // -------------------------------------------------------------- suspension
  const springGeo = coil(47, 7.5, 7, 240);
  {
    const P = new Part('suspension', M);
    for (const [a, front] of [[CAR.axle.f, true], [CAR.axle.r, false]]) {
      for (const s of [1, -1]) {
        const zt = a.track - 150;
        const U = V(a.x - 12, a.y + 190, s * (zt - 26)), L = V(a.x, a.y - 172, s * (zt + 24));
        for (const dx of [185, -185]) {
          rod(P, U, V(a.x + dx, a.y + 180, s * 440), 13, 'forged');
          rod(P, L, V(a.x + dx * 1.2, a.y - 150, s * 330), 16, 'forged');
        }
        rod(P, L, U, 22, 'cast', 14);
        P.add(new THREE.SphereGeometry(24, 16, 12), 'steel', T(U.x, U.y, U.z));
        P.add(new THREE.SphereGeometry(27, 16, 12), 'steel', T(L.x, L.y, L.z));
        // coil-over damper
        const d0 = V(a.x, a.y - 150, s * (zt - 190)), d1 = V(a.x, a.y + 392, s * 500);
        const dir = d1.clone().sub(d0), mid = d0.clone().lerp(d1, 0.5), up = d0.clone().lerp(d1, 0.66);
        rod(P, d0, mid, 30, 'damper', 20); rod(P, mid, d1, 14, 'journal', 12);
        P.add(springGeo.clone(), 'coilSpring', alignY(dir.toArray(), up.toArray()));
        for (const f of [0.44, 0.88]) P.add(cylY(56, 8, 24), 'machined', alignY(dir.toArray(), d0.clone().lerp(d1, f).toArray()));
        // track rod
        const ox = front ? 140 : -150;
        rod(P, V(a.x + ox, a.y - 30, s * (zt - 6)), V(a.x + ox, a.y - 40, s * 330), 10, 'steel');
      }
      // anti-roll bar
      const bx = a.x + (front ? 330 : -330);
      pipe(P, [V(bx - 150 * Math.sign(bx), a.y - 110, -640), V(bx, a.y - 120, -560), V(bx, a.y - 124, 0), V(bx, a.y - 120, 560), V(bx - 150 * Math.sign(bx), a.y - 110, 640)], 13, 'steelDark', 10);
    }
    P.add(cylZ(24, 640, 18), 'machined', T(1500, 310, 0));
    for (const s of [1, -1]) P.add(cylZ(31, 90, 16, ), 'rubber', T(1500, 310, s * 330));
    const g = P.build(); root.add(g); reg('suspension', g);
    anchor('suspension', g, [CAR.axle.r.x, CAR.axle.r.y + 320, 520], 'Double wishbones', [0, 0.3, 1], 'l', true);
  }

  // -------------------------------------------------------------- drivetrain
  const shafts = [];
  {
    const P = new Part('drivetrain', M);
    const ex0 = CAR.engine[0], cy = CAR.engine[1];
    const cone = (rf, rr2, x1, x0, mat = 'cast') => { const g = new THREE.CylinderGeometry(rf, rr2, x1 - x0, 40); g.rotateZ(-Math.PI / 2); P.add(g, mat, T((x0 + x1) / 2, cy, 0)); };
    cone(160, 160, ex0 - 368, ex0 - 430); cone(160, 72, ex0 - 430, ex0 - 560);
    P.add(cylX(62, 1560, 32), 'cast', T(-310, cy, 0));
    for (const x of [460, -1070]) P.add(cylX(84, 18, 32), 'machined', T(x, cy, 0));
    // seven-speed transaxle
    cone(70, 150, -1080, -1170);
    P.add(rb(520, 330, 400, 70, 5), 'cast', T(-1420, cy + 6, 0));
    P.add(cylZ(158, 330, 40), 'cast', T(-1360, cy + 18, 0));
    for (const s of [1, -1]) { P.add(cylZ(70, 30, 28), 'machined', T(-1360, cy + 18, s * 180)); P.add(rb(360, 8, 8, 2), 'cast', T(-1440, cy + 176, s * 120)); }
    P.add(rb(430, 46, 320, 14), 'castDark', T(-1430, cy - 172, 0));
    P.add(rb(210, 70, 170, 14), 'plastic', T(-1500, cy + 196, 0));
    for (let k = 0; k < 6; k++) P.add(rb(10, 300, 10, 3), 'cast', T(-1610 + k * 62, cy + 6, 202));
    for (let k = 0; k < 6; k++) P.add(rb(10, 300, 10, 3), 'cast', T(-1610 + k * 62, cy + 6, -202));
    P.add(rb(190, 290, 940, 46), 'machined', T(-1012, 570, 0));
    P.add(cylY(38, 26, 20), 'plastic', T(-1012, 722, 380));
    const g = P.build(); root.add(g); reg('drivetrain', g);
    anchor('drivetrain', g, [-1500, cy + 240, 0], 'Rear transaxle', [0, 1, 0], 'r', true);
    // half shafts turn with the wheels
    for (const s of [1, -1]) {
      const a = CAR.axle.r, S = new Part('drivetrain', M);
      const len = a.track - 150 - 200;
      S.add(cylY(19, len, 16), 'steel');
      S.add(new THREE.CylinderGeometry(24, 46, 84, 20), 'rubber', T(0, len / 2 - 44, 0));
      S.add(new THREE.CylinderGeometry(46, 24, 84, 20), 'rubber', T(0, -len / 2 + 44, 0));
      const sg = S.build();
      const from = V(-1360, cy + 18, s * 200), to = V(a.x, a.y, s * (a.track - 150));
      sg.applyMatrix4(alignY(to.clone().sub(from).toArray(), from.clone().lerp(to, 0.5).toArray()));
      root.add(sg); reg('drivetrain', sg); shafts.push({ g: sg, s });
    }
  }

  // ----------------------------------------------------------- exhaust system
  {
    const P = new Part('exhaustsys', M);
    const cdir = V(-0.34, -1, 0.04).normalize();
    for (const s of [1, -1]) {
      const xs = CYL.filter(c => c.bank === s).map(c => c.x);
      const join = V(690, 232, s * 168);
      for (let g = 0; g < 2; g++) {
        const xm = (xs[g * 3] + xs[g * 3 + 1] + xs[g * 3 + 2]) / 3 - 58;
        const end = V(xm, 34, 268).addScaledVector(cdir, 160).add(V(...CAR.engine)); end.z *= s;
        const d = cdir.clone(); d.z *= s;
        pipe(P, [end, end.clone().addScaledVector(d, 70), V(end.x - 190, 196, s * (250 - g * 30)), V(join.x + 130, 214 + g * 22, s * (200 - g * 14)), join], 30, 'exhaustFlange');
      }
      P.add(cylX(40, 60, 24), 'exhaustFlange', T(join.x - 20, join.y, join.z));
      P.add(cylX(60, 250, 28), 'steelDark', T(330, 232, s * 150));
      for (const x of [460, 200]) P.add(new THREE.CylinderGeometry(60, 36, 40, 28).rotateZ(x > 300 ? Math.PI / 2 : -Math.PI / 2), 'steelDark', T(x + (x > 300 ? 15 : -15), 232, s * 150));
      pipe(P, [V(660, 232, s * 166), V(480, 232, s * 150)], 34, 'exhaustFlange');
      pipe(P, [V(190, 232, s * 150), V(-600, 228, s * 150), V(-930, 226, s * 160), V(-1130, 232, s * 255), V(-1500, 290, s * 395), V(-1790, 366, s * 440)], 34, 'exhaustFlange');
      P.add(rb(380, 170, 300, 70, 4), 'steel', T(-1960, 372, s * 440));
      for (const z of [352, 500]) {
        const zt = s * z, x1 = CAR.rear + bowAt(CAR.rear, z) * -1 - 8;
        pipe(P, [V(-2140, 372, zt), V(-2200, 396, zt)], 30, 'exhaustFlange');
        P.add(lathe([[40, 0], [47, 4], [47, 120], [43, 124], [41, 120], [41, 6]], 28, 40), 'chrome', mat4({ p: [x1 + 108, 398, zt], r: [0, 0, Math.PI / 2] }));
      }
    }
    const g = P.build(); root.add(g); reg('exhaustsys', g);
    anchor('exhaustsys', g, [CAR.rear + 30, 400, 430], 'Quad exhaust', [-1, 0, 0], 'l');
  }

  // --------------------------------------------------------------------- cabin
  let steeringWheel;
  {
    const cab = new THREE.Group(); cab.name = 'cabin'; root.add(cab); reg('cabin', cab); ex(cab, [0, 560, 0], 0.55);
    const P = new Part('cabin', M);
    for (const s of [1, -1]) {
      const z = s * 425;
      const seat = (geo, mat, p, rz = 0) => P.add(geo, mat, mat4({ p: [p[0], p[1], z + (p[2] || 0)], r: [0, 0, rz] }));
      seat(rb(520, 120, 420, 50), 'leather', [-380, 286], 0.12);
      seat(rb(380, 30, 300, 14), 'alcantara', [-380, 348], 0.12);
      for (const k of [1, -1]) seat(rb(470, 150, 70, 34), 'leather', [-375, 318, k * 208], 0.12);
      seat(rb(120, 620, 400, 52), 'leather', [-712, 610], 0.36);
      seat(rb(30, 420, 270, 14), 'alcantara', [-650, 600], 0.36);
      for (const k of [1, -1]) seat(rb(170, 520, 70, 34), 'leather', [-668, 570, k * 205], 0.36);
      seat(rb(120, 180, 250, 44), 'leather', [-836, 960], 0.36);
      seat(rb(40, 760, 440, 30), 'carbon', [-762, 640], 0.36);
      seat(rb(480, 40, 430, 16), 'carbon', [-390, 222], 0.12);
      // four-point harness
      for (const k of [1, -1]) {
        seat(rb(8, 470, 50, 2), 'harness', [-640, 640, k * 92], 0.36);
        seat(rb(250, 8, 50, 2), 'harness', [-470, 372, k * 150], 0.12);
      }
      seat(rb(40, 34, 60, 6), 'chrome', [-545, 412], 0.2);
    }
    // dashboard, binnacle, screens
    P.add(rb(300, 170, 1540, 70, 4), 'alcantara', T(520, 792, 0));
    P.add(rb(180, 60, 1500, 24), 'leather', T(470, 712, 0));
    P.add(rb(200, 116, 400, 54), 'alcantara', T(432, 880, -425));
    const scr = new THREE.PlaneGeometry(300, 92); scr.rotateY(-Math.PI / 2);
    P.add(scr, 'screen', mat4({ p: [344, 872, -425], r: [0, 0, 0.16] }));
    const mid = new THREE.PlaneGeometry(250, 130); mid.rotateY(-Math.PI / 2);
    P.add(rb(16, 150, 270, 6), 'gloss', mat4({ p: [372, 786, 0], r: [0, 0, 0.3] }));
    P.add(mid, 'screen', mat4({ p: [362, 788, 0], r: [0, 0, 0.3] }));
    for (const z of [-720, 720, -160, 160]) P.add(cylX(34, 20, 20), 'chrome', mat4({ p: [368, 790, z + (Math.abs(z) < 200 ? 0 : 0)], r: [0, 0, 0.2] }));
    // tunnel console, selector, armrest
    P.add(rb(1000, 46, 330, 20), 'leather', T(-110, 440, 0));
    P.add(rb(260, 70, 230, 26), 'alcantara', T(-560, 494, 0));
    P.add(rb(170, 16, 120, 6), 'carbon', T(40, 468, 0));
    P.add(cylY(22, 60, 20), 'chrome', T(60, 500, 0));
    P.add(new THREE.SphereGeometry(27, 20, 14), 'leather', T(60, 540, 0));
    for (const k of [-1, 0, 1]) P.add(cylY(16, 12, 16), 'chrome', T(-90, 470, k * 60));
    // parcel shelf, carpet, mirror
    P.add(rb(700, 24, 1240, 10), 'alcantara', mat4({ p: [-1260, 902, 0], r: [0, 0, -0.07] }));
    P.add(rb(1460, 8, 1250, 3), 'carpet', T(-150, 170, 0));
    P.add(rb(30, 60, 210, 12), 'gloss', T(170, 1180, 0));
    for (const z of [-470, -390, -300]) P.add(rb(16, 150, 60, 6), 'machined', mat4({ p: [470, 300, z], r: [0, 0, 0.5] }));
    cab.add(P.build());
    // steering wheel on its column, free to turn
    steeringWheel = new THREE.Group();
    const S = new Part('cabin', M);
    const rim = new THREE.TorusGeometry(172, 15, 14, 48);
    S.add(rim, 'leather');
    for (const an of [0, Math.PI, -Math.PI / 2]) S.add(rb(150, 30, 14, 6), 'carbon', mat4({ p: [86 * Math.cos(an), 86 * Math.sin(an), -6], r: [0, 0, an] }));
    S.add(rb(96, 84, 40, 20), 'alcantara', T(0, 0, -6));
    S.add(cylZ(20, 6, 20), 'caliper', T(118, -22, 10));
    steeringWheel.add(S.build());
    const col = new THREE.Group(); col.position.set(268, 770, -425); col.rotation.set(0, -Math.PI / 2, 0); col.rotateX(-0.36);
    col.add(steeringWheel);
    const C2 = new Part('cabin', M); C2.add(cylZ(26, 200, 18), 'plastic', T(0, 0, -108)); col.add(C2.build());
    cab.add(col);
    anchor('cabin', cab, [-700, 1020, 425], 'Cabin', [0, 1, 0], 'r', true);
  }

  // where the engine drops in
  const engineMount = new THREE.Group(); engineMount.name = 'engineMount'; engineMount.position.set(...CAR.engine); root.add(engineMount);
  reg('v12', engineMount);
  anchor('v12', engineMount, [0, 460, 0], '6.0 L V12', [0, 1, 0], 'r', true);

  // ------------------------------------------------------------- animation
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function setExplode(t) {
    for (const e of explodes) {
      const delay = 0.38 * (1 - e.order);
      e.obj.position.copy(e.base).addScaledVector(e.vec, ease(THREE.MathUtils.clamp((t - delay) / 0.62, 0, 1)));
    }
  }
  const setBonnet = t => { hood.rotation.z = ease(t) * 46 * DEG; };
  const setDoors = t => { G.doorR.rotation.y = ease(t) * 64 * DEG; G.doorL.rotation.y = -ease(t) * 64 * DEG; };
  function setSteer(rad) {
    for (const c of corners) if (c.front) c.steer.rotation.y = rad;
    steeringWheel.rotation.z = rad * 13;
  }
  // roll: positive angle is forwards; only the driven rear axle turns
  function roll(angle) {
    for (const c of corners) if (!c.front) c.spin.rotation.z = -c.s * angle;
    for (const sh of shafts) sh.g.children.forEach(m => { m.rotation.y = sh.s * angle; });
  }
  setExplode(0); setBonnet(0); setDoors(0); setSteer(0);

  return { root, parts, anchors, engineMount, setExplode, setBonnet, setDoors, setSteer, roll, corners };
}
