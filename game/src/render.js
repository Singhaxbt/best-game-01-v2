// Everything the player sees: the starfield, the sun, planets, wells,
// the comet's trail, the HUD and every screen. Nothing here rolls dice —
// twinkle and shake are functions of the world's own clock, so a frozen
// world always renders the same pixels.

import { ARENA, PALETTE, PLANET_COLORS, MAX_WELLS, COMET_R, HUNTER_R } from './tuning.js';
import { moverAt, linkedWellPairs } from './physics.js';
import { speedFraction } from './sim.js';

// A deterministic wobble for screen shake: a function of time, never random.
function shakeOffset(state) {
  if (state.shake <= 0.1) return { x: 0, y: 0 };
  const t = state.time * 47;
  return {
    x: Math.sin(t * 1.3) * state.shake * 0.5,
    y: Math.cos(t * 1.7) * state.shake * 0.5,
  };
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function drawStars(ctx, state) {
  for (const s of state.stars) {
    const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * s.speed + s.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#dfe9ff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, sun, t) {
  // The burn radius, drawn as a faint dashed ring so the danger is honest.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 93, 93, 0.35)';
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 1.5;
  circle(ctx, sun.x, sun.y, sun.kill);
  ctx.stroke();
  ctx.restore();
  const glow = ctx.createRadialGradient(sun.x, sun.y, sun.r * 0.2, sun.x, sun.y, sun.r * 3.2);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.5)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  circle(ctx, sun.x, sun.y, sun.r * 3.2);
  ctx.fill();
  const core = ctx.createRadialGradient(
    sun.x - sun.r * 0.25, sun.y - sun.r * 0.25, 2, sun.x, sun.y, sun.r,
  );
  core.addColorStop(0, PALETTE.sunCore);
  core.addColorStop(1, PALETTE.sun);
  ctx.fillStyle = core;
  circle(ctx, sun.x, sun.y, sun.r);
  ctx.fill();
  // A slow solar flare arc, placed by the clock.
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const a0 = t * 0.5;
  ctx.arc(sun.x, sun.y, sun.r + 7, a0, a0 + 1.1);
  ctx.stroke();
}

function drawPlanet(ctx, x, y, r, colorIdx, t) {
  const color = PLANET_COLORS[colorIdx % PLANET_COLORS.length];
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, '#0a0f22');
  ctx.fillStyle = grad;
  circle(ctx, x, y, r);
  ctx.fill();
  // One slow band across the face, so the planet reads as a world.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(x, y + Math.sin(t * 0.3) * 3, r * 1.1, r * 0.28, -0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  circle(ctx, x, y, r);
  ctx.stroke();
}

function drawAsteroid(ctx, a, index) {
  ctx.fillStyle = '#8d97ad';
  circle(ctx, a.x, a.y, a.r);
  ctx.fill();
  ctx.fillStyle = '#6b7488';
  // Craters placed by a hash of the asteroid's index, never at random.
  for (let i = 0; i < 3; i++) {
    const h = Math.sin(index * 12.9898 + i * 78.233) * 43758.5453;
    const f = h - Math.floor(h);
    const cx = a.x + (f - 0.5) * a.r * 1.1;
    const cy = a.y + (Math.sin(index * 3.7 + i * 5.1) * 0.5) * a.r;
    circle(ctx, cx, cy, a.r * 0.22);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  circle(ctx, a.x, a.y, a.r);
  ctx.stroke();
}

function drawShard(ctx, s, i, t) {
  if (s.taken) return;
  const pulse = 1 + 0.12 * Math.sin(t * 3 + i * 1.7);
  const r = 11 * pulse;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.PI / 4 + Math.sin(t * 1.2 + i) * 0.12);
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
  glow.addColorStop(0, 'rgba(255, 215, 106, 0.55)');
  glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
  ctx.fillStyle = glow;
  circle(ctx, 0, 0, r * 2.4);
  ctx.fill();
  ctx.fillStyle = PALETTE.shard;
  ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
  ctx.restore();
}

