import { makeImpulse, makeNoise, Synth } from './synth';

export type Bus = 'master' | 'music' | 'sfx';

const STORAGE_KEY = 'falseDawn.volume';
const DEFAULTS: Record<Bus, number> = { master: 0.8, music: 0.6, sfx: 0.9 };
const PAUSE_DUCK = 0.3;

function loadVolumes(): Partial<Record<Bus, number>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
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
  private volumes: Record<Bus, number> = { ...DEFAULTS, ...loadVolumes() };
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

  getVolume(bus: Bus): number {
    return this.volumes[bus];
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = Math.min(1, Math.max(0, value));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
    } catch {
      /* storage blocked: volume still applies for this session */
    }
    this.apply();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.apply();
    return this.muted;
  }

  setDucked(ducked: boolean): void {
    if (this.ctx) this.duck.gain.setTargetAtTime(ducked ? PAUSE_DUCK : 1, this.ctx.currentTime, 0.15);
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

    this.duck = ctx.createGain();
    this.duck.connect(music);
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
