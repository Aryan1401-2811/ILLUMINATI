export const WARDEN = {
  maxHp: 300,
  radius: 0.9,
  height: 2.6,
  mass: 10,                    // bosses are heavy, don't get pushed
  moveSpeed: 2.5,              // slow, deliberate
  shieldBashDamage: 15,
  shieldBashKnockback: 12,
  groundPoundDamage: 10,
  groundPoundKnockback: 15,
  groundPoundRadius: 4,
  bashWindup: 0.7,             // telegraph duration
  poundWindup: 0.8,
  attackCooldown: 4,           // rarely attacks
  armourShellHp: 80,
  armourCoreHp: 60,
  armourWindowSec: 4.5,        // how long the core stays open before the shell regrows
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
  maxHp: 400,
  phase2HpThreshold: 0.5,     // switch at 50% hp
  // Phase 1 gold armour: melee cracks the plates, then the Lance hits the core.
  // Only core hits cost him health; a broken core regrows after a short beat.
  armourShellHp: 120,
  armourCoreHp: 100,
  armourWindowSec: 5,
  armourRegrowSec: 1.5,
  phase2RoarSec: 1.5,          // invulnerable roar on the phase change
  model: 'models/bosses/narrator.glb',
  modelHeight: 2.9,
  floatHeight: 0.6,
};
