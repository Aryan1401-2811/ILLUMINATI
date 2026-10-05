import { events } from '@/core/events';
import { getGame } from '@/core/Game';
import { PLAYER } from '@/core/config';
import { Player } from '@/player/Player';
import { retry, skip, SKIPPABLE } from '@/narrative/flow';
import { EnemyBars } from './EnemyBars';
import { PauseMenu } from './PauseMenu';
import './hud.css';

const HUD = {
  /** The white "damage taken" bar waits this long, then drains to the real value. */
  lagDelaySec: 0.45,
  lagDrainPerSec: 0.6,
  lowHp: 0.3,
  denySec: 0.35,
  bossHideAfterSec: 1.6,
};

/** Keys that cast a slot, for the "not enough energy / on cooldown" shake. */
const SLOT_KEYS: Record<string, number> = { KeyQ: 0, KeyK: 0, KeyE: 1, KeyL: 1, KeyR: 2, KeyI: 2, KeyF: 3, KeyH: 3 };

/**
 * The comic HUD. Everything is driven by events plus a light per-frame read of the player
 * (cooldowns). Mounts the enemy health bars and the pause/settings menus too.
 */
export class Hud {
  readonly el: HTMLElement;
  private hpFill: HTMLElement;
  private hpLag: HTMLElement;
  private hpText: HTMLElement;
  private energyFill: HTMLElement;
  private guardRow: HTMLElement;
  private guardFill: HTMLElement;
  private slots: HTMLElement[];
  private prompt: HTMLElement;
  private boss: HTMLElement;
  private bossFill: HTMLElement;
  private bossLag: HTMLElement;
  private bossName: HTMLElement;
  private bossPhase: HTMLElement;
  private death: HTMLElement;

  private promptTimer = 0;
  private hp = 1;
  private lag = 1;
  private lagWait = 0;
  private bossHp = 1;
  private bossLagV = 1;
  private bossHideIn = -1;
  private deny = [0, 0, 0, 0];

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.dataset.theme = 'gold';
    this.el.innerHTML = `
      <div class="hud-vignette"></div>
      <div class="hud-stats">
        <div class="hud-meter hp"><div class="lag"></div><div class="fill"></div><span class="label">HP</span><span class="num"></span></div>
        <div class="hud-meter energy"><div class="fill"></div><div class="ticks"></div><span class="label">LIGHT</span></div>
        <div class="hud-meter guard"><div class="fill"></div><span class="label">GUARD</span></div>
      </div>
      <div class="hud-boss hidden">
        <div class="hud-boss-name"></div>
        <div class="hud-meter boss"><div class="lag"></div><div class="fill"></div></div>
        <div class="hud-boss-phase"></div>
      </div>
      <div class="hud-slots">
        ${['Q', 'E', 'R'].map((k) => this.slotHtml(k)).join('')}
        <div class="hud-slot heal" title="Heal: spend ${PLAYER.heal.cost} Light to mend ${PLAYER.heal.amount} HP">
          <div class="glyph">✚</div><div class="cd"></div><div class="key">F</div><div class="cost">${PLAYER.heal.cost}</div>
        </div>
        <div class="hud-slot guard-slot" title="Guard: hold right mouse to block hits from the front">
          <div class="glyph">◈</div><div class="key">RMB</div>
        </div>
      </div>
      <div class="hud-prompt hidden"></div>
      <div class="hud-death hidden">
        <div class="hud-death-panel">TO BE CONTINUED…<span>?</span></div>
        <div class="hud-death-actions">
          <button class="comic-btn" data-death="retry">RETRY <small>ENTER</small></button>
          <button class="comic-btn" data-death="skip">SKIP FIGHT <small>K</small></button>
          <p>Skip is for testers &amp; judges</p>
        </div>
      </div>
    `;
    root.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    this.hpFill = q('.hp .fill');
    this.hpLag = q('.hp .lag');
    this.hpText = q('.hp .num');
    this.energyFill = q('.energy .fill');
    this.guardRow = q('.hud-meter.guard');
    this.guardFill = q('.guard .fill');
    this.slots = [...this.el.querySelectorAll<HTMLElement>('.hud-slot')];
    this.prompt = q('.hud-prompt');
    this.boss = q('.hud-boss');
    this.bossFill = q('.boss .fill');
    this.bossLag = q('.boss .lag');
    this.bossName = q('.hud-boss-name');
    this.bossPhase = q('.hud-boss-phase');
    this.death = q('.hud-death');

