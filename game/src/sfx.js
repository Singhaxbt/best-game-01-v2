// Synthesized WebAudio sound effects — no audio files, nothing to load.
// The context is created lazily on the first user gesture, so the game
// stays silent (and error-free) until the player interacts.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio() {
  if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

export function isMuted() {
  return muted;
}

// One oscillator note with an exponential decay.
function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A short burst of filtered noise (crashes, impacts).
function noise(dur, gain, cutoff) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic pseudo-noise from a fixed LCG seed, so the buffer is
  // identical on every run.
  let s = 123456789;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    data[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  // A well drops into place: a low thunk that slides down.
  place() { tone(220, 0.16, 'sine', 0.5, 0, 110); },
  // A well is removed: a short high tick.
  remove() { tone(520, 0.07, 'triangle', 0.3); },
  // A shard is caught: the pitch climbs with the combo of shards this level.
  collect(n) { tone(520 + n * 90, 0.22, 'sine', 0.45, 0, (520 + n * 90) * 1.5); },
  // The gate opens: a warm two-note chord.
  gateOpen() { tone(392, 0.5, 'sine', 0.35); tone(587, 0.6, 'sine', 0.3, 0.08); },
  // A level is complete: a rising arpeggio.
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.4, i * 0.09));
  },
  // A hunter wakes: a low warning slide.
  warn() { tone(160, 0.3, 'sawtooth', 0.2, 0, 90); },
  // A hunter dies on a hazard: a bright two-note chime.
  hunterKill() { tone(880, 0.18, 'sine', 0.4); tone(1318, 0.3, 'sine', 0.35, 0.09); },
  // The comet crashes: noise plus a falling tone.
  crash() { noise(0.35, 0.6, 900); tone(180, 0.4, 'sawtooth', 0.25, 0, 40); },
  // Game over: three descending notes.
  gameOver() {
    [392, 311, 233].forEach((f, i) => tone(f, 0.35, 'triangle', 0.4, i * 0.16));
  },
  // All six levels cleared: a bright fanfare.
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.4, i * 0.11));
  },
  // A menu click.
  click() { tone(660, 0.06, 'square', 0.18); },
};
