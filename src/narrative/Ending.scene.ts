import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { Player } from '@/player/Player';
import { buildFinalArena } from '@/world/zones';
import { Sequence } from '@/sequences/Sequence';
import { SCRIPT } from './script';
import { Typewriter } from './Typewriter';
import { creditsRollHtml } from './credits';
import { newGame, toTitle } from './flow';

const ENDING = {
  captionCharsPerSec: 22,
  /** Seconds the finished caption stays alone before the credits start rolling. */
  captionHoldSec: 3,
  /** Credits scroll speed in pixels per second. */
  rollPxPerSec: 55,
};

/**
 * The last panel: the souls are free, the hero picks up the pen and writes the final caption
 * themselves. Then the credits roll (built from CREDITS.md) and the run ends.
 */
class EndingScene extends GameScene {
  private started = false;
  private seq!: Sequence;
  private el!: HTMLElement;
  private caption!: HTMLElement;
  private writer: Typewriter | null = null;
  private roll: HTMLElement | null = null;
  private rollY = 0;
  private rollEnd = 0;
  private done = false;

  async load() {
    events.emit('palette:set', { mode: 'violet', durationSec: 0 });
    const layout = buildFinalArena(this);
    const player = this.add(new Player());
    await player.ready;
    player.position.copy(layout.playerSpawn);
    player.loadFromRun();
    player.setLocked(true);
    this.cameraRig.follow(player.object);
    this.cameraRig.setOffset(0, 4, 7, 0);

    this.el = document.createElement('div');
    this.el.className = 'comic-screen ending-screen';
    this.el.innerHTML = `
      <div class="ending-caption hidden"></div>
      <div class="credits-roll hidden"><div class="credits-roll-inner">${creditsRollHtml()}</div></div>
      <div class="comic-menu ending-menu hidden">
        <div class="comic-logo" style="font-size:clamp(40px,6vw,80px)">${SCRIPT.ending.theEnd}</div>
        <button class="comic-btn" data-act="again">PLAY AGAIN</button>
        <button class="comic-btn" data-act="title">TITLE</button>
      </div>
    `;
    document.getElementById('ui-root')!.appendChild(this.el);
    this.listen(() => this.el.remove());
    this.caption = this.el.querySelector<HTMLElement>('.ending-caption')!;
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'again') void newGame();
      if (act === 'title') void toTitle();
    });
  }

  protected onUpdate(_dt: number, realDt: number) {
    if (!this.started) {
      this.started = true;
      this.seq = new Sequence(this);
      this.listen(() => this.seq.dispose());
      void this.run();
    }
    this.writer?.update(realDt, ENDING.captionCharsPerSec);
    if (this.roll && !this.done) {
      this.rollY += ENDING.rollPxPerSec * realDt;
      this.roll.style.transform = `translate(-50%, ${-this.rollY}px)`;
      if (this.rollY >= this.rollEnd) this.finish();
    }
  }

  private async run() {
    const seq = this.seq;
    await seq.lockPlayer();
    seq.beat('ending:start');
    await seq.camera(0, 3, 6, 2);
    for (const line of SCRIPT.ending.lines) {
      await seq.say(line.text, line.sec ?? 3, line.speaker ?? 'hero');
      if (this.game.current !== this) return;
    }

    // The hero writes the final caption
    this.caption.classList.remove('hidden');
    this.writer = new Typewriter(this.caption);
    this.writer.start(SCRIPT.ending.finalCaption);
    const writer = this.writer;
    await seq.until(() => writer.done);
    await seq.wait(ENDING.captionHoldSec);
    if (this.game.current !== this) return;

    // Credits roll from the bottom of the screen to past the top
    this.caption.classList.add('hidden');
    const rollBox = this.el.querySelector<HTMLElement>('.credits-roll')!;
    rollBox.classList.remove('hidden');
    this.roll = rollBox.querySelector<HTMLElement>('.credits-roll-inner')!;
    this.rollEnd = this.roll.offsetHeight + rollBox.offsetHeight;
    this.el.querySelector('.ending-menu')!.classList.remove('hidden');
    this.el.classList.add('rolling');
  }

  private finish() {
    this.done = true;
    events.emit('story:beat', { id: 'ending:done' });
    this.el.classList.add('finished');
  }
}

export default defineScene({ id: 'ending', title: 'Ending', owner: 'Narrative', create: (g) => new EndingScene(g) });
