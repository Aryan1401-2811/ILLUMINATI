/** Tuning for every visual effect. Colours are sRGB hex; sizes in metres; times in seconds. */

export const FX_COLORS = {
  ink: '#140d12',
  paper: '#fbf1dc',
  gold: '#ffc21a',
  goldHot: '#fff0b8',
  violet: '#9b6bff',
  violetSoft: '#cdb8ff',
  steel: '#b9c4d6',
  danger: '#e8463a',
};

export interface WordStyle {
  words: string[];
  fill: string;
  /** Second fill colour for the vertical gradient. */
  fill2: string;
  /** Height of the word in metres. */
  size: number;
  life: number;
  /** Draw a spiky starburst behind the word. */
  burst: boolean;
}

/** Comic sound effects by what happened. Keep lists short so each word stays iconic. */
export const WORDS = {
  light: { words: ['THWACK!', 'POW!', 'BAM!', 'WHAP!'], fill: '#ffe24a', fill2: '#ff9d1a', size: 0.95, life: 0.6, burst: false },
  heavy: { words: ['WHAM!', 'KRAK!', 'KA-POW!'], fill: '#ff5a3c', fill2: '#c8102e', size: 1.7, life: 0.95, burst: true },
  energy: { words: ['ZAP!', 'FZZT!', 'ZWAP!'], fill: '#fff6c9', fill2: '#ffc21a', size: 1.0, life: 0.6, burst: false },
  energyViolet: { words: ['ZAP!', 'FZZT!', 'ZWAP!'], fill: '#f1e9ff', fill2: '#9b6bff', size: 1.0, life: 0.6, burst: false },
  shellHit: { words: ['CLANG!', 'KLONK!'], fill: '#e6edf7', fill2: '#8e9bb3', size: 1.15, life: 0.7, burst: false },
  shellBroken: { words: ['SHATTER!'], fill: '#ffffff', fill2: '#7fd6ff', size: 2.0, life: 1.15, burst: true },
  coreHit: { words: ['ZZRAK!', 'FZZAK!'], fill: '#ffffff', fill2: '#ff7ad9', size: 1.3, life: 0.75, burst: false },
  deflected: { words: ['PING!'], fill: '#f4f8ff', fill2: '#b9c4d6', size: 0.8, life: 0.55, burst: false },
  blocked: { words: ['TINK!', 'CLANK!'], fill: '#e6edf7', fill2: '#9aa6bd', size: 0.8, life: 0.55, burst: false },
  ko: { words: ['KO!', 'POOF!'], fill: '#ffe24a', fill2: '#ff5a3c', size: 1.5, life: 0.9, burst: true },
  ouch: { words: ['OOF!', 'OW!', 'ACK!'], fill: '#ff8a7a', fill2: '#c8102e', size: 0.8, life: 0.6, burst: false },
} satisfies Record<string, WordStyle>;

export const WORD_FX = {
  font: 'Bangers',
  fallbackFonts: 'Impact, "Arial Black", sans-serif',
  /** Never more than this many words on screen: bold, not cluttered. */
  maxLive: 6,
  /** Minimum seconds between two small words (multi-hit swings get one word, not five). */
  minGap: 0.14,
  /** Pop-in duration and overshoot. */
  popTime: 0.11,
  overshoot: 1.35,
  riseSpeed: 0.55,
  tiltDeg: 14,
  /** Words sit a little above the hit point and jitter sideways so repeats do not stack. */
  lift: 0.75,
  jitter: 0.55,
};

export const IMPACT_FX = {
  sparksLight: 7,
  sparksHeavy: 16,
  sparkSpeed: 7.5,
  inkDrops: 3,
  inkDropsHeavy: 8,
  deathDrops: 22,
  deathMotes: 10,
  splatLife: 3.2,
  maxSplats: 40,
};

/** The wisp: a Shade's light leaving its body and drifting to the Narrator's caption box. */
export const WISP_FX = {
  /** Where the caption box sits on screen, in NDC (-1..1). Top-right. */
  targetNdc: { x: 0.74, y: 0.8 },
  /** How far in front of the camera the wisp ends up (metres). */
  targetDepth: 7.5,
  riseTime: 0.75,
  riseHeight: 1.5,
  maxSpeed: 7.5,
  accel: 9,
  size: 0.5,
  trailEvery: 0.035,
  /** Give up and fade if it has not arrived by then. */
  maxLife: 5,
};

/** Gold energy is subtly wrong: it jitters and flickers. Violet is perfectly calm. */
export const BUZZ_FX = {
  /** Jitter steps per second (stepped, like a mis-registered print plate). */
  rate: 14,
  /** Scale jitter on gold projectiles and auras (fraction). */
  scale: 0.16,
  sparksPerSec: 16,
};

export const AFTERIMAGE_FX = { ghosts: 3, gap: 0.055, life: 0.3, opacity: 0.4 };

/** The twist: the world comes apart. */
export const COLLAPSE_FX = {
  durationSec: 7,
  radius: 14,
  cracks: 8,
  /** Fraction of the duration it takes the cracks to reach the rim. */
  crackGrowth: 0.4,
  slabs: 14,
  /** Slabs never land closer than this to the centre (the hero and the Warden are there). */
  safeRadius: 4.5,
  gravity: 26,
  rumble: 0.11,
  landingShake: 0.32,
  scrapsPerSec: 34,
};
