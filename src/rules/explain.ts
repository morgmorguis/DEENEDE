// Explicaciones breves para la burbuja de información (mantener pulsado): qué hace algo y qué te limita ahora mismo.
import type { Ability, Character, ConditionId } from '../types';
import { L, T } from '../i18n';
import {
  ACTIONS, CLASSES, CONDITIONS, COST_NAMES, MASTERIES, SKILLS, abilityName, abilityShort, conditionName, damageTypeName, effectName, effectNotes, findMastery, resourceName,
} from './srd';
import { abilityMods, attackBonus, fmt, mod, profBonus, rollContext, saveBonus, skillBonus, spellAttack, spellSaveDc, type RollKind } from './calc';
import { findSpell, spellComponents } from './spells';

export type InfoTarget =
  | { type: 'ability'; ability: Ability }
  | { type: 'save'; ability: Ability }
  | { type: 'skill'; id: string }
  | { type: 'spell'; id: string }
  | { type: 'attack'; id: string }
  | { type: 'feature'; id: string }
  | { type: 'condition'; id: ConditionId }
  | { type: 'effect'; id: string }
  | { type: 'resource'; id: string }
  | { type: 'action'; id: string }
  | { type: 'mastery'; id: string };

export interface Limit { tone: 'good' | 'bad' | 'info'; text: string }
export interface Explanation { title: string; subtitle?: string; lines: string[]; limits: Limit[] }

const INCAPACITATING: ConditionId[] = ['incapacitado', 'aturdido', 'paralizado', 'inconsciente', 'petrificado'];

function rollLimits(c: Character, r: RollKind): Limit[] {
  const ctx = rollContext(c, r);
  return [
    ...ctx.advantage.map((x) => ({ tone: 'good' as const, text: T(`Ventaja por ${x}`, `Advantage from ${x}`) })),
    ...ctx.disadvantage.map((x) => ({ tone: 'bad' as const, text: T(`Desventaja por ${x}`, `Disadvantage from ${x}`) })),
    ...ctx.autoFail.map((x) => ({ tone: 'bad' as const, text: x })),
    ...ctx.penalties.map((x) => ({ tone: 'bad' as const, text: x })),
  ];
}

/** Límites comunes a cualquier cosa que requiera actuar */
function actionLimits(c: Character): Limit[] {
  const out: Limit[] = [];
  const blocking = c.conditions.filter((x) => INCAPACITATING.includes(x));
  if (blocking.length) out.push({ tone: 'bad', text: T(`No puedes realizar acciones ni reacciones: ${blocking.map(conditionName).join(', ')}.`, `You can’t take actions or reactions: ${blocking.map(conditionName).join(', ')}.`) });
  if (c.hp.current <= 0 && !c.dead) out.push({ tone: 'bad', text: T('Estás a 0 PG e inconsciente.', 'You’re at 0 HP and unconscious.') });
  if (c.combat.active) {
    const spent = [!c.combat.action && T('acción', 'action'), !c.combat.bonus && T('acción adicional', 'bonus action'), !c.combat.reaction && T('reacción', 'reaction')].filter(Boolean);
    if (spent.length) out.push({ tone: 'info', text: T(`Este turno ya has usado: ${spent.join(', ')}.`, `Already used this turn: ${spent.join(', ')}.`) });
  }
  return out;
}

const raging = (c: Character) => c.effects.some((e) => e.presetId === 'furia');

/** Espacios libres de nivel ≥ n (normales y de pacto) */
function freeSlotsFrom(c: Character, level: number) {
  let n = 0;
  c.slots.forEach((s, i) => { if (i + 1 >= level) n += s.max - s.used; });
  if (c.pactSlots && c.pactSlots.level >= level) n += c.pactSlots.max - c.pactSlots.used;
  return n;
}
const maxSlotLevel = (c: Character) => Math.max(c.slots.reduce((m, s, i) => (s.max > 0 ? i + 1 : m), 0), c.pactSlots?.max ? c.pactSlots.level : 0);

