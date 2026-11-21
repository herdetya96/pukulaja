// Procedural surface textures, all drawn to canvases at load. No image assets.
import * as THREE from '../vendor/three.bundle.min.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// small deterministic PRNG so the surfaces are identical on every load
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Sand-cast grain: layered value noise, used as a bump and roughness map.
export function castGrain(size = 256, seed = 7) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const img = g.createImageData(size, size);
  const layers = [1, 2, 4].map(scale => {
    const n = size / scale, a = new Float32Array(n * n);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return { n, a, scale };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, wsum = 0;
    for (const [i, L] of layers.entries()) {
      const w = [0.5, 0.3, 0.2][i];
      const fx = x / L.scale, fy = y / L.scale;
      const x0 = Math.floor(fx) % L.n, y0 = Math.floor(fy) % L.n;
      const x1 = (x0 + 1) % L.n, y1 = (y0 + 1) % L.n;
      const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      const a = L.a[y0 * L.n + x0], b = L.a[y0 * L.n + x1], cc = L.a[y1 * L.n + x0], d = L.a[y1 * L.n + x1];
      v += w * (a + (b - a) * tx + (cc - a) * ty + (a - b - cc + d) * tx * ty);
      wsum += w;
    }
    const k = Math.round(255 * v / wsum);
    const o = (y * size + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = k; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Wrinkle paint: worm-like ridges, the finish on classic Italian cam covers.
export function crackle(size = 256, seed = 11) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const shade = 120 + Math.floor(r() * 135);
    g.strokeStyle = `rgb(${shade},${shade},${shade})`;
    g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, y);
    const steps = 3 + Math.floor(r() * 5);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 1.9;
      x += Math.cos(a) * 3.2; y += Math.sin(a) * 3.2;
      g.lineTo(x, y);
    }
    g.stroke();
    // wrap-around copies keep the tile seamless
    if (x < 8 || y < 8 || x > size - 8 || y > size - 8) {
      g.save(); g.translate(x < size / 2 ? size : -size, 0); g.stroke(); g.restore();
      g.save(); g.translate(0, y < size / 2 ? size : -size); g.stroke(); g.restore();
    }
  }
  return c;
}

// 2×2 twill carbon weave: colour and bump.
export function carbon(size = 128) {
  const [c, g] = canvas(size, size);
  const [b, gb] = canvas(size, size);
  const n = 8, cell = size / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const warp = ((i + j) % 4) < 2;
    const x = i * cell, y = j * cell;
    const grad = warp ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell);
    grad.addColorStop(0, '#0b0c0e'); grad.addColorStop(0.5, warp ? '#3c3f45' : '#2a2c31'); grad.addColorStop(1, '#0b0c0e');
    g.fillStyle = grad; g.fillRect(x, y, cell, cell);
    const gr2 = warp ? gb.createLinearGradient(x, y, x + cell, y) : gb.createLinearGradient(x, y, x, y + cell);
    gr2.addColorStop(0, '#404040'); gr2.addColorStop(0.5, '#d0d0d0'); gr2.addColorStop(1, '#404040');
    gb.fillStyle = gr2; gb.fillRect(x, y, cell, cell);
  }
  return [c, b];
}

// Fine directional scratches for brushed and turned metal.
export function brushed(size = 256, seed = 3) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const y = r() * size, x = r() * size, len = 30 + r() * 180, s = 90 + Math.floor(r() * 110);
    g.strokeStyle = `rgba(${s},${s},${s},${0.25 + r() * 0.4})`;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    g.beginPath(); g.moveTo(x - size, y); g.lineTo(x + len - size, y); g.stroke();
  }
  return c;
}

// Titanium heat tint along a pipe: straw, purple and blue bands near the port,
// fading to bare metal.
export function heatTint() {
  const [c, g] = canvas(512, 4);
  const grad = g.createLinearGradient(0, 0, 512, 0);
  const stops = [
    [0.00, '#6f7d9c'], [0.05, '#3f62b8'], [0.11, '#5b47a8'], [0.17, '#8f4a8c'], [0.24, '#b98a4a'],
    [0.33, '#cdb27a'], [0.46, '#bdb6a8'], [0.72, '#b4b0a8'], [0.84, '#c2a878'], [0.9, '#8d5a96'],
    [0.95, '#4a66b4'], [1.0, '#8a93a6'],
  ];
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad; g.fillRect(0, 0, 512, 4);
  return c;
}

// Where a manifold glows: hottest just downstream of the port and at the merge.
export function heatGlow() {
  const [c, g] = canvas(256, 4);
  const grad = g.createLinearGradient(0, 0, 256, 0);
  const stops = [[0, '#1c0400'], [0.07, '#ff6a14'], [0.2, '#d83a06'], [0.42, '#7a1600'], [0.7, '#360800'], [0.88, '#5a0f00'], [1, '#220500']];
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 4);
  return c;
}

// Roller chain: one pitch per tile.
export function chainLinks() {
  const [c, g] = canvas(64, 32);
  g.fillStyle = '#17181b'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#8b8e94';
  g.beginPath(); g.roundRect(3, 2, 58, 9, 4); g.fill();
  g.beginPath(); g.roundRect(3, 21, 58, 9, 4); g.fill();
  g.fillStyle = '#c9ccd1';
  g.beginPath(); g.arc(14, 16, 6.5, 0, 7); g.fill();
  g.beginPath(); g.arc(50, 16, 6.5, 0, 7); g.fill();
  g.fillStyle = '#2b2d31';
  g.beginPath(); g.arc(14, 16, 2.4, 0, 7); g.fill();
  g.beginPath(); g.arc(50, 16, 2.4, 0, 7); g.fill();
  return c;
}

// 45° section hatching for cut faces.
export function hatch() {
  const s = 64;
  const [c, g] = canvas(s, s);
  g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#3c3a36'; g.lineWidth = 3.2;
  for (let i = -s; i < s * 2; i += 16) {
    g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke();
  }
  return c;
}

// Nameplate for the plenum / cover.
export function badge(title = 'TIPO 600', sub = 'V12 · 6.0') {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#0d0e10'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#c8cbd0'; g.lineWidth = 3; g.strokeRect(5, 5, 502, 118);
  g.fillStyle = '#e4e6ea';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 54px "Syncopate", "Arial Black", Arial, sans-serif';
  g.fillText(title, 256, 52, 470);
  g.font = '500 24px "JetBrains Mono", ui-monospace, monospace';
  g.fillStyle = '#ffb454';
  g.fillText(sub, 256, 98, 470);
  return c;
}

// Soft radial falloff used under the engine and to fade the floor into the void.
export function radial(inner = 'rgba(0,0,0,1)', outer = 'rgba(0,0,0,0)', size = 256, mid = 0.5) {
  const [c, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner); grad.addColorStop(mid, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return c;
}

export { tex };
