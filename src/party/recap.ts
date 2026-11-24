// «En la sesión anterior…»: junta lo que pasó en la última sesión (combates, bajas, crónicas, botín, misiones y PNJ)
// para que el DM lo comparta al empezar la siguiente, escrito aquí sin IA o como relato con Claude.
import type { RoomView } from './protocol';
import { secretIds } from './room';
import { itemLine } from '../rules/items';
import { T } from '../i18n';

/** Desde cuándo hasta cuándo fue la sesión anterior, según cuándo se creó la partida cada vez */
export function lastSessionRange(view: Pick<RoomView, 'sessions' | 'open'>, now = Date.now()): { from: number; to: number } {
  const s = [...(view.sessions ?? [])].sort((a, b) => a - b);
  // Con la partida abierta, la sesión de ahora ya ha empezado: la anterior es la de antes
  if (view.open && s.length) return { from: s.length >= 2 ? s[s.length - 2] : 0, to: s[s.length - 1] };
  return { from: s.length ? s[s.length - 1] : 0, to: now };
}

export interface RecapMaterial {
  combats: { title: string; downs: string[] }[];
  chronicles: { title: string; text: string }[];
  loot: string[];
  questsNew: string[];
  questsDone: string[];
  questsFailed: string[];
  questsOpen: string[];
  npcs: string[];
}

/** Lo que se puede contar a los jugadores (nada oculto: ni monstruos sin revelar, ni misiones o PNJ sin compartir) */
export function recapMaterial(view: RoomView, range = lastSessionRange(view)): RecapMaterial {
  const inRange = (t: number) => t >= range.from && t < range.to;
  const secret = secretIds(view.log, view.encounter.order);
  const combats: RecapMaterial['combats'] = [];
  for (const ev of view.log) {
    if (!inRange(ev.at) || ev.undone) continue;
    if (ev.kind === 'start') combats.push({ title: ev.text || T('Un combate', 'A fight'), downs: [] });
    if (ev.kind === 'down' && ev.target && !(ev.targetId && secret.has(ev.targetId))) {
      if (!combats.length) combats.push({ title: T('Un combate', 'A fight'), downs: [] });
      combats[combats.length - 1].downs.push(ev.actor ? T(`${ev.target} (golpe final de ${ev.actor})`, `${ev.target} (final blow by ${ev.actor})`) : ev.target);
    }
  }
  const chronicles = view.chronicles
    .filter((c) => inRange(c.at) && !c.recap && (!c.to || c.to === 'all'))
    .map((c) => ({ title: c.title, text: c.text }));
  const loot = view.gifts
    .filter((g) => inRange(g.at) && !g.fromId && !g.shop && g.items?.length)
    .map((g) => `${g.toName}: ${g.items!.map(itemLine).join(', ')}`);
  const shared = view.quests.filter((q) => q.shared);
  return {
    combats,
    chronicles,
    loot,
    questsNew: shared.filter((q) => inRange(q.at)).map((q) => q.title),
    questsDone: shared.filter((q) => q.status === 'done' && inRange(q.updatedAt)).map((q) => q.title),
    questsFailed: shared.filter((q) => q.status === 'failed' && inRange(q.updatedAt)).map((q) => q.title),
    questsOpen: shared.filter((q) => q.status === 'active').map((q) => q.title + (q.giver ? T(` (encargo de ${q.giver})`, ` (from ${q.giver})`) : '')),
    npcs: view.npcs.filter((n) => n.shared && inRange(n.at)).map((n) => n.name + (n.place ? ` · ${n.place}` : '') + (n.text ? ` — ${n.text.split('\n')[0].slice(0, 80)}` : '')),
  };
}

export const recapIsEmpty = (m: RecapMaterial) =>
  !m.combats.length && !m.chronicles.length && !m.loot.length && !m.questsNew.length && !m.questsDone.length && !m.questsFailed.length && !m.npcs.length;

/** Resumen sin IA: una lista ordenada de lo que pasó */
export function localRecap(m: RecapMaterial): string {
  const out: string[] = [];
  const block = (title: string, lines: string[]) => { if (lines.length) out.push(`${title}\n${lines.map((l) => `• ${l}`).join('\n')}`); };
  block(T('⚔️ Combates', '⚔️ Fights'), m.combats.map((c) => c.title + (c.downs.length ? T(` — cayeron: ${c.downs.join(', ')}`, ` — fallen: ${c.downs.join(', ')}`) : '')));
  block(T('📖 Crónicas', '📖 Chronicles'), m.chronicles.map((c) => c.title));
  block(T('🎁 Botín', '🎁 Loot'), m.loot);
  block(T('👥 Personajes que conocisteis', '👥 People you met'), m.npcs);
  block(T('🗺️ Misiones nuevas', '🗺️ New quests'), m.questsNew);
  block(T('✅ Misiones cumplidas', '✅ Quests completed'), m.questsDone);
  block(T('❌ Misiones fallidas', '❌ Quests failed'), m.questsFailed);
  block(T('📌 Siguen pendientes', '📌 Still open'), m.questsOpen);
  return out.join('\n\n');
}

/** Lo mismo en texto plano para que Claude lo cuente como relato */
export function recapTranscript(m: RecapMaterial): string {
  const parts: string[] = [];
  for (const c of m.chronicles) parts.push(`Chronicle «${c.title}»:\n${c.text.slice(0, 3000)}`);
  for (const c of m.combats) parts.push(`Fight «${c.title}»${c.downs.length ? `; fallen: ${c.downs.join(', ')}` : ''}`);
  if (m.loot.length) parts.push(`Loot handed out:\n${m.loot.join('\n')}`);
  if (m.npcs.length) parts.push(`People they met:\n${m.npcs.join('\n')}`);
  if (m.questsNew.length) parts.push(`New quests: ${m.questsNew.join('; ')}`);
  if (m.questsDone.length) parts.push(`Quests completed: ${m.questsDone.join('; ')}`);
  if (m.questsFailed.length) parts.push(`Quests failed: ${m.questsFailed.join('; ')}`);
  if (m.questsOpen.length) parts.push(`Quests still open: ${m.questsOpen.join('; ')}`);
  return parts.join('\n\n');
}
