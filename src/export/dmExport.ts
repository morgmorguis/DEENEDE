// Listas del DM en Excel (.xlsx) o Markdown: personajes preparados, lugares y encuentros, tesoro de cada enemigo y de cada grupo, botín pendiente, entregas y registro; y una ficha de personaje (p. ej. de un PNJ) en Excel o Markdown.
import type { Character } from '../types';
import type { CarriedLoot, Gift, LogEvent, LootDrop, PreparedEncounter, RosterEntry } from '../party/protocol';
import { encountersRows, mergeLoot } from '../party/encounterImport';
import { coinsInGold, coinsText, itemLine } from '../rules/items';
import { abilityName, skillName } from '../rules/srd';
import { sheetFields } from './sheetPdf';
import { buildXlsx, type Cell, type XlsxSheet } from './xlsx';
import { getLang, T } from '../i18n';

/** Lo que exporta el DM (lo tiene en su vista de la partida o en la copia de la campaña) */
export interface DmLists {
  roster: RosterEntry[];
  encounters: PreparedEncounter[];
  loot: LootDrop[];
  gifts: Gift[];
  log: LogEvent[];
}

const gold = (x: number) => Math.round(x * 100) / 100;
/** Valor en oro de un botín (monedas + valor de los objetos) */
export const lootValue = (l?: CarriedLoot) => gold(coinsInGold(l?.coins ?? {}) + (l?.items ?? []).reduce((a, i) => a + (i.value ?? 0) * Math.max(1, i.qty), 0));
const coins = (l?: CarriedLoot) => (l?.coins ? coinsText(l.coins) : '');
const items = (l?: CarriedLoot) => (l?.items ?? []).map(itemLine).join('; ');
/** Botín de `n` iguales */
const times = (l: CarriedLoot | undefined, n: number) => mergeLoot(Array.from({ length: Math.max(1, n) }, () => l ?? {}));
const when = (ms: number) => new Date(ms).toLocaleString(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---------- Filas de cada lista (puras, con tests) ----------

export function rosterRows(list: RosterEntry[]): Cell[][] {
  return [
    [T('Nombre', 'Name'), T('Tipo', 'Type'), T('Nivel / VD', 'Level / CR'), T('PG', 'HP'), T('CA', 'AC'), T('Iniciativa', 'Initiative'), T('Monstruo base', 'Base monster'), T('Ataques', 'Attacks'), T('Equipo', 'Equipment'), T('Notas', 'Notes')],
    ...list.map((r) => [r.name, r.kind === 'npc' ? T('PNJ / aliado', 'NPC / ally') : T('Enemigo', 'Enemy'), r.level, r.hpMax, r.ac, r.initBonus, r.monster, r.attacks, r.equipment, r.notes]),
  ];
}

/** Tesoro de cada enemigo: lo que lleva uno y lo que llevan todos los de esa fila */
export function lootPerEnemyRows(list: PreparedEncounter[]): Cell[][] {
  const rows: Cell[][] = [[T('Lugar', 'Place'), T('Enemigo', 'Enemy'), T('Cantidad', 'Count'), T('Monedas (cada uno)', 'Coins (each)'), T('Objetos (cada uno)', 'Items (each)'), T('Valor de uno (po)', 'Value each (gp)'), T('Valor de todos (po)', 'Total value (gp)')]];
  for (const enc of list) for (const x of enc.entries) {
    if (!x.loot) continue;
    rows.push([enc.name, x.name, x.count, coins(x.loot), items(x.loot), lootValue(x.loot), gold(lootValue(x.loot) * Math.max(1, x.count))]);
  }
  return rows;
}

/** Tesoro de cada grupo (lugar): todo lo que llevan sus enemigos juntos */
export function lootPerGroupRows(list: PreparedEncounter[]): Cell[][] {
  const rows: Cell[][] = [[T('Lugar', 'Place'), T('Enemigos', 'Enemies'), T('Con tesoro', 'Carrying loot'), T('Monedas', 'Coins'), T('Objetos', 'Items'), T('Valor total (po)', 'Total value (gp)')]];
  for (const enc of list) {
    const all = mergeLoot(enc.entries.map((x) => times(x.loot, x.count)));
    const n = enc.entries.reduce((a, x) => a + Math.max(1, x.count), 0);
    const carrying = enc.entries.filter((x) => x.loot).reduce((a, x) => a + Math.max(1, x.count), 0);
    rows.push([enc.name, n, carrying, coins(all), items(all), lootValue(all)]);
  }
  return rows;
}

export function pendingLootRows(list: LootDrop[]): Cell[][] {
  return [
    [T('Fecha', 'Date'), T('Combate', 'Combat'), T('Lo llevaba', 'Carried by'), T('Derrotado', 'Defeated'), T('Monedas', 'Coins'), T('Objetos', 'Items'), T('Valor (po)', 'Value (gp)')],
    ...list.map((d) => [when(d.at), d.combat, d.from, d.defeated ? T('sí', 'yes') : T('no', 'no'), coins(d), items(d), lootValue(d)]),
  ];
}

export function giftRows(list: Gift[]): Cell[][] {
  return [
    [T('Fecha', 'Date'), T('De', 'From'), T('Para', 'To'), T('Monedas', 'Coins'), T('Objetos', 'Items'), T('Nota', 'Note'), T('Entregado', 'Delivered')],
    ...list.map((g) => [when(g.at), g.fromName ?? 'DM', g.toName, coins(g), items(g), g.note, g.delivered ? T('sí', 'yes') : T('pendiente', 'pending')]),
  ];
}

export function logRows(list: LogEvent[], line: (ev: LogEvent) => string): Cell[][] {
  return [
    [T('Fecha', 'Date'), T('Ronda', 'Round'), T('Qué pasa', 'What happens'), T('Quién', 'Who'), T('A quién', 'Target'), T('Cantidad', 'Amount'), T('Tirada', 'Roll')],
    ...list.filter((e) => !e.undone && e.kind !== 'turn').map((e) => [when(e.at), e.round, line(e), e.actor, e.target, e.amount, e.roll ?? undefined]),
  ];
}

// ---------- Libro y documento ----------

/** Libro de Excel con todas las listas del DM (la pestaña «Encuentros» se puede volver a importar) */
export function dmWorkbook(d: DmLists, line: (ev: LogEvent) => string): Uint8Array {
  const sheets: XlsxSheet[] = [
    { name: T('Personajes', 'Characters'), rows: rosterRows(d.roster), widths: [22, 14, 10, 6, 6, 9, 18, 40, 40, 40] },
    { name: T('Encuentros', 'Encounters'), rows: encountersRows(d.encounters, getLang()), widths: [20, 22, 10, 9, 6, 6, 9, 6, 7, 8, 6, 6, 6, 40, 40] },
    { name: T('Tesoro por enemigo', 'Loot per enemy'), rows: lootPerEnemyRows(d.encounters), widths: [20, 22, 9, 26, 40, 14, 16] },
    { name: T('Tesoro por grupo', 'Loot per group'), rows: lootPerGroupRows(d.encounters), widths: [22, 10, 11, 30, 50, 16] },
    { name: T('Botín pendiente', 'Pending loot'), rows: pendingLootRows(d.loot), widths: [17, 22, 22, 10, 26, 40, 11] },
    { name: T('Entregas', 'Gifts'), rows: giftRows(d.gifts), widths: [17, 14, 20, 26, 40, 30, 11] },
    { name: T('Registro', 'Log'), rows: logRows(d.log, line), widths: [17, 7, 70, 18, 18, 9, 7] },
  ];
  return buildXlsx(sheets);
}

const mdCell = (v: Cell) => (v == null ? '' : String(v)).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
/** Tabla de Markdown (la primera fila es la cabecera); columnas vacías en todas las filas se quitan */
export function mdTable(rows: Cell[][]): string {
  if (rows.length < 2) return `_${T('(nada)', '(nothing)')}_\n`;
  const keep = rows[0].map((_, c) => rows.slice(1).some((r) => r[c] != null && r[c] !== ''));
  const pick = (r: Cell[]) => r.filter((_, c) => keep[c]);
  const head = pick(rows[0]);
  return [`| ${head.map(mdCell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${pick(r).map(mdCell).join(' | ')} |`)].join('\n') + '\n';
}

