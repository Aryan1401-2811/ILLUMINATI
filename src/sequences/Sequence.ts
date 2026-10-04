import * as THREE from 'three';
import { events, type StoryBeat } from '@/core/events';
import { input } from '@/core/input';
import type { PaletteMode } from '@/render/palette';
import type { GameScene } from '@/core/GameScene';
import { Player } from '@/player/Player';
import { time } from '@/core/time';

/**
 * Cutscene scripting tool. Provides an async/await API so scripted sequences
 * read like a screenplay. Every scene that plays a cutscene uses this.
 *
 * Usage:
 *   const seq = new Sequence(scene);
 *   await seq.lockPlayer();
 *   await seq.say('Hello, hero!', 2.5);
 *   await seq.camera(0, 10, 14, 1.2);
 *   seq.shake(0.5);
 *   seq.beat('warden:start');
 *   await seq.walkPlayer(new THREE.Vector3(0, 0, -3));
 *   await seq.until(() => someCondition);
 *   seq.unlockPlayer();
 *   await seq.resetCamera(1);
 *
 * Skip: the player can press Enter (input action 'skip') to fast-forward
 * through skippable waits. Mark sections as non-skippable with setSkippable(false).
 */
export class Sequence {
  private scene: GameScene;
  private player: Player | null = null;
  private _skippable = true;
  private _aborted = false;

  /** Frame-level polling hook. Unsubscribed when the sequence is done. */
  private frameUnsub: (() => void) | null = null;
  private skipRequested = false;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.player = scene.getFirst(Player) ?? null;

    // Poll skip input every frame
    this.frameUnsub = scene.game.onFrame(() => {
      if (this._skippable && input.pressedRaw('skip')) {
        this.skipRequested = true;
      }
    });
  }

  // ── Configuration ────────────────────────────────────────────────

  /** Toggle whether upcoming waits can be skipped with Enter. */
  setSkippable(value: boolean): void {
    this._skippable = value;
  }

  /** Stop the sequence early. Pending awaits resolve immediately. */
  abort(): void {
    this._aborted = true;
    this.skipRequested = true;
  }

  /** Clean up frame hooks. Call when the sequence is fully done. */
  dispose(): void {
    this.frameUnsub?.();
    this.frameUnsub = null;
  }

  // ── Player control ───────────────────────────────────────────────

  /** Lock the player (no input, invulnerable, idle pose). */
  async lockPlayer(): Promise<void> {
    this.player ??= this.scene.getFirst(Player) ?? null;
    this.player?.setLocked(true);
    input.enabled = false;
  }

  /** Unlock the player (returns control). */
  unlockPlayer(): void {
    this.player?.setLocked(false);
    input.enabled = true;
  }

  /** Scripted walk: the player walks to `target` and the promise resolves on arrival. */
  async walkPlayer(target: THREE.Vector3): Promise<void> {
    this.player ??= this.scene.getFirst(Player) ?? null;
    if (!this.player) return;
    await this.player.walkTo(target);
  }

  // ── Narrator / dialogue ──────────────────────────────────────────

  /**
   * Show a narrator caption and wait for `durationSec`.
   * If the player presses Enter (skip) and skipping is enabled, resolves early.
   */
  async say(text: string, durationSec = 2.5, speaker?: 'narrator' | 'warden' | 'hero'): Promise<void> {
    events.emit('narrator:say', { text, speaker, durationSec });
    await this.wait(durationSec);
  }

  // ── Timing ───────────────────────────────────────────────────────

  /**
   * Wait for `seconds` of unscaled game time (cutscene timing ignores slow-mo and hit-stop,
   * but stops while the game is paused). Respects skip if enabled.
   * Driven by game frames — not requestAnimationFrame or the wall clock — so it pauses with
   * the game, never runs ahead of it, and works under game.advance() in scripted tests.
   */
  async wait(seconds: number): Promise<void> {
    if (this._aborted) return;
    this.skipRequested = false;
    let left = seconds;
    return this.onFrames((realDt) => {
      if (this.skipRequested) {
        this.skipRequested = false;
        return true;
      }
      if (!time.paused) left -= realDt;
      return left <= 0;
    });
  }

  /**
   * Wait until a predicate returns true (checked every game frame).
   * Also resolves if the sequence is aborted.
   */
  async until(predicate: () => boolean): Promise<void> {
    if (this._aborted) return;
    return this.onFrames(() => predicate());
  }

  /** Resolve once `done` returns true on a game frame. Aborts if our scene is unloaded. */
  private onFrames(done: (realDt: number) => boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      const off = this.scene.game.onFrame((_dt, realDt) => {
        if (this.scene.game.current !== this.scene) this._aborted = true;
        if (this._aborted || done(realDt)) {
          off();
          resolve();
        }
      });
    });
  }

  // ── Camera ───────────────────────────────────────────────────────

  /**
   * Smoothly move the camera to a new offset and wait for the transition.
   * Coordinates are relative to the focus point (player).
   */
  async camera(x: number, y: number, z: number, durationSec = 0.8): Promise<void> {
    this.scene.cameraRig.setOffset(x, y, z, durationSec);
    await this.wait(durationSec);
  }

  /** Reset camera to the default follow position. */
  async resetCamera(durationSec = 0.8): Promise<void> {
    this.scene.cameraRig.resetOffset(durationSec);
    await this.wait(durationSec);
  }

  // ── Feel (non-blocking) ──────────────────────────────────────────

  /** Camera shake. Non-blocking. */
  shake(strength: number): void {
    events.emit('fx:shake', { strength });
  }

  /** Hit-stop freeze. Non-blocking. */
  hitstop(durationSec: number): void {
    events.emit('fx:hitstop', { durationSec });
  }

  /** Slow-mo for dramatic moments. Non-blocking. */
  slowMo(scale: number, durationSec: number): void {
    time.slowMo(scale, durationSec);
  }

  /** Comic onomatopoeia text pop. Non-blocking. */
  onomatopoeia(text: string, position: THREE.Vector3, color?: string, scale?: number): void {
    events.emit('fx:onomatopoeia', { text, position, color, scale });
  }

  // ── Story ────────────────────────────────────────────────────────

  /** Emit a story beat. Non-blocking. Other systems (UI, audio, visuals) react. */
  beat(id: StoryBeat): void {
    events.emit('story:beat', { id });
  }

  /** Switch the world palette (gold ↔ violet). Non-blocking. */
  palette(mode: PaletteMode, durationSec = 1.5): void {
    events.emit('palette:set', { mode, durationSec });
  }

  // ── UI prompts ───────────────────────────────────────────────────

  /** Show a tutorial / interaction prompt. Non-blocking. */
  prompt(text: string, durationSec?: number): void {
    events.emit('ui:prompt', { text, durationSec });
  }
}
