import { events } from '@/core/events';
import { settings, updateSettings } from '@/core/settings';
import { retry, toTitle } from '@/narrative/flow';

/** Scenes where Esc pauses (not the title or the ending). */
const PAUSABLE = new Set(['zone1', 'zone2', 'zone3', 'warden', 'final', 'playground', 'enemies', 'bosses', 'visuals']);

/**
 * Esc / P: pause with Resume, Settings, Restart (from the checkpoint) and Quit to title.
 * The settings panel is shared with the title screen (buildSettingsPanel).
 */
export class PauseMenu {
  private el: HTMLElement;
  private settingsEl: HTMLElement;
  private paused = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'comic-screen pause-screen hidden';
    this.el.innerHTML = `
      <div class="comic-logo pause-logo">PAUSED</div>
      <div class="comic-menu">
        <button class="comic-btn" data-act="resume">RESUME</button>
        <button class="comic-btn" data-act="settings">SETTINGS</button>
        <button class="comic-btn" data-act="restart">RESTART CHECKPOINT</button>
        <button class="comic-btn" data-act="quit">QUIT TO TITLE</button>
      </div>
    `;
    this.settingsEl = buildSettingsPanel(() => this.showMenu());
    this.el.appendChild(this.settingsEl);
    root.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'resume') this.set(false);
      else if (act === 'settings') this.showSettings();
      else if (act === 'restart' || act === 'quit') {
        this.set(false);
        void (act === 'restart' ? retry() : toTitle());
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (!this.paused && !PAUSABLE.has(document.body.dataset.scene ?? '')) return;
      this.set(!this.paused);
    });
    // Losing focus mid-fight pauses (so alt-tab never gets you killed)
    window.addEventListener('blur', () => {
      if (!this.paused && PAUSABLE.has(document.body.dataset.scene ?? '')) this.set(true);
    });
    events.on('scene:loaded', () => this.set(false));
  }

  private set(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    this.el.classList.toggle('hidden', !paused);
    this.showMenu();
    events.emit('game:pause', { paused });
  }

  private showMenu() {
    this.el.querySelector('.comic-menu')!.classList.remove('hidden');
    this.el.querySelector('.pause-logo')!.classList.remove('hidden');
    this.settingsEl.classList.add('hidden');
  }

  private showSettings() {
    this.el.querySelector('.comic-menu')!.classList.add('hidden');
    this.el.querySelector('.pause-logo')!.classList.add('hidden');
    this.settingsEl.classList.remove('hidden');
  }
}

/** The settings panel: volume sliders and the screen-shake toggle. Saved immediately. */
export function buildSettingsPanel(onBack: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'comic-panel settings-panel hidden';
  const slider = (key: 'master' | 'music' | 'sfx', label: string) =>
    `<label class="setting"><span>${label}</span><input type="range" min="0" max="100" step="5" data-key="${key}" value="${Math.round(settings[key] * 100)}"><b>${Math.round(settings[key] * 100)}</b></label>`;
  panel.innerHTML = `
    <h2>Settings</h2>
    ${slider('master', 'Master volume')}
    ${slider('music', 'Music')}
    ${slider('sfx', 'Sound effects')}
    <label class="setting"><span>Screen shake</span><input type="checkbox" data-key="screenShake" ${settings.screenShake ? 'checked' : ''}><b></b></label>
    <label class="setting"><span>Voice</span><input type="checkbox" data-key="voice" ${settings.voice ? 'checked' : ''}><b></b></label>
    <p style="text-align:center;margin:14px 0 0"><button class="comic-btn" data-back>BACK</button></p>
  `;
  panel.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const key = input.dataset.key as 'master' | 'music' | 'sfx' | 'screenShake' | 'voice' | undefined;
    if (!key) return;
    if (key === 'screenShake' || key === 'voice') updateSettings({ [key]: input.checked });
    else {
      updateSettings({ [key]: Number(input.value) / 100 });
      input.nextElementSibling!.textContent = input.value;
    }
  });
  panel.querySelector('[data-back]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    onBack();
  });
  return panel;
}
