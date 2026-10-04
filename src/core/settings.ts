import { events } from './events';

/**
 * Player settings, saved in localStorage. The Settings menu (ui/) writes them; audio and the
 * camera read them. Every change emits 'settings:changed' with the full set.
 */
export interface Settings {
  master: number;
  music: number;
  sfx: number;
  screenShake: boolean;
}

const KEY = 'falseDawn.settings';
const DEFAULTS: Settings = { master: 0.8, music: 0.7, sfx: 0.9, screenShake: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // private window / blocked storage: just use the defaults
  }
  return { ...DEFAULTS };
}

export const settings: Settings = load();

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // not persisted this session; the change still applies
  }
  events.emit('settings:changed', { ...settings });
}
