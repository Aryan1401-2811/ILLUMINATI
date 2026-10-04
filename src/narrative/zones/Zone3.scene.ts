import { defineScene } from '@/core/GameScene';
import { buildZone3 } from '@/world/zones';
import { SCRIPT } from '../script';
import { ZoneScene, type FightDef } from './ZoneScene';

/** Zone 3 — The Worn Square. Mixed fights; the caption box is huge and the Narrator too eager. */
class Zone3Scene extends ZoneScene {
  protected readonly id = 'zone3' as const;
  protected readonly zone = 3 as const;
  protected readonly lines = SCRIPT.zone3;
  protected readonly fights: FightDef[] = [
    {
      waves: [
        { spawns: [{ type: 'grunt', at: 0 }, { type: 'grunt', at: 1 }, { type: 'grunt', at: 2 }, { type: 'grunt', at: 3 }] },
        { delay: 1, spawns: [{ type: 'brute', at: 4 }] },
      ],
    },
    { waves: [{ spawns: [{ type: 'brute', at: 5 }, { type: 'brute', at: 6 }, { type: 'grunt', at: 7 }, { type: 'grunt', at: 8 }] }] },
    {
      waves: [
        { spawns: [{ type: 'grunt', at: 0 }, { type: 'grunt', at: 2 }, { type: 'grunt', at: 4 }, { type: 'grunt', at: 6 }] },
        { delay: 1.5, spawns: [{ type: 'brute', at: 8 }, { type: 'brute', at: 9 }, { type: 'grunt', at: 1 }, { type: 'grunt', at: 3 }] },
      ],
    },
  ];

  protected buildArena() {
    return buildZone3(this);
  }
}

export default defineScene({ id: 'zone3', title: 'Zone 3 — The Worn Square', owner: 'Narrative', create: (g) => new Zone3Scene(g) });
