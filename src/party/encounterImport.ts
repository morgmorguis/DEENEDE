// Listas de enemigos del DM desde Excel (.xlsx), CSV o texto pegado de una hoja de cálculo, plantilla para rellenarlas y exportación a CSV.
import type { Coins5, ItemData } from '../rules/itemTypes';
import { ITEM_CATALOG, fromCatalog } from '../rules/items';
import { MONSTERS } from './monsters';
import type { EncounterEntry, PreparedEncounter } from './protocol';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const newId = () => Math.random().toString(36).slice(2, 10);

// ---------- Leer tablas ----------

/** Separa un CSV (o texto pegado de Excel) en filas; detecta «;», «,» o tabulador y respeta las comillas */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const first = clean.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const count = (ch: string) => first.split(ch).length - 1;
  const sep = count('\t') > 0 ? '\t' : count(';') >= count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Lee un archivo ZIP (como .xlsx) y devuelve sus archivos de texto; descomprime con DecompressionStream */
async function unzip(buf: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // Fin del directorio central: firma 0x06054b50 buscando desde el final
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not-zip');
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.slice(start, start + size);
    if (method === 0) out.set(name, dec.decode(data));
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out.set(name, dec.decode(await new Response(stream).arrayBuffer()));
    }
  }
  return out;
}

