// Studio: renderer, lighting, floor, post-processing, camera rig, render modes
// (studio / x-ray / capped section), picking and highlighting.
import * as THREE from '../vendor/three.bundle.min.js';
import { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, Reflector } from '../vendor/three.bundle.min.js';
import * as Tx from './textures.js';

const BG = '#0a0b0d';
const SHELL_PARTS = ['block', 'liners', 'sump', 'heads', 'gasket', 'covers', 'coils', 'intake', 'fuel', 'airbox', 'exhaust', 'timingcover', 'accessory'];
const SOLID_PARTS = ['block', 'liners', 'sump', 'heads', 'gasket'];
const S30 = 0.5, C30 = Math.cos(Math.PI / 6);

const CAR_GHOST = ['body', 'bonnet', 'doors', 'glass', 'lights', 'lining', 'aero'];
const CAR_SOLID = ['tub', 'drivetrain'];
const FRAMES = { engine: { radius: 4.9, baseY: 0.6 }, car: { radius: 6.3, baseY: -1.5 } };

export const VIEWS = {
  engine: {
    hero: { az: 38, pol: 68, r: 1.0, ty: 0 },
    front: { az: 0.01, pol: 80, r: 0.92, ty: 0 },
    side: { az: 90, pol: 82, r: 1.0, ty: 0 },
    top: { az: 20, pol: 14, r: 1.02, ty: 0 },
    rear: { az: -122, pol: 70, r: 1.0, ty: 0 },
    valley: { az: 72, pol: 40, r: 0.72, ty: 0.9 },
  },
  car: {
    hero: { az: 37, pol: 78, r: 0.88, ty: 0 },
    front: { az: 0.01, pol: 84, r: 0.72, ty: -0.1 },
    side: { az: 90, pol: 85, r: 0.9, ty: 0 },
    top: { az: 0.01, pol: 5, r: 0.92, ty: 0 },
    rear: { az: -148, pol: 77, r: 0.88, ty: 0 },
    valley: { az: 32, pol: 50, r: 0.5, ty: 0.3, tx: 2.6 },
  },
};

export const SECTIONS = {
  engine: {
    cross: { normal: [-1, 0, 0], range: [-3.4, 3.4], start: 1.56, view: { az: 30, pol: 78, r: 0.9, ty: 0 } },
    long: { normal: [0, 0, -1], range: [-2.6, 2.6], start: 0, view: { az: 82, pol: 78, r: 1.0, ty: 0 } },
    bank: { normal: [0, S30, -C30], range: [-0.75, 0.75], start: 0, view: { az: 74, pol: 84, r: 0.95, ty: 0.3 } },
  },
  car: {
    long: { normal: [0, 0, -1], range: [-2.7, 2.7], start: 0, view: { az: 84, pol: 82, r: 0.86, ty: 0 } },
    cross: { normal: [-1, 0, 0], range: [-6, 6.2], start: 2.55, view: { az: 26, pol: 78, r: 0.8, ty: 0 } },
  },
};

