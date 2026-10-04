import { audio } from './AudioManager';
import { mtof, Synth } from './synth';

export type TrackId = 'title' | 'gold' | 'goldIntense' | 'warden' | 'drone' | 'violet' | 'silence';

interface TrackDef {
  bpm: number;
  /** Called once per 16th note; `n` counts from the track's start. */
  step(s: Synth, t: number, n: number, stepDur: number): void;
  /** Continuous voices (drones). Returns a stop function. */
  sustain?(s: Synth, t: number): () => void;
}

const triad = (root: number, minor: boolean) => [root, root + (minor ? 3 : 4), root + 7];
const kick = (s: Synth, t: number, from: number, gain: number, dur = 0.2) =>
  s.tone(t, { freq: from, to: 40, glide: dur * 0.8, dur, gain });
const hat = (s: Synth, t: number, gain: number) => s.noise(t, { dur: 0.035, gain, filter: { type: 'highpass', freq: 7000 } });

/** Title: a slow music box over soft pads. Every 4th bar, the sour note slips in. */
const TITLE_BARS = [{ r: 60, m: false }, { r: 57, m: true }, { r: 65, m: false }, { r: 67, m: false }];
const title: TrackDef = {
  bpm: 76,
  step(s, t, n, d) {
    const i = n % 16;
    const bar = Math.floor(n / 16);
    const { r, m } = TITLE_BARS[bar % 4];
    const [a, b, c] = triad(r, m);
    if (i % 2 === 0) {
      const offNote = bar % 4 === 3 && i === 14;
      const note = offNote ? a + 13 : [a, c, b + 12, c, a + 12, c, b + 12, c][i / 2] + 12;
      s.tone(t, { freq: mtof(note), detune: offNote ? 30 : 0, dur: d * 4, gain: 0.07, wet: 0.6 });
      s.tone(t, { freq: mtof(note + 12), dur: d * 1.5, gain: 0.015, wet: 0.6 });
    }
    if (i === 0) {
      for (const p of [a, b, c]) s.tone(t, { type: 'triangle', freq: mtof(p - 12), dur: d * 16 + 0.4, gain: 0.03, attack: 0.8, release: 1, wet: 0.6 });
      s.tone(t, { freq: mtof(a - 24), dur: d * 16, gain: 0.15, attack: 0.3, release: 1 });
    }
  },
};

/** The lie: warm and bouncy in C major. Once every 8 bars one note is flat and out of tune. */
const GOLD_BARS = [{ r: 60, m: false }, { r: 67, m: false }, { r: 69, m: true }, { r: 65, m: false }];
/** `intense` (zone 3): faster, kick on every beat, driving bass, and the sour note every 4 bars. */
const makeGold = (bpm: number, intense: boolean): TrackDef => ({
  bpm,
  step(s, t, n, d) {
    const i = n % 16;
    const bar = Math.floor(n / 16);
    const { r, m } = GOLD_BARS[bar % 4];
    const [a, b, c] = triad(r, m);
    const offNote = bar % (intense ? 4 : 8) === (intense ? 3 : 7) && i === 14;
    const arp = offNote ? a + 8 : [a, b, c, a + 12, c, b, c, a + 12][i % 8];
    s.tone(t, { type: 'triangle', freq: mtof(arp), detune: offNote ? 35 : 0, dur: d * 1.6, gain: 0.07, wet: 0.25 });
    if (i === 0) {
      for (const p of [a, b, c]) s.tone(t, { type: 'triangle', freq: mtof(p - 12), dur: d * 16, gain: 0.035, attack: 0.25, release: 0.6, wet: 0.4 });
    }
    const bassSteps = intense ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 14];
    if (bassSteps.includes(i)) {
      s.tone(t, { type: intense ? 'sawtooth' : 'triangle', freq: mtof(a - 24 + (intense && i % 4 === 2 ? 12 : 0)), dur: d * 2.5, gain: intense ? 0.14 : 0.22, filter: { type: 'lowpass', freq: intense ? 900 : 600 } });
    }
    if (i % (intense ? 4 : 8) === 0) kick(s, t, 130, 0.45);
    if (i === 4 || i === 12) s.noise(t, { dur: 0.12, gain: intense ? 0.16 : 0.12, filter: { type: 'bandpass', freq: 1500, q: 1 }, wet: 0.2 });
    if (intense || i % 2 === 1) hat(s, t, i % 2 === 1 ? 0.035 : 0.02);
  },
});
const gold = makeGold(112, false);
const goldIntense = makeGold(124, true);

