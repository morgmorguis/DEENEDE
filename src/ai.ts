// Integración opcional con Claude: interpretar frases libres, convertir transcripciones en crónica
// e importar fichas desde fotos o documentos. La clave la introduce el usuario y se guarda en el dispositivo.
import Anthropic from '@anthropic-ai/sdk';
import type { Character } from './types';
import type { Command } from './rules/engine';
import { CLASSES, CONDITIONS, DAMAGE_TYPES, EFFECT_PRESETS, SKILLS } from './rules/srd';
import { armorClass, maxHp } from './rules/calc';
import { getLang, T } from './i18n';

export { DEFAULT_MODEL } from './config';

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return T('La clave de API no es válida. Revísala en Ajustes.', 'The API key is invalid. Check it in Settings.');
  if (e instanceof Anthropic.PermissionDeniedError) return T('Tu clave no tiene permiso para usar ese modelo.', 'Your key isn’t allowed to use that model.');
  if (e instanceof Anthropic.NotFoundError) return T('Modelo no encontrado. Revisa el nombre del modelo en Ajustes.', 'Model not found. Check the model name in Settings.');
  if (e instanceof Anthropic.RateLimitError) return T('Demasiadas peticiones; espera unos segundos y vuelve a intentarlo.', 'Too many requests; wait a few seconds and try again.');
  if (e instanceof Anthropic.APIConnectionError) return T('Sin conexión con la API de Claude. ¿Tienes internet?', 'Can’t reach the Claude API. Are you online?');
  if (e instanceof Anthropic.APIError) return `${T('Error de la API', 'API error')} (${e.status ?? '?'}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

function textOf(msg: Anthropic.Beta.BetaMessage): string {
  if (msg.stop_reason === 'refusal') throw new Error(T('Claude no ha podido procesar esta petición.', 'Claude couldn’t process this request.'));
  if (msg.stop_reason === 'max_tokens') throw new Error(T('La respuesta se ha cortado por ser demasiado larga.', 'The response was cut off for being too long.'));
  return msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
}

const langName = () => (getLang() === 'es' ? 'español' : 'English');

function characterSummary(c: Character): string {
  return [
    `${c.name}, ${c.species} ${c.className} ${c.level}.`,
    `HP ${c.hp.current}/${maxHp(c)} (+${c.hp.temp} temp), AC ${armorClass(c).value}.`,
    c.conditions.length ? `Conditions: ${c.conditions.join(', ')}.` : '',
    c.effects.length ? `Effects: ${c.effects.map((e) => e.presetId ?? e.name).join(', ')}.` : '',
    c.concentratingOn ? `Concentrating on ${c.concentratingOn}.` : '',
    c.spells.length ? `Spells: ${c.spells.map((s) => `${s.name} (lvl ${s.level})`).join(', ')}.` : '',
    c.resources.length ? `Resources: ${c.resources.map((r) => r.key ?? r.name).join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const ABILITY_ENUM = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// ---------- Interpretar una frase libre ----------

const COMMAND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'commands'],
  properties: {
    reply: { type: 'string', description: 'Short reply for the player (1-3 sentences) in the requested language. For rules questions, answer here using the D&D 2024 rules.' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'damageType', 'source', 'attackRoll', 'critical', 'dice', 'condition', 'presetId', 'name', 'rounds', 'restKind', 'level', 'ability', 'skill', 'delta', 'value'],
        properties: {
          type: { type: 'string', enum: ['damage', 'heal', 'tempHp', 'addCondition', 'removeCondition', 'addEffect', 'removeEffect', 'rest', 'useSlot', 'rollSave', 'rollSkill', 'rollAbility', 'rollDice', 'rollInitiative', 'exhaustion', 'deathSave', 'nextRound', 'endConcentration', 'concentrate', 'inspiration', 'useResource'] },
          amount: nullable({ type: 'integer' }),
          damageType: nullable({ type: 'string', enum: DAMAGE_TYPES.map((d) => d.id), description: 'Spanish ids: cortante=slashing, perforante=piercing, contundente=bludgeoning, fuego=fire, frio=cold, relampago=lightning, trueno=thunder, acido=acid, veneno=poison, necrotico=necrotic, radiante=radiant, psiquico=psychic, fuerza=force' }),
          source: nullable({ type: 'string' }),
          attackRoll: nullable({ type: 'integer' }),
          critical: nullable({ type: 'boolean' }),
          dice: nullable({ type: 'string', description: 'Dice expression like 2d4+2 (healing or rollDice)' }),
          condition: nullable({ type: 'string', enum: CONDITIONS.map((c) => c.id), description: 'Spanish ids, e.g. derribado=prone, envenenado=poisoned' }),
          presetId: nullable({ type: 'string', enum: EFFECT_PRESETS.map((p) => p.id) }),
          name: nullable({ type: 'string', description: 'Effect, spell or resource name' }),
          rounds: nullable({ type: 'integer' }),
          restKind: nullable({ type: 'string', enum: ['short', 'long'] }),
          level: nullable({ type: 'integer' }),
          ability: nullable({ type: 'string', enum: ABILITY_ENUM }),
          skill: nullable({ type: 'string', enum: SKILLS.map((s) => s.id) }),
          delta: nullable({ type: 'integer' }),
          value: nullable({ type: 'boolean' }),
        },
      },
    },
  },
} as const;

