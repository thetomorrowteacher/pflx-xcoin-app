// PFLX Sound System — Web Audio API (no external files needed)
// All tones are synthesized procedurally.

export interface SoundSettings {
  enabled: boolean;
  volume: number;     // 0–1
  clicks: boolean;
  rewards: boolean;
  alerts: boolean;
  ambient: boolean;
}

const STORAGE_KEY = "pflx_sound_settings";

export function defaultSoundSettings(): SoundSettings {
  return { enabled: true, volume: 0.45, clicks: true, rewards: true, alerts: true, ambient: false };
}

export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return defaultSoundSettings();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultSoundSettings(), ...JSON.parse(stored) };
  } catch {}
  return defaultSoundSettings();
}

export function saveSoundSettings(s: SoundSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── AudioContext singleton ──────────────────────────────────────────────────
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  } catch { return null; }
}

function makeTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ── Public sound functions ──────────────────────────────────────────────────

/** Short UI click beep */
export function playClick(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.clicks) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.3;
  makeTone(ctx, 1200, ctx.currentTime, 0.045, "square", v);
  makeTone(ctx, 900,  ctx.currentTime + 0.02, 0.03, "square", v * 0.5);
}

/** Navigation / tab switch — softer click */
export function playNav(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.clicks) return;
  const ctx = getCtx();
  if (!ctx) return;
  makeTone(ctx, 660, ctx.currentTime, 0.06, "sine", s.volume * 0.25);
}

/** Success / save confirmation — ascending arpeggio */
export function playSuccess(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.45;
  const now = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    makeTone(ctx, f, now + i * 0.09, 0.18, "sine", v);
  });
}

/** Badge / XC reward fanfare — richer multi-voice */
export function playReward(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.5;
  const now = ctx.currentTime;
  // Root chord then rise
  [[261, 0], [329, 0], [392, 0], [523, 0.1], [659, 0.2], [784, 0.3], [1047, 0.4]].forEach(([f, t]) => {
    makeTone(ctx, f, now + t, 0.3 - t * 0.3, "sine", v);
  });
}

/** Error / warning tone — descending buzz */
export function playError(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.alerts) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.4;
  const now = ctx.currentTime;
  [[280, 0], [220, 0.1], [180, 0.2]].forEach(([f, t]) => {
    makeTone(ctx, f, now + t, 0.14, "sawtooth", v);
  });
}

/** Alert / warning ping */
export function playAlert(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.alerts) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.35;
  const now = ctx.currentTime;
  makeTone(ctx, 440, now, 0.08, "sine", v);
  makeTone(ctx, 440, now + 0.12, 0.08, "sine", v);
}

// ── Ambient HUD hum ─────────────────────────────────────────────────────────
let _ambOsc: OscillatorNode | null = null;
let _ambGain: GainNode | null = null;

export function startAmbient(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.ambient || _ambOsc) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  // Add subtle vibrato via second oscillator
  const lfo  = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value  = 0.3;
  lfoG.gain.value      = 4;
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = 55;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(s.volume * 0.06, ctx.currentTime + 2);

  lfo.start();
  osc.start();
  _ambOsc  = osc;
  _ambGain = gain;
}

export function stopAmbient(): void {
  if (_ambOsc && _ambGain && _ctx) {
    _ambGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 1);
    const osc = _ambOsc;
    setTimeout(() => { try { osc.stop(); } catch {} }, 1100);
    _ambOsc  = null;
    _ambGain = null;
  }
}

export function syncAmbient(): void {
  const s = getSoundSettings();
  if (s.enabled && s.ambient) {
    startAmbient();
  } else {
    stopAmbient();
  }
}
