// Tipo 600 — engine definition. All lengths in millimetres, angles in degrees.
// Everything the model, the kinematics and the telemetry need derives from here.

export const DEG = Math.PI / 180;

export const E = {
  bore: 92.0,
  stroke: 75.2,
  rod: 138.0,            // conrod centre-to-centre
  pitch: 104.0,          // bore spacing
  stagger: 22.0,         // bank-to-bank offset (two rods share a crankpin)
  bankHalf: 30.0,        // half the 60° vee
  compHeight: 30.0,      // wrist pin to crown
  deckClear: 1.4,
  blockFoot: 100.0,      // where the bank castings start, measured up the bore axis
  halfLen: 330.0,        // block half length
  bankHalfW: 62.0,
  mainR: 30.0,
  pinR: 25.0,
  valveAngle: 12.0,
  valveLen: 100.0,
  intakeValveR: 18.0,
  exhaustValveR: 15.25,
  intakeLift: 10.5,
  exhaustLift: 10.0,
  camBaseR: 14.0,
  idle: 950,
  redline: 9000,
  compression: 13.0,
};
E.crankR = E.stroke / 2;
E.deck = E.crankR + E.rod + E.compHeight + E.deckClear;      // 207.0
E.headTop = E.deck + 103;                                     // cam carrier face
E.valveSeatY = E.deck + 1.0;
E.valveZ = 19.0;                                              // valve head offset from bore centre
E.valveX = 19.5;
E.camY = E.valveSeatY + (E.valveLen + 16) * Math.cos(E.valveAngle * DEG);
E.camZ = E.valveZ + (E.valveLen + 16) * Math.sin(E.valveAngle * DEG);
E.displacement = Math.PI / 4 * E.bore * E.bore * E.stroke * 12 / 1000;   // cc

// Cylinders 1–6 sit in bank A (−Z), 7–12 in bank B (+Z); No.1 is at the front (+X).
export const FIRING_ORDER = [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10];

export const CYL = [];
for (let n = 1; n <= 12; n++) {
  const bank = n <= 6 ? -1 : 1;
  const k = (n - 1) % 6;                                // throw index, front to rear
  const fire = FIRING_ORDER.indexOf(n) * 60;            // crank degrees in the 720° cycle
  CYL.push({
    n, bank, k, fire,
    x: (2.5 - k) * E.pitch + bank * E.stagger / 2,
  });
}

// Crankpin phase per throw, measured from +Y towards +Z in the crank's own frame.
// Derived from bank A so that each bank-A cylinder reaches TDC at its firing angle;
// bank B then lands exactly 60° later on the shared pin.
export const THROW_ANGLE = [];
for (let k = 0; k < 6; k++) {
  const c = CYL[k];
  THROW_ANGLE.push(((-E.bankHalf - c.fire) % 360 + 360) % 360);
}
export const throwX = k => (2.5 - k) * E.pitch;

// --- valve events, crank degrees after firing TDC ---------------------------
export const VALVE = {
  exhaust: { open: 128, close: 382, lift: E.exhaustLift },
  intake: { open: 338, close: 592, lift: E.intakeLift },
};
export function valveLift(phase, kind) {
  const v = VALVE[kind];
  if (phase < v.open || phase > v.close) return 0;
  const s = Math.sin(Math.PI * (phase - v.open) / (v.close - v.open));
  return v.lift * s * s;
}

// Piston pin height above the crank axis for a crank-to-bore angle psi (radians).
export function pinHeight(psi) {
  const r = E.crankR, s = Math.sin(psi);
  return r * Math.cos(psi) + Math.sqrt(E.rod * E.rod - r * r * s * s);
}