/** Documento Markdown con las listas del DM */
export function dmMarkdown(d: DmLists, line: (ev: LogEvent) => string, title = T('Campaña', 'Campaign')): string {
  const out = [`# ${title}`, '', `_${T('Exportado el', 'Exported on')} ${when(Date.now())} · Di en Di_`, ''];
  out.push(`## ${T('Personajes preparados', 'Prepared characters')}`, '', mdTable(rosterRows(d.roster)));
  out.push(`## ${T('Lugares y encuentros', 'Places and encounters')}`, '');
  for (const enc of d.encounters) {
    out.push(`### ${enc.name}`, '');
    if (enc.notes) out.push(enc.notes, '');
    out.push(mdTable(encountersRows([enc], getLang()).map((r) => r.slice(1))));
  }
  if (!d.encounters.length) out.push(`_${T('(nada)', '(nothing)')}_`, '');
  out.push(`## ${T('Tesoro por enemigo', 'Loot per enemy')}`, '', mdTable(lootPerEnemyRows(d.encounters)));
  out.push(`## ${T('Tesoro por grupo', 'Loot per group')}`, '', mdTable(lootPerGroupRows(d.encounters)));
  out.push(`## ${T('Botín pendiente de repartir', 'Loot waiting to be shared')}`, '', mdTable(pendingLootRows(d.loot)));
  out.push(`## ${T('Entregas de oro y objetos', 'Gold and item gifts')}`, '', mdTable(giftRows(d.gifts)));
  out.push(`## ${T('Registro de combate', 'Combat log')}`, '', mdTable(logRows(d.log, line)));
  return out.join('\n');
}

