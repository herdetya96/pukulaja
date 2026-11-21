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
  } else if (group === 'exhaust') {
    M.exhaust.color.set(opt.tint ? '#ffffff' : opt.color);
    M.exhaust.map = opt.tint ? M._tex.heatMap : null;
    M.exhaust.roughness = opt.rough;
    M.exhaust.metalness = opt.metal ?? 1;
    M.exhaust.needsUpdate = true;
  }
  return opt;
}
