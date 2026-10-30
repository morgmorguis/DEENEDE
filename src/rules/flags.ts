// Avisos de la ficha: datos que deberían estar y no están, o cosas que no cuadran con las reglas de 2024.
// Cada aviso tiene un id estable para poder ignorarlo y que no vuelva a aparecer.
import type { Character } from '../types';
import { T } from '../i18n';
import { ABILITIES, CLASSES, abilityName, abilityShort, pactSlotsFor, skillName, slotsFor } from './srd';
import { abilityMods, mod } from './calc';
import { findSpell } from './spells';

export type FlagSeverity = 'error' | 'warning' | 'info';
export interface Flag { id: string; severity: FlagSeverity; title: string; reason: string }

/** Experiencia necesaria para cada nivel (reglas 2024) */
export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Clases con Pericia y el nivel en que la obtienen */
const EXPERTISE_AT: Record<string, number> = { picaro: 1, bardo: 2, explorador: 2 };
/** Subclases de clases sin conjuros que sí lanzan conjuros */
const THIRD_CASTERS = /arcane trickster|eldritch knight|embaucador arcano|caballero arcano|caballero sobrenatural|bribón arcano/i;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SMALL_SPECIES = /\b(mediano|halfling|gnomo|gnome)\b/;
const MEDIUM_ONLY = /\b(enano|dwarf|elfo|elf|draconido|dragonborn|goliat|goliath|orco|orc)\b/;