const xmlText = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colIndex = (ref: string) => ref.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Hojas de un .xlsx: nombre de cada pestaña y sus filas */
export async function readXlsx(buf: ArrayBuffer): Promise<{ name: string; rows: string[][] }[]> {
  const files = await unzip(buf);
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]));
  const wb = files.get('xl/workbook.xml') ?? '';
  const rels = files.get('xl/_rels/workbook.xml.rels') ?? '';
  const target = (rid: string) => {
    const m = rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`))?.[0].match(/Target="([^"]+)"/)?.[1];
    return m ? (m.startsWith('/') ? m.slice(1) : `xl/${m}`) : undefined;
  };
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: xmlText(m[0].match(/name="([^"]*)"/)?.[1] ?? 'Hoja'),
    file: target(m[0].match(/r:id="([^"]+)"/)?.[1] ?? '') ?? '',
  }));
  return sheets.map(({ name, file }) => {
    const xml = files.get(file) ?? '';
    const rows: string[][] = [];
    for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const body = cm[2] ?? '';
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/t="([^"]+)"/)?.[1];
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val = '';
        if (type === 's' && v != null) val = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') val = xmlText(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
        else if (type === 'b') val = v === '1' ? 'sí' : '';
        else if (v != null) val = xmlText(v);
        const i = ref ? colIndex(ref) : row.length;
        while (row.length < i) row.push('');
        row[i] = val;
      }
      if (row.some((x) => x.trim())) rows.push(row);
    }
    return { name, rows };
  }).filter((s) => s.rows.length);
}

// ---------- Interpretar columnas ----------

type Field = 'place' | 'name' | 'kind' | 'count' | 'hp' | 'ac' | 'init' | 'cr' | 'hidden' | 'color' | 'notes' | 'items' | keyof Coins5 | 'ppAmbiguous';

const HEADERS: [Field, string[]][] = [
  ['place', ['lugar', 'encuentro', 'hoja', 'zona', 'location', 'place', 'encounter', 'sheet']],
  ['name', ['nombre', 'enemigo', 'criatura', 'monstruo', 'name', 'enemy', 'creature', 'monster']],
  ['kind', ['tipo', 'bando', 'kind', 'type', 'side']],
  ['count', ['cantidad', 'numero', 'num', 'n', 'unidades', 'count', 'qty', 'quantity', 'number']],
  ['hp', ['pg', 'vida', 'puntos de golpe', 'hp', 'hit points', 'life']],
  ['ac', ['ca', 'clase de armadura', 'armadura', 'ac', 'armor class', 'armour class']],
  ['init', ['iniciativa', 'bonificador de iniciativa', 'init', 'initiative', 'ini']],
  ['cr', ['vd', 'valor de desafio', 'desafio', 'cr', 'challenge', 'challenge rating']],
  ['hidden', ['oculto', 'escondido', 'secreto', 'hidden', 'secret']],
  ['color', ['color', 'colour']],
  ['notes', ['notas', 'ataques', 'nota', 'descripcion', 'notes', 'attacks', 'note', 'description']],
  ['items', ['objetos', 'botin', 'equipo', 'lleva', 'items', 'loot', 'gear', 'equipment']],
  ['gp', ['oro', 'po', 'gp', 'gold']],
  ['sp', ['plata', 'sp', 'silver']],
  ['cp', ['cobre', 'pc', 'cp', 'copper']],
  ['ep', ['electro', 'pe', 'ep', 'electrum']],
  ['pp', ['platino', 'ppt', 'platinum']],
  ['ppAmbiguous', ['pp']],
];

const YES = new Set(['si', 'yes', 'y', 's', 'x', '1', 'true', 'verdadero', 'oculto', 'hidden']);
const ALLY = /^(pnj|npc|aliado|ally|amigo|friend|neutral)/;
const int = (s: string) => { const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? Math.round(Number(m[0])) : null; };

/** Objetos de una celda: «Daga; 2x Poción de curación; Llave x3» (del catálogo si se reconoce el nombre) */
export function parseItems(cell: string): ItemData[] {
  return cell.split(/[;|\n]|,(?!\d)/).map((s) => s.trim()).filter(Boolean).map((raw) => {
    let qty = 1;
    let name = raw;
    const pre = raw.match(/^(\d+)\s*[x×*]?\s+(.+)$/i) ?? raw.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
    const post = raw.match(/^(.+?)\s*[x×*]\s*(\d+)$/i);
    if (pre) { qty = Number(pre[1]); name = pre[2]; } else if (post) { name = post[1]; qty = Number(post[2]); }
    const k = fold(name);
    const cat = ITEM_CATALOG.find((c) => fold(c.name.es) === k || fold(c.name.en) === k);
    if (cat) return fromCatalog(cat, Math.max(1, qty));
    return { name: name.slice(0, 120), rarity: 'mundane', type: 'other', description: '', value: 0, qty: Math.max(1, Math.min(9999, qty)) } as ItemData;
  });
}

/** Convierte filas (la primera, cabeceras) en encuentros: uno por «Lugar» o, si no hay esa columna, uno con `fallbackName` */
export function rowsToEncounters(rows: string[][], fallbackName: string): PreparedEncounter[] {
  const [head, ...body] = rows;
  if (!head) return [];
  const cols = new Map<Field, number>();
  head.forEach((h, i) => {
    const k = fold(h).replace(/[()[\]:.]/g, '').trim();
    for (const [field, names] of HEADERS) if (names.includes(k) && !cols.has(field)) { cols.set(field, i); break; }
  });
  // «pp» es plata en español y platino en inglés: lo decide el idioma de las demás cabeceras
  if (cols.has('ppAmbiguous')) {
    const spanish = head.some((h) => ['nombre', 'cantidad', 'pg', 'ca', 'oro', 'iniciativa', 'objetos', 'tipo'].includes(fold(h)));
    const key: keyof Coins5 = spanish ? 'sp' : 'pp';
    if (!cols.has(key)) cols.set(key, cols.get('ppAmbiguous')!);
  }
  if (!cols.has('name')) cols.set('name', 0);
  const get = (row: string[], f: Field) => { const i = cols.get(f); return i == null ? '' : String(row[i] ?? '').trim(); };
  const groups = new Map<string, EncounterEntry[]>();
  for (const row of body) {
    const name = get(row, 'name');
    if (!name) continue;
    const lib = MONSTERS.find((m) => fold(m.name.es) === fold(name) || fold(m.name.en) === fold(name) || m.id === fold(name));
    const coins: Partial<Coins5> = {};
    for (const k of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) { const v = int(get(row, k)); if (v && v > 0) coins[k] = v; }
    const items = parseItems(get(row, 'items'));
    const kindCell = fold(get(row, 'kind'));
    const color = get(row, 'color');
    const entry: EncounterEntry = {
      id: newId(),
      name: name.slice(0, 60),
      kind: ALLY.test(kindCell) ? 'npc' : 'monster',
      count: Math.max(1, Math.min(20, int(get(row, 'count')) ?? 1)),
      hidden: YES.has(fold(get(row, 'hidden'))),
      hpMax: int(get(row, 'hp')) ?? lib?.hp ?? null,
      ac: int(get(row, 'ac')) ?? lib?.ac ?? null,
      initBonus: int(get(row, 'init')) ?? lib?.init ?? 0,
      ...((get(row, 'cr') || lib?.cr) ? { cr: get(row, 'cr').replace(/^(vd|cr)\s*/i, '') || lib!.cr } : {}),
      ...(lib ? { monster: lib.id } : {}),
      ...(/^#[0-9a-f]{3,6}$/i.test(color) ? { color } : {}),
      ...(get(row, 'notes') ? { notes: get(row, 'notes').slice(0, 1000) } : {}),
      ...(Object.keys(coins).length || items.length ? { loot: { ...(Object.keys(coins).length ? { coins } : {}), ...(items.length ? { items } : {}) } } : {}),
    };
    const place = get(row, 'place') || fallbackName;
    groups.set(place, [...(groups.get(place) ?? []), entry]);
  }
  return [...groups].map(([name, entries]) => ({ id: newId(), name: name.slice(0, 80), notes: '', entries }));
}

/** Encuentros de un archivo: .xlsx (una pestaña = un lugar, salvo que haya columna «Lugar») o CSV/texto */
export async function importEncounterFile(file: File): Promise<PreparedEncounter[]> {
  const base = file.name.replace(/\.[^.]+$/, '');
  if (/\.xlsx$/i.test(file.name)) {
    const sheets = await readXlsx(await file.arrayBuffer());
    return sheets.flatMap((s) => rowsToEncounters(s.rows, sheets.length > 1 ? s.name : base));
  }
  return rowsToEncounters(parseDelimited(await file.text()), base);
}

// ---------- Plantilla y exportación ----------

const ES_HEAD = ['Lugar', 'Nombre', 'Tipo', 'Cantidad', 'PG', 'CA', 'Iniciativa', 'VD', 'Oculto', 'Color', 'Oro', 'Plata', 'Cobre', 'Objetos', 'Notas'];
const EN_HEAD = ['Location', 'Name', 'Type', 'Count', 'HP', 'AC', 'Initiative', 'CR', 'Hidden', 'Color', 'Gold', 'Silver', 'Copper', 'Items', 'Notes'];
const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const itemsCell = (items?: ItemData[]) => (items ?? []).map((i) => (i.qty > 1 ? `${i.qty}x ${i.name}` : i.name)).join('; ');

/** CSV con «;» (lo abre Excel en español) a partir de encuentros guardados */
export function encountersToCsv(list: PreparedEncounter[], lang: 'es' | 'en'): string {
  const yes = lang === 'es' ? 'sí' : 'yes';
  const lines = [(lang === 'es' ? ES_HEAD : EN_HEAD).join(';')];
  for (const enc of list) {
    for (const x of enc.entries) {
      lines.push([enc.name, x.name, x.kind === 'npc' ? (lang === 'es' ? 'PNJ' : 'NPC') : (lang === 'es' ? 'Enemigo' : 'Enemy'), x.count, x.hpMax, x.ac, x.initBonus, x.cr, x.hidden ? yes : '', x.color,
        x.loot?.coins?.gp, x.loot?.coins?.sp, x.loot?.coins?.cp, itemsCell(x.loot?.items), x.notes].map(csvCell).join(';'));
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Plantilla de ejemplo para rellenar en Excel */
export function encounterTemplateCsv(lang: 'es' | 'en'): string {
  const es = lang === 'es';
  const enc = (name: string, entries: Omit<EncounterEntry, 'id'>[]): PreparedEncounter => ({ id: '', name, notes: '', entries: entries.map((x) => ({ ...x, id: '' })) });
  return encountersToCsv([
    enc(es ? 'Taberna Malandra' : 'Rascal Tavern', [
      { name: es ? 'Matón' : 'Thug', kind: 'monster', count: 3, hidden: false, hpMax: 32, ac: 11, initBonus: 0, cr: '1/2', loot: { coins: { sp: 8, cp: 15 }, items: [{ name: es ? 'Garrote' : 'Club', rarity: 'mundane', type: 'weapon', description: '', value: 0.1, qty: 1 }] } },
      { name: es ? 'Ladrón de bolsas' : 'Cutpurse', kind: 'monster', count: 2, hidden: true, hpMax: 9, ac: 12, initBonus: 2, cr: '1/8', notes: es ? 'Escondido entre los clientes' : 'Hiding among the patrons', loot: { coins: { gp: 3 } } },
      { name: es ? 'Tabernero' : 'Innkeeper', kind: 'npc', count: 1, hidden: false, hpMax: 16, ac: 12, initBonus: 1, notes: es ? 'Ayuda si le pagan' : 'Helps if paid' },
    ]),
    enc(es ? 'Cripta olvidada' : 'Forgotten crypt', [
      { name: es ? 'Esqueleto' : 'Skeleton', kind: 'monster', count: 4, hidden: false, hpMax: 13, ac: 14, initBonus: 3, cr: '1/4' },
    ]),
  ], lang);
}

// ---------- Repartir botín ----------

/** Reparte monedas y objetos entre `n` personas lo más igual posible (lo que sobra, uno a uno a los primeros) */
export function splitLoot(loot: { coins?: Partial<Coins5>; items?: ItemData[] }, n: number): { coins: Coins5; items: ItemData[] }[] {
  const out = Array.from({ length: Math.max(1, n) }, () => ({ coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } as Coins5, items: [] as ItemData[] }));
  const k = out.length;
  let extra = 0;
  for (const c of ['pp', 'gp', 'ep', 'sp', 'cp'] as const) {
    const v = Math.max(0, Math.floor(loot.coins?.[c] ?? 0));
    const each = Math.floor(v / k);
    for (let i = 0; i < k; i++) out[i].coins[c] = each;
    for (let r = 0; r < v % k; r++) out[(extra + r) % k].coins[c] += 1;
    extra = (extra + (v % k)) % k;
  }
  let next = 0;
  for (const it of loot.items ?? []) {
    for (let u = 0; u < Math.max(1, it.qty); u++) {
      const bag = out[next % k].items;
      const same = bag.find((x) => x.name === it.name && x.ref === it.ref);
      if (same) same.qty += 1; else bag.push({ ...it, qty: 1 });
      next++;
    }
  }
  return out;
}

/** Junta varios botines en uno */
export function mergeLoot(list: { coins?: Partial<Coins5>; items?: ItemData[] }[]): { coins: Coins5; items: ItemData[] } {
  const coins: Coins5 = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const items: ItemData[] = [];
  for (const l of list) {
    for (const c of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) coins[c] += l.coins?.[c] ?? 0;
    for (const it of l.items ?? []) {
      const same = items.find((x) => x.name === it.name && x.ref === it.ref);
      if (same) same.qty += it.qty; else items.push({ ...it });
    }
  }
  return { coins, items };
}
