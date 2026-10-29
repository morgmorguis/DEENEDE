// Integración opcional con Claude: interpretar frases libres y convertir transcripciones en crónica.
// La clave de API la introduce el usuario en Ajustes y se guarda solo en el dispositivo.
import Anthropic from '@anthropic-ai/sdk';
import type { Character } from './types';
import type { Command } from './rules/engine';
import { CONDITIONS, DAMAGE_TYPES, EFFECT_PRESETS, SKILLS } from './rules/srd';
import { armorClass, maxHp } from './rules/calc';

export { DEFAULT_MODEL } from './config';

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de API no es válida. Revísala en Ajustes.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para usar ese modelo.';
  if (e instanceof Anthropic.NotFoundError) return 'Modelo no encontrado. Revisa el nombre del modelo en Ajustes.';
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas peticiones; espera unos segundos y vuelve a intentarlo.';
  if (e instanceof Anthropic.APIConnectionError) return 'Sin conexión con la API de Claude. ¿Tienes internet?';
  if (e instanceof Anthropic.APIError) return `Error de la API (${e.status ?? '?'}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

function textOf(msg: Anthropic.Beta.BetaMessage): string {
  if (msg.stop_reason === 'refusal') throw new Error('Claude no ha podido procesar esta petición.');
  return msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
}

function characterSummary(c: Character): string {
  return [
    `${c.name}, ${c.species} ${c.className} nivel ${c.level}.`,
    `PG ${c.hp.current}/${maxHp(c)} (+${c.hp.temp} temporales), CA ${armorClass(c).value}.`,
    c.conditions.length ? `Condiciones: ${c.conditions.join(', ')}.` : '',
    c.effects.length ? `Efectos: ${c.effects.map((e) => e.name).join(', ')}.` : '',
    c.concentratingOn ? `Concentrado en ${c.concentratingOn}.` : '',
    c.spells.length ? `Conjuros: ${c.spells.map((s) => `${s.name} (nv ${s.level})`).join(', ')}.` : '',
    c.resources.length ? `Recursos: ${c.resources.map((r) => r.name).join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}

// ---------- Interpretar una frase libre ----------

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });

