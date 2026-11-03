// Lectura sin IA de fichas escritas como texto (Word, texto pegado o texto reconocido por OCR).
import type { Ability } from '../types';
import type { ImportedSheet } from '../ai';
import { CLASSES, SKILLS, classById } from '../rules/srd';
import { emptySheet, parseAttackBonus, parseDamageCell, parseDamageType, parseHitDie, setSkill } from './sheetUtils';
import { findSpell } from '../rules/spells';
import { findSpecies } from '../rules/species';

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Formas femeninas o alternativas de los nombres de clase
const CLASS_ALIASES: Record<string, string> = {
  barbara: 'barbaro', barda: 'bardo', cleriga: 'clerigo', guerrera: 'guerrero', monja: 'monje', paladina: 'paladin',
  exploradora: 'explorador', picara: 'picaro', hechicera: 'hechicero', bruja: 'brujo', maga: 'mago', explorer: 'explorador',
};

export function findClass(text: string): string | null {
  const t = strip(text);
  for (const c of CLASSES) {
    for (const n of [c.name.es, c.name.en]) if (new RegExp(`\\b${strip(n)}\\b`).test(t)) return c.id;
  }
  for (const [alias, id] of Object.entries(CLASS_ALIASES)) if (new RegExp(`\\b${alias}\\b`).test(t)) return id;
  return null;
}

const ABILITY_PATTERNS: [Ability, RegExp, RegExp][] = [
  // [característica, abreviatura (en mayúsculas), nombre completo]
  ['str', /\b(?:FUE|STR)\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:fuerza|strength)\s*[:=]?\s*(\d{1,2})\b(?!\s*(?:de\s+)?(?:dano|damage))/i],
  ['dex', /\b(?:DES|DEX)\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:destreza|dexterity)\s*[:=]?\s*(\d{1,2})\b/i],
  ['con', /\bCON\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:constitucion|constitution)\s*[:=]?\s*(\d{1,2})\b/i],
  ['int', /\bINT\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:inteligencia|intelligence)\s*[:=]?\s*(\d{1,2})\b/i],
  ['wis', /\b(?:SAB|WIS)\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:sabiduria|wisdom)\s*[:=]?\s*(\d{1,2})\b/i],
  ['cha', /\b(?:CAR|CHA)\b\.?\s*[:=]?\s*(\d{1,2})\b/, /\b(?:carisma|charisma)\s*[:=]?\s*(\d{1,2})\b/i],
];

const LABELS: [string, RegExp][] = [
  ['name', /^(?:nombre(?: del personaje)?|personaje|character name|name)\s*[:\-–]\s*(.+)$/i],
  ['class', /^(?:clase|class)\s*[:\-–]\s*(.+)$/i],
  ['species', /^(?:especie|raza|species|race)\s*[:\-–]\s*(.+)$/i],
  ['background', /^(?:trasfondo|background)\s*[:\-–]\s*(.+)$/i],
  ['subclass', /^(?:subclase|subclass|arquetipo|archetype)\s*[:\-–]\s*(.+)$/i],
  ['alignment', /^(?:alineamiento|alignment)\s*[:\-–]\s*(.+)$/i],
  ['languages', /^(?:idiomas|lenguas|languages)\s*(?:[:\-–]\s*|\s+)(.+)$/i],
  ['equipment', /^(?:equipo|equipamiento|inventario|equipment|inventory|gear)\s*(?:[:\-–]\s*|\s+)(.+)$/i],
  ['features', /^(?:rasgos(?: de clase)?|aptitudes(?: de clase)?|caracter[ií]sticas de clase|class features|features(?: (?:&|and) traits)?)\s*[:\-–]\s*(.+)$/i],
  ['coins', /^(?:monedas|dinero|tesoro|coins|money|treasure|gold|oro)\s*[:\-–]\s*(.+)$/i],
  ['feats', /^(?:dotes|feats?)\s*[:\-–]\s*(.+)$/i],
  ['speciesTraits', /^(?:rasgos de especie|atributos de especie|rasgos raciales|species traits|racial traits)\s*[:\-–]\s*(.+)$/i],
  ['appearance', /^(?:aspecto|apariencia|appearance)\s*[:\-–]\s*(.+)$/i],
  ['backstory', /^(?:historia|personalidad|backstory|personality|history)\s*[:\-–]\s*(.+)$/i],
  ['weaponProf', /^(?:competencias? con armas|armas|weapon proficienc(?:y|ies)|weapons)\s*[:\-–]\s*(.+)$/i],
  ['toolProf', /^(?:herramientas|competencias? con herramientas|tools|tool proficienc(?:y|ies))\s*[:\-–]\s*(.+)$/i],
  ['skills', /^(?:habilidades|competencias en habilidades|competencias|skills|skill proficiencies|proficiencies)\s*(?:[:\-–]\s*|\s+(?=[A-ZÁÉÍÓÚa-z]))(.+)$/i],
  ['saves', /^(?:salvaciones|tiradas de salvaci[oó]n|saving throws|saves)\s*(?:[:\-–]\s*|\s+(?=[A-ZÁÉÍÓÚa-z]))(.+)$/i],
];

