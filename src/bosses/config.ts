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
  retreatDist: 6,              // preferred distance from player
  // AI weights
  shieldChance: 0.5,           // chance to raise shield vs sidestep
  bashChance: 0.15,            // low aggression
  poundChance: 0.1,
};

export const NARRATOR_BOSS = {
  maxHp: 400,
  phase2HpThreshold: 0.5,     // switch at 50% hp
};