// ---------- Ficha de personaje (también la de un PNJ) ----------

const PROF = ['', '●', '●●'];

/** Filas de la ficha: secciones con «Campo | Valor» */
export function characterRows(c: Character): Cell[][] {
  const f = sheetFields(c);
  const rows: Cell[][] = [[T('Campo', 'Field'), T('Valor', 'Value'), T('Extra', 'Extra')]];
  const add = (k: string, v: Cell, x?: Cell) => { if (v != null && v !== '') rows.push([k, v, x]); };
  const head = (k: string) => rows.push([`— ${k} —`]);
  head(T('Personaje', 'Character'));
  add(T('Nombre', 'Name'), f.name); add(T('Clase', 'Class'), f.className); add(T('Subclase', 'Subclass'), f.subclass); add(T('Nivel', 'Level'), Number(f.level));
  add(T('Especie', 'Species'), f.species); add(T('Trasfondo', 'Background'), f.background); add(T('Alineamiento', 'Alignment'), f.alignment); add(T('Experiencia', 'XP'), f.xp);
  head(T('Combate', 'Combat'));
  add(T('Clase de armadura', 'Armor class'), Number(f.ac), f.shield ? T('con escudo', 'with shield') : undefined);
  add(T('Puntos de golpe', 'Hit points'), `${f.hp}/${f.hpMax}`, f.temp ? `+${f.temp} ${T('temp.', 'temp')}` : undefined);
  add(T('Dados de golpe', 'Hit dice'), f.hdMax, f.hdSpent ? `${T('gastados', 'spent')}: ${f.hdSpent}` : undefined);
  add(T('Iniciativa', 'Initiative'), f.initiative); add(T('Velocidad', 'Speed'), f.speed); add(T('Tamaño', 'Size'), f.size);
  add(T('Bonificador de competencia', 'Proficiency bonus'), f.prof); add(T('Percepción pasiva', 'Passive perception'), Number(f.passive));
  head(T('Características', 'Abilities'));
  for (const [a, v] of Object.entries(f.abilities)) add(abilityName(a as keyof typeof f.abilities), `${v.score} (${v.mod})`, `${T('Salvación', 'Save')} ${v.save}${v.saveProf ? ' ●' : ''}`);
  head(T('Habilidades', 'Skills'));
  for (const [id, v] of Object.entries(f.skills)) add(skillName(id), v.bonus, PROF[v.prof]);
  if (f.attacks.length) { head(T('Ataques', 'Attacks')); for (const a of f.attacks) add(a.name, `${a.bonus} · ${a.damage}`, a.notes); }
  if (f.spells.length) {
    head(T('Conjuros', 'Spells'));
    add(T('Aptitud mágica', 'Spellcasting ability'), f.spellAbility, `CD ${f.spellDc} · ${T('ataque', 'attack')} ${f.spellAtk}`);
    const slots = f.slots.map((s, i) => (s.total ? `${i + 1}º: ${s.total - s.used}/${s.total}` : '')).filter(Boolean).join(' · ');
    add(T('Espacios', 'Slots'), slots);
    for (const s of f.spells) add(`${s.level === '0' ? T('Truco', 'Cantrip') : `${T('Nivel', 'Level')} ${s.level}`}: ${s.name}`, [s.time, s.range].filter(Boolean).join(' · '), [s.c && 'C', s.r && 'R', s.m && 'M', s.notes].filter(Boolean).join(' '));
  }
  head(T('Rasgos y competencias', 'Traits and proficiencies'));
  add(T('Rasgos de clase', 'Class features'), f.features); add(T('Rasgos de especie', 'Species traits'), f.speciesTraits); add(T('Dotes', 'Feats'), f.feats);
  add(T('Armas', 'Weapons'), f.weapons); add(T('Herramientas', 'Tools'), f.tools); add(T('Idiomas', 'Languages'), f.languages);
  add(T('Armaduras', 'Armor'), [f.armor.light && T('ligera', 'light'), f.armor.medium && T('intermedia', 'medium'), f.armor.heavy && T('pesada', 'heavy'), f.armor.shields && T('escudos', 'shields')].filter(Boolean).join(', '));
  head(T('Equipo', 'Equipment'));
  add(T('Equipo', 'Equipment'), f.equipment); add(T('Sintonizados', 'Attuned'), f.attunement.join(', '));
  add(T('Monedas', 'Coins'), coinsText(c.coins));
  if (f.appearance || f.backstory) { head(T('Historia', 'Story')); add(T('Aspecto', 'Appearance'), f.appearance); add(T('Trasfondo e historia', 'Backstory'), f.backstory); }
  return rows;
}

export const characterXlsx = (c: Character) => buildXlsx([{ name: c.name || T('Ficha', 'Sheet'), rows: characterRows(c), widths: [30, 60, 30] }]);

export function characterMarkdown(c: Character): string {
  const out = [`# ${c.name}`, ''];
  let block: Cell[][] = [];
  const flush = () => { if (block.length) out.push(mdTable([[T('Campo', 'Field'), T('Valor', 'Value'), ''], ...block])); block = []; };
  for (const r of characterRows(c).slice(1)) {
    const k = String(r[0]);
    if (k.startsWith('— ')) { flush(); out.push(`## ${k.replace(/^— | —$/g, '')}`, ''); } else block.push(r);
  }
  flush();
  out.push(`_${T('Exportado con Di en Di', 'Exported with Di en Di')} · ${when(Date.now())}_`);
  return out.join('\n');
}

