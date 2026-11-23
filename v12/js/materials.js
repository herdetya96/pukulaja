// Material library. Keys are referenced by the geometry builders; finishes
// from the configurator mutate a handful of these in place.
import * as THREE from '../vendor/three.bundle.min.js';
import * as T from './textures.js';
import { FINISHES } from './config.js';

const std = o => new THREE.MeshStandardMaterial(o);

export function createMaterials() {
  const grain = T.castGrain();
  const castBump = T.tex(grain, { repeat: [0.03, 0.03] });
  const castBumpUnit = T.tex(grain, { repeat: [3, 3] });
  const crackleC = T.crackle();
  const crackleBump = T.tex(crackleC, { repeat: [0.045, 0.045] });
  const [carbonC, carbonB] = T.carbon();
  const carbonMap = T.tex(carbonC, { srgb: true, repeat: [0.05, 0.05] });
  const carbonBump = T.tex(carbonB, { repeat: [0.05, 0.05] });
  const brushC = T.brushed();
  const brushRough = T.tex(brushC, { repeat: [2, 2] });
  const heatMap = T.tex(T.heatTint(), { srgb: true });
  const glowMap = T.tex(T.heatGlow(), { srgb: true });
  const chainMap = T.tex(T.chainLinks(), { srgb: true });
  const hatchMap = T.tex(T.hatch(), { srgb: true, repeat: [60, 60] });

  const M = {
    // castings
    cast: std({ color: '#aeb1b5', metalness: 0.82, roughness: 0.58, bumpMap: castBump, bumpScale: 1.4, roughnessMap: castBump }),
    castHead: std({ color: '#b6b9bd', metalness: 0.82, roughness: 0.55, bumpMap: castBump, bumpScale: 1.2, roughnessMap: castBump }),
    castDark: std({ color: '#5b5e63', metalness: 0.8, roughness: 0.6, bumpMap: castBump, bumpScale: 1.4 }),
    machined: std({ color: '#d3d6da', metalness: 1, roughness: 0.24 }),
    liner: std({ color: '#7d8187', metalness: 1, roughness: 0.2 }),
    gasket: std({ color: '#6c6f76', metalness: 1, roughness: 0.34 }),
    // rotating assembly
    forged: std({ color: '#72767c', metalness: 1, roughness: 0.4 }),
    journal: std({ color: '#e6e8ec', metalness: 1, roughness: 0.07 }),
    titanium: std({ color: '#9a9488', metalness: 1, roughness: 0.3 }),
    piston: std({ color: '#c7c9cc', metalness: 1, roughness: 0.34 }),
    pistonCrown: std({ color: '#55575b', metalness: 0.7, roughness: 0.55 }),
    ring: std({ color: '#2c2e32', metalness: 1, roughness: 0.28 }),
    steel: std({ color: '#b9bcc1', metalness: 1, roughness: 0.22 }),
    steelDark: std({ color: '#3d4046', metalness: 1, roughness: 0.36 }),
    // valvetrain
    cam: std({ color: '#a3a6ac', metalness: 1, roughness: 0.2 }),
    valveIn: std({ color: '#c9cbd0', metalness: 1, roughness: 0.18 }),
    valveEx: std({ color: '#a89684', metalness: 1, roughness: 0.3 }),
    spring: std({ color: '#3b5a9a', metalness: 0.9, roughness: 0.32 }),
    bucket: std({ color: '#d7d9dc', metalness: 1, roughness: 0.12 }),
    chain: std({ color: '#ffffff', metalness: 0.9, roughness: 0.38, map: chainMap }),
    // dress
    cover: std({ color: '#a01310', metalness: 0.05, roughness: 0.62, bumpMap: crackleBump, bumpScale: 2.2 }),
    coverRib: std({ color: '#dfe1e5', metalness: 1, roughness: 0.14 }),
    stack: std({ color: '#dfe2e6', metalness: 1, roughness: 0.09 }),
    throttle: std({ color: '#c2c5ca', metalness: 1, roughness: 0.3 }),
    brass: std({ color: '#c8a04a', metalness: 1, roughness: 0.26 }),
    anoBlue: std({ color: '#1d4fb0', metalness: 1, roughness: 0.3 }),
    anoRed: std({ color: '#b3201b', metalness: 1, roughness: 0.3 }),
    rail: std({ color: '#2a2c30', metalness: 1, roughness: 0.34 }),
    plastic: std({ color: '#0e0f11', metalness: 0, roughness: 0.62 }),
    rubber: std({ color: '#0b0b0c', metalness: 0, roughness: 0.9 }),
    ceramic: std({ color: '#e8e4da', metalness: 0, roughness: 0.35 }),
    bolt: std({ color: '#c0c3c8', metalness: 1, roughness: 0.3 }),
    exhaust: std({ color: '#ffffff', metalness: 1, roughness: 0.3, map: heatMap, emissive: '#ffffff', emissiveMap: glowMap, emissiveIntensity: 0 }),
    exhaustFlange: std({ color: '#8e8c88', metalness: 1, roughness: 0.4 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: carbonMap, bumpMap: carbonBump, bumpScale: 0.6, metalness: 0.2, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08 }),
    stand: std({ color: '#6f7379', metalness: 1, roughness: 0.34, roughnessMap: brushRough }),
    standDark: std({ color: '#131417', metalness: 0.6, roughness: 0.5 }),
    badge: std({ color: '#ffffff', metalness: 0.4, roughness: 0.4, map: T.tex(T.badge(), { srgb: true }) }),
  };

  // ---- car ----
  const hexMap = T.tex(T.hexMesh(), { srgb: true, repeat: [1.1, 1.27] });
  const phys = o => new THREE.MeshPhysicalMaterial(o);
  const flakeMap = T.tex(T.flake(), { repeat: [22, 22] });
  Object.assign(M, {
    paint: phys({ color: '#7d0a0c', metalness: 0.2, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: flakeMap, normalScale: new THREE.Vector2(0.14, 0.14) }),
    roof: phys({ color: '#7d0a0c', metalness: 0.2, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: flakeMap, normalScale: new THREE.Vector2(0.14, 0.14) }),
    carGlass: phys({ color: '#05080b', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.66, depthWrite: false, envMapIntensity: 1.6 }),
    gloss: std({ color: '#050506', metalness: 0.2, roughness: 0.1 }),
    carUnder: std({ color: '#0a0a0b', metalness: 0, roughness: 0.88 }),
    archLiner: std({ color: '#0a0a0b', metalness: 0, roughness: 0.92, side: THREE.DoubleSide }),
    carSill: std({ color: '#0d0e10', metalness: 0.35, roughness: 0.42 }),
    vent: std({ color: '#ffffff', metalness: 0.5, roughness: 0.55, map: hexMap }),
    grille: std({ color: '#ffffff', metalness: 0.5, roughness: 0.5, map: hexMap }),
    lens: std({ color: '#0b0d12', metalness: 0.5, roughness: 0.04 }),
    lampGlass: phys({ color: '#c9d6e2', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.7 }),
    lampBucket: std({ color: '#060709', metalness: 0.7, roughness: 0.4 }),
    amber: std({ color: '#ff9a1a', emissive: '#ff7a00', emissiveIntensity: 0.5, metalness: 0, roughness: 0.25 }),
    plate: std({ color: '#ffffff', metalness: 0, roughness: 0.5, map: T.tex(T.regPlate(), { srgb: true }) }),
    tacho: new THREE.MeshBasicMaterial({ map: T.tex(T.tacho(), { srgb: true }) }),
    heatShield: std({ color: '#c9b37a', metalness: 1, roughness: 0.32, bumpMap: castBumpUnit, bumpScale: 1.2 }),
    lampLens: std({ color: '#f4f8ff', metalness: 0.9, roughness: 0.05, emissive: '#dfeaff', emissiveIntensity: 3.4 }),
    capBadge: std({ color: '#e0b000', metalness: 0.3, roughness: 0.3 }),
    quilt: std({ color: '#17181a', metalness: 0, roughness: 0.92, bumpMap: T.tex(T.quilt(), { repeat: [5, 5] }), bumpScale: 6 }),
    tail: std({ color: '#3a0306', metalness: 0.3, roughness: 0.08, emissive: '#ff1408', emissiveIntensity: 0.25 }),
    drl: std({ color: '#ffffff', emissive: '#e4ecff', emissiveIntensity: 6, side: THREE.DoubleSide }),
    tailLit: std({ color: '#5a0000', emissive: '#e60000', emissiveIntensity: 1.5, side: THREE.DoubleSide }),
    gap: std({ color: '#020202', metalness: 0, roughness: 1 }),
    chrome: std({ color: '#eceef2', metalness: 1, roughness: 0.05 }),
    mirror: std({ color: '#dfe6ee', metalness: 1, roughness: 0.02 }),
    liner: std({ color: '#151517', metalness: 0, roughness: 0.96 }),
    tyre: std({ color: '#0d0d0e', metalness: 0, roughness: 0.9, bumpMap: T.tex(T.tread(), { repeat: [56, 1] }), bumpScale: 5 }),
    harness: std({ color: '#9a1410', metalness: 0, roughness: 0.8 }),
    tyreText: std({ color: '#ffffff', metalness: 0, roughness: 0.8, map: T.tex(T.tyreRing(), { srgb: true }), alphaTest: 0.35 }),
    rim: std({ color: '#b9bcc2', metalness: 1, roughness: 0.2 }),
    disc: std({ color: '#3a3c40', metalness: 0.55, roughness: 0.55 }),
    caliper: phys({ color: '#b3120e', metalness: 0.2, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    damper: std({ color: '#c9a227', metalness: 1, roughness: 0.3 }),
    coilSpring: std({ color: '#b3120e', metalness: 0.4, roughness: 0.4 }),
    radiator: std({ color: '#ffffff', metalness: 0.8, roughness: 0.5, map: T.tex(T.fins(), { srgb: true, repeat: [1, 60] }) }),
    leather: std({ color: '#8a4b25', metalness: 0, roughness: 0.5, bumpMap: castBumpUnit, bumpScale: 1.6 }),
    alcantara: std({ color: '#17181a', metalness: 0, roughness: 0.97 }),
    carpet: std({ color: '#0e0e10', metalness: 0, roughness: 1 }),
    screen: new THREE.MeshBasicMaterial({ map: T.tex(T.cluster(), { srgb: true }) }),
  });

  // cut faces in section mode
  M.cap = std({ color: '#ffffff', metalness: 0.1, roughness: 0.8, map: hatchMap });

  // x-ray shell: additive fresnel rim, no depth write
  M.ghost = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#9fc4ff') }, uPower: { value: 3.0 }, uBase: { value: 0.006 }, uGain: { value: 0.34 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      #include <common>
      void main(){
        vec3 p = position; vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(p, 1.0)).xyz;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uPower; uniform float uBase; uniform float uGain;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor * (uBase + f * uGain), 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });

  M.highlight = new THREE.MeshBasicMaterial({
    color: '#ffb454', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  for (const [k, m] of Object.entries(M)) m.name = k;
  M._tex = { castBump, castBumpUnit, crackleBump, heatMap, glowMap, chainMap, hatchMap };
  return M;
}

export function applyFinish(M, group, id) {
  const opt = FINISHES[group].options.find(o => o.id === id);
  if (!opt) return null;
  const col = new THREE.Color(opt.color);
  if (group === 'covers') {
    M.cover.color.copy(col);
    if (opt.kind === 'cast') {
      M.cover.metalness = 0.82; M.cover.roughness = 0.56; M.cover.bumpMap = M._tex.castBump; M.cover.bumpScale = 1.4;
    } else {
      M.cover.metalness = 0.05; M.cover.roughness = 0.62; M.cover.bumpMap = M._tex.crackleBump; M.cover.bumpScale = 2.2;
    }
    M.cover.needsUpdate = true;
  } else if (group === 'block') {
    M.cast.color.copy(col); M.cast.roughness = opt.rough;
    M.castHead.color.copy(col).offsetHSL(0, 0, 0.025); M.castHead.roughness = opt.rough - 0.03;
  } else if (group === 'intake') {
    if (!opt.airbox) { M.stack.color.copy(col); M.stack.roughness = opt.rough; }
  } else if (group === 'paint') {
    M.paint.color.copy(col); M.paint.metalness = opt.metal ?? 0.2; M.paint.roughness = opt.rough ?? 0.5;
    M.paint.normalScale.setScalar(0.06 + 0.2 * M.paint.metalness); M.roof.normalScale.copy(M.paint.normalScale);
    if (!M.roof.userData.contrast) { M.roof.color.copy(col); M.roof.metalness = M.paint.metalness; M.roof.roughness = M.paint.roughness; }
  } else if (group === 'roof') {
    M.roof.userData.contrast = !!opt.contrast;
    if (opt.contrast) { M.roof.color.copy(col); M.roof.metalness = 0.2; M.roof.roughness = 0.12; }
    else { M.roof.color.copy(M.paint.color); M.roof.metalness = M.paint.metalness; M.roof.roughness = M.paint.roughness; }
  } else if (group === 'wheels') {
    M.rim.color.copy(col); M.rim.roughness = opt.rough; M.rim.metalness = opt.metal ?? 1;
  } else if (group === 'calipers') {
    M.caliper.color.copy(col);
  } else if (group === 'interior') {
    M.leather.color.copy(col);
  } else if (group === 'exhaust') {
    M.exhaust.color.set(opt.tint ? '#ffffff' : opt.color);
    M.exhaust.map = opt.tint ? M._tex.heatMap : null;
    M.exhaust.roughness = opt.rough;
    M.exhaust.metalness = opt.metal ?? 1;
    M.exhaust.needsUpdate = true;
  }
  return opt;
}
