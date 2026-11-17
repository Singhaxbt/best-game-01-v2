// Pure physics: gravity, integration and collisions. No DOM, no canvas,
// no randomness — the same inputs always give the same outputs, so the
// simulation can be tested headless in Node.

import {
  ARENA, G, SOFT2, MAX_ACCEL, MAX_SPEED, COMET_R, BOUNCE_LOSS,
  RESONANCE_DIST, RESONANCE_BOOST, HUNTER_SPEED, HUNTER_ACCEL, HUNTER_R,
  HUNTER_REPEL_DIST, HUNTER_REPEL_ACCEL,
} from './tuning.js';

// Every source of gravity this tick: planets, movers, the sun and the
// player's wells. Each is { x, y, mass } with mass negative for repulsors.
export function gravityAt(x, y, sources) {
  let ax = 0;
  let ay = 0;
  for (const s of sources) {
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy + SOFT2;
    const inv = 1 / (d2 * Math.sqrt(d2));
    const pull = G * s.mass * inv;
    ax += dx * pull;
    ay += dy * pull;
  }
  // Clamp the total acceleration so a comet skimming a well never explodes.
  const mag = Math.hypot(ax, ay);
  if (mag > MAX_ACCEL) {
    ax = (ax / mag) * MAX_ACCEL;
    ay = (ay / mag) * MAX_ACCEL;
  }
  return { ax, ay };
}

// Semi-implicit Euler step for the comet, then a soft bounce off the
// arena walls so the comet always stays in play.
export function stepComet(comet, sources, dt) {
  const { ax, ay } = gravityAt(comet.x, comet.y, sources);
  comet.vx += ax * dt;
  comet.vy += ay * dt;
  const speed = Math.hypot(comet.vx, comet.vy);
  if (speed > MAX_SPEED) {
    comet.vx = (comet.vx / speed) * MAX_SPEED;
    comet.vy = (comet.vy / speed) * MAX_SPEED;
  }
  comet.x += comet.vx * dt;
  comet.y += comet.vy * dt;
  const m = COMET_R + 3;
  if (comet.x < m) { comet.x = m; comet.vx = Math.abs(comet.vx) * BOUNCE_LOSS; }
  if (comet.x > ARENA.w - m) { comet.x = ARENA.w - m; comet.vx = -Math.abs(comet.vx) * BOUNCE_LOSS; }
  if (comet.y < m) { comet.y = m; comet.vy = Math.abs(comet.vy) * BOUNCE_LOSS; }
  if (comet.y > ARENA.h - m) { comet.y = ARENA.h - m; comet.vy = -Math.abs(comet.vy) * BOUNCE_LOSS; }
}

// Move one asteroid in a straight line, bouncing off the arena walls.
export function stepAsteroid(a, dt) {
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  if (a.x < a.r || a.x > ARENA.w - a.r) a.vx = -a.vx;
  if (a.y < a.r || a.y > ARENA.h - a.r) a.vy = -a.vy;
  a.x = Math.max(a.r, Math.min(ARENA.w - a.r, a.x));
  a.y = Math.max(a.r, Math.min(ARENA.h - a.r, a.y));
}

// Where a moving planet is at time t (seconds since the level loaded).
export function moverAt(mover, t) {
  const a = mover.phase + mover.speed * t;
  return {
    x: mover.cx + Math.cos(a) * mover.orbitR,
    y: mover.cy + Math.sin(a) * mover.orbitR,
    r: mover.r,
    mass: mover.mass,
    color: mover.color,
  };
}

// Indices of wells linked to at least one other well (within
// RESONANCE_DIST). A linked well pulls RESONANCE_BOOST times harder.
// Exported so the sim can apply the boost and the renderer can draw
// the link beams.
export function linkedWellSet(wells) {
  const linked = new Set();
  for (let i = 0; i < wells.length; i++) {
    for (let j = i + 1; j < wells.length; j++) {
      const dx = wells[i].x - wells[j].x;
      const dy = wells[i].y - wells[j].y;
      if (dx * dx + dy * dy <= RESONANCE_DIST * RESONANCE_DIST) {
        linked.add(i);
        linked.add(j);
      }
    }
  }
  return linked;
}