export function explain(c: Character, t: InfoTarget): Explanation | null {
  const m = abilityMods(c);
  const pb = profBonus(c.level);

  switch (t.type) {
    case 'ability': {
      const skills = SKILLS.filter((s) => s.ability === t.ability).map((s) => L(s.name));
      return {
        title: abilityName(t.ability),
        subtitle: `${c.abilities[t.ability]} → ${fmt(mod(c.abilities[t.ability]))}`,
        lines: [
          T(`Se suma a las pruebas, salvaciones y ataques que usan ${abilityShort(t.ability)}.`, `Added to checks, saves and attacks that use ${abilityShort(t.ability)}.`),
          skills.length ? T(`Habilidades: ${skills.join(', ')}.`, `Skills: ${skills.join(', ')}.`) : '',
        ].filter(Boolean),
        limits: rollLimits(c, { kind: 'check', ability: t.ability }),
      };
    }
    case 'save': {
      const prof = c.saveProf.includes(t.ability);
      return {
        title: T(`Salvación de ${abilityName(t.ability)}`, `${abilityName(t.ability)} saving throw`),
        subtitle: fmt(saveBonus(c, t.ability)),
        lines: [
          T('Tiras para resistir un conjuro, trampa, veneno u otro peligro. Si igualas o superas la CD, lo resistes.', 'You roll to resist a spell, trap, poison or other danger. Meet or beat the DC to resist it.'),
          `${abilityShort(t.ability)} ${fmt(m[t.ability])}${prof ? ` + ${T('competencia', 'proficiency')} ${fmt(pb)}` : ''}`,
        ],
        limits: rollLimits(c, { kind: 'save', ability: t.ability }),
      };
    }
    case 'skill': {
      const s = SKILLS.find((x) => x.id === t.id);
      if (!s) return null;
      const p = c.skillProf[s.id] ?? 0;
      return {
        title: L(s.name),
        subtitle: `${abilityShort(s.ability)} · ${fmt(skillBonus(c, s.id))}`,
        lines: [
          L(s.desc),
          `${T('Ejemplos', 'Examples')}: ${L(s.examples)}`,
          `${abilityShort(s.ability)} ${fmt(m[s.ability])}${p === 1 ? ` + ${T('competencia', 'proficiency')} ${fmt(pb)}` : p === 2 ? ` + ${T('pericia', 'expertise')} ${fmt(2 * pb)}` : ''}`,
        ],
        limits: rollLimits(c, { kind: 'check', ability: s.ability, skill: s.id }),
      };
    }
    case 'spell': {
      const sp = c.spells.find((x) => x.id === t.id);
      if (!sp) return null;
      const info = findSpell(sp.name);
      const lines: string[] = [];
      const meta = [
        sp.level ? T(`Nivel ${sp.level}`, `Level ${sp.level}`) : T('Truco', 'Cantrip'),
        sp.castingTime || (info ? L(info.time) : ''),
        sp.range || (info ? L(info.range) : ''),
        info?.components ?? '',
        info ? L(info.duration) : '',
      ].filter(Boolean).join(' · ');
      if (info) lines.push(L(info.text));
      if (sp.notes) lines.push(sp.notes);
      if (!info && !sp.notes) lines.push(T('No tengo este conjuro en la base de datos; añade una nota con lo que hace al editarlo.', 'This spell isn’t in the database; add a note describing it when you edit it.'));
      const dc = spellSaveDc(c);
      const atk = spellAttack(c);
      if (dc != null) lines.push(T(`Tu CD de salvación de conjuros es ${dc} y tu ataque de conjuro ${fmt(atk!)}.`, `Your spell save DC is ${dc} and your spell attack ${fmt(atk!)}.`));

      const limits: Limit[] = [];
      const concentration = sp.concentration || !!info?.concentration;
      const ritual = sp.ritual || !!info?.ritual;
      if (raging(c)) limits.push({ tone: 'bad', text: T('Estás en Furia: no puedes lanzar conjuros ni concentrarte.', 'You’re raging: you can’t cast spells or concentrate.') });
      if (!sp.prepared && sp.level > 0) limits.push({ tone: 'bad', text: T('No está preparado: no puedes lanzarlo hasta prepararlo.', 'Not prepared: you can’t cast it until you prepare it.') });
      lines.push(sp.level === 0
        ? T('Truco: se lanza a voluntad, sin gastar espacios.', 'Cantrip: cast at will, no slots needed.')
        : T(`Gasta un espacio de conjuro de nivel ${sp.level} o superior; los espacios se recuperan con un descanso largo${c.pactSlots ? ' (los de pacto, también con uno corto)' : ''}.`, `Uses a spell slot of level ${sp.level} or higher; slots come back on a Long Rest${c.pactSlots ? ' (Pact slots also on a Short Rest)' : ''}.`)
          + (sp.alwaysPrepared ? T(' Siempre lo tienes preparado gracias a un rasgo de clase.', ' You always have it prepared thanks to a class feature.') : ''));
      if (sp.level > 0) {
        const top = maxSlotLevel(c);
        if (top < sp.level) limits.push({ tone: 'bad', text: T(`Aún no tienes espacios de nivel ${sp.level}.`, `You don’t have level ${sp.level} slots yet.`) });
        else {
          const free = freeSlotsFrom(c, sp.level);
          limits.push(free > 0
            ? { tone: 'good', text: T(`Te quedan ${free} espacio(s) de nivel ${sp.level} o superior.`, `${free} slot(s) of level ${sp.level} or higher left.`) }
            : { tone: 'bad', text: T(`No te quedan espacios de nivel ${sp.level} o superior.`, `No slots of level ${sp.level} or higher left.`) + (ritual ? T(' Puedes lanzarlo como ritual (+10 minutos) si tu clase lo permite.', ' You can cast it as a ritual (+10 minutes) if your class allows it.') : '') });
        }
      }
      if (concentration) {
        limits.push(c.concentratingOn
          ? { tone: 'bad', text: T(`Requiere concentración: lanzarlo termina tu concentración en ${c.concentratingOn}.`, `Requires Concentration: casting it ends your concentration on ${c.concentratingOn}.`) }
          : { tone: 'info', text: T('Requiere concentración: si recibes daño haz una salvación de CON (CD 10 o la mitad del daño, máx. 30).', 'Requires Concentration: when you take damage, make a CON save (DC 10 or half the damage, max 30).') });
      }
      const time = (sp.castingTime || (info ? info.time.en : '')).toLowerCase();
      if (/bonus|adicional/.test(time)) limits.push({ tone: 'info', text: T('Si lanzas un conjuro con acción adicional, no puedes gastar otro espacio de conjuro en ese turno.', 'If you cast a spell with a Bonus Action, you can’t expend another spell slot on that turn.') });
      const comp = spellComponents(sp);
      if (comp.includes('V')) limits.push({ tone: 'info', text: T('V (verbal): tienes que poder hablar en voz alta; no puedes lanzarlo amordazado ni dentro de un Silencio, y delata que lanzas un conjuro.', 'V (verbal): you must be able to speak aloud; you can’t cast it while gagged or inside Silence, and it reveals you’re casting.') });
      if (comp.includes('S')) limits.push({ tone: 'info', text: T('S (somático): necesitas al menos una mano libre para gesticular (puede ser la del canalizador).', 'S (somatic): you need at least one free hand to gesture (it can be the one holding your focus).') });
      if (comp.includes('M') || sp.material) limits.push({ tone: 'info', text: T('Componente material: necesitas una bolsa de componentes o un canalizador (o el material si tiene coste).', 'Material component: you need a component pouch or a focus (or the material itself if it has a cost).') });
      if (sp.level === 0 && info) limits.push({ tone: 'info', text: T(`Los trucos mejoran a nivel 5, 11 y 17 (tú eres nivel ${c.level}).`, `Cantrips improve at levels 5, 11 and 17 (you’re level ${c.level}).`) });
      return { title: info ? L(info.name) : sp.name || T('Conjuro', 'Spell'), subtitle: meta, lines, limits: [...actionLimits(c), ...limits] };
    }
    case 'attack': {
      const a = c.attacks.find((x) => x.id === t.id);
      if (!a) return null;
      const bonus = attackBonus(c, a.ability, a.proficient, a.extraBonus);
      const flat = m[a.ability];
      const mastery = findMastery(a.mastery);
      const lines = [
        T(`Tirada de ataque: d20 ${fmt(bonus)} (${abilityShort(a.ability)} ${fmt(m[a.ability])}${a.proficient ? `, ${T('competencia', 'proficiency')} ${fmt(pb)}` : ''}${a.extraBonus ? `, ${T('extra', 'extra')} ${fmt(a.extraBonus)}` : ''}).`,
          `Attack roll: d20 ${fmt(bonus)} (${abilityShort(a.ability)} ${fmt(m[a.ability])}${a.proficient ? `, proficiency ${fmt(pb)}` : ''}${a.extraBonus ? `, extra ${fmt(a.extraBonus)}` : ''}).`),
        T(`Daño: ${a.damage}${flat ? fmt(flat) : ''} ${damageTypeName(a.damageType).toLowerCase()}. En un crítico (20 natural) tiras el doble de dados.`, `Damage: ${a.damage}${flat ? fmt(flat) : ''} ${damageTypeName(a.damageType).toLowerCase()}. On a critical hit (natural 20) roll the dice twice.`),
      ];
      if (a.range) lines.push(`${T('Alcance', 'Range')}: ${a.range}`);
      if (mastery) lines.push(`${T('Maestría', 'Mastery')} ${L(mastery.name)}: ${L(mastery.text)}`);
      if (a.notes) lines.push(a.notes);
      const limits = [...actionLimits(c), ...rollLimits(c, { kind: 'attack' })];
      if (raging(c) && a.ability === 'str') limits.push({ tone: 'good', text: T('Furia: sumas tu bonificador de Furia al daño.', 'Rage: add your Rage damage bonus.') });
      if (!a.proficient) limits.push({ tone: 'info', text: T('Sin competencia: no sumas tu bonificador de competencia.', 'Not proficient: you don’t add your Proficiency Bonus.') });
      for (const e of c.effects) if (e.mods.bonus?.attack || e.mods.bonus?.damage) limits.push({ tone: e.kind === 'buff' ? 'good' : 'bad', text: `${effectName(e)}: ${[e.mods.bonus.attack && `${T('ataque', 'attack')} ${e.mods.bonus.attack}`, e.mods.bonus.damage && `${T('daño', 'damage')} ${e.mods.bonus.damage}`].filter(Boolean).join(', ')}` });
      return { title: a.name || T('Ataque', 'Attack'), subtitle: `${fmt(bonus)} · ${a.damage}${flat ? fmt(flat) : ''}`, lines, limits };
    }
    case 'feature': {
      const f = c.features.find((x) => x.id === t.id);
      if (!f) return null;
      const key = f.name.trim().toLowerCase();
      let known: { name: { es: string; en: string }; text: { es: string; en: string } } | undefined;
      for (const cls of [CLASSES.find((x) => x.id === c.classId), ...CLASSES]) {
        known = cls?.features(c.level).find((x) => x.name.es.toLowerCase() === key || x.name.en.toLowerCase() === key);
        if (known) break;
      }
      const lines = [f.text.trim() || (known ? L(known.text) : T('Sin descripción.', 'No description.'))];
      if (known && f.text.trim() && L(known.text) !== f.text.trim()) lines.push(`${T('Según las reglas', 'Per the rules')}: ${L(known.text)}`);
      const limits: Limit[] = [];
      const res = c.resources.find((r) => resourceName(r).toLowerCase() === key || r.name.toLowerCase() === key || (known && (r.name === known.name.es || r.name === known.name.en)));
      if (res) limits.push({ tone: res.used < res.max ? 'good' : 'bad', text: T(`Usos: ${res.max - res.used}/${res.max} (se recupera con descanso ${res.recovers === 'short' ? 'corto' : 'largo'}).`, `Uses: ${res.max - res.used}/${res.max} (recovers on a ${res.recovers} rest).`) });
      return { title: known ? L(known.name) : f.name || T('Rasgo', 'Feature'), lines, limits };
    }
    case 'condition': {
      const ci = CONDITIONS.find((x) => x.id === t.id);
      if (!ci) return null;
      return { title: L(ci.name), subtitle: L(ci.short), lines: ci.effects.map(L), limits: [] };
    }
    case 'effect': {
      const e = c.effects.find((x) => x.id === t.id);
      if (!e) return null;
      const limits: Limit[] = [];
      if (e.roundsLeft != null) limits.push({ tone: 'info', text: T(`Quedan ${e.roundsLeft} rondas.`, `${e.roundsLeft} rounds left.`) });
      if (e.concentration) limits.push({ tone: 'info', text: T('Depende de concentración: termina si quien lo lanzó pierde la concentración.', 'Depends on Concentration: it ends if the caster loses concentration.') });
      return { title: effectName(e), subtitle: e.kind === 'buff' ? T('Beneficio', 'Buff') : T('Perjuicio', 'Debuff'), lines: [effectNotes(e) || T('Sin notas.', 'No notes.')], limits };
    }
    case 'resource': {
      const r = c.resources.find((x) => x.id === t.id);
      if (!r) return null;
      const feature = CLASSES.find((x) => x.id === c.classId)?.features(c.level).find((x) => x.name.es === resourceName(r) || x.name.en === resourceName(r) || x.name.es === r.name || x.name.en === r.name);
      return {
        title: resourceName(r),
        subtitle: `${r.max - r.used}/${r.max}`,
        lines: [feature ? L(feature.text) : '', T(`Se recupera con un descanso ${r.recovers === 'short' ? 'corto o largo' : 'largo'}.`, `Recovers on a ${r.recovers === 'short' ? 'short or long' : 'long'} rest.`)].filter(Boolean),
        limits: r.used >= r.max ? [{ tone: 'bad', text: T('No te quedan usos.', 'No uses left.') }] : [],
      };
    }
    case 'action': {
      const a = ACTIONS.find((x) => x.id === t.id);
      if (!a) return null;
      return { title: L(a.name), subtitle: L(COST_NAMES[a.cost]), lines: [L(a.text)], limits: actionLimits(c) };
    }
    case 'mastery': {
      const ms = MASTERIES.find((x) => x.id === t.id);
      return ms ? { title: L(ms.name), lines: [L(ms.text)], limits: [] } : null;
    }
  }
}