const COMMAND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'commands'],
  properties: {
    reply: { type: 'string', description: 'Respuesta breve en español para el jugador (1-3 frases). Si es una pregunta de reglas, respóndela aquí según las reglas de D&D 2024.' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'damageType', 'source', 'attackRoll', 'critical', 'dice', 'condition', 'presetId', 'name', 'rounds', 'restKind', 'level', 'ability', 'skill', 'delta', 'value'],
        properties: {
          type: { type: 'string', enum: ['damage', 'heal', 'tempHp', 'addCondition', 'removeCondition', 'addEffect', 'removeEffect', 'rest', 'useSlot', 'rollSave', 'rollSkill', 'rollAbility', 'rollDice', 'rollInitiative', 'exhaustion', 'deathSave', 'nextRound', 'endConcentration', 'concentrate', 'inspiration', 'useResource'] },
          amount: nullable({ type: 'integer' }),
          damageType: nullable({ type: 'string', enum: DAMAGE_TYPES.map((d) => d.id) }),
          source: nullable({ type: 'string' }),
          attackRoll: nullable({ type: 'integer' }),
          critical: nullable({ type: 'boolean' }),
          dice: nullable({ type: 'string', description: 'Expresión de dados como 2d4+2 (curación o rollDice)' }),
          condition: nullable({ type: 'string', enum: CONDITIONS.map((c) => c.id) }),
          presetId: nullable({ type: 'string', enum: EFFECT_PRESETS.map((p) => p.id) }),
          name: nullable({ type: 'string', description: 'Nombre del efecto, conjuro o recurso' }),
          rounds: nullable({ type: 'integer' }),
          restKind: nullable({ type: 'string', enum: ['short', 'long'] }),
          level: nullable({ type: 'integer' }),
          ability: nullable({ type: 'string', enum: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
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
    case 'removeEffect': return s('name') ?? s('presetId') ? { type: 'removeEffect', name: (s('name') ?? EFFECT_PRESETS.find((p) => p.id === s('presetId'))?.name)! } : null;
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

const INTERPRET_SYSTEM = `Eres el asistente de reglas de una hoja de personaje de D&D 5ª edición con las reglas revisadas de 2024.
El jugador te describe en español lo que le ha pasado a su personaje durante la partida. Tradúcelo en comandos para la hoja.
- No calcules tú el daño final: pasa el daño bruto que dijo el DM; la app aplica resistencias, PG temporales, concentración y salvaciones de muerte.
- Usa presetId cuando el efecto coincida con uno de la lista; si no, addEffect con name y rounds (1 minuto = 10 rondas).
- Si el jugador lanza un conjuro de concentración, añade también "concentrate" con su nombre.
- Si es una pregunta de reglas, responde en "reply" (reglas 2024) y no generes comandos.
- Si la frase no implica ningún cambio, devuelve commands vacío.
Rellena con null los campos que no apliquen.`;

export async function interpretWithClaude(apiKey: string, model: string, text: string, c: Character): Promise<{ reply: string; commands: Command[] }> {
  const msg = await client(apiKey).beta.messages.create({
    model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: COMMAND_SCHEMA as unknown as Record<string, unknown> } },
    system: INTERPRET_SYSTEM,
    messages: [{ role: 'user', content: `Estado del personaje: ${characterSummary(c)}\n\nFrase del jugador: ${text}` }],
  });
  const parsed = JSON.parse(textOf(msg)) as { reply: string; commands: RawCmd[] };
  return { reply: parsed.reply, commands: parsed.commands.map(toCommand).filter((x): x is Command => x !== null) };
}

// ---------- Convertir una transcripción en crónica ----------

const STORY_SYSTEM = `Eres el cronista de una campaña de Dungeons & Dragons. Recibes la transcripción automática (con errores de reconocimiento de voz, varias personas hablando, comentarios fuera de juego) de un fragmento de una sesión.
Escribe en español un resumen narrativo en prosa, en pasado y en tercera persona, como si fuera un capítulo de un libro de fantasía:
- Céntrate en lo que ocurre en la historia: lugares, personajes no jugadores, decisiones, combates, botín y pistas.
- Ignora las charlas fuera de partida, las reglas y las tiradas, salvo que tengan consecuencias en la historia.
- Corrige las palabras mal reconocidas cuando el contexto lo deje claro; no inventes hechos que no aparezcan.
- Termina con una lista breve titulada "Para recordar:" con nombres, pistas, misiones pendientes y objetos importantes.
Devuelve solo el texto, empezando por un título corto en la primera línea.`;

export async function narrateWithClaude(apiKey: string, model: string, transcript: string, c: Character | null, previous?: string): Promise<string> {
  const context = [
    c ? `Personaje del jugador que graba: ${c.name} (${c.species} ${c.className} ${c.level}).` : '',
    previous ? `Resumen de lo ocurrido antes (para mantener la continuidad):\n${previous.slice(-4000)}` : '',
  ].filter(Boolean).join('\n\n');
  const stream = client(apiKey).beta.messages.stream({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: STORY_SYSTEM,
    messages: [{ role: 'user', content: `${context}\n\nTranscripción:\n"""\n${transcript}\n"""` }],
  });
  return textOf(await stream.finalMessage());
}

/** Versión sin IA: limpia la transcripción y la agrupa en párrafos. */
export function narrateOffline(transcript: string): string {
  const sentences = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\s+(?=entonces|luego|después|de repente)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.'));
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 4) paragraphs.push(sentences.slice(i, i + 4).join(' '));
  return `Transcripción de la sesión\n\n${paragraphs.join('\n\n')}`;
}
