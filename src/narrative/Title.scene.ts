import * as THREE from 'three';
import { GameScene, defineScene } from '@/core/GameScene';
import { events } from '@/core/events';
import { buildZone1 } from '@/world/zones';
import { SCRIPT } from './script';
import { newGame } from './flow';
import { creditsPanelHtml } from './credits';
import './guide'; // tutorial prompts + narrator reactions listen from the start

const CONTROLS = [
  ['WASD', 'Move'],
  ['Left mouse', '3-hit combo (3rd hit is a HEAVY finisher)'],
  ['Space', 'Dodge'],
  ['Right mouse (hold)', 'Guard: block hits from the front'],
  ['F', 'Heal: spend Light to restore health'],
  ['Q', 'Ability 1'],
  ['E', 'Ability 2'],
  ['R', 'Ability 3'],
  ['Esc', 'Pause'],
  ['Enter', 'Skip dialogue'],
];

/**
 * The title screen (scene id `game`, the default when there's no ?scene=). Sunny Side Street
 * drifts by behind a comic cover: the lie, looking its best.
 */
class TitleScene extends GameScene {
  private focus = new THREE.Object3D();
  private t = 0;

  async load() {
    events.emit('palette:set', { mode: 'gold', durationSec: 0 });
    buildZone1(this);
    this.three.add(this.focus);
    this.cameraRig.follow(this.focus);
    this.cameraRig.setOffset(0, 7, 13, 0);

    const el = document.createElement('div');
    el.className = 'comic-screen title-screen';
    el.innerHTML = `
      <div class="comic-logo">FALSE DAWN</div>
      <div class="comic-tagline">${SCRIPT.title.tagline}</div>
      <div class="comic-menu">
        <button class="comic-btn" data-act="play">PLAY</button>
        <button class="comic-btn" data-act="controls">CONTROLS</button>
        <button class="comic-btn" data-act="credits">CREDITS</button>
      </div>
      <div class="comic-panel hidden" data-panel></div>
      <div class="comic-hint">A comic-book brawler · Comic · Twist · Light</div>
    `;
    document.getElementById('ui-root')!.appendChild(el);
    this.listen(() => el.remove());

    const panel = el.querySelector<HTMLElement>('[data-panel]')!;
    const menu = el.querySelector<HTMLElement>('.comic-menu')!;
    const showPanel = (html: string) => {
      panel.innerHTML = `${html}<p style="text-align:center;margin-top:14px"><button class="comic-btn" data-act="back">BACK</button></p>`;
      panel.classList.remove('hidden');
      menu.classList.add('hidden');
    };
    el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'play') {
        el.querySelectorAll('button').forEach((b) => (b.disabled = true));
        void newGame();
      } else if (act === 'controls') {
        showPanel(`<h2>Controls</h2><table>${CONTROLS.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('')}</table>`);
      } else if (act === 'credits') {
        showPanel(creditsPanelHtml());
      } else if (act === 'back') {
        panel.classList.add('hidden');
        menu.classList.remove('hidden');
      }
    });
  }

  protected onUpdate(_dt: number, realDt: number) {
    // A slow drift down the street, like a camera panning across the cover
    this.t += realDt;
    this.focus.position.set(Math.sin(this.t * 0.08) * 9, 0, Math.cos(this.t * 0.11) * 1.5);
  }
}

export default defineScene({ id: 'game', title: 'Title', owner: 'Narrative', create: (g) => new TitleScene(g) });
