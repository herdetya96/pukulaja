# Tipo 600 V12

A real-time, interactive 3D showcase of a 6.0-litre 60° V12, built entirely in
three.js. Every surface is generated in code from the dimensions in
`js/config.js`: there are no imported models or image textures.

## Run it

Serve the repository root with any static server and open `/v12/`:

```bash
python3 -m http.server 4173
# open http://localhost:4173/v12/
```

Add `#lite` to the address for a reduced-effects renderer on slow machines.

## What it does

- **Studio** – PBR materials under a softbox environment, soft shadows, a
  mirrored turntable and bloom. Finishes for the cam covers, castings, intake
  and exhaust are configurable; the exhaust manifolds glow as load rises.
- **X-ray** – the castings turn to ghosted shells so the crank, rods, pistons,
  cams, valves and timing chains can be watched running.
- **Section** – a true capped cut (stencil-filled, hatched faces) on three
  planes: across the vee, along the crank, or through one cylinder bank.
- **Exploded view** – every assembly separates along its own axis while the
  engine keeps turning.
- **Drive** – start/stop, throttle to the 9,000 rpm redline, slow-motion
  playback down to 1/128, or turn the crank by hand through the 720° cycle.
- **Telemetry** – tachometer, full-load power and torque curves, firing-order
  strip and a per-cylinder stroke display, all driven by the same kinematics
  as the model.
- **Parts** – click any component for its material, key figures and what it
  does; focus the camera on it or isolate its layer.
- **Sound** – an optional synthesised exhaust note locked to firing frequency.

Keys: `Space` start/stop, `1` `2` `3` view modes, `E` explode, `H` hide panels,
`Esc` clear the selection.

## How the engine is modelled

| | |
|---|---|
| Layout | 60° V12, cylinders 1–6 in bank A, 7–12 in bank B |
| Bore × stroke | 92.0 × 75.2 mm, 5,999 cc |
| Rod length | 138 mm |
| Firing order | 1-7-5-11-3-9-6-12-2-8-4-10, one power stroke every 60° |
| Valvetrain | DOHC per bank, 48 valves, chain-driven at half crank speed |

The crank has six throws at 120°, each shared by two rods. Piston position,
rod angle, valve lift and cam-lobe phase are all computed from the crank angle,
so what the telemetry reports is what the geometry is doing. Castings are built
with real bores, a crankcase cavity and main-bearing bulkheads, which is what
lets the section view show filled cut faces rather than hollow shells.

## Layout

```
v12/
  index.html            page, styles, markup
  js/config.js          dimensions, firing order, torque curve, part catalogue
  js/geo.js             extrusion / lathe / merge helpers
  js/textures.js        procedural surface textures
  js/materials.js       material library and configurator finishes
  js/engine.js          the model and its kinematics
  js/stage.js           renderer, lighting, post, camera, x-ray and section
  js/ui.js              controls and telemetry
  js/audio.js           engine note synthesis
  js/main.js            boot and main loop
  vendor/               three.js r170 with the addons used, as one ES module
```

`vendor/three.bundle.min.js` was produced with:

```bash
npm i three@0.170.0 esbuild
# entry.js re-exports three plus OrbitControls, EffectComposer, RenderPass,
# UnrealBloomPass, OutputPass, ShaderPass, Reflector, RoundedBoxGeometry and
# BufferGeometryUtils
npx esbuild entry.js --bundle --format=esm --minify --outfile=v12/vendor/three.bundle.min.js
```
