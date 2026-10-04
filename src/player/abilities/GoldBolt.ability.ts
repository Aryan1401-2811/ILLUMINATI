import { Projectile } from '@/combat/Projectile';
import { Ability, defineAbility, type AbilityContext } from './Ability';

/** First-half ranged shot. Reference implementation for projectile abilities. */
export class GoldBolt extends Ability {
  readonly id = 'goldBolt';
  readonly name = 'Gold Bolt';
  readonly description = 'Fire a bolt of gold light. Hurts exposed cores.';
  readonly cost = 20;
  readonly cooldown = 0.35;
  readonly castTime = 0.16;
  readonly glyph = '➶';

  cast({ player, scene, aimDir }: AbilityContext) {
    const from = player.position.clone().addScaledVector(aimDir, 0.8).setY(1.1);
    scene.add(new Projectile({ team: 'player', from, dir: aimDir, damage: 16, element: 'gold', speed: 24, sourceId: this.id }));
  }
}

export default defineAbility({ id: 'goldBolt', create: () => new GoldBolt() });
