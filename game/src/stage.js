// Staged scenes for the screenshots (?shot=start|play|win|over).
// Each scene runs the real simulation from a fixed start with a fixed
// script of well placements, so the rendered frame is identical on every
// take: same seed, same inputs, same pixels.

import { loadLevel, stepGame } from './sim.js';

const DT = 1 / 60;

// A script of well placements: { at: seconds, x, y }.
function runScript(state, script, seconds) {
  // First frame: start the game from the title screen.
  stepGame(state, DT, { clicks: [], pressed: new Set(['Enter']) });
  const ticks = Math.round(seconds / DT);
  let placed = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const t = tick * DT;
    const clicks = [];
    while (placed < script.length && script[placed].at <= t) {
      clicks.push({ x: script[placed].x, y: script[placed].y, button: 0 });
      placed += 1;
    }
    stepGame(state, DT, { clicks, pressed: new Set() });
    if (state.screen !== 'play') break;
  }
}

export function applyShot(state, kind) {
  if (kind === 'start') {
    // Title screen over level 1, comet waiting on its pad.
    loadLevel(state, 0);
    state.screen = 'title';
    return;
  }

  if (kind === 'play') {
    // Level 3, nine seconds in: the autopilot's opening bends the comet
    // through three shards with three wells down (one resonance link),
    // the combo at x2.5, and the hunter already on the hunt — the cover
    // frame shows every system at once (verified: comet mid-flight,
    // 3/4 shards, 1 hunter, 1 link, combo x2.5).
    loadLevel(state, 2);
    state.screen = 'play';
    runScript(
      state,
      [
        { at: 0, x: 280, y: 200 },
        { at: 0.5, x: 280, y: 80 },
        { at: 1, x: 400, y: 200 },
        { at: 1.5, x: 340, y: 200 },
        { at: 2.5, x: 280, y: 20 },
        { at: 3.5, x: 460, y: 140 },
        { at: 4, x: 760, y: 200 },
        { at: 4.5, x: 880, y: 140 },
        { at: 5.5, x: 760, y: 500 },
        { at: 6, x: 580, y: 500 },
        { at: 6.5, x: 640, y: 560 },
        { at: 7, x: 580, y: 620 },
        { at: 7.5, x: 700, y: 500 },
        { at: 8, x: 1000, y: 480 },
        { at: 8.5, x: 1000, y: 300 },
      ],
      9,
    );
    return;
  }

  if (kind === 'win') {
    // Level 1 played to the gate: the autopilot's winning script bends
    // the comet through all three shards and into the gate, freezing on
    // the level-clear panel (verified: levelDone at 13.6 s, score 810).
    loadLevel(state, 0);
    state.screen = 'play';
    runScript(
      state,
      [
        { at: 0, x: 520, y: 290 },
        { at: 0.5, x: 640, y: 230 },
        { at: 1, x: 700, y: 50 },
        { at: 1.5, x: 760, y: 50 },
        { at: 2, x: 640, y: 170 },
        { at: 4, x: 520, y: 290 },
        { at: 4.5, x: 860, y: 240 },
        { at: 5, x: 1100, y: 240 },
        { at: 6.5, x: 920, y: 360 },
        { at: 7.5, x: 1040, y: 360 },
        { at: 9, x: 1120, y: 560 },
        { at: 9.5, x: 1000, y: 620 },
        { at: 11.5, x: 1040, y: 230 },
        { at: 12, x: 1100, y: 110 },
        { at: 12.5, x: 1100, y: 50 },
      ],
      26,
    );
    return;
  }

  if (kind === 'over') {
    // Level 1, last attempt: the comet is dropped straight above the
    // planet and falls into it, freezing on the game-over panel.
    loadLevel(state, 0);
    state.attempts = 1;
    state.comet = { x: 640, y: 200, vx: 0, vy: 150 };
    state.screen = 'play';
    for (let i = 0; i < 5 * 60; i++) {
      stepGame(state, DT, { clicks: [], pressed: new Set() });
      if (state.screen !== 'play') break;
    }
  }
}