// The linked pairs themselves, for drawing beams.
export function linkedWellPairs(wells) {
  const pairs = [];
  for (let i = 0; i < wells.length; i++) {
    for (let j = i + 1; j < wells.length; j++) {
      const dx = wells[i].x - wells[j].x;
      const dy = wells[i].y - wells[j].y;
      if (dx * dx + dy * dy <= RESONANCE_DIST * RESONANCE_DIST) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

// One hunter step: accelerate toward the comet, get pushed away by
// wells, steer clear of the sun and planets (a hunter that flies into
// a hazard dies, so it gives them a wide berth), bounce off the walls,
// and remember a short trail behind it.
export function stepHunter(h, comet, wells, level, t, dt) {
  const dx = comet.x - h.x;
  const dy = comet.y - h.y;
  const d = Math.hypot(dx, dy) || 1;
  h.vx += (dx / d) * HUNTER_ACCEL * dt;
  h.vy += (dy / d) * HUNTER_ACCEL * dt;
  for (const w of wells) {
    const wx = h.x - w.x;
    const wy = h.y - w.y;
    const wd = Math.hypot(wx, wy);
    if (wd > 0 && wd < HUNTER_REPEL_DIST) {
      const push = HUNTER_REPEL_ACCEL * (1 - wd / HUNTER_REPEL_DIST) * dt;
      h.vx += (wx / wd) * push;
      h.vy += (wy / wd) * push;
    }
  }
  // Give the sun and the planets a wide berth — the hunter is a hunter,
  // not a kamikaze, and flying into a hazard would end it.
  const shy = (hx, hy, radius, margin, strength) => {
    const sx = h.x - hx;
    const sy = h.y - hy;
    const sd = Math.hypot(sx, sy);
    if (sd > 0 && sd < radius + margin) {
      const push = strength * (1 - (sd - radius) / margin) * dt;
      h.vx += (sx / sd) * push;
      h.vy += (sy / sd) * push;
    }
  };
  if (level.sun) shy(level.sun.x, level.sun.y, level.sun.kill, 90, 420);
  for (const p of level.planets) shy(p.x, p.y, p.r, 70, 320);
  for (const mv of level.movers) {
    const m = moverAt(mv, t);
    shy(m.x, m.y, m.r, 70, 320);
  }
  const sp = Math.hypot(h.vx, h.vy);
  if (sp > HUNTER_SPEED) {
    h.vx = (h.vx / sp) * HUNTER_SPEED;
    h.vy = (h.vy / sp) * HUNTER_SPEED;
  }
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  if (h.x < HUNTER_R) { h.x = HUNTER_R; h.vx = Math.abs(h.vx); }
  if (h.x > ARENA.w - HUNTER_R) { h.x = ARENA.w - HUNTER_R; h.vx = -Math.abs(h.vx); }
  if (h.y < HUNTER_R) { h.y = HUNTER_R; h.vy = Math.abs(h.vy); }
  if (h.y > ARENA.h - HUNTER_R) { h.y = ARENA.h - HUNTER_R; h.vy = -Math.abs(h.vy); }
  h.trail.push({ x: h.x, y: h.y });
  if (h.trail.length > 24) h.trail.shift();
}

// Crash reason for the comet right now, or null when it is safe:
// 'sun' inside the burn radius, 'planet' touching a solid body, or
// 'asteroid' touching a drifting rock.
export function crashReason(comet, level, t) {
  if (level.sun) {
    const d = Math.hypot(comet.x - level.sun.x, comet.y - level.sun.y);
    if (d < level.sun.kill) return 'sun';
  }
  for (const p of level.planets) {
    const d = Math.hypot(comet.x - p.x, comet.y - p.y);
    if (d < p.r + COMET_R) return 'planet';
  }
  for (const mv of level.movers) {
    const m = moverAt(mv, t);
    const d = Math.hypot(comet.x - m.x, comet.y - m.y);
    if (d < m.r + COMET_R) return 'planet';
  }
  for (const a of level.asteroids) {
    const d = Math.hypot(comet.x - a.x, comet.y - a.y);
    if (d < a.r + COMET_R) return 'asteroid';
  }
  return null;
}
