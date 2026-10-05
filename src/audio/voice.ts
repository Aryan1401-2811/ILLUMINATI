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
  // Neural voices (Edge "… Online (Natural)", Chrome "Google …") sound human; the old local
  // SAPI voices (David, Zira) sound robotic, so they are only the fallback.
  const quality = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 8 : /google/i.test(v.name) ? 5 : v.localService ? 1 : 2);
  const rank = (v: SpeechSynthesisVoice, male: boolean, gb: boolean) =>
    quality(v) + (MALE.test(v.name) === male ? 4 : 0) + (gb && /en-GB/i.test(v.lang) ? 1 : 0);
  const best = (male: boolean, gb: boolean, avoid: (SpeechSynthesisVoice | null)[]) =>
    [...en].sort((a, b) => rank(b, male, gb) - rank(a, male, gb)).find((v) => !avoid.includes(v)) ?? en[0];
  voices.narrator = best(true, true, []);
  voices.warden = best(true, false, [voices.narrator]);
  voices.hero = best(false, false, [voices.narrator, voices.warden]);
}

function delivery(speaker: Speaker): Delivery {
  // Rates stay near natural speech: hurrying a TTS voice is what makes it sound robotic
  if (speaker === 'warden') return { pitch: 0.8, rate: 0.85, maxRate: 0.92 };
  if (speaker === 'hero') return { pitch: 1, rate: 0.95, maxRate: 1.05 };
  if (freed) return { pitch: 0.75, rate: 0.88, maxRate: 0.98 };
  if (runState.narratorGrowth > HUNGRY_GROWTH) return { pitch: 1.08, rate: 1.05, maxRate: 1.15 };
  return { pitch: 1.0, rate: 0.95, maxRate: 1.08 };
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

/** Chrome swallows the first words of an utterance queued right after cancel(); wait this long. */
const AFTER_CANCEL_MS = 120;

function speak(text: string, speaker: Speaker, windowSec: number) {
  if (!synth) return;
  // Only cut something that is still talking (the caption box normally waits for it to finish)
  const busy = synth.speaking || synth.pending;
  cancelVoice();
  const voice = voices[speaker];
  if (!voice || !settings.voice || audio.isMuted) return;
  const segs = segments(text);
  if (!segs.length) return;
  // Counts as speaking from the moment it is queued, so the caption holds even before
  // a network (neural) voice actually starts
  setSpeaking(true);
  const id = lineId;
  if (busy) setTimeout(() => id === lineId && queue(segs, speaker, windowSec, id), AFTER_CANCEL_MS);
  else queue(segs, speaker, windowSec, id);
}

function queue(segs: { text: string; wrong: boolean }[], speaker: Speaker, windowSec: number, id: number) {
  const voice = voices[speaker]!;

  const d = delivery(speaker);
  const chars = segs.reduce((n, s) => n + s.text.length, 0);
  const rate = Math.min(d.maxRate, Math.max(d.rate, chars / CHARS_PER_SEC / windowSec));
  const volume = settings.master * settings.sfx;

  segs.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s.text);
    u.voice = voice;
    u.lang = voice.lang;
    u.volume = volume;
    // The wrong word comes out lower and slower: his real voice slipping through.
    u.pitch = s.wrong ? d.pitch * 0.75 : d.pitch;
    u.rate = s.wrong ? rate * 0.85 : rate;
    // A failed segment must not leave the caption box waiting forever
    if (i < segs.length - 1) u.onerror = () => id === lineId && setSpeaking(false);
    if (i === segs.length - 1) u.onend = u.onerror = () => id === lineId && setSpeaking(false);
    live.push(u);
    synth!.speak(u);
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
