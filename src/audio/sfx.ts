import { audio } from './AudioManager';
import { mtof, type Synth } from './synth';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Sound recipes. `arg` is recipe-specific (combo step, size). */
const SFX = {
  swing(s: Synth, t: number, step = 0) {
    const heavy = step >= 2;
    s.noise(t, {
      dur: heavy ? 0.24 : 0.14,
      gain: heavy ? 1.1 : 0.8,
      attack: 0.03,
      filter: { type: 'bandpass', freq: heavy ? 350 : 700 + step * 250, to: heavy ? 1600 : 2800, q: 1.2 },
    });
  },
  flesh(s: Synth, t: number) {
    s.noise(t, { dur: 0.09, gain: 0.45, filter: { type: 'lowpass', freq: 1800, to: 400 } });
    s.tone(t, { freq: 160, to: 55, dur: 0.12, gain: 0.6 });
  },
  heavy(s: Synth, t: number) {
    s.tone(t, { freq: 120, to: 38, dur: 0.3, gain: 0.9 });
    s.noise(t, { dur: 0.18, gain: 0.55, filter: { type: 'lowpass', freq: 2600, to: 300 } });
    s.tone(t, { type: 'square', freq: 90, to: 50, dur: 0.08, gain: 0.15, filter: { type: 'lowpass', freq: 800 } });
  },
  energyGold(s: Synth, t: number) {
    s.tone(t, { type: 'square', freq: 1300, to: 500, dur: 0.12, gain: 0.12, filter: { type: 'lowpass', freq: 3000 } });
    s.noise(t, { dur: 0.06, gain: 0.2, filter: { type: 'highpass', freq: 3000 } });
  },
  energyViolet(s: Synth, t: number) {
    s.tone(t, { type: 'triangle', freq: 520, to: 780, dur: 0.18, gain: 0.25, wet: 0.4 });
    s.tone(t, { freq: 1560, dur: 0.25, gain: 0.08, wet: 0.5 });
  },
  /** Sword on intact armour shell: inharmonic metal partials. */
  clank(s: Synth, t: number) {
    for (const [freq, gain, dur] of [[540, 0.25, 0.35], [1370, 0.15, 0.25], [2290, 0.1, 0.18], [3150, 0.06, 0.12]]) {
      s.tone(t, { freq, dur, gain, wet: 0.2 });
    }
    s.noise(t, { dur: 0.04, gain: 0.3, filter: { type: 'highpass', freq: 2500 } });
  },
  shellBreak(s: Synth, t: number) {
    for (const [freq, gain, dur] of [[380, 0.3, 0.5], [960, 0.2, 0.35], [1710, 0.12, 0.25]]) s.tone(t, { freq, dur, gain, wet: 0.3 });
    s.noise(t, { dur: 0.45, gain: 0.6, filter: { type: 'lowpass', freq: 5000, to: 400 } });
    s.tone(t, { freq: 90, to: 40, dur: 0.35, gain: 0.8 });
    for (let i = 0; i < 5; i++) s.tone(t + 0.04 + i * 0.035, { freq: rand(1800, 4300), dur: 0.12, gain: 0.06 });
  },
  /** Wrong move for this armour: a bright ping so the player learns. */
  deflect(s: Synth, t: number) {
    s.tone(t, { freq: 1900, to: 1750, dur: 0.4, gain: 0.18, wet: 0.3 });
    s.tone(t, { freq: 2850, dur: 0.22, gain: 0.08 });
    s.noise(t, { dur: 0.03, gain: 0.15, filter: { type: 'highpass', freq: 4000 } });
  },
  blocked(s: Synth, t: number) {
    s.tone(t, { type: 'square', freq: 180, to: 120, dur: 0.08, gain: 0.15, filter: { type: 'lowpass', freq: 900 } });
    s.noise(t, { dur: 0.07, gain: 0.3, filter: { type: 'bandpass', freq: 900, q: 2 } });
  },
  coreHit(s: Synth, t: number) {
    s.tone(t, { type: 'triangle', freq: 1250, to: 1650, dur: 0.14, gain: 0.2, wet: 0.3 });
    s.noise(t, { dur: 0.08, gain: 0.2, filter: { type: 'highpass', freq: 5000 } });
  },
  /** Glass / crystal breaking. `size` 1 = an armour core, 2 = the Narrator's box. */
  shatter(s: Synth, t: number, size = 1) {
    for (let i = 0; i < Math.round(8 * size); i++) {
      s.tone(t + rand(0, 0.25 * size), { freq: rand(2200, 6700), dur: rand(0.08, 0.28), gain: 0.07, wet: 0.4 });
    }
    s.noise(t, { dur: 0.5 * size, gain: 0.35, filter: { type: 'highpass', freq: 4500 } });
    s.tone(t, { freq: 200, to: 60, dur: 0.25, gain: 0.4 * size });
  },
  playerHurt(s: Synth, t: number) {
    s.tone(t, { type: 'sawtooth', freq: 320, to: 110, dur: 0.2, gain: 0.4, filter: { type: 'lowpass', freq: 1400 } });
    s.noise(t, { dur: 0.1, gain: 0.6, filter: { type: 'lowpass', freq: 1500 } });
  },
  playerDeath(s: Synth, t: number) {
    s.tone(t, { type: 'sawtooth', freq: 240, to: 50, dur: 1.4, gain: 0.25, filter: { type: 'lowpass', freq: 1600, to: 200 }, wet: 0.4 });
    s.tone(t, { freq: 120, to: 30, dur: 1.2, gain: 0.5 });
  },
  dodge(s: Synth, t: number) {
    s.noise(t, { dur: 0.24, gain: 1.0, attack: 0.06, filter: { type: 'bandpass', freq: 300, to: 1800, q: 1.5 } });
  },
  goldBolt(s: Synth, t: number) {
    s.tone(t, { type: 'square', freq: 900, to: 1800, glide: 0.05, dur: 0.16, gain: 0.2, filter: { type: 'lowpass', freq: 4000 } });
    s.tone(t, { freq: 2400, dur: 0.2, gain: 0.12, wet: 0.3 });
  },
  goldBurst(s: Synth, t: number) {
    s.tone(t, { freq: 90, to: 30, dur: 0.6, gain: 0.8 });
    s.noise(t, { dur: 0.6, gain: 0.45, filter: { type: 'lowpass', freq: 3500, to: 200 } });
    for (const m of [72, 76, 79]) s.tone(t, { type: 'triangle', freq: mtof(m), dur: 0.7, gain: 0.06, wet: 0.5 });
  },
  violetCast(s: Synth, t: number) {
    [69, 76, 81].forEach((m, i) => s.tone(t + i * 0.05, { freq: mtof(m), dur: 0.5, gain: 0.12, wet: 0.6 }));
    s.noise(t, { dur: 0.3, gain: 0.12, attack: 0.08, filter: { type: 'bandpass', freq: 2000, to: 5000, q: 2 }, wet: 0.5 });
  },
  enemyDeath(s: Synth, t: number) {
    s.noise(t, { dur: 0.35, gain: 0.4, filter: { type: 'lowpass', freq: 1800, to: 250 } });
    s.tone(t, { freq: 260, to: 70, dur: 0.3, gain: 0.45 });
  },
  wispRelease(s: Synth, t: number) {
    s.tone(t + 0.15, { freq: 880, to: 1320, dur: 0.5, gain: 0.07, attack: 0.1, wet: 0.7 });
  },
  /** Two near-unison bells that beat against each other: pretty, but slightly wrong. */
  wispAbsorbed(s: Synth, t: number) {
    s.tone(t, { freq: 1318.5, dur: 0.8, gain: 0.09, wet: 0.6 });
    s.tone(t, { freq: 1330, dur: 0.8, gain: 0.06, wet: 0.6 });
    s.tone(t + 0.06, { freq: 1975.5, dur: 0.6, gain: 0.05, wet: 0.6 });
  },
  uiClick(s: Synth, t: number) {
    s.tone(t, { type: 'square', freq: 1100, dur: 0.035, gain: 0.08, filter: { type: 'lowpass', freq: 3000 } });
  },
  flipViolet(s: Synth, t: number) {
    s.tone(t, { freq: 70, to: 28, dur: 1.6, gain: 0.9 });
    s.noise(t, { dur: 2.2, gain: 0.5, filter: { type: 'lowpass', freq: 6000, to: 150 }, wet: 0.5 });
    for (const m of [57, 64, 69, 72, 76]) s.tone(t + 0.05, { type: 'triangle', freq: mtof(m), dur: 3, gain: 0.05, attack: 0.4, wet: 0.8 });
  },
  flipGold(s: Synth, t: number) {
    for (const m of [60, 64, 67, 72]) s.tone(t, { type: 'triangle', freq: mtof(m), dur: 1.6, gain: 0.05, attack: 0.1, wet: 0.6 });
    s.noise(t, { dur: 0.8, gain: 0.15, attack: 0.2, filter: { type: 'bandpass', freq: 3000, q: 1 }, wet: 0.5 });
  },
  rumble(s: Synth, t: number) {
    s.noise(t, { dur: 3.5, gain: 0.7, attack: 0.6, filter: { type: 'lowpass', freq: 160 } });
    s.tone(t, { freq: 42, dur: 3.5, gain: 0.4, attack: 0.8 });
  },
  bossDown(s: Synth, t: number) {
    SFX.heavy(s, t);
    SFX.shatter(s, t, 1.6);
    s.tone(t, { freq: 55, dur: 2.5, gain: 0.5, wet: 0.5 });
  },
};

export type SfxName = keyof typeof SFX;

const lastPlayed = new Map<SfxName, number>();
/** The same sound twice within this window is one sound (e.g. a burst hitting five enemies). */
const DEDUPE_SEC = 0.035;

export function playSfx(name: SfxName, arg?: number): void {
  const s = audio.sfx;
  if (!s || !audio.running) return;
  const t = s.ctx.currentTime;
  if (t - (lastPlayed.get(name) ?? -1) < DEDUPE_SEC) return;
  lastPlayed.set(name, t);
  SFX[name](s, t + 0.005, arg);
}