/** The Warden: driving low ostinato and war drums in D minor, ending each phrase on a sour b9. */
const WARDEN_BARS = [{ r: 50, m: true }, { r: 46, m: false }, { r: 43, m: true }, { r: 45, m: false }];
const warden: TrackDef = {
  bpm: 96,
  step(s, t, n, d) {
    const i = n % 16;
    const barIdx = Math.floor(n / 16) % 4;
    const { r, m } = WARDEN_BARS[barIdx];
    const [a, b, c] = triad(r, m);
    if (i % 2 === 0) {
      s.tone(t, { type: 'sawtooth', freq: mtof(i % 8 === 0 ? a + 24 : a + 12), dur: d * 1.5, gain: 0.09, filter: { type: 'lowpass', freq: 900, q: 5 } });
    }
    if ([0, 3, 6, 10, 12].includes(i)) s.tone(t, { freq: 95, to: 50, dur: 0.35, gain: i === 0 ? 0.55 : 0.35 });
    if (i === 0 && barIdx % 2 === 0) s.tone(t, { freq: 55, to: 30, dur: 0.8, gain: 0.4 });
    if (i === 0) {
      for (const p of [a, b, c]) {
        for (const detune of [-8, 8]) {
          s.tone(t, { type: 'sawtooth', freq: mtof(p + 24), detune, dur: d * 16, gain: 0.018, attack: 0.6, release: 0.5, wet: 0.5, filter: { type: 'lowpass', freq: 1300 } });
        }
      }
    }
    if (barIdx === 3 && i === 8) {
      s.tone(t, { type: 'sawtooth', freq: mtof(a + 25), dur: d * 8, gain: 0.03, attack: 0.3, wet: 0.5, filter: { type: 'lowpass', freq: 2000 } });
    }
    if (i === 14) s.noise(t, { dur: 0.06, gain: 0.05, filter: { type: 'highpass', freq: 5000 } });
  },
};

/** The twist: no rhythm, a low breathing drone and a far-off bell. */
const drone: TrackDef = {
  bpm: 60,
  sustain(s, t) {
    const ctx = s.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1, t + 3);
    out.connect(s.out.dry);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 3;
    lp.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth).connect(lp.frequency);
    const voices: { midi: number; type: OscillatorType; gain: number; detune: number }[] = [
      { midi: 38, type: 'sawtooth', gain: 0.06, detune: -6 },
      { midi: 38, type: 'sawtooth', gain: 0.06, detune: 7 },
      { midi: 45, type: 'sine', gain: 0.12, detune: 0 },
      { midi: 50, type: 'sine', gain: 0.08, detune: 0 },
    ];
    const oscs = voices.map((v) => {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.value = mtof(v.midi);
      o.detune.value = v.detune;
      const g = ctx.createGain();
      g.gain.value = v.gain;
      o.connect(g).connect(lp);
      o.start(t);
      return o;
    });
    lfo.start(t);
    return () => [...oscs, lfo].forEach((o) => o.stop());
  },
  step(s, t, n) {
    if (n > 0 && n % 32 === 0) {
      s.tone(t, { freq: mtof(86), dur: 4, gain: 0.03, wet: 0.9 });
      s.tone(t, { freq: mtof(86) + 4, dur: 4, gain: 0.02, wet: 0.9 });
    }
  },
};