// --- full-load torque curve (N·m) ------------------------------------------
const TQ = [
  [0, 0], [600, 380], [1000, 455], [2000, 535], [3000, 592], [4000, 636], [5000, 668],
  [6000, 685], [6750, 690], [7500, 683], [8000, 674], [8500, 661], [9000, 612], [9400, 560],
];
export function torqueAt(rpm) {
  if (rpm <= 0) return 0;
  let i = 1;
  while (i < TQ.length - 1 && TQ[i][0] < rpm) i++;
  const p0 = TQ[Math.max(0, i - 2)], p1 = TQ[i - 1], p2 = TQ[i], p3 = TQ[Math.min(TQ.length - 1, i + 1)];
  const t = Math.min(1, Math.max(0, (rpm - p1[0]) / (p2[0] - p1[0])));
  // Catmull-Rom on non-uniform knots, tangents scaled by segment length
  const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]);
  const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}
export const powerAt = rpm => torqueAt(rpm) * rpm / 9549.3;      // kW

export const PEAK = (() => {
  let pk = { power: 0, powerRpm: 0, torque: 0, torqueRpm: 0 };
  for (let r = 1000; r <= E.redline; r += 50) {
    const t = torqueAt(r), p = powerAt(r);
    if (t > pk.torque) { pk.torque = t; pk.torqueRpm = r; }
    if (p > pk.power) { pk.power = p; pk.powerRpm = r; }
  }
  return pk;
})();

// --- configurator finishes --------------------------------------------------
export const FINISHES = {
  covers: {
    label: 'Cam covers',
    options: [
      { id: 'rosso', name: 'Rosso crackle', color: '#a01310', kind: 'crackle' },
      { id: 'nero', name: 'Nero crackle', color: '#17181a', kind: 'crackle' },
      { id: 'giallo', name: 'Giallo crackle', color: '#d59a05', kind: 'crackle' },
      { id: 'verde', name: 'Verde scuro', color: '#0f3a29', kind: 'crackle' },
      { id: 'blu', name: 'Blu notte', color: '#142a5c', kind: 'crackle' },
      { id: 'argento', name: 'Sand-cast silver', color: '#b4b7bb', kind: 'cast' },
    ],
  },
  block: {
    label: 'Block & heads',
    options: [
      { id: 'cast', name: 'Natural cast aluminium', color: '#aeb1b5', rough: 0.58 },
      { id: 'graphite', name: 'Graphite ceramic coat', color: '#3a3d42', rough: 0.5 },
      { id: 'bronze', name: 'Magnesium bronze', color: '#7b6a4c', rough: 0.52 },
    ],
  },
  intake: {
    label: 'Intake',
    options: [
      { id: 'polished', name: 'Polished aluminium stacks', color: '#dfe2e6', rough: 0.09 },
      { id: 'black', name: 'Black anodised stacks', color: '#141518', rough: 0.3 },
      { id: 'gold', name: 'Gold anodised stacks', color: '#b88a2e', rough: 0.22 },
      { id: 'airbox', name: 'Carbon airbox', color: '#1a1b1e', rough: 0.3, airbox: true },
    ],
  },
  exhaust: {
    label: 'Exhaust manifolds',
    options: [
      { id: 'titanium', name: 'Heat-tinted titanium', color: '#b9b4ac', rough: 0.3, tint: true },
      { id: 'inconel', name: 'Satin Inconel', color: '#8d8a84', rough: 0.42 },
      { id: 'ceramic', name: 'Black ceramic coat', color: '#18181a', rough: 0.72, metal: 0.2 },
      { id: 'polished', name: 'Polished stainless', color: '#e3e4e6', rough: 0.07 },
    ],
  },
};

