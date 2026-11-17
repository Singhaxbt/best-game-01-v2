// Keyboard and mouse input, kept apart from the simulation so the sim can
// run headless in tests. Mouse positions are converted into arena
// coordinates (the canvas is letterboxed, so the scale is not 1:1).

import { ARENA } from './tuning.js';

export function createInput(canvas) {
  const input = {
    mouseX: ARENA.w / 2,
    mouseY: ARENA.h / 2,
    // Clicks queued since the last frame: { x, y, button } in arena coords.
    clicks: [],
    // Keys pressed since the last frame, by event.code.
    pressed: new Set(),
    // Keys currently held down.
    held: new Set(),
  };

  function toArena(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / ARENA.w, rect.height / ARENA.h);
    const ox = (rect.width - ARENA.w * scale) / 2;
    const oy = (rect.height - ARENA.h * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const p = toArena(e.clientX, e.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
  });

  canvas.addEventListener('mousedown', (e) => {
    const p = toArena(e.clientX, e.clientY);
    input.clicks.push({ x: p.x, y: p.y, button: e.button });
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.held.add(e.code);
  });

  window.addEventListener('keyup', (e) => input.held.delete(e.code));
  window.addEventListener('blur', () => input.held.clear());

  return input;
}

// True once for a key pressed since the last frame; consumes the press.
export function wasPressed(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

// Drain this frame's click queue.
export function takeClicks(input) {
  const out = input.clicks;
  input.clicks = [];
  return out;
}

// Clear per-frame state at the end of a frame.
export function endFrame(input) {
  input.pressed.clear();
}
