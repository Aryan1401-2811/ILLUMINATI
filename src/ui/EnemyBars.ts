import * as THREE from 'three';
import { getGame } from '@/core/Game';
import { Enemy } from '@/enemies/Enemy';
import type { Armour } from '@/enemies/armour/Armour';

const BARS = {
  /** Metres above the enemy's height. */
  lift: 0.35,
  /** A bar shows once the enemy has been hurt (or has armour), and fades after this long untouched. */
  showSec: 4,
  /** Never show bars for enemies this far from the camera focus (keeps the screen clean). */
  maxDist: 22,
};

const _v = new THREE.Vector3();

interface Bar {
  el: HTMLElement;
  fill: HTMLElement;
  shell: HTMLElement;
  lastHp: number;
  lastShell: number;
  visibleFor: number;
}

/**
 * Small comic health bars floating over every enemy. Armoured enemies also show their shell
 * (lavender) above the health bar, and a hot core marker while it is exposed. Pure overlay:
 * reads the enemies each frame, no events needed.
 */
export class EnemyBars {
  private layer: HTMLElement;
  private bars = new Map<Enemy, Bar>();

  constructor(root: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'enemy-bars';
    root.appendChild(this.layer);
    getGame().onFrame((_dt, realDt) => this.update(realDt));
  }

  private make(): Bar {
    const el = document.createElement('div');
    el.className = 'enemy-bar';
    el.innerHTML = '<div class="shell"></div><div class="hpbox"><div class="fill"></div></div>';
    this.layer.appendChild(el);
    return { el, fill: el.querySelector('.fill')!, shell: el.querySelector('.shell')!, lastHp: 1, lastShell: 1, visibleFor: 0 };
  }

  private update(realDt: number) {
    const game = getGame();
    const scene = game.current;
    const enemies = scene ? scene.getAll(Enemy) : [];
    const live = new Set(enemies);

    for (const [enemy, bar] of this.bars) {
      if (!live.has(enemy) || !enemy.alive) {
        bar.el.remove();
        this.bars.delete(enemy);
      }
    }
    if (!scene) return;

    const w = this.layer.clientWidth;
    const h = this.layer.clientHeight;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      let bar = this.bars.get(enemy);
      if (!bar) this.bars.set(enemy, (bar = this.make()));

      const hpK = enemy.hp / enemy.maxHp;
      const armour = (enemy as unknown as { armour?: Armour }).armour;
      const shellK = armour ? armour.shellFraction : 0;
      if (hpK < bar.lastHp || shellK < bar.lastShell) bar.visibleFor = BARS.showSec;
      bar.lastHp = hpK;
      bar.lastShell = shellK;
      if (armour) bar.visibleFor = Math.max(bar.visibleFor, 0.1); // armoured foes always show their shell
      bar.visibleFor -= realDt;

      _v.copy(enemy.position);
      _v.y += enemy.height * enemy.object.scale.y + BARS.lift;
      const far = _v.distanceTo(scene.cameraRig.focus) > BARS.maxDist;
      _v.project(game.camera);
      const onScreen = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      const show = bar.visibleFor > 0 && onScreen && !far;
      bar.el.style.display = show ? '' : 'none';
      if (!show) continue;

      bar.el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) translate(-50%, -100%)`;
      bar.fill.style.width = `${hpK * 100}%`;
      bar.el.classList.toggle('armoured', !!armour && armour.state !== 'broken');
      bar.el.classList.toggle('exposed', armour?.state === 'exposed');
      bar.shell.style.width = `${shellK * 100}%`;
      bar.el.classList.toggle('big', enemy.maxHp >= 80);
    }
  }
}
