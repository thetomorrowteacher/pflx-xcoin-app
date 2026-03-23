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

/** Cloud save confirmation — short digital chirp */
export function playSave(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.3;
  const now = ctx.currentTime;
  makeTone(ctx, 880, now, 0.06, "sine", v);
  makeTone(ctx, 1320, now + 0.06, 0.08, "sine", v * 0.8);
  makeTone(ctx, 1760, now + 0.12, 0.06, "sine", v * 0.5);
}

/** Coin / XC transaction — metallic coin drop sound */
export function playCoin(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.35;
  const now = ctx.currentTime;
  // Metallic shimmer
  makeTone(ctx, 2400, now, 0.05, "square", v * 0.4);
  makeTone(ctx, 3200, now + 0.01, 0.04, "sine", v * 0.6);
  makeTone(ctx, 1800, now + 0.04, 0.12, "sine", v);
  makeTone(ctx, 2200, now + 0.06, 0.1, "sine", v * 0.3);
}

/** Badge award — sparkle cascade */
export function playBadge(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.4;
  const now = ctx.currentTime;
  // Sparkle ascending with shimmer
  [784, 988, 1175, 1319, 1568, 1976].forEach((f, i) => {
    makeTone(ctx, f, now + i * 0.06, 0.15, "sine", v * (1 - i * 0.1));
  });
  // Sub-layer warmth
  makeTone(ctx, 392, now, 0.4, "sine", v * 0.25);
}

/** Delete / remove — descending thud */
export function playDelete(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.alerts) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.3;
  const now = ctx.currentTime;
  makeTone(ctx, 400, now, 0.08, "sawtooth", v);
  makeTone(ctx, 250, now + 0.06, 0.1, "sawtooth", v * 0.7);
  makeTone(ctx, 120, now + 0.12, 0.15, "sine", v * 0.5);
}

/** Level-up / rank promotion — triumphant fanfare */
export function playLevelUp(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.rewards) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.5;
  const now = ctx.currentTime;
  // Trumpet-like arpeggio
  [[523, 0, 0.15], [659, 0.12, 0.15], [784, 0.24, 0.15], [1047, 0.36, 0.3]].forEach(([f, t, d]) => {
    makeTone(ctx, f, now + t, d, "sine", v);
    makeTone(ctx, f * 1.005, now + t, d, "sine", v * 0.3); // slight detune for richness
  });
  // Bass foundation
  makeTone(ctx, 131, now, 0.6, "sine", v * 0.3);
}

/** Tax / fine applied — stern buzz */
export function playTax(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.alerts) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.3;
  const now = ctx.currentTime;
  makeTone(ctx, 330, now, 0.06, "square", v * 0.5);
  makeTone(ctx, 220, now + 0.06, 0.1, "sawtooth", v);
  makeTone(ctx, 165, now + 0.14, 0.12, "sawtooth", v * 0.6);
}

/** Toggle / switch — soft pop */
export function playToggle(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.clicks) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.2;
  makeTone(ctx, 600, ctx.currentTime, 0.04, "sine", v);
  makeTone(ctx, 800, ctx.currentTime + 0.03, 0.04, "sine", v * 0.7);
}

/** Modal open — whoosh in */
export function playModalOpen(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.clicks) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.2;
  const now = ctx.currentTime;
  // Rising sweep
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(v, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** Modal close — whoosh out */
export function playModalClose(): void {
  const s = getSoundSettings();
  if (!s.enabled || !s.clicks) return;
  const ctx = getCtx();
  if (!ctx) return;
  const v = s.volume * 0.18;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
  gain.gain.setValueAtTime(v, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.start(now);
  osc.stop(now + 0.15);
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
