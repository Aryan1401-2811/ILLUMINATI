import creditsMd from '../../CREDITS.md?raw';

/** The people who made the game (shown first in the credits). Edit names/roles here. */
export const TEAM: { name: string; role: string }[] = [
  { name: 'Amey Patel', role: 'Foundation & Player · Narrative, UI & Audio' },
  { name: 'Yagna Saradava', role: 'Enemies & Armour' },
  { name: 'Daksh Panchotiya', role: 'Bosses & the Twist' },
  { name: 'Nipun Jain', role: 'Visuals & World' },
  { name: 'Aryan', role: 'Team' },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Inline markdown we use in CREDITS.md: [text](url), **bold**, `code`. Links render as plain text. */
const inline = (s: string) =>
  esc(s)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '$1');

export interface CreditSection {
  title: string;
  rows: string[][];
}

/** CREDITS.md → sections of table rows (header rows and the intro paragraph are dropped). */
export function creditSections(): CreditSection[] {
  const out: CreditSection[] = [];
  let cur: CreditSection | null = null;
  let headerSeen = false;
  for (const raw of creditsMd.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      cur = { title: line.slice(3), rows: [] };
      out.push(cur);
      headerSeen = false;
    } else if (cur && line.startsWith('|')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator row
      if (!headerSeen) {
        headerSeen = true; // first row is the column header
        continue;
      }
      cur.rows.push(cells);
    }
  }
  return out.filter((s) => s.rows.length > 0);
}

/** HTML for a scrollable credits panel (title screen). */
export function creditsPanelHtml(): string {
  const team = TEAM.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.role)}</td></tr>`).join('');
  const sections = creditSections()
    .map((s) => `<h3>${inline(s.title)}</h3><table>${s.rows.map((r) => `<tr><td>${inline(r[0])}</td><td>${r.slice(1, 2).map(inline).join('')}</td></tr>`).join('')}</table>`)
    .join('');
  return `<h2>Credits</h2><h3>Team</h3><table>${team}</table>${sections}`;
}

/** HTML for the end-of-game credits roll. */
export function creditsRollHtml(): string {
  const team = TEAM.map((t) => `<p><b>${esc(t.name)}</b> — ${esc(t.role)}</p>`).join('');
  const sections = creditSections()
    .map((s) => `<h3>${inline(s.title)}</h3>${s.rows.map((r) => `<p>${inline(r[0])}${r[1] ? ` — ${inline(r[1])}` : ''}</p>`).join('')}`)
    .join('');
  return `<h3>FALSE DAWN</h3><h3>Team</h3>${team}${sections}<h3>Thank you for playing</h3>`;
}