function drawGate(ctx, gate, open, t) {
  ctx.save();
  ctx.translate(gate.x, gate.y);
  if (open) {
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    glow.addColorStop(0, 'rgba(61, 255, 160, 0.5)');
    glow.addColorStop(1, 'rgba(61, 255, 160, 0)');
    ctx.fillStyle = glow;
    circle(ctx, 0, 0, 52);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gate;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 8]);
    ctx.lineDashOffset = -t * 30;
    circle(ctx, 0, 0, 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.gate;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATE', 0, -36);
  } else {
    ctx.strokeStyle = PALETTE.gateDim;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 8]);
    circle(ctx, 0, 0, 34);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawResonance(ctx, state, t) {
  // Beams between linked wells, with the boost written on the midpoint.
  const pairs = linkedWellPairs(state.wells);
  for (const [i, j] of pairs) {
    const a = state.wells[i];
    const b = state.wells[j];
    const alpha = 0.35 + 0.2 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(255, 79, 216, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 190, 240, ${0.7 + 0.3 * Math.sin(t * 4)})`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('×1.5', (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
  }
}

function drawHunter(ctx, h, t) {
  // The red trail behind it, then a dark body with a crimson rim.
  const trail = h.trail;
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const f = i / trail.length;
      ctx.strokeStyle = `rgba(255, 93, 93, ${f * 0.7})`;
      ctx.lineWidth = 1 + f * 4;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  }
  const glow = ctx.createRadialGradient(h.x, h.y, 1, h.x, h.y, 30);
  glow.addColorStop(0, 'rgba(255, 93, 93, 0.5)');
  glow.addColorStop(1, 'rgba(255, 93, 93, 0)');
  ctx.fillStyle = glow;
  circle(ctx, h.x, h.y, 30);
  ctx.fill();
  ctx.fillStyle = '#20060f';
  circle(ctx, h.x, h.y, HUNTER_R);
  ctx.fill();
  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 2;
  circle(ctx, h.x, h.y, HUNTER_R);
  ctx.stroke();
  // Two eyes, facing where it flies.
  const sp = Math.hypot(h.vx, h.vy) || 1;
  const nx = h.vx / sp;
  const ny = h.vy / sp;
  const px = -ny;
  const py = nx;
  ctx.fillStyle = '#ff2e2e';
  circle(ctx, h.x + nx * 4 + px * 3.5, h.y + ny * 4 + py * 3.5, 1.8);
  ctx.fill();
  circle(ctx, h.x + nx * 4 - px * 3.5, h.y + ny * 4 - py * 3.5, 1.8);
  ctx.fill();
}

function drawWell(ctx, w, t) {
  const attract = w.type === 'attract';
  const color = attract ? PALETTE.wellAttract : PALETTE.wellRepel;
  const pulse = 1 + 0.1 * Math.sin(t * 4 + w.born);
  ctx.save();
  ctx.translate(w.x, w.y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
  glow.addColorStop(0, attract ? 'rgba(255, 79, 216, 0.4)' : 'rgba(79, 157, 255, 0.4)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  circle(ctx, 0, 0, 46);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  circle(ctx, 0, 0, 26 * pulse);
  ctx.stroke();
  // Chevrons point in for attractors, out for repulsors.
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + t * 0.8 * (attract ? 1 : -1);
    const r1 = attract ? 18 : 12;
    const r2 = attract ? 10 : 20;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.lineTo(Math.cos(a + 0.35) * r1, Math.sin(a + 0.35) * r1);
    ctx.lineTo(Math.cos(a - 0.35) * r1, Math.sin(a - 0.35) * r1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawComet(ctx, state) {
  const trail = state.trail;
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const f = i / trail.length;
      ctx.strokeStyle = `rgba(95, 232, 255, ${f * 0.75})`;
      ctx.lineWidth = 1 + f * 5;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  }
  const c = state.comet;
  const glow = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, 34);
  glow.addColorStop(0, 'rgba(234, 252, 255, 0.9)');
  glow.addColorStop(0.4, 'rgba(95, 232, 255, 0.35)');
  glow.addColorStop(1, 'rgba(95, 232, 255, 0)');
  ctx.fillStyle = glow;
  circle(ctx, c.x, c.y, 34);
  ctx.fill();
  ctx.fillStyle = PALETTE.cometCore;
  circle(ctx, c.x, c.y, COMET_R);
  ctx.fill();
  ctx.fillStyle = PALETTE.trail;
  circle(ctx, c.x - 3, c.y - 3, 3.5);
  ctx.fill();
}

// --- HUD ---

function drawHud(ctx, state) {
  const level = state.level;
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LEVEL ${state.levelIndex + 1}/6 — ${level.name}`, 20, 30);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`par ${level.par}s`, 20, 52);

  // Shards: diamonds, filled when caught.
  const total = level.shards.length;
  for (let i = 0; i < total; i++) {
    const x = 20 + i * 26;
    const y = 76;
    ctx.save();
    ctx.translate(x + 8, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = level.shards[i].taken ? PALETTE.shard : 'rgba(255, 215, 106, 0.25)';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${state.shardsTaken}/${total} shards`, 20 + total * 26 + 8, 81);

  // Attempts as three dots.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < state.attempts ? '#ff8f8f' : 'rgba(255, 93, 93, 0.2)';
    circle(ctx, 1120 + i * 24, 26, 7);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`SCORE ${state.score}`, 1260, 52);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`${Math.floor(state.levelTime)}s`, 1260, 74);

  // The combo multiplier, only while it is alive.
  if (state.combo > 1) {
    ctx.fillStyle = PALETTE.shard;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`COMBO ×${state.combo.toFixed(1)}`, 1260, 98);
  }
  // Hunters on the board, as a red warning.
  if (state.hunters.length > 0) {
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`HUNTERS ${state.hunters.length}`, 1260, state.combo > 1 ? 120 : 98);
  }

  // Well slots and the selected well type, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(state.wellType === 'attract' ? 'WELL: ATTRACT  [1]' : 'WELL: REPEL  [2]', 20, 692);
  if (state.level.repulsor) {
    ctx.fillText('press 1 attract · 2 repel', 20, 668);
  }
  for (let i = 0; i < MAX_WELLS; i++) {
    const x = 250 + i * 26;
    ctx.strokeStyle = i < state.wells.length
      ? (state.wells[i].type === 'attract' ? PALETTE.wellAttract : PALETTE.wellRepel)
      : 'rgba(111, 134, 184, 0.4)';
    ctx.lineWidth = 2;
    circle(ctx, x, 688, 8);
    ctx.stroke();
    if (i < state.wells.length) {
      ctx.fillStyle = state.wells[i].type === 'attract' ? PALETTE.wellAttract : PALETTE.wellRepel;
      circle(ctx, x, 688, 3.5);
      ctx.fill();
    }
  }

  // Speed bar, bottom right.
  const f = speedFraction(state);
  ctx.fillStyle = 'rgba(111, 134, 184, 0.35)';
  ctx.fillRect(1060, 684, 180, 8);
  ctx.fillStyle = f > 0.85 ? PALETTE.danger : PALETTE.trail;
  ctx.fillRect(1060, 684, 180 * Math.min(1, f), 8);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SPEED', 1050, 692);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, ARENA.w / 2, y);
}

function drawTitle(ctx, state) {
  panel(ctx, 290, 120, 700, 470);
  centerText(ctx, 'P E R I H E L I O N', 200, 'bold 54px system-ui, sans-serif', PALETTE.comet);
  centerText(ctx, 'You do not steer the comet. You bend its orbit.', 245,
    'italic 19px system-ui, sans-serif', PALETTE.hudDim);
  const lines = [
    'CLICK — place a gravity well (3 max). Click a well to remove it.',
    'RIGHT-CLICK — remove the nearest well.  1 / 2 — attract / repel wells (repel from level 4).',
    'Fly through every gold shard, then dive into the green gate.',
    'Linked wells resonate and pull ×1.5. Chain shards fast for a combo up to ×3.',
    'Wells wake the hunters. They chase the comet — but wells repel them.',
    'Lure a hunter into the sun or a planet: +150. The sun burns. 3 attempts a level.',
    'P — pause · R — restart level · M — mute',
  ];
  lines.forEach((line, i) => {
    centerText(ctx, line, 296 + i * 27, '16px system-ui, sans-serif', PALETTE.hud);
  });
  centerText(ctx, state.best > 0 ? `BEST SCORE ${state.best}` : 'Six star systems. One comet. No steering wheel.',
    510, 'bold 16px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, 'ENTER or CLICK to launch', 552, 'bold 20px system-ui, sans-serif', PALETTE.gate);
}

function drawPaused(ctx) {
  panel(ctx, 440, 250, 400, 180);
  centerText(ctx, 'PAUSED', 320, 'bold 40px system-ui, sans-serif', PALETTE.comet);
  centerText(ctx, 'P or ENTER to resume · R to restart the level', 370,
    '16px system-ui, sans-serif', PALETTE.hudDim);
}

function drawLevelDone(ctx, state) {
  panel(ctx, 390, 180, 500, 330);
  centerText(ctx, 'LEVEL CLEAR', 250, 'bold 42px system-ui, sans-serif', PALETTE.gate);
  centerText(ctx, state.level.name, 290, 'bold 19px system-ui, sans-serif', PALETTE.hud);
  const par = state.level.par;
  const timeBonus = Math.max(0, Math.round(par - state.levelTime)) * 10;
  const attemptBonus = state.attempts * 50;
  const shardLine = `Shards  ${state.shardPoints} pts`
    + (state.hunterPoints > 0 ? `  ·  Hunters +${state.hunterPoints}` : '');
  centerText(ctx, shardLine, 340,
    '17px system-ui, sans-serif', PALETTE.hud);
  centerText(ctx, `Time bonus  ${timeBonus}  (par ${par}s, finished in ${Math.floor(state.levelTime)}s)`, 372,
    '17px system-ui, sans-serif', PALETTE.hud);
  centerText(ctx, `Attempts bonus  ${attemptBonus}`, 404, '17px system-ui, sans-serif', PALETTE.hud);
  centerText(ctx, `LEVEL SCORE  ${state.levelScore}   ·   TOTAL  ${state.score}`, 448,
    'bold 19px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, 'ENTER or CLICK for the next system', 488, 'bold 18px system-ui, sans-serif', PALETTE.gate);
}

function drawGameOver(ctx, state) {
  panel(ctx, 390, 200, 500, 300);
  centerText(ctx, 'LOST IN THE DARK', 270, 'bold 40px system-ui, sans-serif', PALETTE.danger);
  centerText(ctx, `The comet burned out on ${state.level.name}.`, 312,
    '17px system-ui, sans-serif', PALETTE.hud);
  centerText(ctx, `SCORE  ${state.score}` + (state.best > 0 ? `   ·   BEST  ${state.best}` : ''), 360,
    'bold 20px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, 'ENTER or CLICK to fly again', 430, 'bold 18px system-ui, sans-serif', PALETTE.gate);
}

function drawWin(ctx, state) {
  panel(ctx, 340, 170, 600, 350);
  centerText(ctx, 'ALL SIX SYSTEMS CROSSED', 240, 'bold 38px system-ui, sans-serif', PALETTE.gate);
  centerText(ctx, 'The comet made its perihelion and came home.', 282,
    'italic 18px system-ui, sans-serif', PALETTE.hudDim);
  centerText(ctx, `FINAL SCORE  ${state.score}` + (state.best > 0 ? `   ·   BEST  ${state.best}` : ''), 340,
    'bold 22px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, 'ENTER or CLICK to fly it all again', 420, 'bold 18px system-ui, sans-serif', PALETTE.gate);
}

// Draw the whole frame for the current state at time state.time.
export function draw(ctx, state) {
  ctx.save();
  const off = shakeOffset(state);
  ctx.translate(off.x, off.y);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(-20, -20, ARENA.w + 40, ARENA.h + 40);
  drawStars(ctx, state);

  const level = state.level;
  if (level.sun) drawSun(ctx, level.sun, state.time);
  for (const p of level.planets) drawPlanet(ctx, p.x, p.y, p.r, p.color, state.time);
  for (const mv of level.movers) {
    const m = moverAt(mv, state.time);
    drawPlanet(ctx, m.x, m.y, m.r, m.color, state.time);
  }
  level.asteroids.forEach((a, i) => drawAsteroid(ctx, a, i));
  drawGate(ctx, level.gate, state.gateOpen, state.time);
  level.shards.forEach((s, i) => drawShard(ctx, s, i, state.time));
  drawResonance(ctx, state, state.time);
  for (const w of state.wells) drawWell(ctx, w, state.time);
  if (state.screen !== 'title') drawComet(ctx, state);
  for (const h of state.hunters) drawHunter(ctx, h, state.time);

  ctx.restore();

  // The crash flash sits above the world, below the HUD.
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.35})`;
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  }

  if (state.screen !== 'title') drawHud(ctx, state);
  if (state.screen === 'title') drawTitle(ctx, state);
  if (state.screen === 'paused') drawPaused(ctx);
  if (state.screen === 'levelDone') drawLevelDone(ctx, state);
  if (state.screen === 'gameOver') drawGameOver(ctx, state);
  if (state.screen === 'win') drawWin(ctx, state);

  // A hint line while flying, so the mechanic is never a mystery.
  if (state.screen === 'play' && state.levelIndex === 0 && state.levelTime < 9) {
    ctx.fillStyle = 'rgba(207, 230, 255, 0.85)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.level.hint, ARENA.w / 2, ARENA.h - 34);
  }
}
