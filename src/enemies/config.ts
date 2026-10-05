/**
 * Central tuning numbers for all enemy types and zone variants.
 * Every stat lives here so balancing is easy. Clip names map to the
 * placeholder robot model; swap when the Visuals person delivers real models.
 */

// ── Models & Animations ───────────────────────────────────────────────────
export const ENEMY_MODELS = {
  grunt: { path: 'models/enemies/grunt.glb', height: 1.35 },
  brute: { path: 'models/enemies/brute.glb', height: 2.6 },
} as const;

export const ENEMY_ANIMS = {
  idle: 'Idle_Combat',
  run: 'Running_A',
  walk: 'Walking_A',
  attack: 'Unarmed_Melee_Attack_Punch_A',
  slam: '2H_Melee_Attack_Chop',
  hurt: 'Hit_A',
  death: 'Death_A',
  block: 'Block',
  windup: 'Block', // used as a generic ready pose
  spawn: 'Spawn_Ground',
  roar: 'Taunt',
} as const;

// ── Zone tint colours ──────────────────────────────────────────────────────
// Real models have textures baked in. We use tint ONLY for the 'gold' variant.
export const ZONE_TINTS: Record<1 | 2 | 3, string> = {
  1: '#a88dff',   // soft lavender
  2: '#8f6bff',   // richer violet
  3: '#6b3fff',   // deep violet
};

// ── Grunt ────────────────────────────────────────────────────────────────────
export interface GruntStats {
  hp: number;
  damage: number;
  knockback: number;
  moveSpeed: number;
  chaseRange: number;
  attackRange: number;
  windupSec: number;
  activeSec: number;
  recoverySec: number;
  arcDeg: number;
  circleSpeed: number;
  /** Chance per frame to hesitate instead of attacking (Shade clue). */
  hesitateProbability: number;
  /** Chance to flinch/back away after a hit (Shade clue). */
  flinchProbability: number;
  radius: number;
  height: number;
  mass: number;
  scaleMul: number;
}

export const GRUNT_BASE: GruntStats = {
  hp: 35,
  damage: 8,
  knockback: 3.5,
  moveSpeed: 4.5,
  chaseRange: 14,
  attackRange: 2.0,
  windupSec: 0.55,
  activeSec: 0.1,
  recoverySec: 0.5,
  arcDeg: 90,
  circleSpeed: 2.5,
  hesitateProbability: 0.012,
  flinchProbability: 0.5,
  radius: 0.45,
  height: 1.6,
  mass: 1,
  scaleMul: 1.0,
};

export const GRUNT_ZONES: Record<1 | 2 | 3, Partial<GruntStats>> = {
  1: {},                                            // default
  2: { hp: 50, damage: 8, moveSpeed: 5.0, scaleMul: 1.05 },
  3: { hp: 65, damage: 10, moveSpeed: 5.5, scaleMul: 1.1, hesitateProbability: 0.008 },
};

// ── Brute ────────────────────────────────────────────────────────────────────
export interface BruteStats {
  hp: number;
  damage: number;
  slamDamage: number;
  chargeDamage: number;
  knockback: number;
  slamKnockback: number;
  moveSpeed: number;
  chaseRange: number;
  attackRange: number;
  slamRadius: number;
  chargeRange: number;
  chargeSpeed: number;
  chargeWidth: number;
  windupSec: number;
  chargeWindupSec: number;
  activeSec: number;
  recoverySec: number;
  shellHp: number;
  coreHp: number;
  coreWindowSec: number;
  radius: number;
  height: number;
  mass: number;
  scaleMul: number;
}

export const BRUTE_BASE: BruteStats = {
  hp: 80,
  damage: 15,
  slamDamage: 20,
  chargeDamage: 8,
  knockback: 5,
  slamKnockback: 8,
  moveSpeed: 2.8,
  chaseRange: 16,
  attackRange: 2.5,
  slamRadius: 3.5,
  chargeRange: 10,
  chargeSpeed: 11,
  chargeWidth: 1.8,
  windupSec: 0.95,
  chargeWindupSec: 1.1,
  activeSec: 0.12,
  recoverySec: 1.2,
  shellHp: 40,
  coreHp: 30,
  coreWindowSec: 4.0,
  radius: 0.7,
  height: 2.4,
  mass: 6,
  scaleMul: 1.0,
};

export const BRUTE_ZONES: Record<1 | 2 | 3, Partial<BruteStats>> = {
  1: {},
  2: { hp: 70, shellHp: 30, coreHp: 25, slamDamage: 14, scaleMul: 1.05 },
  3: { hp: 88, shellHp: 38, coreHp: 31, slamDamage: 18, chargeDamage: 10, chargeSpeed: 12, moveSpeed: 3.2, scaleMul: 1.15 },
};

// ── Armour defaults ─────────────────────────────────────────────────────────
export const ARMOUR_HEAVY_MULTIPLIER = 3;  // heavy finisher does 3× shell damage
export const ARMOUR_SHELL_COLOR = '#c8b0ff';
export const ARMOUR_CORE_COLOR = '#ff6b40';
export const ARMOUR_CRACK_COLOR = '#ffffff';

// ── Encounter ───────────────────────────────────────────────────────────────
export const MAX_ALIVE_ENEMIES = 8;
