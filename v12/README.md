# Tipo 600 V12

A real-time, interactive 3D showcase of a 6.0-litre 60° V12 and the grand
tourer built around it, made entirely in three.js. Every surface is generated
in code from the dimensions in `js/config.js` and `js/car-body.js`: there are
no imported models or image textures.

## Run it

Serve the repository root with any static server and open `/v12/`:

```bash
python3 -m http.server 4173
# open http://localhost:4173/v12/
```

Add `#lite` to the address for a reduced-effects renderer on slow machines.

## What it does

The **Car / Engine** switch at the top chooses the subject. Both share the
same studio, view modes and telemetry, and the engine you see in the car is
the same running model.

### The car

- A two-seat fastback, 4,650 mm long on a 2,720 mm wheelbase, with the V12
  mounted behind the front axle and a transaxle at the rear.
- **Styling reference** – proportions and cues are taken from Ferrari's
  front-engined V12 berlinettas, the 812 Superfast in particular: long bonnet
  and set-back cabin, wings that rise above the bonnet line, a deep scallop in
  the flank behind the front wheel, a high cut-off tail with four round lamps,
  quad tailpipes, twin-spoke wheels and yellow calipers. It is an original
  model drawn in that idiom, not a replica, and carries no Ferrari name or
  badge.
- **Body** – one lofted surface: paint, glass, bonnet, doors, lamps and vents
  are regions of the same grid, so panels meet exactly. Wheel arches are cut
  into it, and the cabin is lined behind every panel.
- **Detail** – five twin-spoke wheels with treaded, lettered tyres, drilled
  carbon-ceramic discs and six-piston calipers; clear-covered headlamps with
  projector units; double wishbones with
  coil-over dampers; a carbon tub with roof hoop; torque tube, transaxle and
  half shafts; a twin exhaust from manifold to tailpipe; radiator pack; seats,
  harnesses, quilted inserts, door cards, round vents, displays, shift paddles
  and a steering wheel that turns.
- **Configure** – paint, roof, wheel finish, caliper colour and leather, plus
  the engine's own finishes.
- **Open it up** – raise the bonnet, swing the doors, switch the lamps, steer
  the front wheels, and pick a gear to turn the rear wheels at road speed.
- **X-ray** ghosts the bodywork to show the rolling chassis; **Section** cuts
  the whole car (and the engine in it) lengthwise or across; **Lift the body**
  raises the shell clear of the chassis.

### The engine

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
- **Sound** – two synthesised voices, cycled with the speaker button
  (Berlinetta, Corsa). Each cylinder bank plays one engine cycle of exhaust
  pulses through fixed exhaust resonances, with induction roar, a short room
  reverb and crackle on the overrun. No recording is used.

Keys: `Space` start/stop, `C` car/engine, `1` `2` `3` view modes, `E` explode or
lift the body, `B` bonnet, `D` doors, `L` lamps, `H` hide panels, `Esc` clear
the selection.

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
  js/engine.js          the engine model and its kinematics
  js/car-body.js        the lofted bodywork: sections, panels, arches, lamps
  js/car.js             wheels, brakes, chassis, drivetrain, cabin, assembly
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
