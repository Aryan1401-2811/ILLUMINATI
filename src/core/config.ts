/**
 * Tuning numbers live here so they can be tweaked in one place (and from the ?debug panel).
 * Units: metres, seconds. One character is ~1.8 m tall.
 */

export interface ComboStep {
  damage: number;
  /** Seconds before the hit lands. */
  windup: number;
  /** Seconds the hit is live. */
  active: number;
  /** Seconds after the hit before you can act again (next attack can be buffered). */
  recovery: number;
  range: number;
  /** Hit arc in degrees, centred on facing. */
  arcDeg: number;
  /** Forward step during the swing. */
  lunge: number;
  /** Energy gained per enemy hit. */
  energyGain: number;
  /** Finisher: breaks armour shells. */
  heavy: boolean;
  knockback: number;
}

export const PLAYER = {
  maxHp: 100,
  maxEnergy: 100,
  radius: 0.45,
  height: 1.8,
  moveSpeed: 6.5,
  acceleration: 55,
  turnSpeed: 16,
  /** After being hit: invulnerable for this long. */
  hurtInvuln: 0.6,
  hurtStun: 0.25,
  dodge: { speed: 17, duration: 0.2, invuln: 0.24, cooldown: 0.4 },
  /** Time after a combo step during which the next press continues the combo. */
  comboWindow: 0.45,
  combo: [
    { damage: 10, windup: 0.07, active: 0.08, recovery: 0.16, range: 2.1, arcDeg: 120, lunge: 2.2, energyGain: 8, heavy: false, knockback: 2 },
    { damage: 12, windup: 0.07, active: 0.08, recovery: 0.18, range: 2.1, arcDeg: 120, lunge: 2.4, energyGain: 8, heavy: false, knockback: 2.5 },
    { damage: 22, windup: 0.16, active: 0.1, recovery: 0.34, range: 2.5, arcDeg: 150, lunge: 4.0, energyGain: 14, heavy: true, knockback: 7 },
  ] satisfies ComboStep[],
};

export const CAMERA = {
  fov: 40,
  /** Offset from the player (fixed angle, comic-panel framing). */
  offset: { x: 0, y: 9, z: 10.5 },
  /** Look slightly ahead of the player toward the mouse. */
  lookAhead: 1.6,
  followSharpness: 7,
};

export const FEEL = {
  hitstopLight: 0.045,
  hitstopHeavy: 0.1,
  shakeLight: 0.12,
  shakeHeavy: 0.35,
};