    events.on('player:health', ({ hp, max }) => {
      const v = Math.max(0, hp / max);
      if (v < this.hp) this.lagWait = HUD.lagDelaySec;
      else this.lag = Math.max(this.lag, v);
      if (v > 0) this.death.classList.add('hidden'); // revived
      this.hp = v;
      this.hpFill.style.width = `${v * 100}%`;
      this.hpText.textContent = `${Math.ceil(hp)}`;
      this.el.classList.toggle('low-hp', v > 0 && v < HUD.lowHp);
    });
    events.on('player:hurt', () => this.bump(this.el.querySelector('.hud-stats')!));
    events.on('player:energy', ({ energy, max }) => (this.energyFill.style.width = `${(energy / max) * 100}%`));
    events.on('player:guard', ({ active, stability }) => {
      this.guardFill.style.width = `${stability * 100}%`;
      this.guardRow.classList.toggle('show', active || stability < 1);
      this.guardRow.classList.toggle('broken', stability <= 0.2);
      this.slots[4].classList.toggle('active', active);
    });
    events.on('player:block', ({ broken }) => this.bump(this.slots[4], broken ? 'deny' : 'flash'));
    events.on('player:died', () => {
      // Only scenes that handle skip wait for a choice; the rest revive on their own
      this.death.classList.toggle('choice', SKIPPABLE.has(getGame().currentId));
      this.death.classList.remove('hidden');
    });
    const choose = (act: string | undefined) => {
      if (!act || this.death.classList.contains('hidden') || !this.death.classList.contains('choice')) return;
      this.death.classList.remove('choice');
      if (act === 'retry') void retry();
      else skip();
    };
    this.death.addEventListener('click', (e) => choose((e.target as HTMLElement).closest<HTMLElement>('[data-death]')?.dataset.death));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Enter') choose('retry');
      else if (e.code === 'KeyK') choose('skip');
    });
    events.on('ui:prompt', ({ text, durationSec }) => {
      this.prompt.textContent = text;
      this.prompt.classList.remove('hidden');
      this.bump(this.prompt);
      this.promptTimer = durationSec ?? 3;
    });

    events.on('boss:health', ({ name, hp, max, phase, shield }) => {
      this.boss.classList.remove('hidden');
      this.bossHideIn = -1;
      this.bossName.textContent = name;
      const shielded = !!shield && shield.left > 0;
      this.boss.classList.toggle('shielded', shielded);
      if (shielded) {
        const pips = Array.from({ length: shield!.total }, (_, i) => `<i class="${i < shield!.left ? 'on' : ''}"></i>`).join('');
        this.bossPhase.innerHTML = `<span class="shield-label">SOUL SHIELD</span><span class="shield-pips">${pips}</span><span class="shield-hint">strike the orbs to free them</span>`;
      } else {
        this.bossPhase.textContent = phase > 1 ? `PHASE ${phase}` : '';
      }
      this.bossHp = Math.max(0, hp / max);
      this.bossFill.style.width = `${this.bossHp * 100}%`;
    });
    events.on('boss:defeated', () => (this.bossHideIn = HUD.bossHideAfterSec));
    events.on('scene:loaded', () => {
      this.boss.classList.add('hidden');
      this.death.classList.add('hidden');
      this.prompt.classList.add('hidden');
    });
    events.on('palette:set', ({ mode }) => (this.el.dataset.theme = mode));

    // Shake a slot that can't be used right now
    window.addEventListener('keydown', (e) => {
      const i = SLOT_KEYS[e.code];
      if (i === undefined || e.repeat) return;
      const player = getGame().current?.getFirst(Player);
      if (!player || player.state === 'locked' || player.state === 'dead') return;
      const usable = i === 3 ? player.canHeal || player.hp >= player.maxHp : !!player.abilities[i]?.canCast(player);
      if (!usable && (i === 3 || player.abilities[i])) this.deny[i] = HUD.denySec;
    });

    new EnemyBars(root);
    new PauseMenu(root);
    getGame().onFrame((_dt, realDt) => this.update(realDt));
  }

  private slotHtml(key: string) {
    return `<div class="hud-slot empty"><div class="glyph"></div><div class="cd"></div><div class="key">${key}</div><div class="cost"></div></div>`;
  }

  /** Retrigger a one-shot CSS animation class. */
  private bump(el: HTMLElement, cls = 'bump') {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private update(realDt: number) {
    if (this.promptTimer > 0 && (this.promptTimer -= realDt) <= 0) this.prompt.classList.add('hidden');

    // Damage-taken lag bars
    if (this.lagWait > 0) this.lagWait -= realDt;
    else this.lag = Math.max(this.hp, this.lag - HUD.lagDrainPerSec * realDt);
    this.hpLag.style.width = `${this.lag * 100}%`;
    this.bossLagV = Math.max(this.bossHp, this.bossLagV - HUD.lagDrainPerSec * realDt * 0.6);
    if (this.bossLagV < this.bossHp) this.bossLagV = this.bossHp;
    this.bossLag.style.width = `${this.bossLagV * 100}%`;
    if (this.bossHideIn > 0 && (this.bossHideIn -= realDt) <= 0) this.boss.classList.add('hidden');

    const player = getGame().current?.getFirst(Player);
    for (let i = 0; i < 3; i++) {
      const slot = this.slots[i];
      const a = player?.abilities[i];
      slot.classList.toggle('empty', !a);
      const glyph = slot.querySelector<HTMLElement>('.glyph')!;
      const cd = slot.querySelector<HTMLElement>('.cd')!;
      const cost = slot.querySelector<HTMLElement>('.cost')!;
      if (!a || !player) {
        glyph.textContent = '';
        cost.textContent = '';
        cd.style.height = '0%';
        slot.title = '';
      } else {
        glyph.textContent = a.glyph;
        cost.textContent = a.cost > 0 ? `${a.cost}` : '';
        slot.style.setProperty('--slot-color', a.color);
        slot.title = `${a.name} (${a.cost} Light): ${a.description}`;
        cd.style.height = `${a.cooldown > 0 ? (a.cooldownLeft / a.cooldown) * 100 : 0}%`;
        slot.classList.toggle('unaffordable', player.energy < a.cost);
      }
      this.tickDeny(i, slot, realDt);
    }
    const heal = this.slots[3];
    if (player) {
      heal.querySelector<HTMLElement>('.cd')!.style.height = `${(player.healCooldownLeft / PLAYER.heal.cooldown) * 100}%`;
      heal.classList.toggle('unaffordable', player.energy < PLAYER.heal.cost);
    }
    this.tickDeny(3, heal, realDt);
  }

  private tickDeny(i: number, slot: HTMLElement, realDt: number) {
    if (this.deny[i] > 0) {
      if (!slot.classList.contains('deny')) this.bump(slot, 'deny');
      this.deny[i] -= realDt;
      if (this.deny[i] <= 0) slot.classList.remove('deny');
    }
  }
}
