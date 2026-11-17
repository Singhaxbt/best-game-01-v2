// The game itself: state, levels, attempts, score and the per-frame step.
// Pure except for sound (injected, so tests can pass a silent stub) and
// the best score, which the caller loads and saves.

import {
  ARENA, LEVELS, WELL_MASS, MAX_WELLS, SHARD_R, GATE_R, SHARD_POINTS,
  ATTEMPTS_PER_LEVEL, COMET_R, COMBO_WINDOW, COMBO_STEP, COMBO_MAX,
  RESONANCE_BOOST, HUNTER_SPAWN_DELAY, HUNTER_KILL_POINTS, HUNTER_R,
} from './tuning.js';
import { stepComet, stepAsteroid, stepHunter, moverAt, crashReason, linkedWellSet } from './physics.js';
import { makeRng, range, seedFromString } from './rng.js';
import { sfx } from './sfx.js';

export const TRAIL_LEN = 90;

// A fresh run: title screen, level 1 loaded, no score yet.
export function createGame(sound = sfx) {
  const state = {
    screen: 'title',
    levelIndex: 0,
    level: null,
    comet: { x: 0, y: 0, vx: 0, vy: 0 },
    wells: [],
    wellType: 'attract',
    shardsTaken: 0,
    gateOpen: false,
    attempts: ATTEMPTS_PER_LEVEL,
    score: 0,
    levelScore: 0,
    shardPoints: 0, // shard points actually earned this level (with combos)
    hunterPoints: 0, // hunter-kill points earned this level
    combo: 1, // current shard multiplier
    comboTimer: 0, // seconds left to keep the combo alive
    comboChain: 0, // shards chained without a gap
    hunters: [], // shadow comets hunting the player comet
    huntersAwake: false, // the first well has woken them
    huntersSpawned: 0,
    hunterTimer: 0, // seconds until the next hunter spawns
    levelTime: 0,
    time: 0,
    trail: [],
    stars: [],
    shake: 0,
    flash: 0,
    crashKind: null,
    best: 0,
    sound,
  };
  loadLevel(state, 0);
  return state;
}

// Set up a level: comet on its pad, shards fresh, wells cleared,
// attempts restored, and a seeded starfield behind it all.
export function loadLevel(state, index) {
  const def = LEVELS[index];
  state.levelIndex = index;
  state.level = JSON.parse(JSON.stringify(def));
  state.comet = { x: def.start.x, y: def.start.y, vx: def.start.vx, vy: def.start.vy };
  state.wells = [];
  state.wellType = 'attract';
  state.shardsTaken = 0;
  state.gateOpen = false;
  state.attempts = ATTEMPTS_PER_LEVEL;
  state.levelScore = 0;
  state.shardPoints = 0;
  state.hunterPoints = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.comboChain = 0;
  state.hunters = [];
  state.huntersAwake = false;
  state.huntersSpawned = 0;
  state.hunterTimer = 0;
  state.levelTime = 0;
  state.time = 0;
  state.trail = [];
  state.shake = 0;
  state.flash = 0;
  state.crashKind = null;
  const rng = makeRng(seedFromString(def.name));
  state.stars = [];
  for (let i = 0; i < 130; i++) {
    state.stars.push({
      x: range(rng, 0, ARENA.w),
      y: range(rng, 0, ARENA.h),
      r: range(rng, 0.6, 2.1),
      phase: range(rng, 0, Math.PI * 2),
      speed: range(rng, 0.4, 1.6),
    });
  }
}

// Every gravity source this tick: planets, movers, the sun and the
// player's wells (repulsors count as negative mass). Wells linked to
// another well resonate and pull RESONANCE_BOOST times harder.
export function gravitySources(state) {
  const sources = [];
  for (const p of state.level.planets) sources.push({ x: p.x, y: p.y, mass: p.mass });
  for (const mv of state.level.movers) {
    const m = moverAt(mv, state.time);
    sources.push({ x: m.x, y: m.y, mass: m.mass });
  }
  if (state.level.sun) sources.push({ x: state.level.sun.x, y: state.level.sun.y, mass: state.level.sun.mass });
  const linked = linkedWellSet(state.wells);
  state.wells.forEach((w, i) => {
    const mass = (w.type === 'repel' ? -WELL_MASS : WELL_MASS) * (linked.has(i) ? RESONANCE_BOOST : 1);
    sources.push({ x: w.x, y: w.y, mass });
  });
  return sources;
}

