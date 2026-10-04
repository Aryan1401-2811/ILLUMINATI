import { events } from '@/core/events';
import { Shockwave } from '@/vfx/Shockwave';
import { Ability, defineAbility, type AbilityContext } from './Ability';

/** First-half area burst. Reference implementation for area abilities. */
export class GoldBurst extends Ability {
  readonly id = 'goldBurst';
  readonly name = 'Gold Burst';
  readonly description = 'Blast everything around you and knock it back.';
  readonly cost = 40;
  readonly cooldown = 2;
  readonly castTime = 0.3;
  readonly glyph = '✺';
  private radius = 3.6;

  cast({ player, scene }: AbilityContext) {
    const center = player.position.clone().setY(1);
    for (const target of scene.combat.querySphere(center, this.radius, 'player')) {
      scene.combat.applyHit(target, {
        amount: 18,
        kind: 'energy',
        element: 'gold',
        heavy: false,
        team: 'player',
        from: player.position.clone(),
        knockback: 10,
        sourceId: this.id,
      });
    }
    scene.add(new Shockwave(player.position, this.radius, '#ffc21a'));
    events.emit('fx:shake', { strength: 0.3 });
  }
}

export default defineAbility({ id: 'goldBurst', create: () => new GoldBurst() });