type RawCmd = Record<string, unknown> & { type: string };

function toCommand(r: RawCmd): Command | null {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : null);
  switch (r.type) {
    case 'damage': return n('amount') != null ? { type: 'damage', amount: n('amount')!, damageType: s('damageType') as never, source: s('source'), attackRoll: n('attackRoll'), critical: r.critical === true } : null;
    case 'heal': return { type: 'heal', amount: n('amount'), dice: s('dice'), source: s('source') };
    case 'tempHp': return n('amount') != null ? { type: 'tempHp', amount: n('amount')! } : null;
    case 'addCondition': case 'removeCondition': return s('condition') ? { type: r.type, condition: s('condition') as never } : null;
    case 'addEffect': return { type: 'addEffect', presetId: s('presetId'), name: s('name'), rounds: n('rounds') };
    case 'removeEffect': {
      const name = s('name') ?? EFFECT_PRESETS.find((p) => p.id === s('presetId'))?.name.es;
      return name ? { type: 'removeEffect', name } : null;
    }
    case 'rest': return { type: 'rest', kind: (s('restKind') as 'short' | 'long') ?? 'short', hitDice: n('amount') };
    case 'useSlot': return n('level') ? { type: 'useSlot', level: n('level')! } : null;
    case 'rollSave': return s('ability') ? { type: 'rollSave', ability: s('ability') as never } : null;
    case 'rollSkill': return s('skill') ? { type: 'rollSkill', skill: s('skill')! } : null;
    case 'rollAbility': return s('ability') ? { type: 'rollAbility', ability: s('ability') as never } : null;
    case 'rollDice': return s('dice') ? { type: 'rollDice', expr: s('dice')! } : null;
    case 'rollInitiative': return { type: 'rollInitiative' };
    case 'exhaustion': return { type: 'exhaustion', delta: n('delta') ?? 1 };
    case 'deathSave': return { type: 'deathSave', roll: n('amount') };
    case 'nextRound': return { type: 'nextRound' };
    case 'endConcentration': return { type: 'endConcentration' };
    case 'concentrate': return s('name') ? { type: 'concentrate', spell: s('name')! } : null;
    case 'inspiration': return { type: 'inspiration', value: r.value !== false };
    case 'useResource': return s('name') ? { type: 'useResource', name: s('name')!, amount: n('amount') } : null;
  }
  return null;
}