export function createStage(container, M, engine, car, { lite = false } = {}) {
  const mobile = lite || matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  let pixelRatio = lite ? 1 : Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.localClippingEnabled = true;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 34, 78);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 220);
  camera.layers.enable(1);

  // ----------------------------------------------------- environment light
  // A softbox studio built from emissive panels and prefiltered once.
  {
    const env = new THREE.Scene();
    const panel = (w, h, pos, look, col, k) => {
      const c = new THREE.Color(col).multiplyScalar(k);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(...look); env.add(m);
    };
    env.add(new THREE.Mesh(new THREE.BoxGeometry(80, 50, 80), new THREE.MeshBasicMaterial({ color: '#07080a', side: THREE.BackSide })));
    panel(22, 10, [0, 15, 2], [0, 0, 0], '#fff6ea', 4.0);          // overhead key
    panel(3.2, 16, [-17, 5, 9], [0, 1, 0], '#cfe0ff', 7.5);        // cool strip, left
    panel(3.2, 16, [17, 5, -8], [0, 1, 0], '#ffe2c0', 6.0);        // warm strip, right
    panel(26, 2.2, [0, 9, -18], [0, 1, 0], '#ffffff', 8.5);        // rim bar behind
    panel(40, 14, [0, 5, 24], [0, 2, 0], '#aab4c8', 1.25);         // broad fills all round,
    panel(40, 14, [0, 5, -24], [0, 2, 0], '#9aa3b6', 0.9);         // so flanks and undersides
    panel(40, 14, [26, 5, 0], [0, 2, 0], '#b8b2a8', 1.1);          // of rough castings still
    panel(40, 14, [-26, 5, 0], [0, 2, 0], '#a2acc0', 0.9);         // read as metal
    panel(60, 60, [0, -6, 0], [0, 10, 0], '#24262b', 1.0);         // floor bounce
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
    scene.environmentIntensity = 1.0;
    pmrem.dispose();
    env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  const key = new THREE.DirectionalLight('#fff3e2', 2.4);
  key.position.set(7, 15, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  if (lite) renderer.shadowMap.type = THREE.PCFShadowMap;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -9, near: 2, far: 46 });
  key.shadow.bias = -0.00035; key.shadow.normalBias = 0.035; key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#b9d2ff', 0.9);
  rim.position.set(-9, 6, -12);
  scene.add(rim);

  // ------------------------------------------------------------------ floor
  const FLOOR_Y = -3.0;
  const floorG = new THREE.Group(); scene.add(floorG);
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#0c0d0f', metalness: 0.35, roughness: 0.42 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.75, 0.24, 96), plinthMat);
  plinth.position.y = FLOOR_Y - 0.121; plinth.receiveShadow = true; floorG.add(plinth);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#8d9197', metalness: 1, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.36, 6.5, 128), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = FLOOR_Y + 0.004; floorG.add(ring);
  // degree ticks around the turntable: a quiet nod to a timing wheel
  {
    const tick = new THREE.PlaneGeometry(0.012, 0.16); tick.rotateX(-Math.PI / 2);
    const ticks = new THREE.InstancedMesh(tick, new THREE.MeshBasicMaterial({ color: '#5d6066' }), 72);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, r = 6.18;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      s.set(1, 1, i % 6 === 0 ? 1.8 : 1);
      m.compose(p.set(Math.cos(a) * r, FLOOR_Y + 0.005, Math.sin(a) * r), q, s);
      ticks.setMatrixAt(i, m);
    }
    ticks.raycast = () => {}; floorG.add(ticks);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: '#050506', metalness: 0, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR_Y - 0.24; ground.receiveShadow = true; floorG.add(ground);

  let mirror = null;
  const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(6.36, 96), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = FLOOR_Y + 0.003; shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = 1;
  floorG.add(shadowCatcher);
  function setMirror(on) {
    if (on && !mirror) {
      const size = mobile ? 512 : 1024;
      // Reflector with a multiplicative tint (the stock overlay blend lets
      // highlights through at full strength) and a falloff towards the rim.
      const shader = {
        name: 'PlinthMirror',
        uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
        vertexShader: /* glsl */`
          uniform mat4 textureMatrix; varying vec4 vUv; varying float vR;
          void main(){ vUv = textureMatrix * vec4(position, 1.0); vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv; varying float vR;
          void main(){
            vec3 base = min(texture2DProj(tDiffuse, vUv).rgb, vec3(1.1));
            float fall = smoothstep(6.4, 1.6, vR);
            gl_FragColor = vec4(base * color * (0.25 + 0.75 * fall), 1.0);
          }`,
      };
      mirror = new Reflector(new THREE.CircleGeometry(6.36, 96), { textureWidth: size, textureHeight: size, color: 0x565a62, clipBias: 0.003, multisample: mobile ? 0 : 4, type: THREE.HalfFloatType, shader });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = FLOOR_Y + 0.001;
      mirror.raycast = () => {};
      floorG.add(mirror);
    }
    if (mirror) mirror.visible = on;
  }
  for (const o of floorG.children) o.raycast = () => {};
  setMirror(!lite);

  scene.add(engine.root);
  car.root.position.y = FLOOR_Y;
  car.root.visible = false;
  scene.add(car.root);
  let subject = 'engine';
  const all = { ...engine.parts, ...car.parts };

  // -------------------------------------------------------- post-processing
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: lite ? 0 : mobile ? 2 : 4, stencilBuffer: true });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.5, 1.7);
  composer.addPass(bloom);
  bloom.enabled = !lite;
  composer.addPass(new OutputPass());

  // ------------------------------------------------------- sizing
  const size = { w: 1, h: 1 };

  // ------------------------------------------------------------- camera rig
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.075, rotateSpeed: 0.62, zoomSpeed: 0.8, panSpeed: 0.6,
    minDistance: 5, maxDistance: 60, maxPolarAngle: 93 * Math.PI / 180, autoRotate: false, autoRotateSpeed: 0.55,
  });
  controls.target.set(0, 0.75, 0);

  const frame = { ...FRAMES.engine };          // what the camera has to fit
  const inset = { l: 0, t: 0, r: 0, b: 0 };            // screen area covered by panels
  const fitDist = r => {
    const t = Math.tan(camera.fov * Math.PI / 360);
    const fw = Math.max(0.3, 1 - (inset.l + inset.r) / size.w), fh = Math.max(0.3, 1 - (inset.t + inset.b) / size.h);
    const v = Math.atan(t * fh), h = Math.atan(t * camera.aspect * fw);
    return r / Math.sin(Math.min(v, h));
  };
  function applyOffset() {
    camera.setViewOffset(size.w, size.h, -(inset.l - inset.r) / 2, -(inset.t - inset.b) / 2, size.w, size.h);
  }
  // keep the engine centred in whatever part of the stage the panels leave free
  function setInsets(l, t, r, b) {
    const before = fitDist(frame.radius);
    Object.assign(inset, { l, t, r, b });
    applyOffset();
    const k = fitDist(frame.radius) / before;
    if (fly) { fly.b.radius *= k; return; }
    const off = camera.position.clone().sub(controls.target).multiplyScalar(k);
    camera.position.copy(controls.target).add(off);
  }
  const viewPose = v => {
    const d = fitDist(frame.radius) * v.r;
    const az = v.az * Math.PI / 180, pol = v.pol * Math.PI / 180;
    const t = new THREE.Vector3(v.tx || 0, frame.baseY + v.ty, 0);
    return { target: t, pos: new THREE.Vector3(Math.sin(pol) * Math.cos(az), Math.cos(pol), Math.sin(pol) * Math.sin(az)).multiplyScalar(d).add(t) };
  };
  let fly = null;
  const sph = v => new THREE.Spherical().setFromVector3(v);
  function flyTo(pose, dur = 1.25) {
    const fromT = controls.target.clone(), a = sph(camera.position.clone().sub(fromT)), b = sph(pose.pos.clone().sub(pose.target));
    let dTheta = b.theta - a.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    fly = { t: 0, dur, fromT, toT: pose.target.clone(), a, b, dTheta };
  }
  function setView(name, dur) { flyTo(viewPose(VIEWS[subject][name] || name), dur); }
  function finishFly() { if (fly) fly.t = 0.9999; }
  function snapView(name) { const p = viewPose(VIEWS[subject][name] || name); camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); }

  // keep the framing when the engine grows or shrinks (explode slider)
  function setFrame(radius, baseY) {
    const k = radius / frame.radius, dy = baseY - frame.baseY;
    frame.radius = radius; frame.baseY = baseY;
    if (fly) { fly.toT.y += dy; fly.b.radius *= k; return; }
    const off = camera.position.clone().sub(controls.target).multiplyScalar(k);
    controls.target.y += dy;
    camera.position.copy(controls.target).add(off);
  }

  // ------------------------------------------------------------ render modes
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1.56);
  const shellMeshes = [];
  for (const id of SHELL_PARTS) for (const o of engine.parts[id] || []) o.traverse(m => {
    if (m.isMesh && !m.userData.helper) { m.userData.solid = m.material; m.userData.shell = id; shellMeshes.push(m); }
  });
  // every mesh of the car; the outer skin can be ghosted, everything can be cut
  const carMeshes = [];
  {
    const seen = new Set();
    for (const [id, list] of Object.entries(car.parts)) {
      if (id === 'v12') continue;
      for (const o of list) o.traverse(m => {
        if (!m.isMesh || m.userData.helper || seen.has(m)) return;
        seen.add(m);
        Object.assign(m.userData, { solid: m.material, carMesh: id, ghosts: CAR_GHOST.includes(id), cast: m.castShadow, ro: m.renderOrder });
        carMeshes.push(m);
      });
    }
  }
  const clipped = new Map();
  const clipOf = mat => {
    let c = clipped.get(mat);
    if (!c) { c = mat.clone(); clipped.set(mat, c); }
    return c;
  };
  function syncClipped() {
    for (const [src, c] of clipped) {
      c.copy(src);
      c.clippingPlanes = [clipPlane]; c.clipShadows = true; c.side = THREE.DoubleSide; c.needsUpdate = true;
    }
  }
  // stencil counting pass for capped solids
  const stencilBase = { depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: [clipPlane] };
  const stBack = new THREE.MeshBasicMaterial({ ...stencilBase, side: THREE.BackSide, stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp });
  const stFront = new THREE.MeshBasicMaterial({ ...stencilBase, side: THREE.FrontSide, stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp });
  const stencilMeshes = [];
  for (const m of [...shellMeshes, ...carMeshes]) {
    if (!SOLID_PARTS.includes(m.userData.shell) && !CAR_SOLID.includes(m.userData.carMesh)) continue;
    for (const mat of [stBack, stFront]) {
      const h = new THREE.Mesh(m.geometry, mat);
      h.userData.helper = true; h.renderOrder = 1; h.visible = false; h.raycast = () => {}; h.frustumCulled = false;
      m.add(h); stencilMeshes.push(h);
    }
  }
  Object.assign(M.cap, { stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp, side: THREE.DoubleSide });
  M.cap.map.repeat.set(120, 120);
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), M.cap);
  cap.renderOrder = 1.1; cap.visible = false; cap.raycast = () => {}; cap.layers.set(1);
  cap.onAfterRender = r => r.clearStencil();
  scene.add(cap);
  const _n = new THREE.Vector3();
  function placeCap() {
    clipPlane.coplanarPoint(cap.position);
    cap.lookAt(_n.copy(cap.position).sub(clipPlane.normal));
  }

  let mode = 'studio';
  const hidden = new Set();          // part ids switched off
  function applyMaterials() {
    for (const m of shellMeshes) {
      if (mode === 'xray' && subject === 'engine') { m.material = M.ghost; m.castShadow = false; m.renderOrder = 4; }
      else if (mode === 'section') { m.material = clipOf(m.userData.solid); m.castShadow = true; m.renderOrder = 2; }
      else { m.material = m.userData.solid; m.castShadow = true; m.renderOrder = 0; }
    }
    for (const m of carMeshes) {
      if (mode === 'xray' && m.userData.ghosts) { m.material = M.ghost; m.castShadow = false; m.renderOrder = 4; }
      else if (mode === 'section') { m.material = clipOf(m.userData.solid); m.castShadow = m.userData.cast; m.renderOrder = 2; }
      else { m.material = m.userData.solid; m.castShadow = m.userData.cast; m.renderOrder = m.userData.ro; }
    }
    if (mode === 'section') syncClipped();
    for (const h of stencilMeshes) h.visible = mode === 'section';
    cap.visible = mode === 'section';
  }
  function refreshVisible() {
    for (const [id, list] of Object.entries(all)) {
      if (id === 'stand') continue;
      for (const o of list) o.visible = !hidden.has(id) && !o.userData.cutHidden;
    }
  }
  let exploded = false;
  const syncGas = () => engine.setGas(mode !== 'studio' && !exploded);
  function setMode(next) {
    mode = next; applyMaterials(); placeCap();
    engine.setCut(mode === 'section' ? clipPlane : null);
    syncGas(); refreshVisible();
  }
  function setExploded(on) { if (on !== exploded) { exploded = on; syncGas(); } }
  // Swap between the bare engine on its stand and the engine installed in the car.
  function setSubject(next) {
    subject = next;
    if (next === 'car') { car.engineMount.add(engine.root); engine.root.scale.setScalar(1); }
    else { scene.add(engine.root); engine.root.scale.setScalar(0.01); }
    car.root.visible = next === 'car';
    engine.root.visible = true;
    Object.assign(frame, FRAMES[next]);
    controls.minDistance = next === 'car' ? 3.2 : 5;
    setMode(mode);
  }
  function setEngineShown(on) { engine.root.visible = on; }
  function setSection(name, value) {
    const s = SECTIONS[subject][name];
    clipPlane.normal.set(...s.normal).normalize();
    clipPlane.constant = value;
    placeCap();
    if (mode === 'section') { engine.setCut(clipPlane); refreshVisible(); }
  }
  function setExhaustGlow(k) {
    M.exhaust.emissiveIntensity = k;
    const c = clipped.get(M.exhaust); if (c) c.emissiveIntensity = k;
  }
  function setPartVisible(id, on) {
    if (on) hidden.delete(id); else hidden.add(id);
    for (const o of all[id] || []) o.visible = on && !o.userData.cutHidden;
  }

  // ---------------------------------------------------- picking / highlight
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(subject === 'car' ? car.root : engine.root, true);
    let fallback = null;
    for (const h of hits) {
      const o = h.object;
      if (o.userData.helper || !o.userData.part) continue;
      let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) continue;
      const cut = !!o.userData.shell || !!o.userData.carMesh;
      const ghost = subject === 'car' ? !!o.userData.ghosts : !!o.userData.shell;
      if (mode === 'section' && cut && clipPlane.distanceToPoint(h.point) < 0) continue;
      if (mode === 'xray' && ghost) { fallback ??= o.userData.part; continue; }
      return o.userData.part;
    }
    return fallback;
  }
  let glow = [];
  function highlight(id) {
    for (const g of glow) g.parent?.remove(g);
    glow = [];
    if (!id) return;
    for (const o of all[id] || []) o.traverse(m => {
      if (!m.isMesh || m.userData.helper || m.isInstancedMesh) return;
      const g = new THREE.Mesh(m.geometry, M.highlight);
      g.userData.helper = true; g.raycast = () => {}; g.renderOrder = 6;
      m.add(g); glow.push(g);
    });
  }
  const _b = new THREE.Box3(), _sp = new THREE.Sphere();
  function focusPart(id) {
    _b.makeEmpty();
    for (const o of all[id] || []) _b.expandByObject(o);
    if (_b.isEmpty()) return;
    _b.getBoundingSphere(_sp);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const d = Math.max(fitDist(Math.max(_sp.radius, 1.2)) * 0.82, controls.minDistance);
    flyTo({ target: _sp.center.clone(), pos: _sp.center.clone().addScaledVector(dir, d) }, 1.0);
  }

  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f = new THREE.Vector3();
  // Screen position of a callout anchor; hidden when its surface faces away
  // from the camera or sits in the half removed by the section plane.
  function project(obj, out, normal) {
    obj.getWorldPosition(_w);
    if (mode === 'section' && clipPlane.distanceToPoint(_w) < 0.02) { out.visible = false; return out; }
    if (normal) {
      _f.copy(normal).transformDirection(obj.matrixWorld);
      if (_f.dot(_v.copy(camera.position).sub(_w).normalize()) < 0) { out.visible = false; return out; }
    }
    _v.copy(_w).project(camera);
    out.x = (_v.x * 0.5 + 0.5) * size.w; out.y = (-_v.y * 0.5 + 0.5) * size.h;
    out.visible = _v.z < 1 && _v.x > -1 && _v.x < 1 && _v.y > -1 && _v.y < 1;
    return out;
  }

  // ------------------------------------------------------- sizing / quality
  function resize() {
    const w = Math.max(2, container.clientWidth), h = Math.max(2, container.clientHeight);
    if (w === size.w && h === size.h) return;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; applyOffset(); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  resize();

  // Step resolution and effects down if the device can't hold the frame rate.
  const perf = { acc: 0, n: 0, level: lite ? 4 : 0, cool: 0 };
  function adapt(dt) {
    perf.acc += dt; perf.n++;
    if (perf.n < 50) return;
    const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
    if (perf.cool > 0) { perf.cool--; return; }
    if (avg > 0.036 && perf.level < 4) {
      perf.level++; perf.cool = 2;
      if (perf.level === 1) pixelRatio = Math.min(pixelRatio, 1.25);
      else if (perf.level === 2) setMirror(false);
      else if (perf.level === 3) pixelRatio = Math.min(pixelRatio, 1);
      else if (perf.level === 4) { bloom.enabled = false; pixelRatio = 0.8; }
      renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio);
      composer.setSize(size.w, size.h);
    }
  }

  let pulse = 0;
  function render(dt, measure = true) {
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - Math.pow(-2 * fly.t + 2, 3) / 2;
      const s = new THREE.Spherical(
        fly.a.radius + (fly.b.radius - fly.a.radius) * k,
        fly.a.phi + (fly.b.phi - fly.a.phi) * k,
        fly.a.theta + fly.dTheta * k);
      controls.target.lerpVectors(fly.fromT, fly.toT, k);
      camera.position.setFromSpherical(s).add(controls.target);
      if (fly.t >= 1) fly = null;
    }
    controls.update(dt);
    pulse += dt;
    M.highlight.opacity = 0.2 + 0.14 * Math.sin(pulse * 4.2);
    const fade = engine.parts.stand[0].userData.fade;
    for (const o of engine.parts.stand) o.visible = !fade && !hidden.has('stand') && subject === 'engine';
    composer.render(dt);
    if (measure) adapt(dt);
  }

  controls.addEventListener('start', () => { fly = null; });

  return {
    renderer, scene, camera, controls, size, mobile,
    render, setView, snapView, setFrame, setInsets, setExploded, finishFly, flyTo, viewPose,
    setMode, setSection, setSubject, setEngineShown, setExhaustGlow, setPartVisible, syncClipped,
    pick, highlight, focusPart, project,
    get mode() { return mode; },
    get subject() { return subject; },
    get perfLevel() { return perf.level; },
  };
}