export function parseSheetText(raw: string, base: ImportedSheet = emptySheet()): ImportedSheet {
  const s = base;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const plain = strip(raw);
  const values: Record<string, string> = {};
  for (const line of lines) {
    for (const [key, re] of LABELS) {
      const m = line.match(re);
      if (m && !values[key]) values[key] = m[1].trim();
    }
  }

  const fill = <K extends keyof ImportedSheet>(k: K, v: ImportedSheet[K] | undefined) => {
    if (v != null && v !== '' && (s[k] === '' || s[k] == null || (Array.isArray(s[k]) && (s[k] as unknown[]).length === 0))) s[k] = v;
  };
  // Las etiquetas pueden ir seguidas de otros datos en la misma línea ("Clase: Maga  Nivel 3")
  const cut = (v?: string) => v?.split(/\s{2,}|\t|\s+(?=(?:nivel|level|especie|raza|trasfondo|clase|class|race|species|background)\b)/i)[0].trim();
  fill('name', cut(values.name));
  fill('species', cut(values.species));
  fill('background', cut(values.background));
  fill('subclass', cut(values.subclass));
  fill('alignment', values.alignment);
  fill('languages', values.languages);
  fill('equipment', values.equipment);
  fill('feats', values.feats);
  fill('speciesTraits', values.speciesTraits);
  fill('appearance', values.appearance);
  fill('backstory', values.backstory);
  fill('weaponProficiencies', values.weaponProf);
  fill('toolProficiencies', values.toolProf);

  const classId = findClass(values.class ?? raw);
  if (classId && !s.classId) {
    s.classId = classId;
    s.className = s.className || cut(values.class)?.replace(/\b(?:nivel|level|nv)\b.*$/i, '').replace(/\d+/g, '').trim() || (classById(classId)?.name.es ?? '');
  }
  const lvl = plain.match(/\b(?:nivel|level|nv)\.?\s*[:=]?\s*(\d{1,2})\b/)
    ?? (s.classId ? plain.match(new RegExp(`\\b(?:${[classById(s.classId)!.name.es, classById(s.classId)!.name.en].map(strip).join('|')}|${Object.keys(CLASS_ALIASES).join('|')})\\s+(\\d{1,2})\\b`)) : null);
  if (lvl && s.level <= 1) s.level = Math.min(20, Math.max(1, Number(lvl[1])));

  for (const [a, abbr, full] of ABILITY_PATTERNS) {
    const m = raw.match(abbr) ?? strip(raw).match(full);
    if (m && s.abilities[a] === 10) {
      const v = Number(m[1]);
      if (v >= 1 && v <= 30) s.abilities[a] = v;
    }
  }

  const ac = raw.match(/\b(?:CA|AC)\b\s*[:=]?\s*(\d{1,2})\b/) ?? plain.match(/\b(?:clase de armadura|armor class|armour class)\s*[:=]?\s*(\d{1,2})\b/);
  if (ac && !s.armorClass) s.armorClass = Number(ac[1]);
  const hp = raw.match(/\b(?:PG|PV|HP)\b(?:\s*m[aá]x(?:imos?|\.)?)?\s*[:=]?\s*(\d{1,3})\b/i) ?? plain.match(/\b(?:puntos de golpe|hit points)(?:\s*(?:maximos?|maximum|max\.?))?\s*[:=]?\s*(\d{1,3})\b/);
  if (hp && !s.hpMax) s.hpMax = Number(hp[1]);
  const spd = plain.match(/\b(?:velocidad|speed)\s*[:=]?\s*(\d{2,3})\b/);
  if (spd) s.speed = Number(spd[1]);
  const hd = plain.match(/\b(?:dados? de golpe|hit dice|hit die|dg)\s*[:=]?\s*(\d*d(?:6|8|10|12))/);
  if (hd && !s.hitDie) s.hitDie = parseHitDie(hd[1]);

  if (values.skills) {
    for (const item of values.skills.split(/[,;/]|\by\b|\band\b/i)) {
      const it = strip(item);
      const sk = SKILLS.find((x) => it.includes(strip(x.name.es)) || it.includes(strip(x.name.en)));
      if (sk) setSkill(s, sk.id, /pericia|expert|\*|x2/.test(it));
    }
  }
  if (values.saves) {
    const v = values.saves;
    for (const [a, abbr, full] of ABILITY_PATTERNS) {
      const short = abbr.source.match(/\(\?:([A-Z|]+)\)|\\b([A-Z]{3})\\b/);
      const names = (short?.[1] ?? short?.[2] ?? '').split('|').filter(Boolean);
      if (names.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(v)) || full.source.split(/[()|?:\\]/).some((w) => w.length > 4 && strip(v).includes(w))) {
        if (!s.saveProficiencies.includes(a)) s.saveProficiencies.push(a);
      }
    }
  }
  parseExtras(raw, lines, values, s);
  return s;
}