/** The truth: slow, wide and soaring in A minor; the melody enters after a 4-bar build. */
const VIOLET_BARS = [{ r: 57, m: true }, { r: 53, m: false }, { r: 60, m: false }, { r: 55, m: false }];
// [step within a 128-step (8-bar) cycle, midi, length in steps]
const VIOLET_MELODY = new Map<number, [number, number]>([
  [0, [76, 8]], [8, [81, 4]], [12, [84, 4]], [16, [84, 12]], [28, [81, 4]],
  [32, [79, 8]], [40, [76, 4]], [44, [79, 4]], [48, [86, 16]],
  [64, [76, 8]], [72, [81, 4]], [76, [84, 4]], [80, [88, 12]], [92, [86, 4]],
  [96, [84, 8]], [104, [83, 4]], [108, [79, 4]], [112, [81, 16]],
]);
const violet: TrackDef = {
  bpm: 80,
  step(s, t, n, d) {
    const i = n % 16;
    const { r, m } = VIOLET_BARS[Math.floor(n / 16) % 4];
    const [a, b, c] = triad(r, m);
    if (i === 0) {
      for (const p of [a, b, c, a + 12]) {
        for (const detune of [-7, 7]) {
          s.tone(t, { type: 'sawtooth', freq: mtof(p), detune, dur: d * 16 + 0.3, gain: 0.016, attack: 0.9, release: 1.2, wet: 0.6, filter: { type: 'lowpass', freq: 1600 } });
        }
      }
    }
    if (i === 0 || i === 8) s.tone(t, { freq: mtof(a - 24), dur: d * 8, gain: 0.28, attack: 0.02, release: d * 4 });
    if (i === 0) kick(s, t, 100, 0.5, 0.45);
    if (i === 10) kick(s, t, 90, 0.3, 0.35);
    if (i % 4 === 2) s.noise(t, { dur: 0.05, gain: 0.02, filter: { type: 'bandpass', freq: 6000, q: 1 } });
    if (n >= 32 && i % 2 === 0) {
      s.tone(t, { type: 'triangle', freq: mtof([a, b, c, b][(i / 2) % 4] + 24), dur: d * 3, gain: 0.035, wet: 0.6 });
    }
    const note = n >= 64 ? VIOLET_MELODY.get((n - 64) % 128) : undefined;
    if (note) {
      const [midi, len] = note;
      s.tone(t, { freq: mtof(midi), dur: len * d + 0.4, gain: 0.12, attack: 0.02, wet: 0.5 });
      s.tone(t, { freq: mtof(midi + 12), dur: len * d * 0.5, gain: 0.03, wet: 0.5 });
    }
  },
};

/** Track output level; voices are written quiet so stacked chords don't clip. */
const LEVEL = 2;

const TRACKS: Partial<Record<TrackId, TrackDef>> = { title, gold, goldIntense, warden, drone, violet };

interface Playing {
  def: TrackDef;
  gain: GainNode;
  wet: GainNode;
  synth: Synth;
  n: number;
  next: number;
  endAt: number;
  stopSustain?: () => void;
}

/** Look-ahead step sequencer with crossfades between tracks. */
export class Music {
  private desired: TrackId = 'silence';
  private currentId: TrackId | null = null;
  private playing: Playing[] = [];

  constructor() {
    audio.onReady(() => {
      this.start(this.desired, 1.5);
      setInterval(() => this.tick(), 50);
    });
  }

  get current(): TrackId {
    return this.desired;
  }

  play(id: TrackId, fadeSec = 2.5): void {
    this.desired = id;
    if (audio.ctx && id !== this.currentId) this.start(id, fadeSec);
  }

  private start(id: TrackId, fade: number) {
    const ctx = audio.ctx!;
    const t = ctx.currentTime;
    for (const p of this.playing) {
      if (p.endAt !== Infinity) continue;
      p.endAt = t + fade;
      for (const g of [p.gain, p.wet]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fade);
      }
    }
    this.currentId = id;
    const def = TRACKS[id];
    if (!def) return;

    const gain = ctx.createGain();
    const wet = ctx.createGain();
    for (const g of [gain, wet]) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(LEVEL, t + fade);
    }
    gain.connect(audio.musicIn);
    wet.connect(audio.musicWet);
    const synth = new Synth(ctx, { dry: gain, wet }, audio.noise);
    this.playing.push({ def, gain, wet, synth, n: 0, next: t + 0.05, endAt: Infinity, stopSustain: def.sustain?.(synth, t) });
  }

  private tick() {
    const ctx = audio.ctx!;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const p of this.playing) {
      const dur = 60 / p.def.bpm / 4;
      // After a stall (tab was suspended) skip ahead instead of firing a burst of old notes.
      if (p.next < now - 0.25) p.next = now + 0.05;
      while (p.next < now + 0.2 && p.next < p.endAt) {
        p.def.step(p.synth, p.next, p.n, dur);
        p.n++;
        p.next += dur;
      }
    }
    this.playing = this.playing.filter((p) => {
      if (now < p.endAt + 0.1) return true;
      p.stopSustain?.();
      p.gain.disconnect();
      p.wet.disconnect();
      return false;
    });
  }
}
