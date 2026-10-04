import { GameScene } from '@/core/GameScene';
import { events, type StoryBeat } from '@/core/events';
import { loadGLTF } from '@/core/assets';
import { Player } from '@/player/Player';
import { Encounter } from '@/enemies/Encounter';
import { ENEMY_MODELS } from '@/enemies/config';
import type { EnemyType } from '@/enemies/spawn';
import type { ZoneLayout } from '@/world/zones';
import { Sequence } from '@/sequences/Sequence';
import type { Line, ZoneLines } from '../script';
import { goTo, nextAfter, retry } from '../flow';
import { prompt } from '../guide';
import { ExitMarker } from './ExitMarker';

/** A fight: waves of enemies, each spawn placed on one of the arena's enemy spawn points. */
export interface FightDef {
  waves: { delay?: number; spawns: { type: EnemyType; at: number }[] }[];
}

/** Thrown to stop a zone's script when its scene has been unloaded (death retry, quit). */
const UNLOADED = Symbol('scene unloaded');

const ZONE = {
  /** Breather between fights, after the "cleared" banter. */
  gapSec: 1.5,
  /** Seconds after death before the checkpoint reloads (the death screen shows meanwhile). */
  retryDelayMs: 2600,
  exitRadius: 2.2,
};

/**
 * A zone level: the arena from Visuals, fights from Enemies (Encounter), lines from the
 * script, then an exit to the next scene. Subclasses only provide data (and zone 2 its grant).
 */
export abstract class ZoneScene extends GameScene {
  protected abstract readonly id: 'zone1' | 'zone2' | 'zone3';
  protected abstract readonly zone: 1 | 2 | 3;
  protected abstract readonly lines: ZoneLines;
  protected abstract readonly fights: FightDef[];
  protected abstract buildArena(): ZoneLayout;

  player!: Player;
  protected layout!: ZoneLayout;
  protected seq!: Sequence;
  private started = false;

  async load() {
    // Zones are all before the twist: the world is still gold
    events.emit('palette:set', { mode: 'gold', durationSec: 0 });
    this.layout = this.buildArena();
    // Warm the cache so the first wave doesn't pop in late
    await Promise.all([loadGLTF(ENEMY_MODELS.grunt.path), loadGLTF(ENEMY_MODELS.brute.path)]);

    this.player = this.add(new Player());
    await this.player.ready;
    this.player.position.copy(this.layout.playerSpawn);
    this.player.loadFromRun();
    this.cameraRig.follow(this.player.object);

    this.listen(events.on('player:died', () => {
      setTimeout(() => {
        if (this.game.current === this) void retry();
      }, ZONE.retryDelayMs);
    }));
  }

  protected onUpdate() {
    // Start the script on the first live frame (Sequence waits run on game frames)
    if (this.started) return;
    this.started = true;
    this.seq = new Sequence(this);
    this.listen(() => this.seq.dispose());
    this.run().catch((err) => {
      if (err !== UNLOADED) throw err;
    });
  }

  private async run() {
    this.beat(`${this.id}:start` as StoryBeat);
    prompt('move');
    await this.sayAll(this.lines.intro);
    await this.beforeFights();

    for (let i = 0; i < this.fights.length; i++) {
      const lines = this.lines.fights[i];
      if (lines) await this.sayAll(lines.before);
      await this.fight(i);
      if (lines) await this.sayAll(lines.after);
      await this.step(this.seq.wait(ZONE.gapSec));
    }

    this.beat(`${this.id}:end` as StoryBeat);
    const marker = this.add(new ExitMarker());
    marker.position.copy(this.layout.exit);
    prompt('exit');
    await this.sayAll(this.lines.exit);
    await this.step(this.seq.until(() => this.player.position.distanceTo(this.layout.exit) < ZONE.exitRadius));
    await goTo(nextAfter(this.id));
  }

  /** Zone 2 grants the gold energy here. */
  protected async beforeFights(): Promise<void> {}

  private fight(i: number): Promise<void> {
    const def = this.fights[i];
    const spawns = this.layout.enemySpawns;
    const id = `${this.id}-${i + 1}`;
    const enc = this.add(new Encounter({
      id,
      zone: this.zone,
      waves: def.waves.map((w) => ({
        delay: w.delay,
        spawns: w.spawns.map((s) => {
          const p = spawns[s.at % spawns.length];
          return { type: s.type, x: p.x, z: p.z };
        }),
      })),
    }));
    enc.start();
    if (this.zone === 1 && i === 0) prompt('attack');
    return this.step(new Promise<void>((resolve) => {
      const off = events.on('encounter:cleared', ({ encounterId }) => {
        if (encounterId !== id) return;
        off();
        enc.destroy();
        resolve();
      });
      this.listen(off);
    }));
  }

  protected async sayAll(lines: Line[]) {
    for (const line of lines) await this.step(this.seq.say(line.text, line.sec ?? 2.5, line.speaker));
  }

  protected beat(id: StoryBeat) {
    events.emit('story:beat', { id });
  }

  /** Await something, then bail out if this scene was unloaded meanwhile. */
  protected async step<T>(p: Promise<T>): Promise<T> {
    const v = await p;
    if (this.game.current !== this) throw UNLOADED;
    return v;
  }
}
