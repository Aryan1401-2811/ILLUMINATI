/** Tiny procedural synth: every sound and note in the game is built from these two calls. */

export interface Out {
  dry: AudioNode;
  /** Reverb send. */
  wet: AudioNode;
}

export interface Env {
  dur: number;
  gain: number;
  attack?: number;
  /** Fade-out length at the end; defaults to the whole note after the attack (a pluck). */
  release?: number;
  /** Reverb send amount 0..1. */
  wet?: number;
}

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  /** Sweep the cutoff to this over the note. */
  to?: number;
  q?: number;
}

export interface ToneSpec extends Env {
  freq: number;
  /** Pitch glide target. */
  to?: number;
  glide?: number;
  type?: OscillatorType;
  detune?: number;
  filter?: FilterSpec;
}

export interface NoiseSpec extends Env {
  filter?: FilterSpec;
}

export const mtof = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Synth {
  constructor(
    readonly ctx: AudioContext,
    readonly out: Out,
    private noiseBuf: AudioBuffer,
  ) {}

  tone(t: number, s: ToneSpec): void {
    const osc = this.ctx.createOscillator();
    osc.type = s.type ?? 'sine';
    osc.frequency.setValueAtTime(s.freq, t);
    if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, t + (s.glide ?? s.dur));
    if (s.detune) osc.detune.value = s.detune;
    this.route(osc, t, s);
    osc.start(t);
    osc.stop(t + s.dur + 0.05);
  }

  noise(t: number, s: NoiseSpec): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    this.route(src, t, s);
    src.start(t, Math.random() * this.noiseBuf.duration);
    src.stop(t + s.dur + 0.05);
  }

  private route(src: AudioNode, t: number, s: Env & { filter?: FilterSpec }) {
    let node = src;
    if (s.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = s.filter.type;
      f.Q.value = s.filter.q ?? 0.7;
      f.frequency.setValueAtTime(s.filter.freq, t);
      if (s.filter.to) f.frequency.exponentialRampToValueAtTime(s.filter.to, t + s.dur);
      node = node.connect(f);
    }
    node.connect(this.envelope(t, s));
  }

  private envelope(t: number, e: Env): GainNode {
    const g = this.ctx.createGain();
    const peak = Math.max(0.0001, e.gain);
    const attack = Math.max(0.002, e.attack ?? 0.005);
    const end = t + Math.max(attack + 0.01, e.dur);
    const releaseAt = end - (e.release ?? e.dur - attack);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (releaseAt > t + attack) g.gain.setValueAtTime(peak, releaseAt);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(this.out.dry);
    if (e.wet) {
      const send = this.ctx.createGain();
      send.gain.value = e.wet;
      g.connect(send).connect(this.out.wet);
    }
    return g;
  }
}

export function makeNoise(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Synthetic room: stereo noise with an exponential tail. */
export function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}
