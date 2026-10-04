import type * as THREE from 'three';
import type { Hit, HitResult, Team } from '@/combat/types';
import type { PaletteMode } from '@/render/palette';

/**
 * Every message that crosses a module boundary goes through this bus.
 * Modules never import each other's internals; they emit and listen here.
 *
 * Adding an event: add it to GameEvents under your section with a one-line comment.
 * Never rename or remove an event someone else listens to without telling them.
 */
export interface GameEvents {
  // ── Player (owner: Foundation) ───────────────────────────────
  /** Player health changed. */
  'player:health': { hp: number; max: number };
  /** Player energy changed. */
  'player:energy': { energy: number; max: number };
  /** Player was damaged. */
  'player:hurt': { amount: number; position: THREE.Vector3 };
  /** Player died. */
  'player:died': { position: THREE.Vector3 };
  /** Player used an ability (ids from the ability registry). */
  'player:ability': { id: string; position: THREE.Vector3 };
  /** Player swung a melee attack (comboStep 0..2). */
  'player:attack': { comboStep: number; heavy: boolean; position: THREE.Vector3 };
  /** Player dodged. */
  'player:dodge': { position: THREE.Vector3 };
  /** Guard raised/lowered or worn down. stability 0..1 (0 = guard broken). */
  'player:guard': { active: boolean; stability: number };
  /** A hit was blocked by the guard. perfect = raised just in time; broken = this hit broke it. */
  'player:block': { position: THREE.Vector3; perfect: boolean; broken: boolean };
  /** Player spent Light to heal. */
  'player:heal': { amount: number; position: THREE.Vector3 };
  /** Player's ability loadout changed (e.g. at the twist). */
  'player:loadout': { abilityIds: (string | null)[] };

  // ── Combat (owner: Foundation) ───────────────────────────────
  /** Any hit landed on anything. VFX/SFX/narrator listen to this. */
  'combat:hit': { hit: Hit; result: HitResult; position: THREE.Vector3; targetTeam: Team };

  // ── Enemies & armour (owner: Enemies) ─────────────────────────
  /** An enemy died. `wisp` = whether it releases a violet wisp toward the narrator. */
  'enemy:killed': { enemyType: string; position: THREE.Vector3; wisp: boolean };
  /** An armour shell was cracked open (core is now exposed). */
  'armour:shellBroken': { position: THREE.Vector3; ownerId: string };
  /** An exposed core was destroyed. */
  'armour:coreBroken': { position: THREE.Vector3; ownerId: string };
  /** A wave / encounter in a zone was cleared. */
  'encounter:cleared': { encounterId: string };

  // ── Bosses & story (owner: Bosses) ────────────────────────────
  /** Boss health for the HUD boss bar. */
  'boss:health': { bossId: string; name: string; hp: number; max: number; phase: number };
  /** Boss defeated. */
  'boss:defeated': { bossId: string };
  /** A story beat happened. Narrative/audio/render react to these ids. */
  'story:beat': { id: StoryBeat };

  // ── Narrative & UI (owner: Narrative) ─────────────────────────
  /** Show a narrator caption. */
  'narrator:say': { text: string; speaker?: 'narrator' | 'warden' | 'hero'; durationSec?: number };
  /** Narrator caption box size, 0 (tiny) .. 1 (fills screen corner). */
  'narrator:growth': { value: number };
  /** New game: restore the unbroken caption box (growth is re-read from runState). */
  'narrator:reset': Record<string, never>;
  /** Settings changed (volume 0..1, screen shake on/off). Saved in localStorage by core/settings. */
  'settings:changed': { master: number; music: number; sfx: number; screenShake: boolean };
  /** Show a tutorial prompt like "Press SPACE to dodge". */
  'ui:prompt': { text: string; durationSec?: number };
  /** Settings menu changed something (also saved to localStorage['falseDawn.settings']). */
  'settings:changed': { master: number; music: number; sfx: number; screenShake: boolean };

  // ── Render & FX (owner: Visuals) ──────────────────────────────
  /** Switch world palette between gold (lie) and violet (truth). */
  'palette:set': { mode: PaletteMode; durationSec?: number };
  /** Camera shake. strength ~0.1 (light) .. 1 (huge). */
  'fx:shake': { strength: number; durationSec?: number };
  /** Freeze gameplay for a few frames to sell an impact. */
  'fx:hitstop': { durationSec: number };
  /** Comic sound-effect word popping up in the world, e.g. THWACK! */
  'fx:onomatopoeia': { text: string; position: THREE.Vector3; color?: string; scale?: number };
  /** A violet wisp finished drifting into the Narrator's caption box (top-right). UI may pulse the box. */
  'fx:wispAbsorbed': { position: THREE.Vector3 };

  // ── Game flow (owner: Narrative) ──────────────────────────────
  'game:pause': { paused: boolean };
  'scene:loaded': { sceneId: string };
}

/** Ordered story beats for the whole run. Bosses/Narrative emit; everyone may listen. */
export type StoryBeat =
  | 'zone1:start'
  | 'zone1:end'
  | 'zone2:start'
  | 'zone2:energyGranted'
  | 'zone2:end'
  | 'zone3:start'
  | 'zone3:end'
  | 'warden:start'
  | 'warden:defeated'
  | 'twist:start'
  | 'twist:narratorFreed'
  | 'twist:powersStripped'
  | 'twist:collapse'
  | 'twist:trueLightGranted'
  | 'final:start'
  | 'final:phase2'
  | 'final:defeated'
  | 'ending:start'
  | 'ending:done';

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  /** Listen to an event. Returns an unsubscribe function — call it in your dispose(). */
  on<K extends keyof GameEvents>(type: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => set!.delete(handler);
  }

  once<K extends keyof GameEvents>(type: K, handler: Handler<GameEvents[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of [...set]) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[events] handler for "${type}" threw`, err);
      }
    }
  }
}

/** The one global event bus. */
export const events = new EventBus();
