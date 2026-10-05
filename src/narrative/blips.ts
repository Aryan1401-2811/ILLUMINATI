import { audio } from '@/audio/AudioManager';
import { isVoiceSpeaking } from '@/audio/voice';

/** Blips sit far under a spoken line so they don't fight the voice. */
const UNDER_VOICE = 0.2;

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
  s.tone(s.ctx.currentTime, { type, freq: freq * (0.92 + Math.random() * 0.16), dur: 0.06, gain: volume * 0.5 * (isVoiceSpeaking() ? UNDER_VOICE : 1) });
}
