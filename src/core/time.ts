import { events } from './events';

/**
 * Game time. `dt` is scaled (slow-mo, hit-stop, pause); `realDt` is not.
 * Gameplay code uses the dt passed to update(). UI/camera polish may use realDt.
 */
class Time {
  /** Seconds since start, scaled. */
  elapsed = 0;
  /** Seconds since start, unscaled. */
  realElapsed = 0;
  /** Global time scale (1 = normal). Use slowMo() rather than setting this directly. */
  scale = 1;
  paused = false;

  private hitstopLeft = 0;
  private slowMoLeft = 0;
  private slowMoScale = 1;

  constructor() {
    events.on('fx:hitstop', ({ durationSec }) => this.hitstop(durationSec));
    events.on('game:pause', ({ paused }) => (this.paused = paused));
  }

  /** Freeze gameplay for `sec` real seconds (impact feel). */
  hitstop(sec: number) {
    this.hitstopLeft = Math.max(this.hitstopLeft, sec);
  }

  /** Run gameplay at `scale` for `sec` real seconds. */
  slowMo(scale: number, sec: number) {
    this.slowMoScale = scale;
    this.slowMoLeft = sec;
  }

  /** Called once per frame by Game. Returns scaled dt. */
  tick(realDt: number): number {
    this.realElapsed += realDt;
    if (this.paused) return 0;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= realDt;
      return 0;
    }
    let s = this.scale;
    if (this.slowMoLeft > 0) {
      this.slowMoLeft -= realDt;
      s *= this.slowMoScale;
    }
    const dt = realDt * s;
    this.elapsed += dt;
    return dt;
  }
}

export const time = new Time();