export function validate(c: Character): Flag[] {
  const out: Flag[] = [];
  const add = (id: string, severity: FlagSeverity, title: string, reason: string) => out.push({ id, severity, title, reason });
  const cls = CLASSES.find((x) => x.id === c.classId);
  const mods = abilityMods(c);

  // ---- Datos que faltan ----
  if (!c.name.trim()) add('missing-name', 'warning', T('Falta el nombre', 'Missing name'), T('Tu personaje no tiene nombre.', 'Your character has no name.'));
  if (!c.classId && !c.className.trim()) add('missing-class', 'error', T('Falta la clase', 'Missing class'), T('Sin clase no se pueden calcular salvaciones, dados de golpe, recursos ni espacios de conjuro.', 'Without a class, saves, hit dice, resources and spell slots can’t be worked out.'));
  else if (!cls) add('custom-class', 'info', T('Clase no reconocida', 'Unrecognized class'), T(`No conozco la clase «${c.className}», así que no puedo comprobar sus recursos ni sus espacios de conjuro. Elige una clase en «Más opciones» si es una de las oficiales.`, `I don’t know the class “${c.className}”, so I can’t check its resources or spell slots. Pick a class in “More options” if it’s an official one.`));
  if (!c.species.trim()) add('missing-species', 'warning', T('Falta la especie', 'Missing species'), T('Todo personaje de 2024 tiene una especie (humano, elfo, enano…), que da rasgos como visión en la oscuridad o resistencias.', 'Every 2024 character has a species (human, elf, dwarf…) that grants traits such as Darkvision or resistances.'));
  if (!c.background.trim()) add('missing-background', 'warning', T('Falta el trasfondo', 'Missing background'), T('En 2024 el trasfondo da +3 a características, una dote de origen, 2 habilidades y una herramienta.', 'In 2024 your background grants +3 to ability scores, an Origin feat, 2 skills and a tool.'));
  if (c.saveProf.length === 0) add('missing-saves', 'error', T('Sin competencias en salvaciones', 'No saving throw proficiencies'), T('Todas las clases dan competencia en dos tiradas de salvación. Marca las de tu clase con el círculo junto a «Tirada de salvación».', 'Every class grants proficiency in two saving throws. Tick your class’s ones with the circle next to “Saving Throw”.'));
  if (c.attacks.length === 0) add('missing-attacks', 'info', T('Sin armas ni ataques', 'No weapons or attacks'), T('No hay ningún ataque en la tabla. Como mínimo tienes un golpe sin armas (1 + mod. FUE contundente).', 'There are no attacks in the table. At the very least you have an Unarmed Strike (1 + STR mod bludgeoning).'));
  if (Object.values(c.skillProf).filter(Boolean).length < 2) add('few-skills', 'warning', T('Pocas habilidades competentes', 'Few skill proficiencies'), T('Tu clase da al menos 2 habilidades y tu trasfondo otras 2. Puede que no se hayan marcado al importar.', 'Your class grants at least 2 skills and your background 2 more. They may not have been ticked on import.'));

  // ---- Características ----
  for (const a of ABILITIES) {
    const v = c.abilities[a.id];
    if (v > 20) add(`score-high:${a.id}`, 'warning', T(`${abilityName(a.id)} por encima de 20`, `${abilityName(a.id)} above 20`), T(`Las puntuaciones no pueden pasar de 20 salvo por objetos mágicos o dones épicos (nivel 19+). Tienes ${v}.`, `Scores can’t exceed 20 except via magic items or Epic Boons (level 19+). You have ${v}.`));
    if (v < 3) add(`score-low:${a.id}`, 'warning', T(`${abilityName(a.id)} demasiado baja`, `${abilityName(a.id)} too low`), T(`Con los métodos de creación la puntuación mínima es 3 (8 con compra de puntos). Tienes ${v}; ¿quizá se leyó el modificador en lugar de la puntuación?`, `With the creation methods the minimum score is 3 (8 with point buy). You have ${v}; maybe the modifier was read instead of the score?`));
  }

  // ---- Clase ----
  if (cls) {
    const expected = [...cls.saves].sort().join();
    if (c.saveProf.length && [...c.saveProf].sort().join() !== expected) {
      add('save-mismatch', 'warning', T('Salvaciones distintas a las de tu clase', 'Saves don’t match your class'),
        T(`${cls.name.es} es competente en salvaciones de ${cls.saves.map(abilityShort).join(' y ')}; tienes ${c.saveProf.map(abilityShort).join(', ')}. Al hacer multiclase solo cuentan las de la primera clase. Una dote como Resiliente añade otra.`,
          `${cls.name.en} is proficient in ${cls.saves.map(abilityShort).join(' and ')} saves; you have ${c.saveProf.map(abilityShort).join(', ')}. When multiclassing only the first class’s count. A feat such as Resilient adds another.`));
    }
    if (c.hitDie !== cls.hitDie) add('hitdie-mismatch', 'warning', T('Dado de golpe incorrecto', 'Wrong hit die'), T(`${cls.name.es} usa d${cls.hitDie} y la ficha tiene d${c.hitDie}.`, `${cls.name.en} uses d${cls.hitDie} and the sheet has d${c.hitDie}.`));

    // Puntos de golpe: máximo posible (todo dados al máximo) y mínimo (1 por nivel)
    const conPart = mods.con * c.level;
    const hpMaxPossible = cls.hitDie * c.level + conPart + (c.effects.reduce((s, e) => s + (e.mods.maxHp ?? 0), 0)) + 2 * c.level; // +2/nivel por la dote Duro
    if (c.hp.max > hpMaxPossible) add('hp-too-high', 'warning', T('Puntos de golpe máximos demasiado altos', 'Max HP too high'), T(`Con d${cls.hitDie}, nivel ${c.level} y CON ${mods.con >= 0 ? '+' : ''}${mods.con}, el máximo posible es ${hpMaxPossible} (incluso con la dote Duro). Tienes ${c.hp.max}.`, `With d${cls.hitDie}, level ${c.level} and CON ${mods.con >= 0 ? '+' : ''}${mods.con}, the most you can have is ${hpMaxPossible} (even with Tough). You have ${c.hp.max}.`));
    const fixed = cls.hitDie + mods.con + (c.level - 1) * (cls.hitDie / 2 + 1 + mods.con);
    if (c.hp.max < Math.max(c.level, Math.floor(fixed / 2))) add('hp-too-low', 'warning', T('Puntos de golpe máximos muy bajos', 'Max HP very low'), T(`Con valores fijos tendrías ${fixed} PG. Tienes ${c.hp.max}: revisa si falta algo.`, `With fixed values you’d have ${fixed} HP. You have ${c.hp.max}: check if something is missing.`));

    // Conjuros
    const caster = cls.caster !== 'none' || THIRD_CASTERS.test(c.subclass);
    if (cls.caster !== 'none' && !c.spellAbility) add('missing-spell-ability', 'error', T('Falta la característica de lanzamiento', 'Missing spellcasting ability'), T(`${cls.name.es} lanza conjuros con ${abilityName(cls.spellAbility!)}. Sin ella no se pueden calcular la CD ni el ataque de conjuro.`, `${cls.name.en} casts spells with ${abilityName(cls.spellAbility!)}. Without it the spell save DC and attack can’t be worked out.`));
    else if (cls.spellAbility && c.spellAbility && c.spellAbility !== cls.spellAbility) add('spell-ability-mismatch', 'warning', T('Característica de lanzamiento distinta', 'Different spellcasting ability'), T(`${cls.name.es} usa ${abilityName(cls.spellAbility)}, pero la ficha usa ${abilityName(c.spellAbility)}.`, `${cls.name.en} uses ${abilityName(cls.spellAbility)}, but the sheet uses ${abilityName(c.spellAbility)}.`));

    if (cls.caster === 'pact') {
      const pact = pactSlotsFor(c.level);
      if (!c.pactSlots || c.pactSlots.max === 0) add('missing-slots', 'warning', T('Faltan los espacios de pacto', 'Missing pact slots'), T(`A nivel ${c.level} un brujo tiene ${pact.max} espacio(s) de pacto de nivel ${pact.level}.`, `At level ${c.level} a warlock has ${pact.max} pact slot(s) of level ${pact.level}.`));
      else if (c.pactSlots.max > pact.max || c.pactSlots.level > pact.level) add('slots-too-many', 'warning', T('Demasiados espacios de pacto', 'Too many pact slots'), T(`A nivel ${c.level} corresponden ${pact.max} espacio(s) de nivel ${pact.level}; la ficha tiene ${c.pactSlots.max} de nivel ${c.pactSlots.level}.`, `At level ${c.level} you get ${pact.max} slot(s) of level ${pact.level}; the sheet has ${c.pactSlots.max} of level ${c.pactSlots.level}.`));
    } else if (cls.caster !== 'none') {
      const table = slotsFor(cls.caster, c.level);
      const total = c.slots.reduce((s, x) => s + x.max, 0);
      if (table.length && total === 0) add('missing-slots', 'warning', T('Faltan los espacios de conjuro', 'Missing spell slots'), T(`A nivel ${c.level} te corresponden: ${table.map((n, i) => `${n} de nv ${i + 1}`).join(', ')}.`, `At level ${c.level} you get: ${table.map((n, i) => `${n} of lvl ${i + 1}`).join(', ')}.`));
      else if (c.slots.some((s, i) => s.max > (table[i] ?? 0))) add('slots-too-many', 'warning', T('Más espacios de conjuro de lo normal', 'More spell slots than normal'), T(`La tabla de tu clase a nivel ${c.level} da ${table.map((n, i) => `${n}×nv${i + 1}`).join(', ') || 'ninguno'}. Si eres multiclase, ignora este aviso.`, `Your class table at level ${c.level} grants ${table.map((n, i) => `${n}×lvl${i + 1}`).join(', ') || 'none'}. If you multiclass, ignore this.`));
    }
    if (caster) {
      const top = Math.max(c.slots.reduce((m, s, i) => (s.max > 0 ? i + 1 : m), 0), c.pactSlots?.max ? c.pactSlots.level : 0);
      for (const sp of c.spells) {
        if (sp.level > 0 && sp.level > top) add(`spell-too-high:${fold(sp.name)}`, 'warning', T(`«${sp.name}» es de nivel demasiado alto`, `“${sp.name}” is too high a level`), T(`Es de nivel ${sp.level} y tu espacio más alto es de nivel ${top || 0}: aún no puedes lanzarlo.`, `It’s level ${sp.level} and your highest slot is level ${top || 0}: you can’t cast it yet.`));
        const info = findSpell(sp.name);
        if (info && info.level !== sp.level) add(`spell-level:${fold(sp.name)}`, 'info', T(`Nivel de «${sp.name}» distinto`, `“${sp.name}” level differs`), T(`En las reglas 2024 es de nivel ${info.level || 'truco'}; la ficha dice ${sp.level || 'truco'}.`, `In the 2024 rules it’s ${info.level ? `level ${info.level}` : 'a cantrip'}; the sheet says ${sp.level ? `level ${sp.level}` : 'cantrip'}.`));
      }
    } else if (c.spells.some((s) => s.level > 0)) {
      add('noncaster-spells', 'info', T('Conjuros en una clase sin magia', 'Spells on a non-caster class'), T(`${cls.name.es} no lanza conjuros por sí misma. Es correcto si vienen de una subclase (Caballero arcano, Embaucador arcano), una dote como Iniciado en la magia o tu especie.`, `${cls.name.en} doesn’t cast spells on its own. That’s fine if they come from a subclass (Eldritch Knight, Arcane Trickster), a feat such as Magic Initiate or your species.`));
    }

    // Pericia
    const expertise = Object.entries(c.skillProf).filter(([, p]) => p === 2).map(([id]) => id);
    const expLevel = EXPERTISE_AT[cls.id];
    if (expertise.length && (expLevel == null || c.level < expLevel)) add('expertise', 'info', T('Pericia sin rasgo de clase', 'Expertise without a class feature'), T(`Tienes pericia en ${expertise.map(skillName).join(', ')}, pero ${cls.name.es} no la da${expLevel ? ` hasta nivel ${expLevel}` : ''}. Es correcto si viene de una dote (Habilidoso no; Experto en habilidades sí) o de tu especie.`, `You have expertise in ${expertise.map(skillName).join(', ')}, but ${cls.name.en} doesn’t grant it${expLevel ? ` until level ${expLevel}` : ''}. That’s fine if it comes from a feat (e.g. Skill Expert) or your species.`));
  }

  // ---- Experiencia y nivel ----
  if (c.level < 20 && c.xp >= XP_TABLE[c.level]) add(`level-up:${c.level + 1}`, 'info', T(`¡Puedes subir a nivel ${c.level + 1}!`, `You can level up to ${c.level + 1}!`), T(`Tienes ${c.xp} PX y el nivel ${c.level + 1} requiere ${XP_TABLE[c.level]}. Súbelo en «Más opciones».`, `You have ${c.xp} XP and level ${c.level + 1} needs ${XP_TABLE[c.level]}. Level up in “More options”.`));
  if (c.xp > 0 && c.xp < XP_TABLE[c.level - 1]) add('xp-below-level', 'info', T('Poca experiencia para tu nivel', 'Low XP for your level'), T(`El nivel ${c.level} requiere ${XP_TABLE[c.level - 1]} PX y tienes ${c.xp}. Ignóralo si tu mesa usa hitos en lugar de experiencia.`, `Level ${c.level} needs ${XP_TABLE[c.level - 1]} XP and you have ${c.xp}. Ignore this if your table uses milestones.`));

  // ---- Especie y equipo ----
  const sp = fold(c.species);
  const size = fold(c.size);
  if (size && SMALL_SPECIES.test(sp) && /mediano|medium/.test(size)) add('size-mismatch', 'info', T('Tamaño distinto al de tu especie', 'Size differs from your species'), T(`Los ${c.species} son Pequeños en las reglas 2024.`, `${c.species} are Small in the 2024 rules.`));
  if (size && MEDIUM_ONLY.test(sp) && /pequeno|small/.test(size)) add('size-mismatch', 'info', T('Tamaño distinto al de tu especie', 'Size differs from your species'), T(`Los ${c.species} son Medianos en las reglas 2024.`, `${c.species} are Medium in the 2024 rules.`));
  if (/\b(goliat|goliath)\b/.test(sp) && c.speed < 35) add('speed-species', 'info', T('Velocidad baja para tu especie', 'Low speed for your species'), T('Los goliat tienen 35 pies de Velocidad en las reglas 2024.', 'Goliaths have a 35-foot Speed in the 2024 rules.'));
  if (/(wood elf|elfo de los bosques)/.test(sp) && c.speed < 35) add('speed-species', 'info', T('Velocidad baja para tu especie', 'Low speed for your species'), T('Los elfos de los bosques tienen 35 pies de Velocidad.', 'Wood elves have a 35-foot Speed.'));
  if (c.shield && !c.armorTraining.shields) add('shield-untrained', 'warning', T('Escudo sin entrenamiento', 'Shield without training'), T('Sin entrenamiento con escudos no ganas su +2 a la CA. Marca el entrenamiento o quita el escudo.', 'Without Shield training you don’t get its +2 AC. Tick the training or remove the shield.'));
  if (c.armorTraining.heavy && mod(c.abilities.str) < 0 && /placas|plate|bandas|splint/.test(fold(c.acNote + ' ' + c.inventory))) add('heavy-armor-str', 'info', T('Armadura pesada con poca Fuerza', 'Heavy armor with low Strength'), T('Las armaduras de bandas y placas piden FUE 15; sin ella tu Velocidad baja 10 pies.', 'Splint and Plate armor require STR 15; without it your Speed drops by 10 feet.'));

  return out;
}

/** Avisos visibles (sin los ignorados) */
export const activeFlags = (c: Character) => validate(c).filter((f) => !c.ignoredFlags.includes(f.id));

