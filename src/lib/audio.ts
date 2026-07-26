/**
 * Zero-dependency Web Audio API synthesizer for Jeopardy UX sounds.
 * Safe to call in SSR — no-ops when AudioContext is unavailable.
 */

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let sharedContext: AudioContext | null = null;
let unlockInstalled = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioCtx();
  }

  if (sharedContext.state === "suspended") {
    void sharedContext.resume();
  }

  return sharedContext;
}

/**
 * iOS/Android require a user gesture before AudioContext can play.
 * Installs a one-time touchstart/click unlocker on first import in the browser.
 */
export function installAudioUnlockListener(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("click", unlock);
  };

  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("click", unlock, { once: true });
}

if (typeof window !== "undefined") {
  installAudioUnlockListener();
}

function playTone(
  frequency: number,
  startTime: number,
  duration: number,
  options: {
    type?: OscillatorType;
    gain?: number;
    glideTo?: number;
  } = {}
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const { type = "sine", gain = 0.18, glideTo } = options;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(glideTo, 1),
      startTime + duration
    );
  }

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

/** Upbeat Jeopardy-style chime when opening a tile. */
export function playTileOpenSound(): void {
  installAudioUnlockListener();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(523.25, now, 0.12, { type: "triangle", gain: 0.16 });
  playTone(659.25, now + 0.1, 0.14, { type: "triangle", gain: 0.16 });
  playTone(783.99, now + 0.2, 0.22, { type: "triangle", gain: 0.18 });
}

/** Sound effect when revealing the answer. */
export function playRevealSound(): void {
  installAudioUnlockListener();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(392.0, now, 0.18, { type: "sine", gain: 0.14 });
  playTone(493.88, now + 0.12, 0.2, { type: "sine", gain: 0.15 });
  playTone(587.33, now + 0.26, 0.28, { type: "triangle", gain: 0.17 });
}

/** Cash-register / positive chime when awarding points. */
export function playScoreAwardSound(): void {
  installAudioUnlockListener();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(880, now, 0.08, { type: "square", gain: 0.08 });
  playTone(1174.66, now + 0.07, 0.1, { type: "square", gain: 0.09 });
  playTone(1318.51, now + 0.14, 0.18, {
    type: "triangle",
    gain: 0.14,
    glideTo: 1567.98,
  });
}

/** Triumphant fanfare melody when the game ends. */
export function playVictoryFanfare(): void {
  installAudioUnlockListener();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const melody: Array<[number, number, number]> = [
    [523.25, 0, 0.16],
    [659.25, 0.14, 0.16],
    [783.99, 0.28, 0.16],
    [1046.5, 0.44, 0.28],
    [783.99, 0.72, 0.14],
    [1046.5, 0.88, 0.4],
  ];

  for (const [freq, offset, duration] of melody) {
    playTone(freq, now + offset, duration, { type: "triangle", gain: 0.2 });
  }

  playTone(1318.51, now + 1.1, 0.5, { type: "sine", gain: 0.12 });
}

/**
 * Classic TV game-show buzzer: dissonant low dual square-wave pulse.
 */
export function playBuzzerSound(): void {
  installAudioUnlockListener();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  playTone(98, now, 0.4, { type: "square", gain: 0.22 });
  playTone(104, now, 0.4, { type: "square", gain: 0.16 });
  playTone(87, now + 0.38, 0.28, { type: "square", gain: 0.2 });
  playTone(92, now + 0.38, 0.28, { type: "square", gain: 0.14 });
}