// Wake a hunter at the arena corner farthest from the comet, so it has
// to cross the whole system to reach its prey.
function spawnHunter(state) {
  const corners = [
    { x: 60, y: 60 },
    { x: ARENA.w - 60, y: 60 },
    { x: 60, y: ARENA.h - 60 },
    { x: ARENA.w - 60, y: ARENA.h - 60 },
  ];
  let best = corners[0];
  let bestD = -1;
  for (const c of corners) {
    const d = Math.hypot(c.x - state.comet.x, c.y - state.comet.y);
    if (d > bestD) { bestD = d; best = c; }
  }
  state.hunters.push({ x: best.x, y: best.y, vx: 0, vy: 0, trail: [] });
  state.sound.warn();
}

// Click near a well to remove it; otherwise place one (oldest goes when
// the three slots are full). Wells may not be placed on top of a planet.
function handleWellClick(state, click) {
  const { x, y } = click;
  for (let i = 0; i < state.wells.length; i++) {
    const w = state.wells[i];
    if (Math.hypot(w.x - x, w.y - y) < 34) {
      state.wells.splice(i, 1);
      state.sound.remove();
      return;
    }
  }
  if (x < 16 || x > ARENA.w - 16 || y < 16 || y > ARENA.h - 16) return;
  for (const p of state.level.planets) {
    if (Math.hypot(p.x - x, p.y - y) < p.r + 30) return;
  }
  if (state.wells.length >= MAX_WELLS) state.wells.shift();
  state.wells.push({ x, y, type: state.wellType, born: state.time });
  state.sound.place();
  // The first well wakes the hunters: the wells hum, and they hear it.
  if (!state.huntersAwake && state.level.hunters > 0) {
    state.huntersAwake = true;
    state.hunterTimer = HUNTER_SPAWN_DELAY;
  }
}

// The comet crashed: lose an attempt, shake the screen, and either
// respawn on the pad (shards kept) or end the run. A crash breaks the
// combo — fast flying has to stay clean to pay.
function onCrash(state, kind) {
  state.crashKind = kind;
  state.attempts -= 1;
  state.shake = 14;
  state.flash = 0.7;
  state.combo = 1;
  state.comboTimer = 0;
  state.comboChain = 0;
  state.sound.crash();
  if (state.attempts <= 0) {
    state.screen = 'gameOver';
    state.sound.gameOver();
    return;
  }
  state.comet = {
    x: state.level.start.x,
    y: state.level.start.y,
    vx: state.level.start.vx,
    vy: state.level.start.vy,
  };
  state.wells = [];
  state.trail = [];
}

// All shards caught and the gate flown through: time bonus plus an
// attempts bonus, then the level-complete screen (or the win screen).
// Shard and hunter points were already banked as they were earned, so
// the level score is the sum of what this level actually paid.
function onGate(state) {
  const par = state.level.par;
  const timeBonus = Math.max(0, Math.round(par - state.levelTime)) * 10;
  const attemptBonus = state.attempts * 50;
  state.levelScore += timeBonus + attemptBonus;
  state.score += timeBonus + attemptBonus;
  state.sound.complete();
  if (state.levelIndex + 1 >= LEVELS.length) {
    state.screen = 'win';
    state.sound.win();
  } else {
    state.screen = 'levelDone';
  }
}

