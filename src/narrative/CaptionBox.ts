import './captionBox.css';
import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { input } from '@/core/input';
import { runState } from '@/core/runState';
import { time } from '@/core/time';
import { blip, type BlipVoice } from './blips';
import { NARRATOR } from './config';
import { Shatter, clearCracks, crackElement } from './shatter';
import { Typewriter } from './Typewriter';

type Speaker = 'narrator' | 'warden' | 'hero';

interface Line {
  text: string;
  speaker: Speaker;
  durationSec?: number;
}

/** One place dialogue can appear: the caption box, or a speech bubble. */
interface Panel {
  el: HTMLElement;
  writer: Typewriter;
  /** The caption box stays faintly visible between lines so its growth is always readable. */
  keepIdle: boolean;
  voice: () => BlipVoice;
}

/**
 * The Narrator's caption box: the star of the twist.
 *
 * - Shows `narrator:say` lines with a typewriter and blips (Enter skips).
 * - Every wisp-releasing kill feeds it ~1 s later: `runState.narratorGrowth` rises,
 *   `narrator:growth` fires, and the box gets bigger, louder and hungrier.
 * - On `story:beat twist:narratorFreed` it cracks and shatters. After that the Narrator speaks
 *   in jagged black bubbles. The Warden always speaks in a soft violet bubble.
 */
export class CaptionBox {
  readonly el: HTMLElement;
  private box: Panel;
  private jagged: Panel;
  private warden: Panel;
  private hero: Panel;

  private queue: Line[] = [];
  private active: { line: Line; panel: Panel; held: number; hold: number } | null = null;
  private wisps: number[] = [];
  private growth = 0;
  private broken = false;
  private crackLeft = 0;
  private shatter: Shatter | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'narr-layer';
    this.el.innerHTML = `
      <div class="caption-box" data-tier="0"><span class="cb-text"></span></div>
      <div class="bubble bubble-jagged"><div class="bubble-body"><span class="cb-text"></span></div></div>
      <div class="bubble bubble-warden"><span class="cb-text"></span></div>
      <div class="bubble bubble-hero"><span class="cb-text"></span></div>
    `;
    root.appendChild(this.el);

    const panel = (sel: string, keepIdle: boolean, voice: () => BlipVoice): Panel => {
      const el = this.el.querySelector<HTMLElement>(sel)!;
      return { el, writer: new Typewriter(el.querySelector('.cb-text')!), keepIdle, voice };
    };
    // He sounds a little deeper and much louder the more he has eaten.
    this.box = panel('.caption-box', true, () => ({ freq: 620 - 200 * this.growth, type: 'square', volume: 0.05 + 0.1 * this.growth }));
    this.jagged = panel('.bubble-jagged', false, () => ({ freq: 150, type: 'sawtooth', volume: 0.09 }));
    this.warden = panel('.bubble-warden', false, () => ({ freq: 330, type: 'sine', volume: 0.12 }));
    this.hero = panel('.bubble-hero', false, () => ({ freq: 480, type: 'triangle', volume: 0.08 }));
    for (const p of [this.box, this.jagged, this.warden, this.hero]) {
      p.writer.onChar = (ch, i) => {
        if (ch.trim() && i % 2 === 0) blip(p.voice());
      };
    }

    events.on('narrator:say', ({ text, speaker, durationSec }) => this.enqueue({ text, speaker: speaker ?? 'narrator', durationSec }));
    events.on('enemy:killed', ({ wisp }) => {
      if (wisp && !this.broken) this.wisps.push(NARRATOR.wispTravelSec);
    });
    events.on('narrator:growth', ({ value }) => this.applyGrowth(value));
    events.on('story:beat', ({ id }) => {
      if (id === 'twist:narratorFreed') this.breakBox();
    });
    events.on('narrator:reset', () => this.reset());
    events.on('scene:loaded', () => {
      // Wisps in flight belonged to the old scene; growth itself carries over in runState.
      this.wisps = [];
      this.applyGrowth(runState.narratorGrowth);
    });

