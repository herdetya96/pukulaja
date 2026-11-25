/* Slash Photo — on-device photo engine.
   WebGL does the pixel work (lens, tone, colour, light, texture); a 2D canvas adds frames and overlays.
   Every look is just a set of the parameters declared in PARAMS, so every look is editable. */
(() => {
  'use strict';

  /* ───────── parameter schema (drives both the shader and the slider UI) ───────── */
  const R = (k, g, l, min, max, d = 0) => ({ k, g, l, t: 'range', min, max, d });
  const C = (k, g, l, d) => ({ k, g, l, t: 'color', d });
  const S = (k, g, l, opts, d = opts[0][0]) => ({ k, g, l, t: 'select', opts, d });
  const T = (k, g, l, d = '') => ({ k, g, l, t: 'text', d });
  const B = (k, g, l) => ({ k, g, l, t: 'bool', d: false });

  const GROUPS = [['light', 'Cahaya'], ['color', 'Warna'], ['detail', 'Detail'], ['lens', 'Lensa'], ['fx', 'Sinar'], ['tex', 'Tekstur'], ['frame', 'Bingkai']];
  const PARAMS = [
    R('exposure', 'light', 'Eksposur', -100, 100), R('contrast', 'light', 'Kontras', -100, 100),
    R('highlights', 'light', 'Sorotan', -100, 100), R('shadows', 'light', 'Bayangan', -100, 100), R('fade', 'light', 'Pudar', 0, 100),

    R('temp', 'color', 'Suhu', -100, 100), R('tint', 'color', 'Rona', -100, 100),
    R('saturation', 'color', 'Saturasi', -100, 100), R('vibrance', 'color', 'Vibrance', -100, 100), R('hue', 'color', 'Geser warna', -180, 180),
    R('bw', 'color', 'Hitam putih', 0, 100), B('invert', 'color', 'Negatif'),
    R('colorize', 'color', 'Satu warna', 0, 100), C('colorizeColor', 'color', 'Warna tunggal', '#c2412d'),
    R('splitAmt', 'color', 'Split tone', 0, 100), C('splitShadow', 'color', 'Warna bayangan', '#0c5f73'), C('splitHigh', 'color', 'Warna sorotan', '#ffb066'),
    R('posterize', 'color', 'Poster', 0, 100),

    R('sharpen', 'detail', 'Ketajaman', 0, 100), R('soft', 'detail', 'Lembut', 0, 100), R('glow', 'detail', 'Glow', 0, 100),
    R('grain', 'detail', 'Grain', 0, 100), R('vignette', 'detail', 'Vignette', -100, 100), R('chroma', 'detail', 'Pecah RGB', 0, 100),
    R('pixelate', 'detail', 'Piksel', 0, 100), R('halftone', 'detail', 'Halftone', 0, 100),
    R('edge', 'detail', 'Garis tepi', 0, 100), C('edgeColor', 'detail', 'Warna tepi', '#ffe2b0'),

    S('crop', 'lens', 'Potong', [['', 'Asli'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:4', '3:4'], ['9:16', '9:16'], ['4:3', '4:3'], ['3:2', '3:2'], ['16:9', '16:9'], ['21:9', '21:9']]),
    R('rotate', 'lens', 'Miring', -45, 45), R('zoom', 'lens', 'Zoom', 0, 100), R('distort', 'lens', 'Distorsi lensa', -100, 100),
    S('mirror', 'lens', 'Cermin', [['none', 'Tidak'], ['flip', 'Balik'], ['split', 'Simetris'], ['quad', 'Empat cermin'], ['reflect', 'Pantulan air']]),
    R('tilt', 'lens', 'Tilt-shift', 0, 100), R('tiltPos', 'lens', 'Posisi fokus', 0, 100, 50), R('focus', 'lens', 'Blur tepi', 0, 100),
    R('motion', 'lens', 'Blur gerak', 0, 100), R('motionAngle', 'lens', 'Arah gerak', 0, 180), R('zoomBlur', 'lens', 'Blur zoom', 0, 100),
    R('keep', 'lens', 'Tengah tetap tajam', 0, 100),

    R('spot', 'fx', 'Lampu sorot', 0, 100), R('spotX', 'fx', 'Sorot X', 0, 100, 50), R('spotY', 'fx', 'Sorot Y', 0, 100, 40), R('spotSize', 'fx', 'Ukuran sorot', 0, 100, 50),
    R('flash', 'fx', 'Flash', 0, 100), R('winlight', 'fx', 'Cahaya jendela', 0, 100),
    R('flare', 'fx', 'Flare matahari', 0, 100), R('flareX', 'fx', 'Flare X', 0, 100, 80), R('flareY', 'fx', 'Flare Y', 0, 100, 16),
    R('leak', 'fx', 'Light leak', 0, 100), C('leakColor', 'fx', 'Warna leak', '#ff4a1f'),
    S('leakSide', 'fx', 'Sisi leak', [['left', 'Kiri'], ['right', 'Kanan'], ['top', 'Atas'], ['bottom', 'Bawah'], ['corner', 'Pojok']]),
    R('neon', 'fx', 'Neon', 0, 100), C('neonA', 'fx', 'Neon kiri', '#ff2bd6'), C('neonB', 'fx', 'Neon kanan', '#19e3ff'),
    R('fog', 'fx', 'Kabut', 0, 100), C('fogColor', 'fx', 'Warna kabut', '#c5ccd2'),
    R('dots', 'fx', 'Titik disko', 0, 100), R('prism', 'fx', 'Prisma', 0, 100), R('ghost', 'fx', 'Eksposur ganda', 0, 100),

    R('scan', 'tex', 'Garis scan', 0, 100), R('tracking', 'tex', 'Gangguan VHS', 0, 100),
    R('rain', 'tex', 'Hujan', 0, 100), R('snow', 'tex', 'Salju', 0, 100), R('bubbles', 'tex', 'Gelembung', 0, 100), R('caustic', 'tex', 'Riak air', 0, 100),
    S('pattern', 'tex', 'Pola bayangan', [['none', 'Tidak'], ['blinds', 'Kerai'], ['stripes', 'Garis'], ['grid', 'Jendela'], ['dapple', 'Dedaunan']]),
    R('patternAmt', 'tex', 'Kuat bayangan', 0, 100), R('patternAngle', 'tex', 'Sudut bayangan', -90, 90), R('dust', 'tex', 'Debu & gores', 0, 100),

    S('frame', 'frame', 'Bingkai', [['none', 'Tidak'], ['border', 'Garis tepi'], ['polaroid', 'Instan'], ['letterbox', 'Sinema'], ['postcard', 'Kartu pos'],
      ['cover', 'Sampul majalah'], ['headline', 'Sampul tebal'], ['campaign', 'Kampanye'], ['album', 'Sampul album'], ['strip', 'Strip photobooth'],
      ['sheet', 'Contact sheet 3×3'], ['film', 'Strip film'], ['globe', 'Bola salju'], ['collage', 'Kolase kertas']]),
    C('frameColor', 'frame', 'Warna bingkai', '#f7f4ec'), R('frameSize', 'frame', 'Tebal bingkai', 0, 100, 40),
    T('text1', 'frame', 'Teks 1'), T('text2', 'frame', 'Teks 2'), T('text3', 'frame', 'Teks 3 ( | = baris baru)'), C('textColor', 'frame', 'Warna teks', '#ffffff'),
    S('osd', 'frame', 'Tampilan kamera', [['none', 'Tidak'], ['date', 'Cap tanggal'], ['vhs', 'VHS'], ['camcorder', 'Camcorder'], ['cctv', 'CCTV']]),
    T('osdText', 'frame', 'Teks kamera (kosong = otomatis)'),
  ];
  const BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.k, p]));
  const defaults = () => Object.fromEntries(PARAMS.map((p) => [p.k, p.d]));

  /** Keep only known keys with valid values — used on anything user-supplied (imports, JSON edits). */
  function sanitize(recipe) {
    const out = {};
    if (!recipe || typeof recipe !== 'object') return out;
    for (const [k, v] of Object.entries(recipe)) {
      const p = BY_KEY[k];
      if (!p) continue;
      if (p.t === 'range' && Number.isFinite(Number(v))) out[k] = Math.min(p.max, Math.max(p.min, Number(v)));
      else if (p.t === 'bool') out[k] = !!v;
      else if (p.t === 'color' && /^#[0-9a-f]{6}$/i.test(v)) out[k] = v;
      else if (p.t === 'select' && p.opts.some(([o]) => o === v)) out[k] = v;
      else if (p.t === 'text') out[k] = String(v).slice(0, 160);
    }
    return out;
  }
  /** Only the values that differ from neutral — what gets stored on an effect. */
  function compact(params) {
    const out = {};
    for (const p of PARAMS) if (params[p.k] !== undefined && params[p.k] !== p.d) out[p.k] = params[p.k];
    return out;
  }
  /** Blend a recipe toward neutral: strength 0 = original photo, 100 = full effect. */
  function withStrength(params, strength) {
    const s = strength / 100;
    if (s >= 1) return params;
    const out = { ...params };
    for (const p of PARAMS) if (p.t === 'range' && !/X$|Y$|Pos$|Angle$|Size$/.test(p.k)) out[p.k] = p.d + (params[p.k] - p.d) * s;
    return out;
  }

  /* ───────── shaders ───────── */
  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }';

  const FS_GEO = `precision highp float;
varying vec2 v; uniform sampler2D S; uniform vec4 crop;
uniform float aspect, rot, zoom, distort, mirror, pixel;
void main(){
  vec2 uv = v; float refl = 0.;
  if (mirror > 3.5) {
    float qy = 1. - uv.y;
    if (qy > .58) { float d = qy - .58; qy = .58 - d*1.25; uv.x += sin(d*70.)*.012*d*3.; refl = .25 + d*1.2; }
    uv.y = 1. - (qy + .21);
  } else if (mirror > 2.5) { uv = .5 + (abs(uv - .5) - .25); }
  else if (mirror > 1.5) { uv.x = .5 - abs(uv.x - .5); }
  else if (mirror > .5) { uv.x = 1. - uv.x; }
  vec2 c = (uv - .5) * vec2(aspect, 1.);
  float cs = cos(rot), sn = sin(rot);
  c = vec2(c.x*cs - c.y*sn, c.x*sn + c.y*cs) / zoom;
  float rmax = length(vec2(aspect, 1.) * .5);
  vec2 n = c / rmax; float r2 = dot(n, n);
  if (distort > 0.) n *= (1. + distort*r2) / (1. + distort); else n *= 1. + distort*r2*.5;
  uv = n * rmax / vec2(aspect, 1.) + .5;
  if (pixel > 0.) { vec2 cells = vec2(pixel*aspect, pixel); uv = (floor(uv*cells) + .5) / cells; }
  uv = clamp(uv, 0., 1.);
  vec3 col = texture2D(S, crop.xy + uv*crop.zw).rgb;
  col = mix(col, col*vec3(.55,.68,.8), clamp(refl, 0., .8));
  gl_FragColor = vec4(col, 1.);
}`;

  const FS_COPY = 'precision mediump float; varying vec2 v; uniform sampler2D T; void main(){ gl_FragColor = texture2D(T, v); }';
  const FS_BLUR = `precision mediump float; varying vec2 v; uniform sampler2D T; uniform vec2 d;
void main(){
  vec3 c = texture2D(T, v).rgb*.227027;
  c += (texture2D(T, v+d*1.3846).rgb + texture2D(T, v-d*1.3846).rgb)*.316216;
  c += (texture2D(T, v+d*3.2308).rgb + texture2D(T, v-d*3.2308).rgb)*.070270;
  gl_FragColor = vec4(c, 1.);
}`;

  const FS_FINAL = `precision highp float;
varying vec2 v; uniform sampler2D T, B;
uniform float aspect, seed, grainCells;
uniform float exposure, contrast, highlights, shadows, fade, temp, tint, saturation, vibrance, hue, bw, invert, colorize, splitAmt, posterize;
uniform vec3 colorizeColor, splitShadow, splitHigh, edgeColor, leakColor, neonA, neonB, fogColor;
uniform float sharpen, soft, glow, grain, vignette, chroma, edge, halftone;
uniform float tilt, tiltPos, focus, motion, motionAngle, zoomBlur, keep;
uniform float spot, spotX, spotY, spotSize, flash, winlight, flare, flareX, flareY, leak, leakSide, neon, fog, dots, prism, ghost;
uniform float scan, tracking, rain, snow, bubbles, caustic, pattern, patternAmt, patternAngle, dust;

float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1.,0.)), f.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + 7.1; a *= .5; } return s; }
float luma(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
vec3 hsv(float h){ return clamp(abs(mod(h*6. + vec3(0.,4.,2.), 6.) - 3.) - 1., 0., 1.); }
vec3 scr(vec3 a, vec3 b){ return 1. - (1. - a)*(1. - clamp(b, 0., 1.)); }
vec3 base(vec2 uv){ return texture2D(T, clamp(uv, 0., 1.)).rgb; }

void main(){
  vec2 uv = v;
  vec2 q = vec2(v.x, 1. - v.y);                     // top-left origin
  vec2 asp = vec2(aspect, 1.);
  vec2 cc = (v - .5)*asp;
  float rad = length(cc) / length(asp*.5);          // 0 centre → 1 corner

  if (tracking > 0.) {
    float band = 1. - smoothstep(0., .035, abs(q.y - .88));
    uv.x += (vnoise(vec2(q.y*90., seed)) - .5)*.014*tracking + band*.06*tracking*(vnoise(vec2(q.y*420., 3.)) - .3);
  }

  vec3 col = base(uv);
  if (motion > 0. || zoomBlur > 0.) {
    vec2 dir = vec2(cos(motionAngle), sin(motionAngle))*motion*.07/asp;
    vec3 acc = vec3(0.);
    for (int i = 0; i < 16; i++) { float t = float(i)/15. - .5; acc += base(uv + dir*t + (uv - .5)*zoomBlur*.22*t); }
    float k = keep > 0. ? smoothstep(keep*.42, keep*.42 + .28, length(cc)) : 1.;
    col = mix(col, acc/16., k);
  } else if (chroma > 0.) {
    vec2 d = (uv - .5)*chroma*.035 + vec2(chroma*.004, 0.);
    col.r = base(uv + d).r; col.b = base(uv - d).b;
  }

  vec3 bl = texture2D(B, clamp(uv, 0., 1.)).rgb;
  if (sharpen > 0.) col += (col - bl)*sharpen*1.3;
  float sm = soft;
  if (tilt > 0.) sm = max(sm, tilt*smoothstep(.06, .38, abs(q.y - tiltPos)));
  if (focus > 0.) sm = max(sm, focus*smoothstep(.16, .72, rad));
  col = mix(col, bl, clamp(sm, 0., 1.));
  if (glow > 0.) { vec3 g = bl*bl; col += g*glow*.6 - col*g*glow*.3; }

  if (ghost > 0.) { vec3 gc = base((uv - .5)*vec2(-.74, .74) + .5); col = mix(col, scr(col, gc), ghost*.9); }

  if (edge > 0.) {
    vec2 px = vec2(1./aspect, 1.)*.0018;
    float a = luma(base(uv + px*vec2(-1.,-1.))), b = luma(base(uv + px*vec2(0.,-1.))), c = luma(base(uv + px*vec2(1.,-1.)));
    float d = luma(base(uv + px*vec2(-1.,0.))), e = luma(base(uv + px*vec2(1.,0.)));
    float f = luma(base(uv + px*vec2(-1.,1.))), g = luma(base(uv + px*vec2(0.,1.))), h = luma(base(uv + px*vec2(1.,1.)));
    float ed = length(vec2(-a - 2.*d - f + c + 2.*e + h, -a - 2.*b - c + f + 2.*g + h));
    col = mix(col, edgeColor, clamp(smoothstep(.06, .45, ed)*edge*1.4, 0., 1.));
  }

  // ── tone & colour ──
  col = max(col, 0.);
  col *= pow(2., exposure*1.6);
  float l = luma(col);
  col += shadows*.26*pow(clamp(1. - l, 0., 1.), 4.);
  col *= 1. + highlights*.45*smoothstep(.4, 1., l);
  col = mix(vec3(.5), col, 1. + contrast*(contrast > 0. ? 1.2 : .7));
  col = col*(1. - fade*.28) + fade*.14;
  col.r *= 1. + temp*.28; col.b *= 1. - temp*.28; col.g *= 1. - tint*.2; col.rb *= 1. + tint*.06;
  l = luma(col);
  col = mix(vec3(l), col, 1. + saturation);
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  col = mix(vec3(l), col, 1. + vibrance*(1. - clamp(sat, 0., 1.))*1.2);
  if (hue != 0.) { const vec3 k = vec3(.57735); float cs = cos(hue), sn = sin(hue); col = col*cs + cross(k, col)*sn + k*dot(k, col)*(1. - cs); }
  col = clamp(col, 0., 1.);
  col = mix(col, 1. - col, invert);
  l = luma(col);
  col = mix(col, vec3(l), bw);
  col += ((splitShadow - .5)*(1. - l) + (splitHigh - .5)*l)*splitAmt*.55;
  if (colorize > 0.) {
    vec3 mono = l < .5 ? mix(colorizeColor*.08, colorizeColor, l*2.) : mix(colorizeColor, vec3(1.), (l - .5)*2.);
    col = mix(col, mono, colorize);
  }
  if (posterize > 0.) { float lv = mix(22., 3., posterize); col = floor(clamp(col, 0., 1.)*lv + .5)/lv; }

  // ── light ──
  if (spot > 0.) {
    float d = length((q - vec2(spotX, spotY))*asp); float r = .12 + spotSize*.5;
    col *= mix(1., .05 + (1. - smoothstep(r, r + .34, d))*1.25, spot);
  }
  if (flash > 0.) {
    float f = 1. - smoothstep(0., 1.1, rad);
    col = mix(col, col*(.36 + .92*f*f) + .03*f, flash);
    col = mix(col, vec3(1.), flash*.08*f*smoothstep(.7, 1., luma(col)));
  }
  if (winlight > 0.) {
    float w = smoothstep(1.05, -.1, q.x*.8 + q.y*.35);
    col *= mix(1., .42 + w*1.05, winlight); col += winlight*.06*w*vec3(1., .93, .82);
  }
  if (vignette > 0.) col *= 1. - vignette*smoothstep(.32, 1.05, rad);
  else col += -vignette*smoothstep(.3, 1., rad)*.5;
  if (neon > 0.) {
    float a = 1. - smoothstep(0., 1.05, length((q - vec2(-.08, .4))*asp));
    float b = 1. - smoothstep(0., 1.05, length((q - vec2(1.08, .55))*asp));
    vec3 n = neonA*a*a + neonB*b*b;
    col *= 1. - neon*.35;
    col = scr(col, n*neon*.8) + n*luma(col)*neon*.45;
  }
  if (leak > 0.) {
    float d = leakSide < .5 ? q.x : leakSide < 1.5 ? 1. - q.x : leakSide < 2.5 ? q.y : leakSide < 3.5 ? 1. - q.y : length(q - vec2(1., 0.))*.7;
    float k = smoothstep(.6, 0., d)*(.55 + .45*vnoise(q*3. + seed));
    col = scr(col, mix(leakColor, vec3(1., .9, .55), k*k*.6)*k*leak*1.15);
  }
  if (flare > 0.) {
    vec2 fp = (q - vec2(flareX, flareY))*asp; float d = length(fp); float ang = atan(fp.y, fp.x);
    float core = exp(-d*9.)*1.2 + exp(-d*2.2)*.42;
    float rays = pow(abs(sin(ang*6. + seed)), 18.)*exp(-d*3.)*.5 + pow(abs(cos(ang)), 60.)*exp(-d*1.6)*.4;
    vec2 g1 = ((q - .5) + (vec2(flareX, flareY) - .5)*.45)*asp; vec2 g2 = ((q - .5) + (vec2(flareX, flareY) - .5)*1.1)*asp;
    float gh = exp(-pow(length(g1)/.07, 2.))*.3 + exp(-pow(length(g2)/.12, 2.))*.18;
    col = scr(col, vec3(1., .86, .62)*(core + rays)*flare + vec3(.45, .85, .65)*gh*flare);
    col += flare*.07*exp(-d*1.2)*vec3(1., .8, .5);
  }
  if (fog > 0.) {
    float f = (fbm(q*asp*2.2 + seed)*.6 + .45)*mix(.55, 1., smoothstep(.15, 1., q.y));
    col = mix(col, fogColor, clamp(fog*f*.85, 0., 1.));
  }
  if (dots > 0.) {
    vec2 g = q*asp*8.; vec2 id = floor(g); vec2 f = fract(g) - .5;
    vec2 off = (vec2(h21(id + 1.3 + seed), h21(id + 7.7)) - .5)*.6;
    float sz = .08 + .13*h21(id + 2.2);
    float sp = smoothstep(sz, sz*.3, length(f - off))*step(.5, h21(id + seed*3.1));
    col = scr(col, hsv(h21(id + 5.1))*sp*dots*.95);
  }
  if (prism > 0.) {
    float t = dot(q - .5, vec2(.8, .6)); float ac = dot(q - .5, vec2(-.6, .8));
    float band = exp(-pow((ac + .2)/.1, 2.)) + .6*exp(-pow((ac - .3)/.07, 2.));
    col = mix(col, max(col, base(uv + vec2(.07, .025))), prism*.4);
    col = scr(col, hsv(fract(t*1.5 + ac*2. + .1))*band*prism*.6);
  }
  if (caustic > 0.) {
    float c = pow(.5 + .5*sin(q.x*18. + sin(q.y*9. + seed)*2.)*sin(q.y*14. + sin(q.x*7.)*2.), 3.);
    col += vec3(.5, .9, 1.)*c*caustic*.3*(1. - q.y*.7);
  }

  // ── texture ──
  if (pattern > .5 && patternAmt > 0.) {
    float cs = cos(patternAngle), sn = sin(patternAngle); vec2 p = (q - .5)*asp; p = vec2(p.x*cs - p.y*sn, p.x*sn + p.y*cs);
    float sh = pattern < 1.5 ? smoothstep(.4, .56, fract(p.y*8.))
      : pattern < 2.5 ? smoothstep(.44, .56, fract(p.y*3.2))
      : pattern < 3.5 ? max(smoothstep(.84, .9, fract(p.x*2.4 + .3)), smoothstep(.84, .9, fract(p.y*2.4 + .3)))
      : smoothstep(.46, .6, fbm(p*5. + seed));
    col *= 1. - sh*patternAmt*.78;
  }
  if (rain > 0.) {
    vec2 r = q*asp; r.x += r.y*.2; float ln = 0.;
    for (int i = 1; i < 3; i++) {
      vec2 g = r*vec2(70.*float(i), 6.*float(i)); vec2 id = floor(g); float h = h21(id + seed + float(i));
      float f = fract(g.y + h*10.);
      ln += step(.84, h)*smoothstep(.14, 0., abs(fract(g.x) - .5))*smoothstep(0., .3, f)*smoothstep(1., .5, f);
    }
    col = mix(col, col*vec3(.86, .93, 1.02)*.92, rain*.5) + ln*rain*.34;
  }
  if (snow > 0.) {
    float s = 0.;
    for (int i = 0; i < 3; i++) {
      float sc = 9. + float(i)*12.; vec2 g = q*asp*sc + float(i)*3.7; vec2 id = floor(g); vec2 f = fract(g) - .5;
      vec2 off = (vec2(h21(id + seed), h21(id + 9.2)) - .5)*.7; float sz = .06 + .1*h21(id + 4.4);
      s += smoothstep(sz, sz*.2, length(f - off))*step(.45, h21(id + 1.7))*(1. - float(i)*.2);
    }
    col = mix(col, vec3(1.), clamp(s*snow, 0., 1.)*.92);
  }
  if (bubbles > 0.) {
    vec2 g = q*asp*7.; vec2 id = floor(g); vec2 f = fract(g) - .5;
    vec2 off = (vec2(h21(id + seed + 2.), h21(id + 6.1)) - .5)*.6; float sz = .05 + .13*h21(id + 8.8); float d = length(f - off);
    float ring = (smoothstep(sz, sz*.86, d) - smoothstep(sz*.8, sz*.55, d) + smoothstep(sz*.3, 0., length(f - off + sz*.4))*.8)*step(.5, h21(id + 3.3));
    col += vec3(.8, .95, 1.)*ring*bubbles*.5;
  }
  if (scan > 0.) col *= 1. - scan*.34*(.5 + .5*sin(q.y*1130.));
  if (halftone > 0.) {
    vec2 g = vec2(cc.x + cc.y, cc.y - cc.x)*62.; float d = length(fract(g) - .5);
    float r = sqrt(clamp(1. - luma(col), 0., 1.))*.72;
    col = mix(col, mix(vec3(.96, .94, .9), col*.3, smoothstep(r, r - .1, d)), halftone);
  }
  if (dust > 0.) {
    float sp = step(.9984, h21(floor(q*asp*260.) + seed));
    float cx = floor(q.x*aspect*300.);
    float sc = step(.995, h21(vec2(cx, seed)))*step(.45, vnoise(vec2(q.y*3., cx)));
    col = mix(col, vec3(.94), clamp((sp + sc*.5)*dust, 0., 1.));
  }
  if (grain > 0.) {
    vec2 gp = floor(q*asp*grainCells);
    float g = (h21(gp + seed) + h21(gp + seed + 17.3)) - 1.;
    col += g*grain*.2*(1. - .5*luma(col));
  }
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

  /* ───────── GL plumbing ───────── */
  const glc = document.createElement('canvas');
  let gl = null, prog = {}, tex = {}, fbo = {}, lastSrc = null, lastW = 0, lastH = 0, maxTex = 4096;

  function compile(fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const a = gl.getActiveUniform(p, i);
      u[a.name] = { loc: gl.getUniformLocation(p, a.name), type: a.type };
    }
    return { p, u };
  }
  function mkTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
    return t;
  }
  function target(name, w, h) {
    const t = (tex[name] ??= mkTex());
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = (fbo[name] ??= gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  }
  function init() {
    gl = glc.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false })
      || glc.getContext('experimental-webgl');
    if (!gl) throw new Error('Browser ini tidak mendukung WebGL, jadi editor tidak bisa jalan.');
    prog = { geo: compile(FS_GEO), copy: compile(FS_COPY), blur: compile(FS_BLUR), fin: compile(FS_FINAL) };
    tex = {}; fbo = {}; lastSrc = null; lastW = lastH = 0;
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    tex.src = mkTex();
  }
  glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; });

  function run(pg, uniforms, inputs, out, w, h) {
    gl.useProgram(pg.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? fbo[out] : null);
    gl.viewport(0, 0, w, h);
    let unit = 0;
    for (const [name, t] of Object.entries(inputs)) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex[t]);
      if (pg.u[name]) gl.uniform1i(pg.u[name].loc, unit);
      unit++;
    }
    for (const [name, val] of Object.entries(uniforms)) {
      const u = pg.u[name];
      if (!u) continue;
      if (typeof val === 'number') gl.uniform1f(u.loc, val);
      else if (val.length === 2) gl.uniform2fv(u.loc, val);
      else if (val.length === 3) gl.uniform3fv(u.loc, val);
      else gl.uniform4fv(u.loc, val);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) / 255 || 0);
  const idx = (key, val) => Math.max(0, BY_KEY[key].opts.findIndex(([o]) => o === val));
  const rad = (deg) => (deg * Math.PI) / 180;

  /** Run the WebGL passes; leaves the result on the internal GL canvas and returns it. */
  function renderGL(src, P, maxSide) {
    if (!gl || gl.isContextLost()) init();
    const sw = src.width, sh = src.height;
    // centred crop to the requested ratio
    let cw = sw, ch = sh;
    if (P.crop) {
      const [a, b] = P.crop.split(':').map(Number), ar = a / b;
      if (sw / sh > ar) cw = sh * ar; else ch = sw / ar;
    }
    const k = Math.min(1, Math.min(maxSide, maxTex) / Math.max(cw, ch));
    const W = Math.max(2, Math.round(cw * k)), H = Math.max(2, Math.round(ch * k));
    const bw = Math.max(2, W >> 2), bh = Math.max(2, H >> 2);
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    if (W !== lastW || H !== lastH) { target('t0', W, H); target('ba', bw, bh); target('bb', bw, bh); lastW = W; lastH = H; }
    if (src !== lastSrc) {
      gl.bindTexture(gl.TEXTURE_2D, tex.src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      lastSrc = src;
    }
    const aspect = W / H, th = rad(P.rotate);
    const rotFit = Math.cos(Math.abs(th)) + Math.max(aspect, 1 / aspect) * Math.sin(Math.abs(th));
    run(prog.geo, {
      crop: [(sw - cw) / 2 / sw, (sh - ch) / 2 / sh, cw / sw, ch / sh], aspect, rot: th,
      zoom: rotFit * (1 + (P.zoom / 100) * 2),
      distort: P.distort > 0 ? (P.distort / 100) * 1.7 : (P.distort / 100) * 0.7,
      mirror: idx('mirror', P.mirror),
      pixel: P.pixelate > 0 ? Math.round(220 - (P.pixelate / 100) * 196) : 0,
    }, { S: 'src' }, 't0', W, H);

    // one blurred copy feeds soft / glow / tilt-shift / edge blur / sharpen
    const amount = Math.max(P.soft, P.tilt, P.focus) / 100;
    const radius = (0.004 + 0.034 * amount + (P.glow > 0 ? 0.01 : 0)) * Math.min(W, H) / 4;
    run(prog.copy, {}, { T: 't0' }, 'ba', bw, bh);
    const step = Math.max(0.6, radius / 6);
    for (let i = 1; i <= 3; i++) {
      run(prog.blur, { d: [(step * i) / bw, 0] }, { T: 'ba' }, 'bb', bw, bh);
      run(prog.blur, { d: [0, (step * i) / bh] }, { T: 'bb' }, 'ba', bw, bh);
    }

    const n = (key) => P[key] / 100;
    const U = { aspect, seed: 3.7, grainCells: 620 };
    for (const p of PARAMS) {
      if (p.t === 'range') U[p.k] = n(p.k);
      else if (p.t === 'color') U[p.k] = rgb(P[p.k]);
    }
    Object.assign(U, {
      hue: rad(P.hue), invert: P.invert ? 1 : 0, motionAngle: rad(P.motionAngle), patternAngle: rad(P.patternAngle),
      leakSide: idx('leakSide', P.leakSide), pattern: idx('pattern', P.pattern),
    });
    run(prog.fin, U, { T: 't0', B: 'ba' }, null, W, H);
    return glc;
  }

  /* ───────── frames & overlays (2D canvas) ───────── */
  const F = {
    serif: '"Didot","Bodoni 72","Playfair Display",Georgia,"Times New Roman",serif',
    sans: '-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif',
    cond: '"HelveticaNeue-CondensedBlack","Arial Narrow",Impact,"Helvetica Neue",Arial,sans-serif',
    hand: '"Bradley Hand","Marker Felt","Segoe Print","Comic Sans MS",cursive',
    mono: '"Courier New",ui-monospace,Menlo,monospace',
  };
  const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const VARIANTS = [[1, 0, 0], [1.25, -0.05, -0.04], [1.5, 0.06, -0.06], [1.12, 0.05, 0.03], [1.8, 0, -0.08], [1.35, -0.07, 0.02], [1.05, 0, 0.02], [2.1, 0.03, -0.1], [1.6, -0.04, 0.05]];

  function size(cv, w, h) { cv.width = Math.round(w); cv.height = Math.round(h); return cv.getContext('2d'); }
  /** Draw a cover-cropped (optionally zoomed/offset) piece of g into a rectangle. */
  function drawCrop(ctx, g, dx, dy, dw, dh, [z, ox, oy] = [1, 0, 0]) {
    const ar = dw / dh;
    let sw = g.width, sh = g.height;
    if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
    sw /= z; sh /= z;
    const sx = Math.min(g.width - sw, Math.max(0, (g.width - sw) / 2 + ox * g.width));
    const sy = Math.min(g.height - sh, Math.max(0, (g.height - sh) / 2 + oy * g.height));
    ctx.drawImage(g, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  /** Fit one line of text into maxW by shrinking the font; returns the size used. */
  function fit(ctx, text, maxW, px, font, weight = 700) {
    ctx.font = `${weight} ${px}px ${font}`;
    const w = ctx.measureText(text).width;
    if (w > maxW) { px *= maxW / w; ctx.font = `${weight} ${px}px ${font}`; }
    return px;
  }
  const lines = (s) => String(s || '').split('|').map((x) => x.trim()).filter(Boolean);
  const spaced = (s) => String(s).split('').join('  ');

  function compose(g, P, out) {
    const W = g.width, H = g.height, m0 = Math.min(W, H);
    let ctx;
    switch (P.frame) {
      case 'border': {
        const m = m0 * (0.015 + 0.1 * P.frameSize / 100);
        ctx = size(out, W + 2 * m, H + 2 * m);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(g, m, m);
        break;
      }
      case 'polaroid': {
        const m = W * 0.06, b = W * 0.25;
        ctx = size(out, W + 2 * m, H + m + b);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(g, m, m);
        ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = Math.max(1, W * 0.003); ctx.strokeRect(m, m, W, H);
        if (P.text1) {
          ctx.fillStyle = '#3a3630'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          fit(ctx, P.text1, W * 0.9, b * 0.36, F.hand, 400);
          ctx.fillText(P.text1, out.width / 2, m + H + b * 0.5);
        }
        break;
      }
      case 'letterbox': {
        ctx = size(out, W, H); ctx.drawImage(g, 0, 0);
        const bar = H * (0.05 + 0.1 * P.frameSize / 100);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
        if (P.text1) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          const px = fit(ctx, P.text1, W * 0.86, W * 0.042, F.sans, 500);
          ctx.lineWidth = px * 0.16; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
          ctx.strokeText(P.text1, W / 2, H - bar - px * 0.6);
          ctx.fillStyle = P.textColor; ctx.fillText(P.text1, W / 2, H - bar - px * 0.6);
        }
        break;
      }
      case 'postcard': {
        const m = m0 * 0.05;
        ctx = size(out, W + 2 * m, H + 2 * m);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(g, m, m);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        let y = m + H - m0 * 0.07;
        if (P.text1) {
          const px = fit(ctx, P.text1, W * 0.86, m0 * 0.17, F.cond, 900);
          ctx.fillStyle = 'rgba(40,20,10,.55)'; ctx.fillText(P.text1, m + W * 0.06 + px * 0.05, y + px * 0.05);
          ctx.fillStyle = P.textColor; ctx.fillText(P.text1, m + W * 0.06, y);
          y -= px * 0.98;
        }
        if (P.text2) {
          fit(ctx, P.text2, W * 0.8, m0 * 0.1, F.hand, 400);
          ctx.fillStyle = P.textColor; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = m0 * 0.01;
          ctx.fillText(P.text2, m + W * 0.065, y); ctx.shadowBlur = 0;
        }
        break;
      }
      case 'cover': case 'headline': {
        ctx = size(out, W, H); ctx.drawImage(g, 0, 0);
        const bold = P.frame === 'headline', pad = W * 0.06;
        const top = ctx.createLinearGradient(0, 0, 0, H * 0.3); top.addColorStop(0, 'rgba(0,0,0,.42)'); top.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.3);
        const bot = ctx.createLinearGradient(0, H * 0.55, 0, H); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,.6)');
        ctx.fillStyle = bot; ctx.fillRect(0, H * 0.55, W, H * 0.45);
        ctx.fillStyle = P.textColor; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        if (P.text1) {
          const t = bold ? P.text1 : spaced(P.text1);
          const px = fit(ctx, t, W - pad * 2, W * (bold ? 0.34 : 0.26), bold ? F.cond : F.serif, bold ? 900 : 400);
          ctx.fillText(t, W / 2, pad * 0.7);
          ctx.font = `600 ${W * 0.022}px ${F.sans}`; ctx.textAlign = 'right';
          ctx.fillText(spaced('NO. 01'), W - pad, pad * 0.9 + px * 1.02);
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        let y = H - pad;
        const subs = lines(P.text3).reverse();
        for (const s of subs) {
          const px = fit(ctx, s, W * 0.6, W * 0.034, F.sans, bold ? 700 : 400);
          ctx.fillText(s, pad, y); y -= px * 1.4;
        }
        if (P.text2) {
          y -= W * 0.012;
          const px = fit(ctx, P.text2, W - pad * 2, W * (bold ? 0.12 : 0.085), bold ? F.cond : F.serif, bold ? 900 : 400);
          if (!bold) ctx.font = `italic 400 ${px}px ${F.serif}`;
          ctx.fillText(P.text2, pad, y);
          ctx.fillRect(pad, y - px * 1.12, W * 0.12, Math.max(2, W * 0.006));
        }
        break;
      }
      case 'campaign': {
        ctx = size(out, W, H); ctx.drawImage(g, 0, 0);
        const bot = ctx.createLinearGradient(0, H * 0.6, 0, H); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = bot; ctx.fillRect(0, H * 0.6, W, H * 0.4);
        ctx.fillStyle = P.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        if (P.text1) { const t = spaced(spaced(P.text1)); fit(ctx, t, W * 0.84, W * 0.075, F.serif, 400); ctx.fillText(t, W / 2, H - W * 0.11); }
        if (P.text2) { const t = spaced(P.text2.toUpperCase()); fit(ctx, t, W * 0.7, W * 0.024, F.sans, 500); ctx.fillText(t, W / 2, H - W * 0.062); }
        break;
      }
      case 'album': {
        ctx = size(out, W, H); ctx.drawImage(g, 0, 0);
        const pad = W * 0.06;
        ctx.strokeStyle = P.textColor; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, W * 0.004);
        ctx.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad); ctx.globalAlpha = 1;
        ctx.fillStyle = P.textColor; ctx.textAlign = 'left';
        if (P.text2) { ctx.textBaseline = 'top'; const t = spaced(P.text2.toUpperCase()); fit(ctx, t, W * 0.8, W * 0.032, F.sans, 600); ctx.fillText(t, pad, pad); }
        if (P.text1) {
          ctx.textBaseline = 'alphabetic';
          const words = P.text1.split(' '), half = Math.ceil(words.length / 2);
          const rows = words.length > 1 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [P.text1];
          let y = H - pad;
          for (const r of rows.reverse()) { const px = fit(ctx, r, W - pad * 2, W * 0.17, F.cond, 900); ctx.fillText(r, pad, y); y -= px * 0.92; }
        }
        break;
      }
      case 'strip': {
        const fw = W * 0.5, fh = fw * 0.78, m = fw * 0.07, gap = fw * 0.045, foot = fw * 0.2;
        ctx = size(out, fw + 2 * m, m + 4 * fh + 3 * gap + foot);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        for (let i = 0; i < 4; i++) drawCrop(ctx, g, m, m + i * (fh + gap), fw, fh, VARIANTS[[0, 1, 3, 2][i]]);
        if (P.text1) { ctx.fillStyle = '#444'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fit(ctx, P.text1, fw * 0.9, foot * 0.36, F.mono, 700); ctx.fillText(P.text1, out.width / 2, out.height - foot * 0.52); }
        break;
      }
      case 'sheet': {
        const cw = W / 3 * 0.92, chh = cw * (H / W), gap = cw * 0.07, m = cw * 0.12, head = cw * 0.22, lab = cw * 0.11;
        ctx = size(out, 2 * m + 3 * cw + 2 * gap, m + head + 3 * (chh + lab) + 2 * gap + m * 0.6);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        ctx.fillStyle = P.textColor; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        if (P.text1) { fit(ctx, P.text1, out.width - 2 * m, head * 0.38, F.mono, 700); ctx.fillText(P.text1, m, m + head * 0.38); }
        ctx.font = `700 ${lab * 0.62}px ${F.mono}`;
        for (let i = 0; i < 9; i++) {
          const x = m + (i % 3) * (cw + gap), y = m + head + Math.floor(i / 3) * (chh + lab + gap);
          drawCrop(ctx, g, x, y, cw, chh, VARIANTS[i]);
          ctx.fillText(String(i + 1).padStart(2, '0') + (i % 2 ? 'A' : ''), x, y + chh + lab * 0.56);
        }
        break;
      }
      case 'film': {
        const fw = W * 0.34, fh = fw * 0.68, gap = fw * 0.05, edge = fh * 0.27, m = fw * 0.16, sw = 3 * fw + 4 * gap, sh = fh + 2 * edge;
        ctx = size(out, sw + 2 * m, 2 * sh + 3 * m);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, out.width, out.height);
        for (let r = 0; r < 2; r++) {
          const y0 = m + r * (sh + m);
          ctx.fillStyle = '#0d0c0b'; ctx.fillRect(m, y0, sw, sh);
          ctx.fillStyle = P.frameColor;
          const hw = fw * 0.055, hh = edge * 0.36, n = 24;
          for (let i = 0; i < n; i++) for (const yy of [y0 + edge * 0.12, y0 + sh - edge * 0.12 - hh]) {
            const x = m + (i + 0.5) * (sw / n) - hw / 2;
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, yy, hw, hh, hw * 0.25) : ctx.rect(x, yy, hw, hh); ctx.fill();
          }
          ctx.fillStyle = '#e8a23a'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `700 ${edge * 0.3}px ${F.mono}`;
          for (let i = 0; i < 3; i++) {
            const x = m + gap + i * (fw + gap), k = r * 3 + i;
            drawCrop(ctx, g, x, y0 + edge, fw, fh, VARIANTS[k]);
            ctx.fillText(`▸ ${12 + k}${k % 2 ? 'A' : ''}`, x, y0 + edge * 0.74);
            if (i === 1) ctx.fillText(P.text1 || 'SAFETY FILM 400', x, y0 + sh - edge * 0.72);
          }
        }
        // grease-pencil pick on one frame
        ctx.strokeStyle = '#e23b2e'; ctx.lineWidth = fw * 0.022; ctx.lineJoin = 'round';
        const px = m + gap + fw + gap, py = m + edge;
        ctx.beginPath(); ctx.ellipse(px + fw / 2, py + fh / 2, fw * 0.56, fh * 0.6, -0.06, 0.2, Math.PI * 2 + 0.05); ctx.stroke();
        break;
      }
      case 'globe': {
        ctx = size(out, W, H);
        const bg = ctx.createRadialGradient(W / 2, H * 0.4, m0 * 0.1, W / 2, H * 0.45, Math.max(W, H) * 0.8);
        bg.addColorStop(0, P.frameColor); bg.addColorStop(1, '#05070c');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        const Rr = Math.min(W * 0.41, H * 0.34), cx = W / 2, cy = H * 0.43;
        // base
        const by = cy + Rr * 0.86, bh = Rr * 0.5;
        const wood = ctx.createLinearGradient(0, by, 0, by + bh); wood.addColorStop(0, '#7a4a28'); wood.addColorStop(1, '#3d2212');
        ctx.fillStyle = wood; ctx.beginPath();
        ctx.moveTo(cx - Rr * 0.78, by); ctx.lineTo(cx + Rr * 0.78, by); ctx.lineTo(cx + Rr * 0.95, by + bh); ctx.lineTo(cx - Rr * 0.95, by + bh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, by + bh, Rr * 1.05, Rr * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        if (P.text1) {
          ctx.fillStyle = '#d9b979'; ctx.fillRect(cx - Rr * 0.42, by + bh * 0.32, Rr * 0.84, bh * 0.36);
          ctx.fillStyle = '#3d2212'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          fit(ctx, P.text1, Rr * 0.76, bh * 0.22, F.serif, 700); ctx.fillText(P.text1, cx, by + bh * 0.5);
        }
        // glass
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, Math.PI * 2); ctx.clip();
        drawCrop(ctx, g, cx - Rr, cy - Rr, Rr * 2, Rr * 2);
        const r = rng(7); ctx.fillStyle = '#fff';
        for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.5 + r() * 0.5; ctx.beginPath(); ctx.arc(cx + (r() * 2 - 1) * Rr, cy + (r() * 2 - 1) * Rr, Rr * (0.006 + r() * 0.014), 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
        const drift = ctx.createLinearGradient(0, cy + Rr * 0.62, 0, cy + Rr); drift.addColorStop(0, 'rgba(255,255,255,0)'); drift.addColorStop(1, 'rgba(255,255,255,.95)');
        ctx.fillStyle = drift; ctx.fillRect(cx - Rr, cy + Rr * 0.62, Rr * 2, Rr * 0.4);
        const sh = ctx.createRadialGradient(cx - Rr * 0.3, cy - Rr * 0.35, Rr * 0.1, cx, cy, Rr);
        sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,10,30,.6)');
        ctx.fillStyle = sh; ctx.fillRect(cx - Rr, cy - Rr, Rr * 2, Rr * 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Rr * 0.016; ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Rr * 0.05; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.84, Math.PI * 1.14, Math.PI * 1.36); ctx.stroke();
        break;
      }
      case 'collage': {
        ctx = size(out, W, H);
        ctx.fillStyle = P.frameColor; ctx.fillRect(0, 0, W, H);
        const r = rng(11);
        ctx.fillStyle = 'rgba(90,70,40,.07)';
        for (let i = 0; i < 700; i++) ctx.fillRect(r() * W, r() * H, m0 * 0.004, m0 * 0.004);
        const block = (x, y, w, h, a, c) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = c; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); };
        block(W * 0.3, H * 0.3, W * 0.62, H * 0.42, -0.12, '#e7a48f');
        block(W * 0.72, H * 0.66, W * 0.5, H * 0.38, 0.1, '#9db8a4');
        const pw = W * 0.72, ph = pw * (H / W), b = pw * 0.035;
        ctx.save(); ctx.translate(W / 2, H * 0.46); ctx.rotate(-0.045);
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = m0 * 0.03; ctx.shadowOffsetY = m0 * 0.012;
        ctx.fillStyle = '#fff'; ctx.fillRect(-pw / 2 - b, -ph / 2 - b, pw + 2 * b, ph + 2 * b);
        ctx.shadowColor = 'transparent';
        ctx.drawImage(g, -pw / 2, -ph / 2, pw, ph);
        ctx.fillStyle = 'rgba(244,226,150,.82)';
        for (const [x, a] of [[-pw * 0.36, -0.5], [pw * 0.36, 0.45]]) { ctx.save(); ctx.translate(x, -ph / 2 - b); ctx.rotate(a); ctx.fillRect(-pw * 0.12, -pw * 0.03, pw * 0.24, pw * 0.06); ctx.restore(); }
        ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const st = String(P.text2 || '').split(/\s+/).filter(Boolean).slice(0, 4);
        const spots = [[0.15, 0.14, -0.3], [0.86, 0.2, 0.25], [0.13, 0.8, 0.2], [0.87, 0.86, -0.2]];
        st.forEach((s, i) => { const [x, y, a] = spots[i]; ctx.save(); ctx.translate(W * x, H * y); ctx.rotate(a); ctx.font = `${m0 * 0.12}px ${F.sans}`; ctx.fillStyle = '#222'; ctx.fillText(s, 0, 0); ctx.restore(); });
        if (P.text1) { ctx.fillStyle = '#2b2622'; ctx.save(); ctx.translate(W / 2, H * 0.46 + ph / 2 + m0 * 0.11); ctx.rotate(-0.03); fit(ctx, P.text1, W * 0.8, m0 * 0.075, F.hand, 400); ctx.fillText(P.text1, 0, 0); ctx.restore(); }
        break;
      }
      default:
        ctx = size(out, W, H); ctx.drawImage(g, 0, 0);
    }
    if (P.osd && P.osd !== 'none') osd(ctx, out.width, out.height, P);
    return out;
  }

  function osd(ctx, W, H, P) {
    const m0 = Math.min(W, H), pad = m0 * 0.055, now = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const custom = (P.osdText || '').trim();
    ctx.save();
    ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = m0 * 0.008;
    const mono = (px, w = 700) => (ctx.font = `${w} ${px}px ${F.mono}`);
    if (P.osd === 'date') {
      mono(m0 * 0.05); ctx.textAlign = 'right'; ctx.fillStyle = '#ff9a2e'; ctx.shadowColor = 'rgba(255,90,0,.9)'; ctx.shadowBlur = m0 * 0.012;
      ctx.fillText(custom || `'${p2(now.getFullYear() % 100)} ${p2(now.getMonth() + 1)} ${p2(now.getDate())}`, W - pad, H - pad);
    } else if (P.osd === 'vhs') {
      ctx.fillStyle = '#fff'; mono(m0 * 0.062); ctx.textAlign = 'left';
      ctx.fillText('PLAY ►', pad, pad + m0 * 0.05);
      ctx.textAlign = 'right'; ctx.fillText('SP', W - pad, pad + m0 * 0.05);
      ctx.textAlign = 'left'; mono(m0 * 0.05);
      const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()];
      ctx.fillText(`${now.getHours() < 12 ? 'AM' : 'PM'} ${p2(now.getHours() % 12 || 12)}:${p2(now.getMinutes())}`, pad, H - pad - m0 * 0.065);
      ctx.fillText(custom || `${mon}. ${p2(now.getDate())} ${now.getFullYear()}`, pad, H - pad);
    } else if (P.osd === 'camcorder') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, m0 * 0.006); const L = m0 * 0.08, i = pad * 0.6;
      for (const [x, y, sx, sy] of [[i, i, 1, 1], [W - i, i, -1, 1], [i, H - i, 1, -1], [W - i, H - i, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke(); }
      ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(pad * 1.5, pad * 1.55, m0 * 0.017, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; mono(m0 * 0.048); ctx.textAlign = 'left'; ctx.fillText('REC', pad * 1.5 + m0 * 0.035, pad * 1.55 + m0 * 0.017);
      const bw = m0 * 0.085, bh = m0 * 0.038, bx = W - pad * 1.5 - bw, by = pad * 1.55 - bh / 2;
      ctx.strokeRect(bx, by, bw, bh); ctx.fillRect(bx + bw, by + bh * 0.3, m0 * 0.008, bh * 0.4); ctx.fillRect(bx + bh * 0.16, by + bh * 0.16, bw * 0.62, bh * 0.68);
      ctx.fillText(custom || `00:${p2(now.getMinutes() % 60)}:${p2(now.getSeconds())}:08`, pad * 1.5, H - pad * 1.4);
      ctx.textAlign = 'right'; ctx.fillText(`${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}`, W - pad * 1.5, H - pad * 1.4);
    } else if (P.osd === 'cctv') {
      ctx.fillStyle = '#fff'; mono(m0 * 0.042); ctx.textAlign = 'left';
      ctx.fillText(custom || 'CAM 03', pad, pad + m0 * 0.035);
      ctx.textAlign = 'right';
      ctx.fillText(`${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`, W - pad, pad + m0 * 0.035);
      ctx.textAlign = 'left'; ctx.fillText('● REC', pad, H - pad);
    }
    ctx.restore();
  }

  /**
   * Render `src` (canvas / image / bitmap) with parameters `params` into the 2D canvas `out`.
   * @param {number} maxSide longest side of the processed photo, before any frame is added
   */
  function render(src, params, out, maxSide = 1280) {
    const P = { ...defaults(), ...params };
    return compose(renderGL(src, P, maxSide), P, out);
  }

  window.SlashFX = { PARAMS, GROUPS, BY_KEY, defaults, sanitize, compact, withStrength, render };
})();
