/**
 * Comic page-turn between scenes: a paper page sweeps across the screen, the next scene
 * loads underneath it, then the page sweeps off the other side.
 *
 *   await pageTurn(() => game.loadScene('zone2'));
 */
const COVER_MS = 520;
const REVEAL_MS = 560;

let el: HTMLElement | null = null;

function page(): HTMLElement {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'page-turn';
  el.innerHTML = '<div class="page-turn-sheet"><div class="page-turn-ink"></div></div>';
  document.getElementById('ui-root')!.appendChild(el);
  return el;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function pageTurn(during: () => Promise<void>): Promise<void> {
  const p = page();
  p.className = 'page-turn covering';
  await wait(COVER_MS);
  try {
    await during();
  } finally {
    p.className = 'page-turn revealing';
    await wait(REVEAL_MS);
    p.className = 'page-turn';
  }
}
