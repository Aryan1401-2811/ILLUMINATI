import { makeImpulse, makeNoise, Synth } from './synth';

export type Bus = 'master' | 'music' | 'sfx';

/** Written by the Settings menu (src/ui); audio only reads it. */
const SETTINGS_KEY = 'falseDawn.settings';
const DEFAULTS: Record<Bus, number> = { master: 0.8, music: 0.7, sfx: 0.9 };
const PAUSE_DUCK = 0.3;
const VOICE_DUCK = 0.4;

function loadVolumes(): Record<Bus, number> {
  const out = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    for (const bus of Object.keys(DEFAULTS) as Bus[]) {
      if (typeof saved?.[bus] === 'number') out[bus] = saved[bus];
    }
  } catch {
    /* missing or corrupt settings: defaults */
  }
  return out;
}

/**
 * Owns the WebAudio graph: master → limiter, with music and sfx buses under it.
 * Browsers only allow audio after a user gesture, so nothing is built until the first click or key.
 */
class AudioManager {
  ctx: AudioContext | null = null;
  /** Sound effects synth (sfx bus + its reverb). Null until unlocked. */
  sfx: Synth | null = null;
  musicIn!: GainNode;
  musicWet!: AudioNode;
  noise!: AudioBuffer;

  private gains = {} as Record<Bus, GainNode>;
  private duck!: GainNode;
  private voiceDuck!: GainNode;
  private volumes = loadVolumes();
  private muted = false;
  private readyFns: ((ctx: AudioContext) => void)[] = [];

  constructor() {
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
    // Background tabs throttle timers, which would stutter the music scheduler; just stop instead.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  onReady(fn: (ctx: AudioContext) => void): void {
    if (this.ctx) fn(this.ctx);
    else this.readyFns.push(fn);
  }

  setVolumes(v: Record<Bus, number>): void {
    for (const bus of Object.keys(DEFAULTS) as Bus[]) this.volumes[bus] = Math.min(1, Math.max(0, v[bus]));
    this.apply();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.apply();
    return this.muted;
  }

  setDucked(ducked: boolean): void {
    if (this.ctx) this.duck.gain.setTargetAtTime(ducked ? PAUSE_DUCK : 1, this.ctx.currentTime, 0.15);
  }

  /** Music dips under spoken lines (separate from the pause duck, so the two stack). */
  setVoiceDucked(ducked: boolean): void {
    if (this.ctx) this.voiceDuck.gain.setTargetAtTime(ducked ? VOICE_DUCK : 1, this.ctx.currentTime, ducked ? 0.08 : 0.4);
  }

  private unlock = () => {
    if (!this.ctx) this.build();
    if (this.ctx!.state === 'suspended' && !document.hidden) void this.ctx!.resume();
  };

  private build() {
    const ctx = (this.ctx = new AudioContext());
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    master.connect(limiter);
    music.connect(master);
    sfx.connect(master);
    this.gains = { master, music, sfx };

    this.voiceDuck = ctx.createGain();
    this.voiceDuck.connect(music);
    this.duck = ctx.createGain();
    this.duck.connect(this.voiceDuck);
    this.noise = makeNoise(ctx);
    const impulse = makeImpulse(ctx, 2.6);
    const reverb = (into: AudioNode) => {
      const c = ctx.createConvolver();
      c.buffer = impulse;
      c.connect(into);
      return c;
    };
    this.musicIn = this.duck;
    this.musicWet = reverb(this.duck);
    this.sfx = new Synth(ctx, { dry: sfx, wet: reverb(sfx) }, this.noise);

    this.apply();
    for (const fn of this.readyFns) fn(ctx);
    this.readyFns = [];
  }

  private apply() {
    if (!this.ctx) return;
    for (const bus of Object.keys(this.gains) as Bus[]) {
      const v = bus === 'master' && this.muted ? 0 : this.volumes[bus];
      // Squared so the slider feels linear to the ear.
      this.gains[bus].gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.05);
    }
  }
}

export const audio = new AudioManager();
