import { events } from '@/core/events';
import { SCRIPT } from './script';
import './powerCard.css';

/**
 * The "new powers" panel before the final fight: what Q/E/R do now and how to beat him.
 * Resolves when the player clicks the button or presses Enter/Space.
 */
export function showPowerCard(): Promise<void> {
  const p = SCRIPT.final.powers;
  const el = document.createElement('div');
  el.className = 'comic-screen power-card';
  el.innerHTML = `
    <div class="comic-panel power-panel">
      <h2>${p.title}</h2>
      <p class="power-intro">${p.intro}</p>
      <ul class="power-list">
        ${p.abilities.map((a) => `<li><kbd>${a.key}</kbd><div><b>${a.name}</b><span>${a.text}</span></div></li>`).join('')}
      </ul>
      <ul class="power-plan">${p.plan.map((l) => `<li>${l}</li>`).join('')}</ul>
      <p class="power-go"><button class="comic-btn">${p.start}</button><small>ENTER</small></p>
    </div>
  `;
  (document.getElementById('ui-root') ?? document.body).appendChild(el);

  return new Promise((resolve) => {
    const close = () => {
      off();
      window.removeEventListener('keydown', onKey, true);
      el.classList.add('closing');
      setTimeout(() => el.remove(), 250);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      // Keep the caption box from also treating this Enter as "skip line"
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    el.querySelector('button')!.addEventListener('click', close);
    // Leaving the scene (quit, skip) takes the panel with it
    const off = events.on('scene:loaded', () => {
      off();
      if (el.isConnected) close();
    });
  });
}
