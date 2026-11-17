// Balance numbers, palette and the six star systems of PERIHELION.
// One file holds every number a designer would tune, so the sim never
// hides a magic constant inside its logic.

export const ARENA = { w: 1280, h: 720 };

// Gravity: acceleration = G * mass / (distance^2 + SOFT2), clamped.
// With G 750 and a planet mass of 8000, a comet 200 px out feels about
// 150 px/s^2 of pull — enough to bend an orbit, never enough to teleport.
export const G = 750;
export const SOFT2 = 900;
export const MAX_ACCEL = 1200;
export const MAX_SPEED = 520;
export const COMET_R = 9;

// A player well pulls (attractor) or pushes (repulsor) about as hard as
// a heavy planet, so three wells are enough to steer any orbit — but not
// so hard that one click flings the comet into the speed cap.
export const WELL_MASS = 7000;
export const MAX_WELLS = 3;
export const WELL_R = 26;

export const SHARD_R = 24; // collect distance, centre to centre
export const GATE_R = 34; // enter distance, centre to centre — generous on purpose: the gate is the goal, not a trick
export const SHARD_POINTS = 100;
export const ATTEMPTS_PER_LEVEL = 3;
export const BOUNCE_LOSS = 0.9; // arena walls bounce, keeping 90% of speed

// Combo: shards caught within COMBO_WINDOW seconds of each other chain a
// multiplier on their points (1 + COMBO_STEP per link, up to COMBO_MAX).
// Fast, aggressive flying pays; dawdling pays the base rate.
export const COMBO_WINDOW = 3;
export const COMBO_STEP = 0.5;
export const COMBO_MAX = 3;

// Resonance: two wells within RESONANCE_DIST of each other link, and each
// linked well pulls RESONANCE_BOOST times harder. Well placement relative
// to other wells matters, not just to the comet.
export const RESONANCE_DIST = 180;
export const RESONANCE_BOOST = 1.5;

// Hunters: shadow comets that wake when the first well is placed (the
// wells hum, and the hunters hear them) and hunt the player comet. They
// are slower than the comet, wells repel them, and they die on any
// hazard — lure one into the sun or a planet for HUNTER_KILL_POINTS.
export const HUNTER_SPEED = 180;
export const HUNTER_ACCEL = 140;
export const HUNTER_R = 10;
export const HUNTER_REPEL_DIST = 220;
export const HUNTER_REPEL_ACCEL = 320;
export const HUNTER_SPAWN_DELAY = 2;
export const HUNTER_KILL_POINTS = 150;

export const PALETTE = {
  bg: '#070a18',
  bgDeep: '#04060f',
  comet: '#eafcff',
  cometCore: '#ffffff',
  trail: '#5fe8ff',
  wellAttract: '#ff4fd8',
  wellRepel: '#4f9dff',
  shard: '#ffd76a',
  gate: '#3dffa0',
  gateDim: '#2a6b52',
  sun: '#ffb347',
  sunCore: '#ffe9a8',
  hud: '#cfe6ff',
  hudDim: '#6f86b8',
  danger: '#ff5d5d',
  panel: 'rgba(8, 14, 34, 0.88)',
  panelEdge: '#2a4a7a',
};

export const PLANET_COLORS = ['#3ec9a7', '#e26d8d', '#8b7bff', '#7fc24f', '#e0a458'];

