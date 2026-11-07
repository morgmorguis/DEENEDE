// Resumen narrativo de un combate a partir de su registro: sin IA (frases generadas aquí) o con IA
// (se prepara el registro en texto para que Claude lo cuente como un relato).
import type { LogEvent } from './protocol';
import { secretIds } from './room';
import { T } from '../i18n';

/**
 * Eventos del último combate (desde su «empieza» hasta su «termina»), sin lo deshecho ni las criaturas que
 * siguen ocultas (el resumen se comparte con los jugadores: no debe destapar sorpresas del DM).
 */
export function lastCombat(log: LogEvent[], order: { id: string; hidden?: boolean }[] = []): LogEvent[] {
  const start = log.map((e) => e.kind).lastIndexOf('start');
  const slice = start >= 0 ? log.slice(start) : log;
  const end = slice.findIndex((e, i) => i > 0 && e.kind === 'start');
  const secret = secretIds(log, order);
  return (end > 0 ? slice.slice(0, end) : slice).filter((e) => !e.undone && !(e.actorId && secret.has(e.actorId)) && !(e.targetId && secret.has(e.targetId)));
}

/** El registro en líneas de texto sencillas (para la IA o para guardarlo) */
export function combatTranscript(events: LogEvent[]): string {
  return events.map((e) => {
    const how = [e.reaction ? 'reaction' : '', e.action ?? '', e.weapon ?? '', e.spell ?? ''].filter(Boolean).join(', ');
    const w = how ? ` [${how}]` : '';
    switch (e.kind) {
      case 'hit': return `${e.actor} hits ${e.target}${w} for ${e.amount} damage${e.crit ? ' (critical)' : ''}${e.text ? ` (${e.text})` : ''}`;
      case 'miss': return `${e.actor} misses${e.target ? ` ${e.target}` : ''}${w}${e.text ? ` (${e.text})` : ''}`;
      case 'heal': return `${e.actor} heals ${e.target}${w} for ${e.amount} HP`;
      case 'hurt': return `${e.actor} takes ${e.amount} damage`;
      case 'other': return `${e.actor}${e.action ? ` uses ${e.action}` : ''}${e.spell ? ` (${e.spell})` : ''}${e.target ? ` on ${e.target}` : ''}${e.text ? `: ${e.text}` : ''}`;
      case 'down': return `${e.target} falls${e.actor ? ` (final blow by ${e.actor})` : ''}`;
      case 'round': return `--- Round ${e.round} ---`;
      case 'add': return `${e.target} joins the fight`;
      case 'reveal': return `${e.target} appears from hiding`;
      case 'start': return 'Combat starts';
      case 'end': return 'Combat ends';
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

const pick = <X,>(arr: X[], i: number) => arr[i % arr.length];

/** Resumen sin IA: un párrafo por momento importante, en pasado */
export function localNarrative(events: LogEvent[]): { title: string; text: string } {
  const lines: string[] = [];
  const enemies = [...new Set(events.filter((e) => e.kind === 'add' || e.kind === 'reveal').map((e) => e.target!).filter(Boolean))];
  const heroes = [...new Set(events.filter((e) => ['hit', 'miss', 'heal', 'other'].includes(e.kind) && e.actor && !enemies.includes(e.actor)).map((e) => e.actor!))];
  const rounds = Math.max(1, ...events.filter((e) => e.kind === 'round').map((e) => e.round));
  if (enemies.length) lines.push(T(`${heroes.length ? heroes.join(', ') : 'El grupo'} se enfrentó a ${enemies.join(', ')}.`, `${heroes.length ? heroes.join(', ') : 'The party'} faced ${enemies.join(', ')}.`));
  let n = 0;
  const missStreak = new Map<string, number>();
  for (const e of events) {
    n++;
    if (e.kind === 'hit') {
      const big = (e.amount ?? 0) >= 10;
      const verb = e.crit ? T('asestó un golpe crítico a', 'landed a critical blow on') : big ? pick([T('golpeó con fuerza a', 'struck hard at'), T('castigó duramente a', 'battered')], n) : pick([T('alcanzó a', 'hit'), T('hirió a', 'wounded'), T('acertó a', 'struck')], n);
      const with_ = e.spell ? T(` con ${e.spell}`, ` with ${e.spell}`) : e.weapon ? T(` con su ${e.weapon.toLowerCase()}`, ` with their ${e.weapon.toLowerCase()}`) : '';
      lines.push(`${e.actor} ${verb} ${e.target}${with_} (${e.amount}${T(' de daño', ' damage')}).`);
      missStreak.delete(`${e.actor}>${e.target}`);
    } else if (e.kind === 'miss') {
      const k = `${e.actor}>${e.target}`;
      const c = (missStreak.get(k) ?? 0) + 1;
      missStreak.set(k, c);
      if (c === 1) lines.push(e.target ? pick([T(`${e.actor} intentó golpear a ${e.target}, pero falló.`, `${e.actor} tried to hit ${e.target}, but missed.`), T(`El ataque de ${e.actor} contra ${e.target} no encontró su objetivo.`, `${e.actor}’s attack on ${e.target} found nothing but air.`)], n) : T(`${e.actor} lo intentó, sin suerte.`, `${e.actor} tried, without luck.`));
      else if (c === 2) lines.push(T(`${e.actor} volvió a fallar contra ${e.target ?? 'su enemigo'}.`, `${e.actor} missed ${e.target ?? 'the enemy'} again.`));
    } else if (e.kind === 'heal') {
      lines.push(e.actor === e.target ? T(`${e.actor} se curó ${e.amount} PG${e.spell ? ` con ${e.spell}` : ''}.`, `${e.actor} healed ${e.amount} HP${e.spell ? ` with ${e.spell}` : ''}.`) : T(`${e.actor} curó a ${e.target} (${e.amount} PG)${e.spell ? ` con ${e.spell}` : ''}.`, `${e.actor} healed ${e.target} (${e.amount} HP)${e.spell ? ` with ${e.spell}` : ''}.`));
    } else if (e.kind === 'down') {
      lines.push(e.actor ? pick([T(`¡${e.actor} derrotó a ${e.target}!`, `${e.actor} defeated ${e.target}!`), T(`${e.target} cayó ante ${e.actor}.`, `${e.target} fell before ${e.actor}.`)], n) : T(`${e.target} cayó.`, `${e.target} fell.`));
    } else if (e.kind === 'other' && e.action) {
      const a = e.action;
      const s = a === 'esconderse' ? T(`${e.actor} se escondió entre las sombras${e.text ? ` (${e.text})` : ''}.`, `${e.actor} hid in the shadows${e.text ? ` (${e.text})` : ''}.`)
        : a === 'correr' ? T(`${e.actor} echó a correr.`, `${e.actor} dashed.`)
        : a === 'destrabarse' ? T(`${e.actor} se apartó con cuidado del combate.`, `${e.actor} carefully disengaged.`)
        : a === 'esquivar' ? T(`${e.actor} se concentró en esquivar.`, `${e.actor} focused on dodging.`)
        : a === 'ayudar' ? T(`${e.actor} ayudó a ${e.target ?? 'un aliado'}.`, `${e.actor} helped ${e.target ?? 'an ally'}.`)
        : a === 'influir' ? T(`${e.actor} intentó convencer a ${e.target ?? 'sus enemigos'}${e.text ? `: «${e.text}»` : ''}.`, `${e.actor} tried to sway ${e.target ?? 'the enemies'}${e.text ? `: “${e.text}”` : ''}.`)
        : a === 'magia' || a === 'reaccion_conjuro' ? T(`${e.actor} lanzó ${e.spell ?? 'un conjuro'}${e.target ? ` sobre ${e.target}` : ''}.`, `${e.actor} cast ${e.spell ?? 'a spell'}${e.target ? ` on ${e.target}` : ''}.`)
        : a === 'agarrar' ? T(`${e.actor} agarró a ${e.target}.`, `${e.actor} grappled ${e.target}.`)
        : a === 'empujar' ? T(`${e.actor} empujó a ${e.target}.`, `${e.actor} shoved ${e.target}.`)
        : a === 'hablar' && e.text ? T(`${e.actor} gritó: «${e.text}»`, `${e.actor} shouted: “${e.text}”`)
        : e.text ? `${e.actor}: ${e.text}.` : '';
      if (s) lines.push(s);
    } else if (e.kind === 'other' && e.text) {
      lines.push(`${e.actor}: ${e.text}.`);
    } else if (e.kind === 'reveal') {
      lines.push(T(`De repente, ¡apareció ${e.target}!`, `Suddenly, ${e.target} appeared!`));
    }
  }
  // Balance final
  const dealt = new Map<string, number>();
  for (const e of events) if (e.kind === 'hit' && e.actor) dealt.set(e.actor, (dealt.get(e.actor) ?? 0) + (e.amount ?? 0));
  const best = [...dealt.entries()].sort((a, b) => b[1] - a[1])[0];
  const fallenEnemies = events.filter((e) => e.kind === 'down' && e.target && enemies.includes(e.target)).length;
  const fallenHeroes = events.filter((e) => e.kind === 'down' && e.target && heroes.includes(e.target)).map((e) => e.target!);
  lines.push(T(
    `Tras ${rounds} ${rounds === 1 ? 'ronda' : 'rondas'}, ${fallenEnemies ? `cayeron ${fallenEnemies} enemigo${fallenEnemies === 1 ? '' : 's'}` : 'ningún enemigo cayó'}${fallenHeroes.length ? ` y ${fallenHeroes.join(', ')} quedó en el suelo` : ''}.${best ? ` ${best[0]} fue quien más daño hizo (${best[1]}).` : ''}`,
    `After ${rounds} ${rounds === 1 ? 'round' : 'rounds'}, ${fallenEnemies ? `${fallenEnemies} ${fallenEnemies === 1 ? 'enemy' : 'enemies'} fell` : 'no enemy fell'}${fallenHeroes.length ? ` and ${fallenHeroes.join(', ')} went down` : ''}.${best ? ` ${best[0]} dealt the most damage (${best[1]}).` : ''}`,
  ));
  const title = enemies.length ? T(`Combate contra ${enemies.slice(0, 3).join(', ')}${enemies.length > 3 ? '…' : ''}`, `Fight against ${enemies.slice(0, 3).join(', ')}${enemies.length > 3 ? '…' : ''}`) : T('Crónica del combate', 'Combat chronicle');
  return { title, text: lines.join(' ') };
}
