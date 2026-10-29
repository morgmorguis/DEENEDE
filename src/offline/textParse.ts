// Lectura sin IA de fichas escritas como texto (Word, texto pegado o texto reconocido por OCR).
import type { Ability } from '../types';
import type { ImportedSheet } from '../ai';
import { CLASSES, SKILLS, classById } from '../rules/srd';
import { emptySheet, parseHitDie, setSkill } from './sheetUtils';

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
  ['languages', /^(?:idiomas|lenguas|languages)\s*[:\-–]\s*(.+)$/i],
  ['equipment', /^(?:equipo|equipamiento|inventario|equipment|inventory|gear)\s*[:\-–]\s*(.+)$/i],
  ['feats', /^(?:dotes|feats?)\s*[:\-–]\s*(.+)$/i],
  ['speciesTraits', /^(?:rasgos de especie|atributos de especie|rasgos raciales|species traits|racial traits)\s*[:\-–]\s*(.+)$/i],
  ['appearance', /^(?:aspecto|apariencia|appearance)\s*[:\-–]\s*(.+)$/i],
  ['backstory', /^(?:historia|personalidad|backstory|personality|history)\s*[:\-–]\s*(.+)$/i],
  ['weaponProf', /^(?:competencias? con armas|armas|weapon proficienc(?:y|ies)|weapons)\s*[:\-–]\s*(.+)$/i],
  ['toolProf', /^(?:herramientas|competencias? con herramientas|tools|tool proficienc(?:y|ies))\s*[:\-–]\s*(.+)$/i],
  ['skills', /^(?:habilidades|competencias en habilidades|competencias|skills|skill proficiencies|proficiencies)\s*[:\-–]\s*(.+)$/i],
  ['saves', /^(?:salvaciones|tiradas de salvaci[oó]n|saving throws|saves)\s*[:\-–]\s*(.+)$/i],
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
  return s;
}
