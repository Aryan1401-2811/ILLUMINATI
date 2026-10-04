import { audio } from '@/audio/AudioManager';

/** Typewriter voice beeps, played on the sfx bus so they follow the volume settings. */
export interface BlipVoice {
  freq: number;
  type: OscillatorType;
  volume: number;
}

export function blip({ freq, type, volume }: BlipVoice): void {
  const s = audio.sfx;
  if (!s || !audio.running) return;
  // A little random detune so a sentence sounds like speech rather than a metronome.
  s.tone(s.ctx.currentTime, { type, freq: freq * (0.92 + Math.random() * 0.16), dur: 0.06, gain: volume * 0.5 });
}
