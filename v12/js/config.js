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
  paint: {
    label: 'Paint', subject: 'car',
    options: [
      { id: 'rosso', name: 'Rosso corsa', color: '#a80d16', metal: 0.2 },
      { id: 'scuro', name: 'Rosso scuro', color: '#5e0709', metal: 0.4 },
      { id: 'blu', name: 'Blu notte', color: '#0b1c46', metal: 0.45 },
      { id: 'verde', name: 'Verde scuro', color: '#0a2c20', metal: 0.4 },
      { id: 'grigio', name: 'Grigio titanio', color: '#3f4247', metal: 0.6 },
      { id: 'argento', name: 'Argento', color: '#aeb1b6', metal: 0.7 },
      { id: 'bianco', name: 'Bianco perla', color: '#dedcd4', metal: 0.3 },
      { id: 'giallo', name: 'Giallo', color: '#cf9d06', metal: 0.2 },
      { id: 'nero', name: 'Nero', color: '#070708', metal: 0.4 },
    ],
  },
  roof: {
    label: 'Roof', subject: 'car',
    options: [
      { id: 'body', name: 'Body colour', color: '#8a8d92' },
      { id: 'black', name: 'Gloss black', color: '#050506', contrast: true },
    ],
  },
  wheels: {
    label: 'Wheels', subject: 'car',
    options: [
      { id: 'silver', name: 'Forged silver', color: '#b9bcc2', rough: 0.2 },
      { id: 'bright', name: 'Diamond cut', color: '#eceef2', rough: 0.07 },
      { id: 'black', name: 'Gloss black', color: '#0c0c0d', rough: 0.18, metal: 0.6 },
      { id: 'bronze', name: 'Satin bronze', color: '#7a6240', rough: 0.34 },
    ],
  },
  calipers: {
    label: 'Brake calipers', subject: 'car',
    options: [
      { id: 'red', name: 'Rosso', color: '#b3120e' },
      { id: 'yellow', name: 'Giallo', color: '#dba800' },
      { id: 'blue', name: 'Blu', color: '#1746a0' },
      { id: 'black', name: 'Nero', color: '#0d0d0e' },
    ],
  },
  interior: {
    label: 'Leather', subject: 'car',
    options: [
      { id: 'cuoio', name: 'Cuoio', color: '#8a4b25' },
      { id: 'crema', name: 'Crema', color: '#c2b092' },
      { id: 'rosso', name: 'Rosso', color: '#6a0f10' },
      { id: 'nero', name: 'Nero', color: '#131314' },
    ],
  },
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
export const GEARS = [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69];
export const FINAL_DRIVE = 3.73;
export const TYRE_R = 0.362;          // driven (rear) tyre radius, metres
export const PARTS = {
  body: {
    name: 'Bodywork', layer: 'body',
    material: 'Aluminium and carbon-fibre panels',
    specs: [['Length', '4,650 mm'], ['Width', '1,980 mm'], ['Height', '1,272 mm'], ['Wheelbase', '2,720 mm']],
    text: 'A two-seat fastback with the cabin set well back: the whole engine sits behind the front axle line, which puts just under half the weight on the front wheels.',
  },
  bonnet: {
    name: 'Bonnet', layer: 'body',
    material: 'Carbon fibre, rear-hinged',
    specs: [['Vents', 'Two heat extractors']],
    text: 'A long clamshell with a central bulge to clear the twelve intake trumpets. The extractor vents let hot air out of the bay rather than under the car.',
  },
  doors: {
    name: 'Doors', layer: 'body',
    material: 'Aluminium skin, frameless glass',
    specs: [['Opening', '64°']],
    text: 'Front-hinged doors with frameless side glass and a release set flush into the shoulder line.',
  },
  glass: {
    name: 'Glasshouse', layer: 'glass',
    material: 'Laminated acoustic glass',
    specs: [['Screen rake', '62° from vertical']],
    text: 'A steeply raked screen runs into a long fastback rear window, with the side glass tapering to a point over the rear haunch.',
  },
  lights: {
    name: 'Lighting', layer: 'body',
    material: 'Matrix LED',
    specs: [['Front', 'Three projectors per side'], ['Rear', 'Four round lamps']],
    text: 'Long clear-covered headlamps sweep back along the wings, each with three projector units and an L-shaped running light. Four round lamps sit in the tail.',
  },
  aero: {
    name: 'Aero', layer: 'body',
    material: 'Carbon fibre',
    specs: [['Front', 'Splitter with dive planes'], ['Rear', 'Seven-channel diffuser']],
    text: 'A flat floor feeds the rear diffuser, the splitter balances it at the front, and the ducktail trims lift over the rear axle.',
  },
  lining: {
    name: 'Cabin lining', layer: 'cabin',
    material: 'Alcantara',
    specs: [],
    text: 'Headlining and door cards trimmed in dark Alcantara.',
  },
  cabin: {
    name: 'Cabin', layer: 'cabin',
    material: 'Leather, Alcantara and carbon fibre',
    specs: [['Seats', 'Two carbon-shell buckets'], ['Drive', 'Left-hand']],
    text: 'Two carbon-shell seats either side of a wide tunnel that carries the torque tube and both exhaust runs. The driver sits behind a three-spoke wheel and a single curved display.',
  },
  wheels: {
    name: 'Wheels & tyres', layer: 'wheels',
    material: 'Forged aluminium',
    specs: [['Front', '275/35 ZR20'], ['Rear', '315/30 ZR21'], ['Design', 'Five twin spokes, dished']],
    text: 'Forged wheels with five pairs of spokes that splay from the hub, on five studs. The rears are wider and an inch larger to put the power down.',
  },
  brakes: {
    name: 'Brakes', layer: 'wheels',
    material: 'Carbon-ceramic discs, monobloc calipers',
    specs: [['Front discs', '394 mm, drilled'], ['Rear discs', '414 mm, drilled'], ['Calipers', 'Six-piston']],
    text: 'Drilled carbon-ceramic discs shed heat and unsprung mass. Calipers trail the front axle and lead the rear, keeping their weight inside the wheelbase.',
  },
  suspension: {
    name: 'Suspension', layer: 'chassis',
    material: 'Forged aluminium wishbones',
    specs: [['Layout', 'Double wishbones all round'], ['Dampers', 'Coil-over, adjustable'], ['Roll bars', 'Front and rear']],
    text: 'Unequal-length wishbones at each corner hold the tyre upright as the body rolls. Coil-over dampers act directly on the lower arms.',
  },
  tub: {
    name: 'Carbon tub', layer: 'chassis',
    material: 'Pre-preg carbon-fibre monocoque',
    specs: [['Structure', 'Floor, sills, bulkheads, roof hoop'], ['Tunnel', 'Torque tube and exhaust']],
    text: 'The occupants sit in a single carbon moulding. Aluminium subframes bolt to its bulkheads to carry the engine at the front and the transaxle at the back.',
  },
  chassis: {
    name: 'Subframes & cooling', layer: 'chassis',
    material: 'Extruded and cast aluminium',
    specs: [['Front', 'Engine cradle, crash structure, radiator'], ['Bracing', 'Carbon strut brace']],
    text: 'Aluminium rails run forward from the tub to the crash structure, with cast towers for the dampers. The radiator pack leans forward behind the grille.',
  },
  drivetrain: {
    name: 'Transaxle & torque tube', layer: 'powertrain',
    material: 'Cast aluminium case',
    specs: [['Gearbox', '7-speed dual-clutch'], ['Final drive', FINAL_DRIVE.toFixed(2) + ' : 1'], ['Drive', 'Rear wheels']],
    text: 'The gearbox sits between the rear wheels, joined to the engine by a rigid torque tube. Putting it there balances the weight of the V12 up front.',
  },
  exhaustsys: {
    name: 'Exhaust system', layer: 'powertrain',
    material: 'Stainless steel',
    specs: [['Layout', 'Twin system, four tailpipes'], ['Catalysts', 'One per bank']],
    text: 'Each bank keeps its own pipe from manifold to tailpipe. Both run through the tunnel beside the torque tube and split round the transaxle to a silencer at each corner.',
  },
  v12: {
    name: '6.0 L V12', layer: 'powertrain',
    material: 'See the engine view for every part',
    specs: [['Position', 'Front-mid, longitudinal'], ['Output', '589 kW at 8,550 rpm']],
    text: 'The engine sits entirely behind the front axle. Switch to the engine view to run it in x-ray, section it or take it apart.',
  },
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

export const CAR_LAYERS = [
  { id: 'body', name: 'Body panels' },
  { id: 'glass', name: 'Glass' },
  { id: 'cabin', name: 'Cabin' },
  { id: 'wheels', name: 'Wheels & brakes' },
  { id: 'chassis', name: 'Chassis' },
  { id: 'powertrain', name: 'Powertrain' },
];

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
