/** Tuning for the Narrator's caption box and dialogue presentation. */
export const NARRATOR = {
  /** Growth added per absorbed wisp. ~28 kills before the Warden takes the box to full size. */
  growthPerKill: 0.036,
  /** Seconds between a kill and its wisp "arriving" in the box (matches the wisp drift). */
  wispTravelSec: 1.0,

  /** Typing speed. He talks faster as he grows: eager, hungry. */
  charsPerSec: 24,
  charsPerSecAtFull: 34,
  deleteCharsPerSec: 32,
  commaPauseSec: 0.12,
  stopPauseSec: 0.28,
  /** How long a wrong (glitched) word stays on screen before correcting itself. */
  glitchHoldSec: 0.45,

  /** How long a finished line stays readable. */
  minHoldSec: 3,
  holdPerChar: 0.06,
  /** When more lines are waiting, a finished line only holds this long. */
  queuedHoldSec: 1.8,
  /** Scripted dialogue waits at least this long per line before the next one: time to read it. */
  readCharsPerSec: 12,
  readBaseSec: 1.2,
  /** A finished line waits up to this much longer while its voice is still speaking (so no words get cut). */
  voiceGraceSec: 8,
  /** ...a little less when more lines are waiting. Reading-time pacing keeps this rare. */
  voiceGraceQueuedSec: 6,
  maxQueue: 5,

  /** Growth thresholds where the typography gets louder (tier 1, 2, 3). */
  tiers: [0.25, 0.5, 0.75],

  /** Twist: how long the box cracks and shakes before it shatters. */
  crackSec: 0.9,
  shardLifeSec: 1.9,
  shardCols: 5,
  shardRows: 3,
};
