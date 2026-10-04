/**
 * Tiny WebAudio beeps for typewriter text. Placeholder voice until the AudioManager lands;
 * browsers only allow audio after a user gesture, so the context is created on the first one.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

export interface BlipVoice {
  freq: number;
  type: OscillatorType;
  volume: number;
}

export function blip({ freq, type, volume }: BlipVoice): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  // A little random detune so a sentence sounds like speech rather than a metronome.
  osc.frequency.setValueAtTime(freq * (0.92 + Math.random() * 0.16), t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.07);
}
