import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { runState } from '@/core/runState';
import { Player } from '@/player/Player';
import { pageTurn } from './PageTurn';
import { resetGuide } from './guide';
import './flow.css';

/**
 * The whole run, title to credits. The twist happens inside `warden`, which loads `final`
 * itself; `final` loads `ending`. Everything else moves on through goTo()/next().
 */
export const FLOW = ['game', 'zone1', 'zone2', 'zone3', 'warden', 'final', 'ending'] as const;
export type FlowId = (typeof FLOW)[number];

/** Scenes that are checkpoints: dying in one restarts it as you first entered it. */
const CHECKPOINTS = new Set<string>(['zone1', 'zone2', 'zone3', 'warden', 'final']);

type RunSnapshot = Omit<typeof runState, 'reset'>;
let snapshot: RunSnapshot | null = null;
let busy = false;

function takeSnapshot(): RunSnapshot {
  const { reset: _reset, ...data } = runState;
  return { ...data, loadout: [...data.loadout] };
}

/** Load a scene behind a page-turn, carrying the hero's hp/energy/loadout across. */
export async function goTo(id: string, opts: { save?: boolean } = {}): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const game = getGame();
    if (opts.save !== false) game.current?.getFirst(Player)?.saveToRun();
    await pageTurn(() => game.loadScene(id));
  } finally {
    busy = false;
  }
}

/** The scene after `id` in the run (zone1 → zone2 …). */
export function nextAfter(id: string): string {
  const i = FLOW.indexOf(id as FlowId);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : 'game';
}

/** Title → a fresh run. */
export function newGame(): Promise<void> {
  runState.reset();
  resetGuide();
  events.emit('narrator:reset', {});
  events.emit('palette:set', { mode: 'gold', durationSec: 0 });
  return goTo('zone1', { save: false });
}

/** Back to the checkpoint exactly as it was when we first walked in. */
export function retry(): Promise<void> {
  const id = runState.checkpoint || 'zone1';
  if (snapshot) Object.assign(runState, { ...snapshot, loadout: [...snapshot.loadout], deaths: runState.deaths });
  // After the twist the box stays shattered; before it, the box comes back as it was
  if (id !== 'final') events.emit('narrator:reset', {});
  return goTo(id, { save: false });
}

export function toTitle(): Promise<void> {
  events.emit('palette:set', { mode: 'gold', durationSec: 0 });
  return goTo('game', { save: false });
}

// Every time a checkpoint scene loads (by any route, including the twist's own loads),
// remember it and what the run looked like on the way in.
events.on('scene:loaded', ({ sceneId }) => {
  document.body.dataset.scene = sceneId;
  if (!CHECKPOINTS.has(sceneId)) return;
  if (runState.checkpoint !== sceneId) {
    runState.checkpoint = sceneId;
    snapshot = takeSnapshot();
  }
});