const interpretSystem = () => `You are the rules assistant of a D&D 5th edition character sheet using the revised 2024 rules.
The player describes what happened to their character during play. Translate it into commands for the sheet.
- Don’t compute the final damage yourself: pass the raw damage the DM announced; the app applies resistances, temporary HP, concentration and death saves.
- Use presetId when the effect matches one in the list; otherwise addEffect with name and rounds (1 minute = 10 rounds).
- If the player casts a concentration spell, also add "concentrate" with its name.
- For a rules question, answer in "reply" (2024 rules) and generate no commands.
- If nothing changes, return an empty commands array.
Write "reply" in ${langName()}. Use null for fields that don’t apply.`;

export async function interpretWithClaude(apiKey: string, model: string, text: string, c: Character): Promise<{ reply: string; commands: Command[] }> {
  const msg = await client(apiKey).beta.messages.create({
    model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: COMMAND_SCHEMA as unknown as Record<string, unknown> } },
    system: interpretSystem(),
    messages: [{ role: 'user', content: `Character state: ${characterSummary(c)}\n\nPlayer: ${text}` }],
  });
  const parsed = JSON.parse(textOf(msg)) as { reply: string; commands: RawCmd[] };
  return { reply: parsed.reply, commands: parsed.commands.map(toCommand).filter((x): x is Command => x !== null) };
}

// ---------- Convertir una transcripción en crónica ----------

const storySystem = () => getLang() === 'es'
  ? `Eres el cronista de una campaña de Dungeons & Dragons. Recibes la transcripción automática (con errores de reconocimiento de voz, varias personas hablando, comentarios fuera de juego) de un fragmento de una sesión.
Escribe en español un resumen narrativo en prosa, en pasado y en tercera persona, como si fuera un capítulo de un libro de fantasía:
- Céntrate en lo que ocurre en la historia: lugares, personajes no jugadores, decisiones, combates, botín y pistas.
- Ignora las charlas fuera de partida, las reglas y las tiradas, salvo que tengan consecuencias en la historia.
- Corrige las palabras mal reconocidas cuando el contexto lo deje claro; no inventes hechos que no aparezcan.
- Termina con una lista breve titulada "Para recordar:" con nombres, pistas, misiones pendientes y objetos importantes.
Devuelve solo el texto, empezando por un título corto en la primera línea.`
  : `You are the chronicler of a Dungeons & Dragons campaign. You receive the automatic transcript (with speech-recognition errors, several people talking, out-of-game chatter) of part of a session.
Write a narrative prose summary in English, in past tense and third person, like a chapter of a fantasy novel:
- Focus on what happens in the story: places, non-player characters, decisions, fights, loot and clues.
- Ignore out-of-game talk, rules and dice rolls unless they have consequences in the story.
- Fix misrecognized words when the context makes them clear; don’t invent events that aren’t there.
- End with a short list titled "To remember:" with names, clues, open quests and important items.
Return only the text, starting with a short title on the first line.`;

export async function narrateWithClaude(apiKey: string, model: string, transcript: string, c: Character | null, previous?: string): Promise<string> {
  const context = [
    c ? `Player character recording: ${c.name} (${c.species} ${c.className} ${c.level}).` : '',
    previous ? `Summary of what happened before (for continuity):\n${previous.slice(-4000)}` : '',
  ].filter(Boolean).join('\n\n');
  const stream = client(apiKey).beta.messages.stream({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: storySystem(),
    messages: [{ role: 'user', content: `${context}\n\nTranscript:\n"""\n${transcript}\n"""` }],
  });
  return textOf(await stream.finalMessage());
}

/** Versión sin IA: limpia la transcripción y la agrupa en párrafos. */
export function narrateOffline(transcript: string): string {
  const sentences = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.'));
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 4) paragraphs.push(sentences.slice(i, i + 4).join(' '));
  return `${T('Transcripción de la sesión', 'Session transcript')}\n\n${paragraphs.join('\n\n')}`;
}

// ---------- Importar una ficha ----------

const str = { type: 'string' };
const int = { type: 'integer' };
const bool = { type: 'boolean' };
const obj = (props: Record<string, object>) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

