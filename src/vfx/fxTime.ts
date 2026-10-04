import { time } from '@/core/time';

/**
 * Effects should keep animating during hit-stop (dt === 0) — a frozen spark kills the impact —
 * but must really stop when the game is paused. Use this instead of the raw dt in effects.
 */
export function fxDt(dt: number): number {
  if (dt > 0) return dt;
  return time.paused ? 0 : 1 / 60;
}
