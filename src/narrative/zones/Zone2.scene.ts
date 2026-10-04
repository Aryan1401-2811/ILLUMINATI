import { defineScene } from '@/core/GameScene';
import { buildZone2 } from '@/world/zones';
import { SCRIPT } from '../script';
import { ZoneScene, type FightDef } from './ZoneScene';
import { prompt } from '../guide';

/** Zone 2 — Rooftop Market. The Narrator hands over his gold Light; armoured Brutes appear. */
class Zone2Scene extends ZoneScene {
  protected readonly id = 'zone2' as const;
  protected readonly zone = 2 as const;
  protected readonly lines = SCRIPT.zone2;
  protected readonly fights: FightDef[] = [
    { waves: [{ spawns: [{ type: 'grunt', at: 0 }, { type: 'grunt', at: 1 }, { type: 'grunt', at: 2 }] }] },
    { waves: [{ spawns: [{ type: 'brute', at: 4 }] }] },
    { waves: [{ spawns: [{ type: 'brute', at: 2 }, { type: 'grunt', at: 3 }, { type: 'grunt', at: 0 }] }] },
    {
      waves: [
        { spawns: [{ type: 'brute', at: 5 }, { type: 'brute', at: 6 }] },
        { delay: 1.5, spawns: [{ type: 'grunt', at: 8 }, { type: 'grunt', at: 9 }, { type: 'grunt', at: 7 }] },
      ],
    },
  ];

  protected buildArena() {
    return buildZone2(this);
  }

  /** The gift: gold energy. Only granted once per run (a retry keeps it via the checkpoint). */
  protected async beforeFights() {
    if (this.player.abilities.some((a) => a?.id === 'goldBolt')) return;
    await this.sayAll(SCRIPT.zone2.energyGrant.slice(0, 1));
    this.player.setLoadout(['goldBolt', 'goldBurst', null]);
    this.player.gainEnergy(60);
    this.beat('zone2:energyGranted');
    prompt('energy');
    await this.sayAll(SCRIPT.zone2.energyGrant.slice(1));
  }
}

export default defineScene({ id: 'zone2', title: 'Zone 2 — Rooftop Market', owner: 'Narrative', create: (g) => new Zone2Scene(g) });
