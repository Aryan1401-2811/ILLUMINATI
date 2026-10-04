import type * as THREE from 'three';

export type Team = 'player' | 'enemy' | 'neutral';

/** melee = sword hits (break shells). energy = gold/violet powers (hurt cores). */
export type DamageKind = 'melee' | 'energy';

/** gold = the Narrator's (false) light, violet = the true light. */
export type Element = 'gold' | 'violet' | 'none';

export interface Hit {
  amount: number;
  kind: DamageKind;
  element: Element;
  /** Combo finisher / heavy attack. Only heavy melee cracks armour shells. */
  heavy: boolean;
  /** Which side dealt it. */
  team: Team;
  /** World position the hit came from (for knockback direction and VFX). */
  from: THREE.Vector3;
  /** Knockback impulse in m/s. */
  knockback: number;
  /** Free-form tag for special rules, e.g. 'goldBolt', 'violetLance'. */
  sourceId?: string;
}

/**
 * What happened when a hit reached a target. Used for feedback (sparks, sounds, hit-stop)
 * and so the attacker knows whether to gain energy.
 */
export type HitResult =
  | 'damaged' //   normal damage taken
  | 'killed' //    this hit killed it
  | 'shellHit' //  hit an intact shell, chipped it
  | 'shellBroken' // this hit broke the shell, core now exposed
  | 'coreHit' //   damaged an exposed core
  | 'deflected' // wrong move for this armour (e.g. energy vs shell) — bounce feedback
  | 'blocked' //   target was guarding
  | 'immune'; //   invulnerable (dodging, cutscene, already dead) — no feedback

/**
 * Anything that can be hit. Enemies, bosses, the player, breakable props.
 * Register it with combat.register() so attacks can find it.
 */
export interface Hurtbox {
  readonly team: Team;
  /** Stable id for debugging / events. */
  readonly id: string;
  /** Centre of the body at ground level. */
  readonly position: THREE.Vector3;
  radius: number;
  height: number;
  /** False once dead — combat ignores it. */
  readonly alive: boolean;
  /** Body-push weight vs other characters. Default 1. 0 = never pushed and doesn't push. Bosses ~10. */
  mass?: number;
  receiveHit(hit: Hit): HitResult;
}

export function isPositiveResult(r: HitResult): boolean {
  return r === 'damaged' || r === 'killed' || r === 'shellHit' || r === 'shellBroken' || r === 'coreHit';
}