const NOT_NAME = /\b(?:nivel|level|clase|class|fue|des|con|int|sab|car|str|dex|wis|cha|ca|ac|pg|hp|ficha|sheet|hoja|personaje|character|d&d|dungeons)\b|\d/i;

/** Lo que no tiene una etiqueta fija: nombre sin etiqueta, subclase entre paréntesis, especie, armas, conjuros, rasgos y monedas */
function parseExtras(raw: string, lines: string[], values: Record<string, string>, s: ImportedSheet) {
  // Nombre: «Ficha de Thalia», «Character sheet: Elara» o la primera línea que parece un nombre
  if (!s.name) {
    const m = raw.match(/^\s*(?:ficha(?: de personaje)?(?: de)?|hoja de personaje(?: de)?|character sheet(?: for| of)?)\s*[:\-–]?\s*([A-ZÁÉÍÓÚÑ][^\n,;]{1,40})$/im);
    if (m) s.name = m[1].trim();
    else {
      const first = lines.slice(0, 3).find((l) => !LABELS.some(([, re]) => re.test(l)) && !NOT_NAME.test(strip(l)) && /^[A-ZÁÉÍÓÚÑ][\p{L}'’ -]{1,40}$/u.test(l) && l.split(/\s+/).length <= 5);
      if (first) s.name = first;
    }
  }
  // Subclase entre paréntesis junto a la clase: «Guerrero 5 (Campeón)», «Druid (Circle of the Moon)»
  const classLine = values.class ?? lines.find((l) => findClass(l) && /\(([^)]+)\)/.test(l));
  const paren = classLine?.match(/\(([^)]+)\)/);
  if (paren && !s.subclass && !/^\d+$/.test(paren[1].trim())) s.subclass = paren[1].trim();
  if (s.className) s.className = s.className.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // Especie dentro de una línea de cabecera («Level 4 Wood Elf Druid»)
  if (!s.species) {
    for (const l of lines.slice(0, 6)) {
      const f = findSpecies(l);
      if (f.species) { s.species = f.lineage ? (strip(l).includes(strip(f.lineage.name.en)) ? f.lineage.name.en : f.lineage.name.es) : (strip(l).includes(strip(f.species.name.en)) ? f.species.name.en : f.species.name.es); break; }
    }
  }
  // Armas: «Hacha de batalla +6, 1d8+3 cortante», «Longsword +5 1d8+3 slashing (versatile)»
  if (!s.attacks.length) {
    for (const l of lines) {
      const m = l.match(/^[-•*]?\s*([\p{L}][\p{L}'’ .-]{1,40}?)\s*[:,]?\s*(?:\(?\s*(?:d20\s*)?([+-]\s*\d{1,2})\)?)\s*[,;:]?\s*(?:da[nñ]o\s*:?\s*|damage\s*:?\s*)?(\d*\s*d\s*(?:4|6|8|10|12)(?:\s*[+-]\s*\d+)?)\s*(.*)$/iu);
      if (!m) continue;
      const name = m[1].trim();
      if (/^(?:nivel|level|pg|hp|ca|ac|dados?|hit)/i.test(strip(name))) continue;
      const rest = m[4] ?? '';
      const range = rest.match(/\b(\d+\s*\/\s*\d+)\b/)?.[1]?.replace(/\s/g, '') ?? '';
      s.attacks.push({ name, attackBonus: parseAttackBonus(m[2]), damage: parseDamageCell(m[3]), damageType: parseDamageType(rest), range, notes: rest.replace(/^[,;\s]+/, '').replace(/^(?:de\s+)?(?:da[nñ]o\s+)?(?:perforante|cortante|contundente|piercing|slashing|bludgeoning|fuego|fire|fr[ií]o|cold|[aá]cido|acid|veneno|poison|necr[oó]tico|necrotic|radiante|radiant|ps[ií]quico|psychic|trueno|thunder|rel[aá]mpago|lightning|fuerza|force)\b[,;\s]*/i, '').trim() });
    }
  }
  // Conjuros por nivel: «Trucos: …», «Cantrips: …», «1st level (4 slots): …», «Nivel 1 (3 espacios): …», «Conjuros: …»
  if (!s.spells.length) {
    for (const l of lines) {
      const m = l.match(/^(trucos|cantrips|conjuros|spells|(?:nivel|level)\s*(\d)|(\d)(?:st|nd|rd|th|º|°|er)?\s*(?:level|nivel)?)\s*(?:\(\s*(\d+)\s*(?:slots?|espacios?|huecos?)[^)]*\))?\s*[:\-–]\s*(.+)$/i);
      if (!m) continue;
      const lvlText = (m[2] ?? m[3]);
      const level = /^(trucos|cantrips)/i.test(m[1]) ? 0 : lvlText ? Number(lvlText) : -1;
      if (level > 0 && m[4]) s.spellSlots[level - 1] = Number(m[4]);
      for (const raw of m[5].split(/[,;]/)) {
        const name = raw.replace(/\(.*?\)/g, '').replace(/[*•]/g, '').trim();
        if (name.length < 3) continue;
        const info = findSpell(name);
        s.spells.push({ name: info ? info.name.es : name, level: info ? info.level : Math.max(0, level), castingTime: '', range: '', concentration: info?.concentration ?? false, ritual: info?.ritual ?? false, material: info ? info.components.includes('M') : false, notes: '' });
      }
    }
  }
  // Rasgos de clase en una línea: «Rasgos: Furia, Defensa sin armadura, …»
  if (!s.classFeatures.length && values.features) {
    for (const part of values.features.split(/[,;](?![^(]*\))/)) {
      const name = part.trim().replace(/\.$/, '');
      if (name.length > 1) s.classFeatures.push({ name, text: '' });
    }
  }
  // Monedas: «15 po, 8 pp» / «25 gp». En español «pp» es plata; en inglés, platino
  const coinText = values.coins ?? raw;
  const spanish = /\b(?:po|pc|pe|ppt|monedas|oro|plata|cobre)\b/i.test(coinText);
  const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  let anyCoin = false;
  for (const m of coinText.matchAll(/(\d[\d.]*)\s*(ppt|pc|po|pe|pp|cp|sp|ep|gp|mo|mp)\b/gi)) {
    const n = Number(m[1].replace(/\./g, ''));
    const u = m[2].toLowerCase();
    const key = u === 'ppt' ? 'pp' : u === 'pc' || u === 'cp' ? 'cp' : u === 'po' || u === 'gp' || u === 'mo' ? 'gp' : u === 'pe' || u === 'ep' ? 'ep' : u === 'sp' || u === 'mp' ? 'sp' : u === 'pp' ? (spanish ? 'sp' : 'pp') : null;
    if (key) { coins[key as keyof typeof coins] += n; anyCoin = true; }
  }
  if (anyCoin && Object.values(s.coins).every((v) => !v)) s.coins = coins;
}

