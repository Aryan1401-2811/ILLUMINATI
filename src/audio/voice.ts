import { events } from '@/core/events';
import { runState } from '@/core/runState';
import { settings } from '@/core/settings';
import { audio } from './AudioManager';

/**
 * Characters speak their caption lines with the browser's Web Speech API (no audio files).
 * Speaks each line when the caption box starts typing it, so voice and text begin together.
 * No voices available (some Linux browsers): silently text-only.
 */

type Speaker = 'narrator' | 'warden' | 'hero';

interface Delivery {
  pitch: number;
  rate: number;
  /** Fastest this voice may go to fit a short line; calm voices barely hurry. */
  maxRate: number;
}

/** Speech speed at rate 1 (measured on the Windows voices), used to fit a line into its time on screen. */
const CHARS_PER_SEC = 9.5;
const HUNGRY_GROWTH = 0.75;
const GLITCH = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
const MALE = /\bmale\b|david|mark|george|guy|daniel|james|ryan|fred|alex|thomas|arthur|oliver|christopher|eric|roger/i;

const synth: SpeechSynthesis | undefined = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
const voices: Record<Speaker, SpeechSynthesisVoice | null> = { narrator: null, warden: null, hero: null };

let freed = false;
let speaking = false;
let lineId = 0;
/** Chrome drops callbacks for utterances that get garbage-collected mid-speech; keep them alive. */
let live: SpeechSynthesisUtterance[] = [];

export function isVoiceSpeaking(): boolean {
  return speaking;
}

function pickVoices() {
  const en = synth!.getVoices().filter((v) => /^en/i.test(v.lang));
  if (!en.length) return;
  // Local voices start instantly and pause reliably; network voices are a fallback.
  const rank = (v: SpeechSynthesisVoice, male: boolean, gb: boolean) =>
    (MALE.test(v.name) === male ? 4 : 0) + (v.localService ? 2 : 0) + (gb && /en-GB/i.test(v.lang) ? 1 : 0);
  const best = (male: boolean, gb: boolean, avoid: (SpeechSynthesisVoice | null)[]) =>
    [...en].sort((a, b) => rank(b, male, gb) - rank(a, male, gb)).find((v) => !avoid.includes(v)) ?? en[0];
  voices.narrator = best(true, true, []);
  voices.warden = best(true, false, [voices.narrator]);
  voices.hero = best(false, false, [voices.narrator, voices.warden]);
}

function delivery(speaker: Speaker): Delivery {
  if (speaker === 'warden') return { pitch: 0.7, rate: 0.85, maxRate: 0.95 };
  if (speaker === 'hero') return { pitch: 1, rate: 1, maxRate: 1.2 };
  if (freed) return { pitch: 0.6, rate: 0.9, maxRate: 1.2 };
  if (runState.narratorGrowth > HUNGRY_GROWTH) return { pitch: 1.15, rate: 1.15, maxRate: 1.6 };
  return { pitch: 1.05, rate: 1, maxRate: 1.45 };
}

const clean = (s: string) =>
  s
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[*_~`#<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Glitch markup becomes its own utterance for the wrong word, so it lands with a beat before the right one. */
function segments(text: string): { text: string; wrong: boolean }[] {
  const out: { text: string; wrong: boolean }[] = [];
  let pending = '';
  let last = 0;
  for (const m of text.matchAll(GLITCH)) {
    out.push({ text: pending + text.slice(last, m.index), wrong: false });
    out.push({ text: m[1], wrong: true });
    pending = m[2];
    last = m.index! + m[0].length;
  }
  out.push({ text: pending + text.slice(last), wrong: false });
  return out.map((s) => ({ ...s, text: clean(s.text) })).filter((s) => /[a-z0-9]/i.test(s.text));
}

function setSpeaking(on: boolean) {
  speaking = on;
  audio.setVoiceDucked(on);
}

export function cancelVoice(): void {
  if (!synth) return;
  lineId++;
  synth.cancel();
  live = [];
  setSpeaking(false);
}

function speak(text: string, speaker: Speaker, windowSec: number) {
  cancelVoice();
  const voice = voices[speaker];
  if (!synth || !voice || !settings.voice || audio.isMuted) return;
  const segs = segments(text);
  if (!segs.length) return;

  const d = delivery(speaker);
  const chars = segs.reduce((n, s) => n + s.text.length, 0);
  const rate = Math.min(d.maxRate, Math.max(d.rate, chars / CHARS_PER_SEC / windowSec));
  const volume = settings.master * settings.sfx;
  const id = lineId;

  segs.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s.text);
    u.voice = voice;
    u.lang = voice.lang;
    u.volume = volume;
    // The wrong word comes out lower and slower: his real voice slipping through.
    u.pitch = s.wrong ? d.pitch * 0.75 : d.pitch;
    u.rate = s.wrong ? rate * 0.85 : rate;
    if (i === 0) u.onstart = () => id === lineId && setSpeaking(true);
    if (i === segs.length - 1) u.onend = u.onerror = () => id === lineId && setSpeaking(false);
    live.push(u);
    synth.speak(u);
  });
}

export function installVoice(): void {
  if (!synth) return;
  pickVoices();
  synth.addEventListener('voiceschanged', pickVoices);

  events.on('narrator:lineStart', ({ text, speaker, durationSec }) => speak(text, speaker, Math.max(1, durationSec)));
  events.on('narrator:lineSkipped', cancelVoice);
  events.on('story:beat', ({ id }) => {
    if (id === 'twist:narratorFreed') freed = true;
  });
  events.on('narrator:reset', () => {
    freed = false;
    cancelVoice();
  });
  events.on('scene:loaded', ({ sceneId }) => {
    cancelVoice();
    // A retry at the final checkpoint never replays the twist, but he is still free.
    if (sceneId === 'final' || sceneId === 'ending') freed = true;
  });
  events.on('game:pause', ({ paused }) => (paused ? synth.pause() : synth.resume()));
  events.on('settings:changed', ({ voice }) => {
    if (!voice) cancelVoice();
  });
}