export const SHEET_SCHEMA = obj({
  name: str,
  species: str,
  className: str,
  classId: nullable({ type: 'string', enum: CLASSES.map((c) => c.id), description: 'barbaro=Barbarian, bardo=Bard, clerigo=Cleric, druida=Druid, guerrero=Fighter, monje=Monk, paladin=Paladin, explorador=Ranger, picaro=Rogue, hechicero=Sorcerer, brujo=Warlock, mago=Wizard' }),
  subclass: str,
  background: str,
  level: int,
  xp: int,
  alignment: str,
  size: str,
  abilities: obj({ str: int, dex: int, con: int, int: int, wis: int, cha: int }),
  saveProficiencies: { type: 'array', items: { type: 'string', enum: ABILITY_ENUM } },
  skills: { type: 'array', items: obj({ skill: { type: 'string', enum: SKILLS.map((s) => s.id), description: 'Spanish ids: acrobacias=Acrobatics, trato_animales=Animal Handling, arcanos=Arcana, atletismo=Athletics, engano=Deception, historia=History, perspicacia=Insight, intimidacion=Intimidation, investigacion=Investigation, medicina=Medicine, naturaleza=Nature, percepcion=Perception, interpretacion=Performance, persuasion=Persuasion, religion=Religion, juego_manos=Sleight of Hand, sigilo=Stealth, supervivencia=Survival' }, expertise: bool }) },
  armorClass: int,
  shield: bool,
  speed: int,
  hpMax: int,
  hpCurrent: nullable(int),
  hpTemp: int,
  hitDie: nullable(int),
  hitDiceSpent: int,
  heroicInspiration: bool,
  attacks: { type: 'array', items: obj({ name: str, attackBonus: nullable(int), damage: str, damageType: nullable({ type: 'string', enum: DAMAGE_TYPES.map((d) => d.id) }), range: str, notes: str }) },
  spellcastingAbility: nullable({ type: 'string', enum: ABILITY_ENUM }),
  spellSlots: { type: 'array', items: int, description: 'Total slots for spell levels 1-9 (9 numbers)' },
  spells: { type: 'array', items: obj({ name: str, level: int, castingTime: str, range: str, concentration: bool, ritual: bool, material: bool, notes: str }) },
  classFeatures: { type: 'array', items: obj({ name: str, text: str }) },
  speciesTraits: str,
  feats: str,
  armorTraining: obj({ light: bool, medium: bool, heavy: bool, shields: bool }),
  weaponProficiencies: str,
  toolProficiencies: str,
  languages: str,
  equipment: str,
  attunement: { type: 'array', items: str },
  coins: obj({ cp: int, sp: int, ep: int, gp: int, pp: int }),
  appearance: str,
  backstory: str,
  warnings: { type: 'array', items: str, description: 'Things you could not read or had to guess, in the requested language' },
});

export interface ImportedSheet {
  name: string; species: string; className: string; classId: string | null; subclass: string; background: string;
  level: number; xp: number; alignment: string; size: string;
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>;
  saveProficiencies: string[];
  skills: { skill: string; expertise: boolean }[];
  armorClass: number; shield: boolean; speed: number; hpMax: number; hpCurrent: number | null; hpTemp: number;
  hitDie: number | null; hitDiceSpent: number; heroicInspiration: boolean;
  attacks: { name: string; attackBonus: number | null; damage: string; damageType: string | null; range: string; notes: string }[];
  spellcastingAbility: string | null; spellSlots: number[];
  /** Espacios gastados por nivel (solo en la importación sin IA) */
  spellSlotsUsed?: number[];
  spells: { name: string; level: number; castingTime: string; range: string; concentration: boolean; ritual: boolean; material: boolean; notes: string }[];
  classFeatures: { name: string; text: string }[];
  speciesTraits: string; feats: string;
  armorTraining: { light: boolean; medium: boolean; heavy: boolean; shields: boolean };
  weaponProficiencies: string; toolProficiencies: string; languages: string; equipment: string;
  attunement: string[]; coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  appearance: string; backstory: string; warnings: string[];
}

