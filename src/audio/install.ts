import { events, type StoryBeat } from '@/core/events';
import { audio } from './AudioManager';
import { Music, type TrackId } from './music';
import { playSfx } from './sfx';

function trackForScene(sceneId: string): TrackId {
  const id = sceneId === 'visuals' ? (new URLSearchParams(location.search).get('view') ?? 'zone1') : sceneId;
  if (id === 'warden') return 'warden';
  if (id === 'final' || id === 'ending') return 'violet';
  return 'gold';
}

const BEAT_TRACKS: Partial<Record<StoryBeat, TrackId>> = {
  'zone1:start': 'gold',
  'zone2:start': 'gold',
  'zone3:start': 'gold',
  'warden:start': 'warden',
  'twist:start': 'drone',
  'twist:trueLightGranted': 'violet',
  'final:start': 'violet',
  'ending:start': 'violet',
};

/** Wires music and sound effects to game events. Call once from main.ts. */
export function installAudio(): void {
  const music = new Music();

  events.on('scene:loaded', ({ sceneId }) => music.play(trackForScene(sceneId)));
  events.on('story:beat', ({ id }) => {
    const track = BEAT_TRACKS[id];
    if (track) music.play(track, id === 'twist:start' ? 1.2 : 3);
    if (id === 'twist:narratorFreed') playSfx('shatter', 2);
    if (id === 'twist:collapse') playSfx('rumble');
  });
  events.on('palette:set', ({ mode, durationSec }) => {
    // Instant sets are scene setup, not a moment.
    if (durationSec === 0) return;
    playSfx(mode === 'violet' ? 'flipViolet' : 'flipGold');
    // Outside the scripted twist (sandbox/debug flips) the music follows the light.
    if (music.current === 'gold' && mode === 'violet') music.play('violet', 2);
    else if (music.current === 'violet' && mode === 'gold') music.play('gold', 2);
  });
  events.on('game:pause', ({ paused }) => audio.setDucked(paused));

  events.on('player:attack', ({ comboStep }) => playSfx('swing', comboStep));
  events.on('player:dodge', () => playSfx('dodge'));
  events.on('player:hurt', () => playSfx('playerHurt'));
  events.on('player:died', () => playSfx('playerDeath'));
  events.on('player:ability', ({ id }) => {
    if (id === 'goldBurst') playSfx('goldBurst');
    else if (id.startsWith('gold')) playSfx('goldBolt');
    else playSfx('violetCast');
  });

  events.on('combat:hit', ({ hit, result, targetTeam }) => {
    if (result === 'immune') return;
    if (targetTeam === 'player') {
      if (result === 'blocked') playSfx('blocked');
      return; // damage to the hero sounds via player:hurt
    }
    switch (result) {
      case 'shellHit': return playSfx('clank');
      case 'shellBroken': return playSfx('shellBreak');
      case 'coreHit': return playSfx('coreHit');
      case 'deflected': return playSfx('deflect');
      case 'blocked': return playSfx('blocked');
    }
    if (hit.kind === 'energy') playSfx(hit.element === 'violet' ? 'energyViolet' : 'energyGold');
    else playSfx(hit.heavy ? 'heavy' : 'flesh');
  });
  events.on('enemy:killed', ({ wisp }) => {
    playSfx('enemyDeath');
    if (wisp) playSfx('wispRelease');
  });
  events.on('armour:coreBroken', () => playSfx('shatter', 0.8));
  events.on('fx:wispAbsorbed', () => playSfx('wispAbsorbed'));
  events.on('boss:defeated', () => playSfx('bossDown'));

  document.addEventListener('click', (e) => {
    if ((e.target as Element | null)?.closest?.('button')) playSfx('uiClick');
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) audio.toggleMute();
  });
}
