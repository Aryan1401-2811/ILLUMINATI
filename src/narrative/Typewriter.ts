import { NARRATOR } from './config';

type Op = { k: 'char'; ch: string; glitch: boolean } | { k: 'wait'; sec: number; flicker?: boolean } | { k: 'del'; n: number };

interface Glyph {
  ch: string;
  glitch: boolean;
}

const GLITCH = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/**
 * Types a line into an element one character at a time.
 *
 * Glitch markup lets the Narrator's mask slip: `"I'm [[feeding|helping]] you"` types the
 * wrong word, flickers it, deletes it and types the right one.
 */
export class Typewriter {
  done = true;
  /** Called for every typed (not deleted) character — used for blips. */
  onChar: ((ch: string, index: number) => void) | null = null;

  private ops: Op[] = [];
  private glyphs: Glyph[] = [];
  private acc = 0;
  private flicker = false;
  private typed = 0;

  constructor(private readonly el: HTMLElement) {}

  start(text: string) {
    this.ops = compile(text);
    this.glyphs = [];
    this.acc = 0;
    this.typed = 0;
    this.done = this.ops.length === 0;
    this.setFlicker(false);
    this.render();
  }

  /** Skip to the end of the line (Enter). Glitches resolve to the corrected text. */
  finish() {
    for (const op of this.ops) {
      if (op.k === 'char') this.glyphs.push({ ch: op.ch, glitch: op.glitch });
      else if (op.k === 'del') this.glyphs.length = Math.max(0, this.glyphs.length - op.n);
    }
    this.ops = [];
    this.done = true;
    this.setFlicker(false);
    this.render();
  }

  update(dt: number, charsPerSec: number) {
    if (this.done) return;
    this.acc += dt;
    let changed = false;
    while (this.ops.length) {
      const op = this.ops[0];
      if (op.k === 'wait') {
        if (this.acc < op.sec) {
          this.setFlicker(!!op.flicker);
          break;
        }
        this.acc -= op.sec;
        this.setFlicker(false);
        this.ops.shift();
        continue;
      }
      const step = op.k === 'char' ? 1 / charsPerSec : 1 / NARRATOR.deleteCharsPerSec;
      if (this.acc < step) break;
      this.acc -= step;
      changed = true;
      if (op.k === 'char') {
        this.glyphs.push({ ch: op.ch, glitch: op.glitch });
        this.onChar?.(op.ch, this.typed++);
        this.ops.shift();
      } else {
        this.glyphs.pop();
        if (--op.n <= 0) this.ops.shift();
      }
    }
    if (!this.ops.length) {
      this.done = true;
      this.setFlicker(false);
      changed = true;
    }
    if (changed) this.render();
  }

  private setFlicker(on: boolean) {
    if (on === this.flicker) return;
    this.flicker = on;
    this.el.classList.toggle('flicker', on);
  }

  private render() {
    let html = '';
    let run = '';
    let runGlitch = false;
    const flush = () => {
      if (run) html += runGlitch ? `<span class="glitch">${run}</span>` : run;
      run = '';
    };
    for (const g of this.glyphs) {
      if (g.glitch !== runGlitch) {
        flush();
        runGlitch = g.glitch;
      }
      run += escapeHtml(g.ch);
    }
    flush();
    if (!this.done) html += '<span class="tw-caret"></span>';
    this.el.innerHTML = html;
  }
}

function compile(text: string): Op[] {
  const ops: Op[] = [];
  const pushText = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      ops.push({ k: 'char', ch, glitch: false });
      // Pause on punctuation only when it ends a phrase, so "..." or "3.5" read naturally.
      const next = s[i + 1];
      if (next !== undefined && next !== ' ') continue;
      if (/[.!?…]/.test(ch)) ops.push({ k: 'wait', sec: NARRATOR.stopPauseSec });
      else if (/[,;:—]/.test(ch)) ops.push({ k: 'wait', sec: NARRATOR.commaPauseSec });
    }
  };
  let last = 0;
  for (const m of text.matchAll(GLITCH)) {
    pushText(text.slice(last, m.index));
    const [, wrong, right] = m;
    for (const ch of wrong) ops.push({ k: 'char', ch, glitch: true });
    ops.push({ k: 'wait', sec: NARRATOR.glitchHoldSec, flicker: true });
    ops.push({ k: 'del', n: wrong.length });
    pushText(right);
    last = m.index! + m[0].length;
  }
  pushText(text.slice(last));
  return ops;
}

function escapeHtml(ch: string): string {
  switch (ch) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '"':
      return '&quot;';
    default:
      return ch;
  }
}
