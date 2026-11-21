// Geometry helpers shared by the engine builders. Units are millimetres.
import * as THREE from '../vendor/three.bundle.min.js';
import { mergeGeometries, toCreasedNormals } from '../vendor/three.bundle.min.js';

export const DEG = Math.PI / 180;
const KEEP = ['position', 'normal', 'uv'];

// Normalise any geometry to non-indexed position/normal/uv so it can be merged.
export function norm(g) {
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  g.morphAttributes = {};
  return g;
}

// Swap triangle winding (needed after a mirroring transform is baked in).
export function flipWinding(g) {
  for (const name of KEEP) {
    const a = g.attributes[name]; if (!a) continue;
    const n = a.itemSize, arr = a.array;
    for (let i = 0; i < arr.length; i += n * 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[i + n + k]; arr[i + n + k] = arr[i + 2 * n + k]; arr[i + 2 * n + k] = t;
      }
    }
    a.needsUpdate = true;
  }
  return g;
}

export function xform(g, m) {
  g.applyMatrix4(m);
  if (m.determinant() < 0) flipWinding(g);
  return g;
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function mat4({ p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  _p.set(p[0], p[1], p[2]);
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Matrix that takes +Y to an arbitrary direction, then translates.
export function alignY(dir, pos = [0, 0, 0]) {
  const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]), q, new THREE.Vector3(1, 1, 1));
}

export function arcPts(cx, cy, r, a0, a1, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Always wound counter-clockwise, so holes and bevels behave the same for every outline.
export function shapeFrom(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts = pts.slice().reverse();
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export function circlePath(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

export function circleShape(r, x = 0, y = 0) {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

function rrectInto(s, x0, y0, x1, y1, r) {
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export const rrectShape = (x0, y0, x1, y1, r) => rrectInto(new THREE.Shape(), x0, y0, x1, y1, r);
export const rrectPath = (x0, y0, x1, y1, r) => rrectInto(new THREE.Path(), x0, y0, x1, y1, r);

function extrude(shape, depth, { bevel = 0, seg = 24, crease = 38 } = {}) {
  const b = Math.min(bevel, depth / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(shape, b > 0
    ? { depth: depth - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: seg }
    : { depth, bevelEnabled: false, curveSegments: seg });
  if (b > 0) g.translate(0, 0, b);
  return crease ? toCreasedNormals(g, crease * DEG) : g;
}

// Shape drawn in (z, y); extruded along X from x0 to x1.
export function extrudeX(shape, x0, x1, o) {
  const g = extrude(shape, x1 - x0, o);
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  return g;
}

// Shape drawn in (x, -z); extruded along Y from y0 to y1.
export function extrudeY(shape, y0, y1, o) {
  const g = extrude(shape, y1 - y0, o);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

export function cylY(r, h, seg = 24, rTop = r) { return new THREE.CylinderGeometry(rTop, r, h, seg); }
export function cylX(r, len, seg = 24) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(-Math.PI / 2); return g; }
export function cylZ(r, len, seg = 24) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return g; }
export function box(x, y, z) { return new THREE.BoxGeometry(x, y, z); }

export function lathe(pts, seg = 48, crease = 32) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  return crease ? toCreasedNormals(g, crease * DEG) : g;
}

// Spur-gear outline, used for sprockets and the flywheel ring gear.
export function gearShape(teeth, rRoot, rTip, hole = 0) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const r = (i % 4 === 1 || i % 4 === 2) ? rTip : rRoot;
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a)); else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  if (hole > 0) s.holes.push(circlePath(0, 0, hole));
  return s;
}

// Box-projected UVs in millimetres, so tiled surface textures keep one scale
// across extrusions, boxes and lathed parts alike.
export function worldUV(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i += 3) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) { nx += nor.getX(i + k); ny += nor.getY(i + k); nz += nor.getZ(i + k); }
    nx = Math.abs(nx); ny = Math.abs(ny); nz = Math.abs(nz);
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k), y = pos.getY(i + k), z = pos.getZ(i + k);
      if (nx >= ny && nx >= nz) uv.setXY(i + k, z, y);
      else if (ny >= nz) uv.setXY(i + k, x, z);
      else uv.setXY(i + k, x, y);
    }
  }
  return g;
}
const WORLD_UV = new Set(['cast', 'castHead', 'castDark', 'cover', 'carbon']);

// A part collects primitives per material and bakes them into one mesh each.
export class Part {
  constructor(id, M) {
    this.id = id; this.M = M;
    this.group = new THREE.Group();
    this.group.name = id;
    this.group.userData.part = id;
    this.bins = new Map();
  }
  add(geom, mat, m) {
    let g = norm(geom);
    if (m) xform(g, m);
    if (!this.bins.has(mat)) this.bins.set(mat, []);
    this.bins.get(mat).push(g);
    return this;
  }
  bolts(list, r = 4.5, mat = 'bolt', m) {
    for (const b of list) {
      const a = alignY(b.n || [0, 1, 0], b.p);
      const head = cylY(r, r * 0.85, 6); head.translate(0, r * 0.42 + 0.8, 0);
      const washer = cylY(r * 1.45, 0.9, 12); washer.translate(0, 0.45, 0);
      for (const g of [head, washer]) {
        const n = norm(g); xform(n, a); if (m) xform(n, m);
        if (!this.bins.has(mat)) this.bins.set(mat, []);
        this.bins.get(mat).push(n);
      }
    }
    return this;
  }
  build({ cast = true, receive = true } = {}) {
    for (const [key, list] of this.bins) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (WORLD_UV.has(key)) worldUV(merged);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, this.M[key]);
      mesh.name = this.id + ':' + key;
      mesh.userData.part = this.id;
      mesh.userData.matKey = key;
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      this.group.add(mesh);
    }
    this.bins.clear();
    return this.group;
  }
}

// Bake several primitives into a single multi-material geometry (for instanced
// or repeated moving parts such as pistons and rods).
export function multi(entries) {
  const list = entries.map(([g, m]) => { const n = norm(g); if (m) xform(n, m); return n; });
  const merged = mergeGeometries(list, true);
  for (const g of list) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}