// --- part catalogue ---------------------------------------------------------
const mm = v => v.toFixed(1) + ' mm';
export const PARTS = {
  crank: {
    name: 'Crankshaft', layer: 'rotating',
    material: 'Forged 42CrMo4 steel, nitrided',
    specs: [['Throws', '6 at 120°'], ['Main journals', '7 × Ø' + mm(E.mainR * 2)], ['Crankpins', 'Ø' + mm(E.pinR * 2) + ', shared'], ['Stroke', mm(E.stroke)]],
    text: 'Six throws spaced 120° apart, each carrying two connecting rods side by side. With a 60° vee that gives one power stroke every 60° of rotation, so primary and secondary forces cancel completely.',
  },
  rods: {
    name: 'Connecting rods', layer: 'rotating',
    material: 'Forged Ti-6Al-4V, I-beam',
    specs: [['Centre to centre', mm(E.rod)], ['Rod ratio', (E.rod / E.stroke).toFixed(2)], ['Count', '12']],
    text: 'Titanium I-beam rods link each piston to its crankpin. The long rod ratio keeps side thrust on the bore low at 9,000 rpm.',
  },
  pistons: {
    name: 'Pistons', layer: 'rotating',
    material: 'Forged 2618 aluminium, three rings',
    specs: [['Bore', mm(E.bore)], ['Compression height', mm(E.compHeight)], ['Mean speed at redline', (2 * E.stroke / 1000 * E.redline / 60).toFixed(1) + ' m/s']],
    text: 'Short-skirt forged pistons with two compression rings and an oil control ring. Each one travels the 75.2 mm stroke 300 times a second at the redline.',
  },
  block: {
    name: 'Cylinder block', layer: 'block',
    material: 'Sand-cast A356-T6 aluminium',
    specs: [['Layout', '60° V12, closed deck'], ['Bore spacing', mm(E.pitch)], ['Deck height', mm(E.deck)], ['Bank offset', mm(E.stagger)]],
    text: 'A deep-skirt crankcase with seven main-bearing bulkheads carries both cylinder banks. The banks are staggered 22 mm so opposing rods can share a crankpin.',
  },
  liners: {
    name: 'Cylinder liners', layer: 'block',
    material: 'Nikasil-plated aluminium',
    specs: [['Bore', mm(E.bore)], ['Count', '12']],
    text: 'Thin plated liners give the rings a hard, oil-retaining surface while keeping the bores close together.',
  },
  sump: {
    name: 'Dry sump', layer: 'sump',
    material: 'Cast magnesium, finned',
    specs: [['System', 'Dry sump, external tank'], ['Depth', '54 mm']],
    text: 'A shallow finned pan with scavenge pickups. Storing the oil in a remote tank lets the engine sit low and keeps pressure steady under sustained cornering load.',
  },
  heads: {
    name: 'Cylinder heads', layer: 'heads',
    material: 'Cast A356-T6 aluminium',
    specs: [['Valves', '4 per cylinder, 48 total'], ['Included valve angle', (E.valveAngle * 2).toFixed(0) + '°'], ['Compression ratio', E.compression.toFixed(1) + ' : 1']],
    text: 'Each head carries six pent-roof combustion chambers, a central spark plug per cylinder and two overhead camshafts acting directly on bucket tappets.',
  },
  gasket: {
    name: 'Head gaskets', layer: 'heads',
    material: 'Multi-layer steel',
    specs: [['Thickness', '0.8 mm']],
    text: 'A stack of embossed steel layers seals combustion pressure, coolant and oil between block and head.',
  },
  cams: {
    name: 'Camshafts', layer: 'valvetrain',
    material: 'Chilled cast iron, hollow',
    specs: [['Layout', 'DOHC per bank, 4 total'], ['Speed', 'Half crankshaft speed'], ['Intake lift', mm(E.intakeLift)], ['Exhaust lift', mm(E.exhaustLift)]],
    text: 'Four chain-driven camshafts turn at half crank speed. Each lobe opens one valve once every two crank revolutions.',
  },
  valves: {
    name: 'Valves & springs', layer: 'valvetrain',
    material: 'Titanium intake, sodium-filled exhaust',
    specs: [['Intake', '24 × Ø' + mm(E.intakeValveR * 2)], ['Exhaust', '24 × Ø' + mm(E.exhaustValveR * 2)], ['Duration', '254° crank']],
    text: 'Intake valves open as the piston descends to draw in charge; exhaust valves open late in the power stroke. Springs close them against the cam profile.',
  },
  covers: {
    name: 'Cam covers', layer: 'covers',
    material: 'Cast magnesium, wrinkle finish',
    specs: [['Finish', 'Configurable']],
    text: 'Twin-hump covers seal the valvetrain. The valley between the humps houses the ignition coils.',
  },
  coils: {
    name: 'Coils & spark plugs', layer: 'ignition',
    material: 'Coil-on-plug, iridium electrodes',
    specs: [['Count', '12'], ['Firing interval', '60° crank']],
    text: 'One pencil coil sits directly on each plug. The order 1-7-5-11-3-9-6-12-2-8-4-10 alternates banks so the crank is loaded evenly along its length.',
  },
  intake: {
    name: 'Intake trumpets', layer: 'intake',
    material: 'Spun aluminium, individual throttles',
    specs: [['Throttle bodies', '12 × Ø46 mm'], ['Runner length', '185 mm']],
    text: 'Every cylinder breathes through its own throttle butterfly and tuned-length velocity stack. Runner length is chosen so pressure waves help fill the cylinder near peak power.',
  },
  fuel: {
    name: 'Fuel rails & injectors', layer: 'intake',
    material: 'Extruded aluminium rail',
    specs: [['Injection', 'Port, 12 injectors']],
    text: 'Two rails feed one injector per cylinder, aimed at the back of the intake valves.',
  },
  airbox: {
    name: 'Carbon airbox', layer: 'intake',
    material: 'Pre-preg carbon fibre',
    specs: [['Volume', '14 L']],
    text: 'A sealed plenum that feeds all twelve trumpets with cool, still air.',
  },
  exhaust: {
    name: 'Exhaust manifolds', layer: 'exhaust',
    material: 'Configurable',
    specs: [['Layout', '6-into-2 per bank'], ['Primary bore', '42 mm']],
    text: 'Equal-length primaries are grouped in threes by firing order, so each collector sees evenly spaced pulses 240° apart. They glow as load and speed rise.',
  },
  timing: {
    name: 'Timing drive', layer: 'timing',
    material: 'Duplex roller chain',
    specs: [['Ratio', '2 : 1'], ['Chains', 'One per bank']],
    text: 'A chain per bank runs from the crank nose to both camshafts. Sprockets twice the size of the crank sprocket give the 2 : 1 reduction.',
  },
  timingcover: {
    name: 'Timing cover', layer: 'timing',
    material: 'Cast aluminium',
    specs: [],
    text: 'Encloses the chain drive at the front of the engine and carries the front crank seal.',
  },
  accessory: {
    name: 'Accessory drive', layer: 'timing',
    material: 'Poly-V belt, cast housings',
    specs: [['Alternator', '180 A'], ['Water pump', 'Centrifugal, belt-driven']],
    text: 'A single ribbed belt runs from the crank damper to the alternator and the water pump. The pump sits at the top of the vee so coolant splits evenly between the two banks.',
  },
  flywheel: {
    name: 'Flywheel', layer: 'rotating',
    material: 'Billet steel, 132-tooth ring gear',
    specs: [['Diameter', '286 mm']],
    text: 'A light flywheel is enough: a V12 delivers overlapping power strokes, so torque at the crank never drops to zero.',
  },
  damper: {
    name: 'Crank damper', layer: 'rotating',
    material: 'Steel hub, viscous inertia ring',
    specs: [['Diameter', '160 mm']],
    text: 'A long six-throw crank twists under load. The damper absorbs torsional vibration at the free end and drives the accessory belt.',
  },
  stand: {
    name: 'Display stand', layer: 'stand',
    material: 'Brushed steel',
    specs: [],
    text: 'A cradle that holds the engine by its mounts.',
  },
};

export const LAYERS = [
  { id: 'intake', name: 'Intake' },
  { id: 'ignition', name: 'Ignition' },
  { id: 'covers', name: 'Cam covers' },
  { id: 'valvetrain', name: 'Valvetrain' },
  { id: 'heads', name: 'Cylinder heads' },
  { id: 'block', name: 'Block' },
  { id: 'rotating', name: 'Rotating assembly' },
  { id: 'timing', name: 'Timing drive' },
  { id: 'exhaust', name: 'Exhaust' },
  { id: 'sump', name: 'Sump' },
  { id: 'stand', name: 'Stand' },
];
