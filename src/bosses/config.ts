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
  attackCooldown: 1.5,         // a real boss: attacks whenever this is ready
  stage2CooldownMul: 0.75,     // angrier after SHIELD UP! (~1.1 s)
  minAttackGap: 0.8,           // idle beat before he decides again
  // Shield Charge: his answer to a hero who keeps away from him
  chargeWindup: 0.9,
  chargeSpeed: 13,
  chargeRange: 9,
  chargeWidth: 1.8,
  chargeDamage: 10,
  chargeKnockback: 10,
  // Guard: blocks frontal hits; a heavy finisher breaks it, a blocked hit may be punished
  defendSec: 1.2,
  // Breather after each attack (the punish window)
  recoverSec: 1.0,
  riposteChance: 0.6,
  riposteWindup: 0.55,
  guardBreakStunSec: 1.4,
  armourShellHp: 80,
  armourCoreHp: 60,
  staggerSec: 2.5,             // how long the Warden kneels between stages
  homeLeash: 2.5,              // he drifts back to his post instead of chasing (clue: he never chases)
  model: 'models/bosses/warden.glb',
  modelHeight: 3.2,
  retreatDist: 6,              // preferred distance from player
  // AI weights
  shieldChance: 0.6,           // between attacks: raise the shield vs sidestep
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
  // Gold burst (phase 2, when the hero is close): telegraphed so it can be dodged
  burstDamage: 12,
  burstRadius: 5,
  burstKnockback: 5,
  burstWindup: 0.8,
  burstCooldown: 3.2,
  model: 'models/bosses/narrator.glb',
  modelHeight: 2.9,
  floatHeight: 0.6,
};
