// Boot and the fixed-step loop: resize the canvas to fit the arena,
// feed input into the sim, draw every frame. Staged screenshot scenes
// (?shot=start|play|win|over) render one frozen frame and stop.

import { ARENA } from './tuning.js';
import { createGame, stepGame } from './sim.js';
import { draw } from './render.js';
import { createInput, takeClicks, wasPressed, endFrame } from './input.js';
import { unlockAudio, toggleMute } from './sfx.js';
import { applyShot } from './stage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const state = createGame();
state.best = Number(localStorage.getItem('perihelion-best') || 0);

// The window's own size decides the canvas's CSS size; the drawing
// buffer stays at the arena's 1280x720 so screenshots are exact.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / ARENA.w, window.innerHeight / ARENA.h);
  canvas.style.width = `${Math.floor(ARENA.w * scale)}px`;
  canvas.style.height = `${Math.floor(ARENA.h * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  // A staged screenshot: render one frozen frame and stop — no loop,
  // no thrown error, just the picture.
  applyShot(state, shot);
  draw(ctx, state);
  window.__perihelion = state;
} else {
  window.__perihelion = state;
  requestAnimationFrame(frame);
}

let last = performance.now();
let acc = 0;
const DT = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  acc += elapsed;
  while (acc >= DT) {
    acc -= DT;
    const pressed = new Set(input.pressed);
    if (wasPressed(input, 'KeyM')) {
      if (toggleMute()) state.muted = true;
      else state.muted = false;
    }
    if (pressed.size > 0 || input.clicks.length > 0) unlockAudio();
    stepGame(state, DT, { clicks: takeClicks(input), pressed });
    endFrame(input);
  }
  draw(ctx, state);
  const best = Math.max(state.best, state.score);
  if (best !== state.best) {
    state.best = best;
    try { localStorage.setItem('perihelion-best', String(best)); } catch { /* private mode */ }
  }
}
