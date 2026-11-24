// Tiradas que pide el DM: nombre de la tirada, bonificador del personaje, tirarla con la app o con el dado
// físico, y el registro de tiradas del grupo (pedidas, del DM y del combate compartido).
import type { Character } from '../types';
import { checkBonus, rollContext, rollD20, saveBonus, skillBonus, type RollKind } from '../rules/calc';
import { SKILLS, abilityName, abilityShort, skillName } from '../rules/srd';
import { T } from '../i18n';
import type { RollAsk, RollRequest, RoomView } from './protocol';

/** «Salvación de DES», «Percepción (SAB)», «Prueba de Fuerza» */
export function askLabel(a: RollAsk): string {
  if (a.kind === 'save') return T(`Salvación de ${abilityShort(a.ability)}`, `${abilityShort(a.ability)} save`);
  if (a.kind === 'check') return T(`Prueba de ${abilityName(a.ability)}`, `${abilityName(a.ability)} check`);
  const s = SKILLS.find((x) => x.id === a.skill);
  return s ? `${skillName(s.id)} (${abilityShort(s.ability)})` : a.skill;
}

export function askKind(a: RollAsk): RollKind {
  if (a.kind === 'save') return { kind: 'save', ability: a.ability };
  if (a.kind === 'check') return { kind: 'check', ability: a.ability };
  const s = SKILLS.find((x) => x.id === a.skill);
  return { kind: 'check', ability: s?.ability ?? 'wis', skill: s?.id };
}

/** Bonificador del personaje para esa tirada (sin el agotamiento, que se resta aparte) */
export function askBonus(c: Character, a: RollAsk): number {
  if (a.kind === 'save') return saveBonus(c, a.ability);
  if (a.kind === 'check') return checkBonus(c, a.ability);
  return SKILLS.some((x) => x.id === a.skill) ? skillBonus(c, a.skill) : 0;
}

/** Ventaja, desventaja y fallos automáticos que tiene ahora el personaje para esa tirada */
export const askContext = (c: Character, a: RollAsk) => rollContext(c, askKind(a));

/** La tira la app, con todo lo de la ficha (ventaja, Talento fiable, efectos…) */
export function rollAsk(c: Character, a: RollAsk): { total: number; natural: number; lines: string[] } {
  return rollD20(c, askKind(a), askBonus(c, a), askLabel(a));
}

/** Con el dado físico: el jugador dice lo que ha salido en el d20 y se suma su bonificador (y se resta el agotamiento) */
export function manualAsk(c: Character, a: RollAsk, natural: number): { total: number; natural: number; lines: string[] } {
  const n = Math.max(1, Math.min(20, Math.round(natural)));
  const bonus = askBonus(c, a);
  const total = n + bonus - 2 * c.exhaustion;
  const sign = (x: number) => (x >= 0 ? `+${x}` : `${x}`);
  const lines = [`🎲 ${askLabel(a)}: d20 [${n}] ${sign(bonus)}${c.exhaustion ? ` −${2 * c.exhaustion} (${T('agotamiento', 'exhaustion')})` : ''}`, `Total: ${total}`];
  return { total, natural: n, lines };
}

/** Una línea del registro de tiradas del grupo */
export interface RollLine {
  id: string;
  at: number;
  who: string;
  label: string;
  total: number;
  natural?: number | null;
  dc?: number;
  /** Solo la ve el DM (secreta u oculta) */
  secret?: boolean;
  manual?: boolean;
  detail?: string;
  source: 'ask' | 'dm' | 'combat';
}

/** Registro de tiradas: las que pidió el DM (con sus respuestas), las del DM y las del combate compartido */
export function rollLines(view: RoomView, limit = 80): RollLine[] {
  const out: RollLine[] = [];
  for (const q of view.rollRequests ?? []) {
    for (const a of q.answers) {
      out.push({ id: `${q.id}:${a.memberId}`, at: a.at, who: a.name, label: askLabel(q.ask), total: a.total, natural: a.natural, dc: q.dc, secret: q.secret, manual: a.manual, detail: a.detail, source: 'ask' });
    }
  }
  for (const r of view.dmRolls ?? []) out.push({ id: r.id, at: r.at, who: 'DM', label: r.label, total: r.total, secret: r.hidden, detail: r.detail, source: 'dm' });
  for (const ev of view.log ?? []) {
    if (ev.roll == null || ev.undone || (ev.kind !== 'hit' && ev.kind !== 'miss' && ev.kind !== 'other')) continue;
    const what = ev.spell ?? ev.weapon ?? (ev.kind === 'other' ? ev.text?.slice(0, 40) : T('Ataque', 'Attack'));
    out.push({ id: ev.id, at: ev.at, who: ev.actor ?? '?', label: `⚔️ ${what}${ev.target ? ` → ${ev.target}` : ''}`, total: ev.roll, source: 'combat' });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** ¿Supera la CD? (null si no hay CD) */
export const beats = (total: number, dc?: number) => (dc ? total >= dc : null);

/** Tiradas que el DM me ha pedido y aún no he hecho (las secretas las tira la app sola) */
export function pendingAsks(view: RoomView | null): RollRequest[] {
  if (!view || view.you.role !== 'player') return [];
  return (view.rollRequests ?? []).filter((q) => !q.secret && !q.closed && q.to.includes(view.you.id) && !q.answers.some((a) => a.memberId === view.you.id));
}
