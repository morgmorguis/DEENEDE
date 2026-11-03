// Genera src/rules/spellsGen.ts con los conjuros del SRD 5.2 y del Player’s Handbook 2024 que no están
// escritos a mano en src/rules/spells.ts (uso: node scripts/build-spells.cjs).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
const srd = read('srd-5.2-spells.json');
const es = { ...read('spells-es-1.json'), ...read('spells-es-2.json') };
const extra = read('spells-phb-extra.json');
const hand = fs.readFileSync(path.join(root, 'src/rules/spells.ts'), 'utf8');
const handNames = new Set([...hand.matchAll(/s\(r\('[^']*', '([^']*)'\)/g)].map((m) => m[1].replace(/’/g, "'")));
const LETTER = { Bard: 'B', Cleric: 'C', Druid: 'D', Paladin: 'P', Ranger: 'R', Sorcerer: 'S', Warlock: 'K', Wizard: 'W' };

const num = (s) => s.replace(/(\d),(\d)/g, '$1.$2');
function timeTr(t) {
  if (t === 'A' || t === 'Action') return { es: 'Acción', en: 'Action' };
  if (t === 'BA' || t === 'Bonus Action') return { es: 'Acción adicional', en: 'Bonus Action' };
  if (t === 'BAhit') return { es: 'Acción adicional, justo tras impactar', en: 'Bonus Action, right after you hit' };
  if (/^Bonus Action, which you take immediately after hitting/.test(t)) return { es: 'Acción adicional, justo tras impactar', en: t };
  if (/^Reaction/.test(t)) {
    const when = /casting a spell/.test(t) ? 'cuando ves a una criatura a 60 pies lanzar un conjuro'
      : /falls/.test(t) ? 'cuando tú o una criatura a 60 pies caéis'
      : /Magic Missile/.test(t) ? 'cuando te impacta un ataque o te apunta Proyectil mágico'
      : /taking damage/.test(t) ? 'cuando una criatura a 60 pies te hace daño' : '';
    return { es: when ? `Reacción, ${when}` : 'Reacción', en: t };
  }
  if (/Overgrowth/.test(t)) return { es: 'Acción (maleza) u 8 horas (abono)', en: t };
  const m = t.match(/^(\d+) (minute|minutes|hour|hours)$/);
  if (m) return { es: `${m[1]} ${m[2].startsWith('minute') ? (m[1] === '1' ? 'minuto' : 'minutos') : (m[1] === '1' ? 'hora' : 'horas')}`, en: t };
  return { es: t, en: t };
}
function rangeTr(r) {
  r = r.replace(/ Component: .*$/, '');
  const ft = r.match(/^(\d[\d,]*) feet$/); if (ft) return { es: `${num(ft[1])} pies`, en: r };
  const mi = r.match(/^(\d+) miles?$/); if (mi) return { es: `${mi[1]} ${mi[1] === '1' ? 'milla' : 'millas'}`, en: r };
  const self = r.match(/^Self \((\d+)-foot (Emanation|Cone|Cylinder)\)$/);
  if (self) return { es: `Personal (${{ Emanation: 'emanación', Cone: 'cono', Cylinder: 'cilindro' }[self[2]]} de ${self[1]} pies)`, en: r };
  return { es: { Self: 'Personal', Touch: 'Toque', Sight: 'Vista', Special: 'Especial', Unlimited: 'Ilimitado' }[r] ?? r, en: r };
}
function durTr(d) {
  const c = /^(concentration )?up to /i.test(d);
  const base = d.replace(/^(Concentration )?up to /i, '');
  const m = base.match(/^(\d+) (round|rounds|minute|minutes|hour|hours|day|days)$/);
  const unit = m && { round: 'asalto', rounds: 'asaltos', minute: 'minuto', minutes: 'minutos', hour: 'hora', hours: 'horas', day: 'día', days: 'días' }[m[2]];
  const esD = m ? `${m[1]} ${unit}` : ({ Instantaneous: 'Instantáneo', Special: 'Especial', 'Until dispelled': 'Hasta que se disipe', 'Until dispelled or triggered': 'Hasta que se disipe o se active' }[base] ?? base);
  return { tr: { es: (c ? 'Hasta ' : '') + esD, en: d }, conc: c && /concentration|up to/i.test(d) };
}
const q = (s) => JSON.stringify(s);
const out = []; const lists = {};
for (const x of srd) {
  if (handNames.has(x.name)) { lists[x.name] = x.classes.map((c) => LETTER[c.name] ?? '').join(''); continue; }
  const t = es[x.name];
  if (!t) throw new Error(`Falta la traducción de ${x.name}`);
  const d = durTr(x.duration);
  const desc = x.description.replace(/\s+/g, ' ').trim() + (x.higher_level ? ` ${x.higher_level.replace(/\s+/g, ' ').trim()}` : '') + (x.material ? ` (Material: ${x.material})` : '');
  out.push(`  s(${q({ es: t[0], en: x.name })}, ${x.level}, ${q(timeTr(x.casting_time))}, ${q(rangeTr(x.range))}, ${q(x.components.join(', '))}, ${q(d.tr)}, ${x.concentration}, ${q({ es: t[1], en: desc })}, ${x.ritual})`);
  lists[x.name] = x.classes.map((c) => LETTER[c.name] ?? '').join('');
}
for (const x of extra) {
  if (handNames.has(x.en)) continue;
  const d = durTr(x.conc ? `up to ${x.dur}` : x.dur);
  out.push(`  s(${q({ es: x.es, en: x.en })}, ${x.level}, ${q(timeTr(x.time))}, ${q(rangeTr(x.range))}, ${q(x.comp)}, ${q(d.tr)}, ${x.conc}, ${q({ es: x.esText, en: x.enText })}, false)`);
  lists[x.en] = x.classes;
}
const file = `// GENERADO por scripts/build-spells.cjs: no editar a mano.
// Conjuros del SRD 5.2 (CC BY 4.0, Wizards of the Coast) y del Player’s Handbook 2024 (resumen propio)
// que no están escritos a mano en spells.ts. Los textos en español son resúmenes; en inglés, el SRD.
import type { SpellInfo } from './spells';

type Tr = { es: string; en: string };
const s = (name: Tr, level: number, time: Tr, range: Tr, components: string, duration: Tr, concentration: boolean, text: Tr, ritual: boolean): SpellInfo =>
  ({ name, level, time, range, components, duration, concentration, ritual, text });

export const GEN_SPELLS: SpellInfo[] = [
${out.join(',\n')},
];

/** Clases que tienen cada conjuro (B bardo, C clérigo, D druida, P paladín, R explorador, S hechicero, K brujo, W mago) */
export const GEN_LISTS: Record<string, string> = ${JSON.stringify(lists, null, 0).replace(/","/g, '", "')};
`;
fs.writeFileSync(path.join(root, 'src/rules/spellsGen.ts'), file);
console.log(`spellsGen.ts: ${out.length} conjuros nuevos, ${Object.keys(lists).length} listas de clase`);
