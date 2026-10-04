import { defineScene } from '@/core/GameScene';
import { buildZone1 } from '@/world/zones';
import { SCRIPT } from '../script';
import { ZoneScene, type FightDef } from './ZoneScene';

/** Zone 1 — Sunny Side Street. Melee only: move, swing, finish, dodge. Small groups of Grunts. */
class Zone1Scene extends ZoneScene {
  protected readonly id = 'zone1' as const;
  protected readonly zone = 1 as const;
  protected readonly lines = SCRIPT.zone1;
  protected readonly fights: FightDef[] = [
    { waves: [{ spawns: [{ type: 'grunt', at: 0 }, { type: 'grunt', at: 1 }] }] },
    { waves: [{ spawns: [{ type: 'grunt', at: 2 }, { type: 'grunt', at: 3 }, { type: 'grunt', at: 4 }] }] },
    {
      waves: [
        { spawns: [{ type: 'grunt', at: 5 }, { type: 'grunt', at: 6 }] },
        { delay: 1, spawns: [{ type: 'grunt', at: 7 }, { type: 'grunt', at: 4 }, { type: 'grunt', at: 3 }] },
      ],
    },
  ];

  protected buildArena() {
    return buildZone1(this);
  }
}

export default defineScene({ id: 'zone1', title: 'Zone 1 — Sunny Side Street', owner: 'Narrative', create: (g) => new Zone1Scene(g) });