// One fixed step. input is { clicks, pressed } — clicks in arena coords,
// pressed a Set of event.codes pressed since the last frame.
export function stepGame(state, dt, input) {
  state.shake = Math.max(0, state.shake - dt * 30);
  state.flash = Math.max(0, state.flash - dt * 1.6);

  if (state.screen === 'title') {
    if (input.pressed.has('Enter') || input.pressed.has('Space') || input.clicks.length > 0) {
      state.screen = 'play';
      state.sound.click();
    }
    return;
  }

  if (state.screen === 'paused') {
    if (input.pressed.has('KeyP') || input.pressed.has('Escape') || input.pressed.has('Enter')) {
      state.screen = 'play';
      state.sound.click();
    }
    return;
  }

  if (state.screen === 'levelDone') {
    if (input.pressed.has('Enter') || input.pressed.has('Space') || input.clicks.length > 0) {
      loadLevel(state, state.levelIndex + 1);
      state.screen = 'play';
      state.sound.click();
    }
    return;
  }

  if (state.screen === 'gameOver') {
    if (input.pressed.has('Enter') || input.pressed.has('KeyR') || input.clicks.length > 0) {
      state.score = 0;
      loadLevel(state, 0);
      state.screen = 'play';
      state.sound.click();
    }
    return;
  }

  if (state.screen === 'win') {
    if (input.pressed.has('Enter') || input.pressed.has('KeyR') || input.clicks.length > 0) {
      state.score = 0;
      loadLevel(state, 0);
      state.screen = 'play';
      state.sound.click();
    }
    return;
  }

  // Playing.
  if (input.pressed.has('KeyP') || input.pressed.has('Escape')) {
    state.screen = 'paused';
    state.sound.click();
    return;
  }
  if (input.pressed.has('KeyR')) {
    loadLevel(state, state.levelIndex);
    state.sound.click();
    return;
  }
  if (input.pressed.has('Digit1')) state.wellType = 'attract';
  if (input.pressed.has('Digit2') && state.level.repulsor) state.wellType = 'repel';

  for (const click of input.clicks) {
    if (click.button === 2) {
      // Right-click removes the nearest well instead of placing one.
      let best = -1;
      let bestD = 60;
      state.wells.forEach((w, i) => {
        const d = Math.hypot(w.x - click.x, w.y - click.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) {
        state.wells.splice(best, 1);
        state.sound.remove();
      }
    } else {
      handleWellClick(state, click);
    }
  }

  state.time += dt;
  state.levelTime += dt;

  // The combo only lives as long as shards keep coming.
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      state.comboChain = 0;
    }
  }

  // Hunters wake a little after the first well, then one at a time.
  if (state.huntersAwake && state.huntersSpawned < state.level.hunters) {
    state.hunterTimer -= dt;
    if (state.hunterTimer <= 0) {
      spawnHunter(state);
      state.huntersSpawned += 1;
      state.hunterTimer = HUNTER_SPAWN_DELAY;
    }
  }

  stepComet(state.comet, gravitySources(state), dt);
  for (const a of state.level.asteroids) stepAsteroid(a, dt);

  // Hunters: they chase the comet, wells push them away, and a hazard
  // kills them — lure one into the sun or a planet for +150.
  let crashed = false;
  for (let i = state.hunters.length - 1; i >= 0; i--) {
    const h = state.hunters[i];
    stepHunter(h, state.comet, state.wells, state.level, state.time, dt);
    if (Math.hypot(h.x - state.comet.x, h.y - state.comet.y) < COMET_R + HUNTER_R) {
      onCrash(state, 'hunter');
      crashed = true;
      break;
    }
    if (crashReason(h, state.level, state.time)) {
      state.hunters.splice(i, 1);
      state.score += HUNTER_KILL_POINTS;
      state.levelScore += HUNTER_KILL_POINTS;
      state.hunterPoints += HUNTER_KILL_POINTS;
      state.sound.hunterKill();
    }
  }

  // The trail remembers where the comet has been, for the glowing tail.
  state.trail.push({ x: state.comet.x, y: state.comet.y });
  if (state.trail.length > TRAIL_LEN) state.trail.shift();

  // Shards, paid at the current combo multiplier.
  if (!crashed) {
    for (const s of state.level.shards) {
      if (s.taken) continue;
      if (Math.hypot(state.comet.x - s.x, state.comet.y - s.y) < SHARD_R) {
        s.taken = true;
        state.shardsTaken += 1;
        const pts = Math.round(SHARD_POINTS * state.combo);
        state.score += pts;
        state.levelScore += pts;
        state.shardPoints += pts;
        state.comboChain += 1;
        state.combo = Math.min(COMBO_MAX, 1 + COMBO_STEP * state.comboChain);
        state.comboTimer = COMBO_WINDOW;
        state.sound.collect(state.shardsTaken);
        if (state.shardsTaken >= state.level.shards.length) {
          state.gateOpen = true;
          state.sound.gateOpen();
        }
      }
    }

    // The gate, once open.
    if (state.gateOpen) {
      const g = state.level.gate;
      if (Math.hypot(state.comet.x - g.x, state.comet.y - g.y) < GATE_R) {
        onGate(state);
        return;
      }
    }
  }

  // Hazards.
  const kind = crashReason(state.comet, state.level, state.time);
  if (kind) onCrash(state, kind);
}

// The comet's speed as a fraction of the cap, for the HUD speed bar.
export function speedFraction(state) {
  return Math.hypot(state.comet.vx, state.comet.vy) / 520;
}
