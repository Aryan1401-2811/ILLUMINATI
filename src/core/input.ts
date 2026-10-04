import * as THREE from 'three';

/** Logical actions. Gameplay code asks about actions, never raw keys. */
export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'attack'
  | 'dodge'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'guard'
  | 'heal'
  | 'interact'
  | 'pause'
  | 'skip';

/** Key codes (KeyboardEvent.code) and mouse buttons ("Mouse0" = left, "Mouse2" = right). */
const BINDINGS: Record<Action, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Mouse0', 'KeyJ'],
  dodge: ['Space', 'ShiftLeft', 'ShiftRight'],
  ability1: ['KeyQ', 'KeyK'],
  ability2: ['KeyE', 'KeyL'],
  ability3: ['KeyR', 'KeyI'],
  guard: ['Mouse2', 'KeyC'],
  heal: ['KeyF', 'KeyH'],
  interact: ['KeyX'],
  pause: ['Escape', 'KeyP'],
  skip: ['Enter'],
};

class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private releasedThisFrame = new Set<string>();
  /** Mouse position in normalized device coords (-1..1). */
  readonly mouseNdc = new THREE.Vector2();
  /** Set false during cutscenes to ignore gameplay input. */
  enabled = true;

  attach(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.press(e.code);
    });
    window.addEventListener('keyup', (e) => this.release(e.code));
    target.addEventListener('mousedown', (e) => this.press(`Mouse${e.button}`));
    window.addEventListener('mouseup', (e) => this.release(`Mouse${e.button}`));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      const r = target.getBoundingClientRect();
      this.mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  private press(code: string) {
    if (!this.down.has(code)) this.pressedThisFrame.add(code);
    this.down.add(code);
  }

  private release(code: string) {
    this.down.delete(code);
    this.releasedThisFrame.add(code);
  }

  /** True while the action is held. */
  held(a: Action): boolean {
    return this.enabled && BINDINGS[a].some((c) => this.down.has(c));
  }

  /** True only on the frame the action was pressed. */
  pressed(a: Action): boolean {
    return this.enabled && BINDINGS[a].some((c) => this.pressedThisFrame.has(c));
  }

  /** Like pressed() but ignores `enabled` — for menus and skipping cutscenes. */
  pressedRaw(a: Action): boolean {
    return BINDINGS[a].some((c) => this.pressedThisFrame.has(c));
  }

  released(a: Action): boolean {
    return this.enabled && BINDINGS[a].some((c) => this.releasedThisFrame.has(c));
  }

  /** Movement in screen terms: x = right, y = up (forward). Length <= 1. */
  moveVector(out = new THREE.Vector2()): THREE.Vector2 {
    out.set(
      (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0),
      (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0),
    );
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  /** Called by Game at the end of every frame. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }
}

export const input = new Input();
