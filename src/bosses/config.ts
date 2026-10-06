export const WARDEN = {
  maxHp: 240,                  // R2: 300 → 240 (favour the hero)
  radius: 0.9,
  height: 2.6,
  mass: 10,                    // bosses are heavy, don't get pushed
  moveSpeed: 2.5,              // slow, deliberate
  shieldBashDamage: 10,        // R2: 15 → 10
  shieldBashKnockback: 12,
  groundPoundDamage: 8,        // R2: 10 → 8
  groundPoundKnockback: 15,
  groundPoundRadius: 4,
  bashWindup: 0.875,           // R2: 0.7 → +25% (more time to read telegraph)
  poundWindup: 1.0,            // R2: 0.8 → +25%
  attackCooldown: 3.2,         // R2: 4 → 3.2 (compensates lower damage with slightly faster cadence)
  minAttackGap: 1.2,           // R2: no two attacks chain without ≥1.2 s gap
  armourShellHp: 80,
  armourCoreHp: 60,
  staggerSec: 2.5,             // how long the Warden kneels between stages
  homeLeash: 2.5,              // he drifts back to his post instead of chasing (clue: he never chases)
  model: 'models/bosses/warden.glb',
  modelHeight: 3.2,
  retreatDist: 6,              // preferred distance from player
  // AI weights
  shieldChance: 0.5,           // chance to raise shield vs sidestep
  bashChance: 0.15,            // low aggression
  poundChance: 0.1,
};

export const NARRATOR_BOSS = {
  maxHp: 320,                  // R2: 400 → 320 (favour the hero)
  phase2HpThreshold: 0.5,     // switch at 50% hp
  // Phase 1 gold armour: melee cracks the plates, then the Lance hits the core.
  // Armour no longer regrows inside a stage (R2 rule).
  armourShellHp: 90,           // R2: 120 → 90
  armourCoreHp: 70,            // R2: 100 → 70
  armourWindowSec: 5,
  phase2RoarSec: 1.5,          // invulnerable roar on the phase change
  model: 'models/bosses/narrator.glb',
  modelHeight: 2.9,
  floatHeight: 0.6,
};
