import type { Element } from '@/combat/types';
import { events } from './events';

/**
 * Everything that must survive moving from one scene to the next during a playthrough
 * (zone1 → zone2 → … → final fight). Scenes read it on load and the player writes it back.
 *
 *   runState.reset()                         // new game
 *   player.loadFromRun() / player.saveToRun()
 */
export const runState = {
  hp: 100,
  energy: 0,
  loadout: [null, null, null] as (string | null)[],
  element: 'gold' as Element,
  /** Shades killed so far (each one fed the Narrator). */
  kills: 0,
  /** 0..1 — how big/loud the Narrator's caption box is. Grows with kills. */
  narratorGrowth: 0,
  deaths: 0,
  /** Id of the last scene reached, for retry-on-death. */
  checkpoint: '',
  /** Seconds played (for pacing checks). */
  playTime: 0,

  reset() {
    Object.assign(this, {
      hp: 100,
      energy: 0,
      loadout: [null, null, null],
      element: 'gold',
      kills: 0,
      narratorGrowth: 0,
      deaths: 0,
      checkpoint: '',
      playTime: 0,
    });
  },
};

events.on('enemy:killed', ({ wisp }) => {
  if (wisp) runState.kills++;
});
events.on('player:died', () => runState.deaths++);
