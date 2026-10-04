import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { Player } from '@/player/Player';

/**
 * Placeholder HUD (health, energy, ability slots, prompts) so the game is testable from
 * day one. Narrator captions live in narrative/CaptionBox. The Narrative/UI owner replaces
 * this with the real comic UI — it is driven entirely by events, so swapping it out touches
 * nothing else.
 */
export class Hud {
  readonly el: HTMLElement;
  private hpFill: HTMLElement;
  private energyFill: HTMLElement;
  private slots: HTMLElement[] = [];
  private prompt: HTMLElement;
  private promptTimer = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-bars">
        <div class="hud-bar hp"><div class="fill"></div><span>HP</span></div>
        <div class="hud-bar energy"><div class="fill"></div><span>ENERGY</span></div>
      </div>
      <div class="hud-slots">
        ${['Q / RMB', 'E', 'R'].map((k) => `<div class="hud-slot empty"><div class="glyph"></div><div class="cd"></div><div class="key">${k}</div></div>`).join('')}
      </div>
      <div class="hud-prompt hidden"></div>
    `;
    root.appendChild(this.el);
    this.hpFill = this.el.querySelector('.hp .fill')!;
    this.energyFill = this.el.querySelector('.energy .fill')!;
    this.slots = [...this.el.querySelectorAll<HTMLElement>('.hud-slot')];
    this.prompt = this.el.querySelector('.hud-prompt')!;

    events.on('player:health', ({ hp, max }) => (this.hpFill.style.width = `${(hp / max) * 100}%`));
    events.on('player:energy', ({ energy, max }) => (this.energyFill.style.width = `${(energy / max) * 100}%`));
    events.on('ui:prompt', ({ text, durationSec }) => {
      this.prompt.textContent = text;
      this.prompt.classList.remove('hidden');
      this.promptTimer = durationSec ?? 3;
    });

    getGame().onFrame((_dt, realDt) => this.update(realDt));
  }

  private update(realDt: number) {
    if (this.promptTimer > 0 && (this.promptTimer -= realDt) <= 0) this.prompt.classList.add('hidden');

    const player = getGame().current?.getFirst(Player);
    this.slots.forEach((slot, i) => {
      const a = player?.abilities[i];
      slot.classList.toggle('empty', !a);
      const glyph = slot.querySelector<HTMLElement>('.glyph')!;
      const cd = slot.querySelector<HTMLElement>('.cd')!;
      if (!a || !player) {
        glyph.textContent = '';
        cd.style.height = '0%';
        return;
      }
      glyph.textContent = a.glyph;
      slot.style.setProperty('--slot-color', a.color);
      slot.title = `${a.name} (${a.cost} energy) — ${a.description}`;
      cd.style.height = `${a.cooldown > 0 ? (a.cooldownLeft / a.cooldown) * 100 : 0}%`;
      slot.classList.toggle('unaffordable', player.energy < a.cost);
    });
  }
}