const importSystem = () => `You extract the data of a Dungeons & Dragons 5e (2024 rules) character sheet from photos, PDFs or text so a character-sheet app can import it.
- Read every field you can see: header, ability scores, proficiency circles for saves and skills (filled = proficient; a second mark or star = expertise), weapons table, spells table, features, equipment, coins, etc.
- Ability scores are the big numbers (e.g. 17), not the modifiers (+3). If only modifiers are visible, estimate a score (modifier × 2 + 10) and add a warning.
- armorClass is the total AC as written. Set shield=true only if the sheet marks a shield as equipped.
- For attacks copy the attack bonus as a number (+6 → 6). Damage like "1d6+4"; keep extra notes (range, properties) in notes.
- Use empty strings, 0, false or empty arrays for missing data. Don’t invent anything that isn’t on the sheet.
- Write every text field (names of weapons, spells, features, traits, equipment, languages, backstory…) in ${langName()}, translating it if the sheet is written in another language. Use the official D&D 2024 terms in ${langName()} (e.g. "Shortsword" → "Espada corta"). Proper names of people and places stay as they are. Write "warnings" in ${langName()} too.
- spellSlots: exactly 9 numbers (total slots for levels 1-9).
- If PDF form-field values are provided as text, use them together with the page images to work out which label each value belongs to.`;

export type ImportBlock = Anthropic.Beta.BetaContentBlockParam;

export async function importWithClaude(apiKey: string, model: string, blocks: ImportBlock[]): Promise<ImportedSheet> {
  const stream = client(apiKey).beta.messages.stream({
    model,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SHEET_SCHEMA as unknown as Record<string, unknown> } },
    system: importSystem(),
    messages: [{ role: 'user', content: [...blocks, { type: 'text', text: 'Extract this character sheet.' }] }],
  });
  return JSON.parse(textOf(await stream.finalMessage())) as ImportedSheet;
}

// ---------- Traducir textos largos de una ficha ----------

const LONG_FIELDS = ['speciesTraits', 'feats', 'appearance', 'backstory', 'inventory'] as const;

/** Traduce con Claude los textos libres de la ficha (historia, rasgos, rasgos de clase…) al idioma de la app. */
export async function translateLongTexts(apiKey: string, model: string, c: Character): Promise<Character> {
  const fields: Record<string, string> = {};
  for (const k of LONG_FIELDS) if (c[k].trim()) fields[k] = c[k];
  c.features.forEach((f, i) => { if (f.text.trim()) fields[`feature_${i}`] = f.text; });
  c.attacks.forEach((a, i) => { if (a.notes?.trim()) fields[`attack_${i}`] = a.notes; });
  c.spells.forEach((sp, i) => { if (sp.notes?.trim()) fields[`spell_${i}`] = sp.notes; });
  const keys = Object.keys(fields);
  if (!keys.length) return c;
  const schema = { type: 'object', additionalProperties: false, required: keys, properties: Object.fromEntries(keys.map((k) => [k, str])) };
  const res = await client(apiKey).beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: `Translate each value of this D&D 2024 character sheet into ${langName()}. Use the official D&D 2024 terminology in ${langName()}. Keep proper names, numbers and dice expressions. If a value is already in ${langName()}, return it unchanged. Return the same keys.`,
    messages: [{ role: 'user', content: JSON.stringify(fields) }],
  });
  const out = JSON.parse(textOf(res)) as Record<string, string>;
  const pick = (k: string, fallback: string) => (typeof out[k] === 'string' && out[k].trim() ? out[k] : fallback);
  const next: Character = { ...c };
  for (const k of LONG_FIELDS) next[k] = pick(k, c[k]);
  next.features = c.features.map((f, i) => ({ ...f, text: pick(`feature_${i}`, f.text) }));
  next.attacks = c.attacks.map((a, i) => ({ ...a, notes: a.notes ? pick(`attack_${i}`, a.notes) : a.notes }));
  next.spells = c.spells.map((sp, i) => ({ ...sp, notes: sp.notes ? pick(`spell_${i}`, sp.notes) : sp.notes }));
  return next;
}