    this.applyGrowth(runState.narratorGrowth);
    getGame().onFrame((dt, realDt) => this.update(dt, realDt));
  }

  private enqueue(line: Line) {
    this.queue.push(line);
    if (this.queue.length > NARRATOR.maxQueue) this.queue.shift();
  }

  private panelFor(speaker: Speaker): Panel {
    if (speaker === 'warden') return this.warden;
    if (speaker === 'hero') return this.hero;
    return this.broken ? this.jagged : this.box;
  }

  private update(dt: number, realDt: number) {
    // Wisps travel in game time, so they freeze with pause and hit-stop.
    if (dt > 0 && this.wisps.length) {
      for (let i = this.wisps.length - 1; i >= 0; i--) {
        if ((this.wisps[i] -= dt) <= 0) {
          this.wisps.splice(i, 1);
          this.absorbWisp();
        }
      }
    }

    if (this.shatter && !this.shatter.update(realDt)) this.shatter = null;
    if (this.crackLeft > 0) {
      if ((this.crackLeft -= realDt) <= 0) this.shatterBox();
      return; // everyone waits while the box breaks
    }
    if (time.paused) return;

    const a = this.active;
    if (a) {
      if (!a.panel.writer.done && input.pressedRaw('skip')) a.panel.writer.finish();
      const speed = a.panel === this.box ? NARRATOR.charsPerSec + (NARRATOR.charsPerSecAtFull - NARRATOR.charsPerSec) * this.growth : NARRATOR.charsPerSec;
      a.panel.writer.update(realDt, speed);
      if (a.panel.writer.done) {
        a.held += realDt;
        const limit = this.queue.length ? Math.min(a.hold, NARRATOR.queuedHoldSec) : a.hold;
        if (a.held >= limit) {
          this.retire(a.panel);
          this.active = null;
        }
      }
    }
    if (!this.active && this.queue.length) this.showNext();
  }

  private showNext() {
    const line = this.queue.shift()!;
    const panel = this.panelFor(line.speaker);
    for (const p of [this.box, this.jagged, this.warden, this.hero]) if (p !== panel) this.retire(p);
    panel.el.classList.add('show');
    panel.el.classList.remove('idle');
    panel.writer.start(line.text);
    const plain = line.text.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1');
    const hold = line.durationSec ?? Math.max(NARRATOR.minHoldSec, plain.length * NARRATOR.holdPerChar);
    this.active = { line, panel, held: 0, hold };
  }

  /** Line finished: the caption box dims but stays, bubbles disappear. */
  private retire(p: Panel) {
    if (p.keepIdle && !this.broken && p.el.classList.contains('show')) p.el.classList.add('idle');
    else p.el.classList.remove('show', 'idle');
  }

  private absorbWisp() {
    if (this.broken) return;
    const value = Math.min(1, runState.narratorGrowth + NARRATOR.growthPerKill);
    runState.narratorGrowth = value;
    events.emit('narrator:growth', { value });

    const el = this.box.el;
    if (!el.classList.contains('show')) {
      // Never spoken yet: appear anyway so the player sees something feeding.
      el.querySelector('.cb-text')!.textContent = '…';
      el.classList.add('show', 'idle');
    }
    // Restart the gulp animation even if one is still playing.
    el.classList.remove('gulp');
    void el.offsetWidth;
    el.classList.add('gulp');
  }

  private applyGrowth(value: number) {
    this.growth = Math.max(0, Math.min(1, value));
    const el = this.box.el;
    el.style.setProperty('--g', this.growth.toFixed(3));
    el.dataset.tier = String(NARRATOR.tiers.filter((t) => this.growth >= t).length);
  }

  private breakBox() {
    if (this.broken || this.crackLeft > 0) return;
    const el = this.box.el;
    el.classList.add('show', 'cracking');
    el.classList.remove('idle', 'gulp');
    crackElement(el);
    this.crackLeft = NARRATOR.crackSec;
    events.emit('fx:shake', { strength: 0.25 });
  }

  private shatterBox() {
    const el = this.box.el;
    if (this.active?.panel === this.box) this.active.panel.writer.finish();
    this.shatter?.dispose();
    this.shatter = new Shatter(el, this.el);
    el.classList.remove('show', 'idle', 'cracking');
    clearCracks(el);
    this.broken = true;
    if (this.active?.panel === this.box) this.active = null;
    events.emit('fx:shake', { strength: 0.7 });
  }

  /** New game: whole box again, growth from runState. */
  private reset() {
    this.shatter?.dispose();
    this.shatter = null;
    this.crackLeft = 0;
    this.broken = false;
    this.queue = [];
    this.wisps = [];
    this.active = null;
    for (const p of [this.box, this.jagged, this.warden, this.hero]) p.el.classList.remove('show', 'idle', 'cracking', 'gulp');
    clearCracks(this.box.el);
    this.applyGrowth(runState.narratorGrowth);
  }
}