// A level: where the comet starts and how fast, the sun, the planets,
// the shards to collect, the gate, drifting asteroids, and the par time.
// Moving planets circle a centre; asteroids drift in straight lines and
// bounce off the arena walls.
export const LEVELS = [
  {
    name: 'FIRST LIGHT',
    hint: 'Click to place a gravity well. Bend your orbit through every shard, then fly into the gate.',
    par: 45,
    start: { x: 120, y: 600, vx: 140, vy: 40 },
    sun: null,
    planets: [{ x: 640, y: 360, r: 46, mass: 5000, color: 0 }],
    movers: [],
    shards: [{ x: 640, y: 170 }, { x: 980, y: 360 }, { x: 1120, y: 560 }],
    gate: { x: 1160, y: 110 },
    asteroids: [],
    repulsor: false,
    hunters: 0,
  },
  {
    name: 'TWIN PULL',
    hint: 'Two planets, one sun in the corner. Keep clear of the burn radius.',
    par: 60,
    start: { x: 120, y: 120, vx: 40, vy: 180 },
    sun: { x: 1180, y: 640, r: 34, kill: 62, mass: 10000 },
    planets: [
      { x: 420, y: 240, r: 40, mass: 4500, color: 1 },
      { x: 860, y: 480, r: 40, mass: 4500, color: 2 },
    ],
    movers: [],
    shards: [{ x: 640, y: 110 }, { x: 640, y: 610 }, { x: 1110, y: 300 }, { x: 300, y: 600 }],
    gate: { x: 1120, y: 130 },
    asteroids: [],
    repulsor: false,
    hunters: 0,
  },
  {
    name: 'THE BELT',
    hint: 'Asteroids drift across the middle. Time your crossing between them.',
    par: 70,
    start: { x: 120, y: 360, vx: -80, vy: -120 },
    sun: null,
    planets: [{ x: 640, y: 360, r: 34, mass: 4000, color: 3 }],
    movers: [],
    shards: [{ x: 400, y: 140 }, { x: 880, y: 140 }, { x: 640, y: 620 }, { x: 1120, y: 360 }],
    gate: { x: 1180, y: 110 },
    asteroids: [
      { x: 420, y: 200, vx: 0, vy: 55, r: 16 },
      { x: 560, y: 520, vx: 0, vy: -60, r: 18 },
      { x: 760, y: 180, vx: 0, vy: 62, r: 15 },
      { x: 920, y: 500, vx: 0, vy: -55, r: 17 },
      { x: 1080, y: 300, vx: 0, vy: 48, r: 14 },
    ],
    repulsor: false,
    hunters: 1,
  },
  {
    name: 'PUSH AND PULL',
    hint: 'Repulsor wells unlocked — press 2, then click to push the comet away.',
    par: 70,
    start: { x: 640, y: 660, vx: 0, vy: -160 },
    sun: null,
    planets: [
      { x: 380, y: 300, r: 42, mass: 4500, color: 0 },
      { x: 900, y: 300, r: 42, mass: 4500, color: 4 },
    ],
    movers: [],
    shards: [{ x: 640, y: 480 }, { x: 300, y: 560 }, { x: 980, y: 560 }, { x: 640, y: 130 }],
    gate: { x: 640, y: 70 },
    asteroids: [],
    repulsor: true,
    hunters: 1,
  },
  {
    name: 'THE DANCER',
    hint: 'The violet planet orbits the centre. Slingshot around it while it moves.',
    par: 80,
    start: { x: 120, y: 640, vx: 160, vy: 200 },
    sun: { x: 120, y: 120, r: 30, kill: 56, mass: 10000 },
    planets: [],
    movers: [{ cx: 640, cy: 360, orbitR: 180, speed: 0.16, phase: 0, r: 38, mass: 5000, color: 2 }],
    shards: [
      { x: 640, y: 120 },
      { x: 1100, y: 200 },
      { x: 1100, y: 560 },
      { x: 400, y: 600 },
      { x: 240, y: 360 },
    ],
    gate: { x: 1160, y: 640 },
    asteroids: [],
    repulsor: true,
    hunters: 2,
  },
  {
    name: 'PERIHELION',
    hint: 'The sun itself is the turn. Skim its burn radius and let it throw you to the gate.',
    par: 90,
    start: { x: 120, y: 360, vx: 160, vy: 220 },
    sun: { x: 640, y: 360, r: 40, kill: 62, mass: 8000 },
    planets: [
      { x: 280, y: 150, r: 36, mass: 4500, color: 1 },
      { x: 1000, y: 570, r: 36, mass: 4500, color: 3 },
    ],
    movers: [],
    shards: [
      { x: 640, y: 120 },
      { x: 960, y: 200 },
      { x: 1120, y: 360 },
      { x: 960, y: 520 },
      { x: 400, y: 600 },
    ],
    gate: { x: 640, y: 80 },
    asteroids: [
      { x: 480, y: 160, vx: 25, vy: 35, r: 14 },
      { x: 820, y: 580, vx: -30, vy: -35, r: 15 },
    ],
    repulsor: true,
    hunters: 2,
  },
];
