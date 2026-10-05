import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { Player } from '@/player/Player';
import { SCRIPT, type Line } from './script';

/**
 * Tutorial prompts and the Narrator's one-off reactions. Each fires the first time it is
 * relevant (never on a timer), once per run. Only active in the zones: by the Warden the
 * player knows the game, and after the twist the Narrator is no longer "helping".
 */
const ZONES = new Set(['zone1', 'zone2', 'zone3']);
const PROMPT_SEC = 5;
/** Don't nag: at most one "you got hurt" line per this many seconds. */
const HURT_LINE_COOLDOWN_MS = 14000;

let scene = '';
let shown = new Set<string>();
let lastHurtLine = 0;

const active = () => ZONES.has(scene);

function say(lines: Line[]) {
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (line) events.emit('narrator:say', { text: line.text, speaker: line.speaker, durationSec: line.sec });
}

/** Show something once per run. */
function once(key: string, fn: () => void) {
  if (shown.has(key) || !active()) return;
  shown.add(key);
  fn();
}

export function prompt(key: keyof typeof SCRIPT.tutorial) {
  once(`prompt:${key}`, () => events.emit('ui:prompt', { text: SCRIPT.tutorial[key], durationSec: PROMPT_SEC }));
}

/** True the first time `key` is asked about in this run (any scene), false after that. */
export function firstTime(key: string): boolean {
  if (shown.has(key)) return false;
  shown.add(key);
  return true;
}

/** New game: everything can be shown again. */
export function resetGuide() {
  shown = new Set();
}

events.on('scene:loaded', ({ sceneId }) => (scene = sceneId));

events.on('player:hurt', () => {
  if (!active()) return;
  prompt('dodge');
  const now = performance.now();
  if (now - lastHurtLine > HURT_LINE_COOLDOWN_MS) {
    lastHurtLine = now;
    say(SCRIPT.reactions.hurt);
  }
});

events.on('enemy:killed', () => once('firstKill', () => say(SCRIPT.reactions.firstKill)));

// Heal needs Light: suggest it the first time the hero is hurt and can afford it
events.on('player:health', ({ hp, max }) => {
  if (hp < max * 0.6) {
    const player = getGame().current?.getFirst(Player);
    if (player?.canHeal) prompt('heal');
  }
});

events.on('player:attack', ({ heavy }) => {
  if (heavy) once('firstHeavy', () => say(SCRIPT.reactions.firstHeavy));
});

events.on('player:ability', () => once('firstEnergy', () => say(SCRIPT.reactions.firstEnergy)));

events.on('combat:hit', ({ result, targetTeam }) => {
  if (targetTeam !== 'enemy') return;
  // First time the player meets a shell: either a hit bounced off it or chipped it
  if (result === 'deflected' || result === 'shellHit') prompt('shell');
});

events.on('armour:shellBroken', () => {
  once('firstShellBreak', () => say(SCRIPT.reactions.firstShellBreak));
  prompt('core');
});

events.on('player:died', () => {
  if (active()) say(SCRIPT.reactions.death);
});
