import type * as THREE from 'three';
import type { Element } from '@/combat/types';
import type { GameScene } from '@/core/GameScene';
import type { Player } from '../Player';

export interface AbilityContext {
  player: Player;
  scene: GameScene;
  /** Point on the ground under the mouse. */
  aimPoint: THREE.Vector3;
  /** Flat unit direction from the player toward aimPoint. */
  aimDir: THREE.Vector3;
}

/**
 * A spendable power on an ability slot (Q / E / R, right mouse = slot 1).
 *
 * To make a new one: create `src/<your-folder>/abilities/MyThing.ability.ts`,
 * extend Ability, and `export default defineAbility({ id: 'myThing', create: () => new MyThing() })`.
 * It is auto-registered; give it to the player with player.setLoadout(['myThing', ...]).
 */
export abstract class Ability {
  abstract readonly id: string;
  abstract readonly name: string;
  /** Short description for HUD tooltips / the narrator's tutorial. */
  abstract readonly description: string;
  /** Energy cost. */
  abstract readonly cost: number;
  /** Seconds between uses. */
  abstract readonly cooldown: number;
  /** Seconds the player is locked in the cast animation. */
  readonly castTime: number = 0.22;
  /** Animation clip to play while casting. */
  readonly castAnim: string = 'Punch';
  readonly element: Element = 'gold';
  /** CSS colour for the HUD icon. */
  readonly color: string = '#ffc21a';
  /** One emoji/glyph or short text for the HUD slot until real icons exist. */
  readonly glyph: string = '✦';

  cooldownLeft = 0;

  canCast(player: Player): boolean {
    return this.cooldownLeft <= 0 && player.energy >= this.cost;
  }

  /** Do the thing. Energy is already spent and cooldown started when this runs. */
  abstract cast(ctx: AbilityContext): void;

  /** Called every frame (cooldowns). Override for channelled abilities but call super. */
  update(dt: number): void {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }
}

export interface AbilityDef {
  id: string;
  create(): Ability;
}

export function defineAbility(def: AbilityDef): AbilityDef {
  return def;
}
