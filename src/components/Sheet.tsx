import { createPortal } from 'react-dom';
import { useState, type ReactNode } from 'react';
import { useChar, useStore } from '../store';
import {
  abilityMods, activeReminders, armorClass, checkBonus, fmt, initiativeBonus, maxHp, maxHpParts, mod, passivePerception, profBonus, rollContext, saveBonus,
  saveProficient, skillBonus, speed, spellAttack, spellSaveDc, targetOf, weaponAttack, weaponDamageFlat, attackParts, effectDice, exhaustionPart, passiveParts, spellParts, type Part, type RollKind,
} from '../rules/calc';
import { activeRules, adjKey, adjText, adjValue, ruleMods, type RollTarget } from '../rules/bonuses';
import { abilityScores, attackExtras, hpExtras, speedExtras } from '../rules/gear';
import {
  ABILITIES, CLASSES, CONDITIONS, DAMAGE_TYPES, EFFECT_PRESETS, MASTERIES, SIZES, SKILLS, SPECIES, abilityName, abilityShort,
  damageTypeName, effectName, effectNotes, findMastery, resourceName,
} from '../rules/srd';
import { uid } from '../rules/factory';
import type { Ability, Attack, BonusAdj, Character, ConditionId, DamageType, ProfLevel, Spell } from '../types';
import { GearPlus, Modal, NumberInput, Pips, pickFiles, useRoll } from './common';
import { HpModal } from './Hp';
import { Editor } from './Editor';
import { ImportModal } from './Import';
import { L, T } from '../i18n';
import { imageFileToBase64 } from '../importer';
import { ExplainModal, longPress } from './InfoBubble';
import { FlagsPanel } from './Flags';
import { LevelUpPage } from './LevelUp';
import { BackgroundField, ClassField, SpeciesField, SubclassField } from './Identity';
import { SuggestInput } from './Suggest';
import { physicalLine } from '../rules/avatar';
import { AvailablePicker, FeatureCounter } from './Available';
import { featureLimits } from '../rules/classFit';
import { useAvatarEditor } from '../features';
import { spellCounts, spellLimits, spellUse } from '../rules/spellLimits';
import { confirmDelete } from './Confirm';
import { Consumables } from './Consumables';
import { CoinsTotal, ItemsBox } from './Treasure';
import { OriginPicker } from './OriginPicker';
import { hitDiceText } from '../rules/multiclass';
import { featureSuggestions, spellSuggestions } from '../rules/suggest';
import { useFx } from './Transition';
import { findSpell, spellComponents } from '../rules/spells';
import { RECHARGE_LABEL, rechargeOf } from '../rules/progression';
import type { Recharge } from '../types';

// ---------- Piezas con aspecto de hoja de papel ----------

function Box({ title, className, children, right }: { title?: string; className?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className={`p-box ${className ?? ''}`}>
      {title && <div className="p-title"><span>{title}</span>{right}</div>}
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, list }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; list?: string }) {
  return (
    <label className="p-field">
      <input value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
    </label>
  );
}

/** Texto largo con botón para abrirlo en grande */
function Area({ value, onChange, placeholder, rows = 4, title }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; title?: string }) {
  const [big, setBig] = useState(false);
  return (
    <div className="p-area-wrap">
      <textarea className="p-area" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="p-area-expand" onClick={() => setBig(true)} aria-label={T('Abrir en grande', 'Open large')} title={T('Abrir en grande', 'Open large')}>⤢</button>
      {big && createPortal(
        <div className="area-big" role="dialog" aria-label={title ?? T('Texto', 'Text')}>
          <div className="area-big-head"><b>{title ?? T('Texto', 'Text')}</b><button className="btn small primary" onClick={() => setBig(false)}>✓ {T('Listo', 'Done')}</button></div>
          <textarea autoFocus value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>,
        document.body,
      )}
    </div>
  );
}

function Diamond({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`p-diamond ${on ? 'on' : ''}`} onClick={onClick} aria-label={label} aria-pressed={on} />;
}

/** Algún rasgo (o un bonificador propio) suma o cambia esta tirada */
const hasExtra = (c: Character, t: RollTarget) => adjValue(c, t).value !== 0 || activeRules(c, t).some((r) => !r.item && !r.note && (r.bonus || r.minNatural || r.prof));
/** Un objeto equipado suma o da desventaja a esta tirada */
const hasItem = (c: Character, t: RollTarget) => activeRules(c, t).some((r) => r.item && (r.bonus || r.dis));


function ProfDot({ level, onClick, label }: { level: ProfLevel; onClick: () => void; label: string }) {
  return <button className={`p-dot ${level === 2 ? 'exp' : level === 1 ? 'on' : ''}`} onClick={onClick} aria-label={label} />;
}

/** Trucos y preparados que llevas frente a los que permite tu clase, con aviso si te pasas */
function SpellCounter() {
  const c = useChar();
  const lim = spellLimits(c);
  const n = spellCounts(c);
  if (!lim.caster && !n.cantrips && !n.prepared) return null;
  const overC = n.cantrips > lim.cantrips; const overP = n.prepared > lim.prepared;
  return (
    <div className="spell-counter">
      <span className={overC ? 'over' : ''}>{T('Trucos', 'Cantrips')} <b>{n.cantrips}/{lim.cantrips}</b></span>
      <span className={overP ? 'over' : ''}>{T('Preparados', 'Prepared')} <b>{n.prepared}/{lim.prepared}</b></span>
      <span className="muted">♾️ {T('a voluntad', 'at will')} · ✨ {T('espacios', 'slots')} · 🌙 {T('descanso largo', 'long rest')} · ⛺ {T('corto', 'short')}</span>
      {(overC || overP) && <p className="spell-over">⚠️ {lim.caster ? T(`Tu clase a este nivel permite ${lim.cantrips} trucos y ${lim.prepared} conjuros preparados (sin contar los de tu especie). Quita los que sobren.`, `At this level your class allows ${lim.cantrips} cantrips and ${lim.prepared} prepared spells (not counting species spells). Remove the extra ones.`) : T('Tu clase no lanza conjuros: solo puedes tener los que te dé tu especie o una dote.', 'Your class doesn’t cast spells: you can only have those from your species or a feat.')}</p>}
    </div>
  );
}

// ---------- Hoja ----------

export function SheetTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const avatarOn = useAvatarEditor();
  const run = useStore((s) => s.runCommands);
  const tapToRoll = useStore((s) => s.settings.tapToRoll);
  const roll = useRoll();
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [levelUp, setLevelUp] = useState(false);
  const [origin, setOrigin] = useState(false);
  const [hpOpen, setHpOpen] = useState(false);
  const [statInfo, setStatInfo] = useState<{ ability: Ability; skill?: string; save?: boolean; init?: boolean } | null>(null);
  const [info, setInfo] = useState<{ title: string; lines: string[] } | null>(null);
  const [extras, setExtras] = useState<'hp' | 'speed' | null>(null);
  const [parts, setParts] = useState<{ title: string; parts: Part[]; total: string; hint?: string } | null>(null);
  const [condOpen, setCondOpen] = useState(false);
  const [effOpen, setEffOpen] = useState(false);
  const [attackEdit, setAttackEdit] = useState<string | null>(null);
  const [spellEdit, setSpellEdit] = useState<string | null>(null);
  const [spellInfo, setSpellInfo] = useState<string | null>(null);
  const [featInfo, setFeatInfo] = useState<string | null>(null);
  const [featEdit, setFeatEdit] = useState<string | null>(null);
  const [browse, setBrowse] = useState<'spell' | 'feature' | null>(null);

  if (editing) return <Editor onDone={() => setEditing(false)} />;

  const set = (fn: (x: Character) => void) => update(fn);
  const m = abilityMods(c);
  const pb = profBonus(c.level);
  const ac = armorClass(c);
  const spd = speed(c);
  const reminders = activeReminders(c);
  const abSrc = abilityScores(c);
  const hpX = hpExtras(c, true);

  // Tocar una estadística: tira el dado solo si el usuario lo ha activado en Ajustes
  const tapStat = (ability: Ability, opts: { skill?: string; save?: boolean } = {}) => {
    if (!tapToRoll) return setStatInfo({ ability, ...opts });
    if (opts.save) roll(c, { kind: 'save', ability }, saveBonus(c, ability), T(`Salvación de ${abilityShort(ability)}`, `${abilityShort(ability)} save`));
    else if (opts.skill) {
      const s = SKILLS.find((x) => x.id === opts.skill)!;
      roll(c, { kind: 'check', ability, skill: s.id }, skillBonus(c, s.id), L(s.name));
    } else roll(c, { kind: 'check', ability }, checkBonus(c, ability), T(`Prueba de ${abilityName(ability)}`, `${abilityName(ability)} check`));
  };

  const cycleSkill = (id: string) => set((x) => { x.skillProf[id] = (((x.skillProf[id] ?? 0) + 1) % 3) as ProfLevel; });
  const toggleSave = (a: Ability) => set((x) => { x.saveProf = x.saveProf.includes(a) ? x.saveProf.filter((y) => y !== a) : [...x.saveProf, a]; });


  const uploadPortrait = async () => {
    const [file] = await pickFiles('image/*', false);
    if (!file) return;
    const data = await imageFileToBase64(file, 640, 0.82);
    set((x) => { x.portrait = `data:image/jpeg;base64,${data}`; x.portraitThumb = undefined; });
  };

  const abilityBox = (a: Ability) => {
    const skills = SKILLS.filter((s) => s.ability === a);
    const saveCtx = rollContext(c, { kind: 'save', ability: a });
    return (
      <Box key={a} title={abilityName(a)} className="p-ability">
        <div className="p-ab-top">
          <button className="p-ab-mod" {...longPress({ type: 'ability', ability: a })} onClick={() => tapStat(a)} aria-label={`${abilityName(a)} ${fmt(m[a])}`}>{fmt(m[a])}{abSrc.sources[a].length > 0 && <GearPlus title={abSrc.sources[a].map((x) => x.text).join(' · ')} />}</button>
          {abSrc.scores[a] !== c.abilities[a] && <span className="p-ab-eff" title={abSrc.sources[a].map((x) => x.text).join(' · ')}>→ {abSrc.scores[a]}</span>}
          <NumberInput className="p-ab-score" value={c.abilities[a]} min={1} max={30} ariaLabel={T(`Puntuación de ${abilityName(a)}`, `${abilityName(a)} score`)} onChange={(n) => set((x) => { x.abilities[a] = Math.max(1, Math.min(30, n)); })} />
        </div>
        <div className="p-row save">
          <ProfDot level={saveProficient(c, a) ? 1 : 0} onClick={() => toggleSave(a)} label={T('Competencia en salvación', 'Saving throw proficiency')} />
          <span className="p-bonus">{fmt(saveBonus(c, a))}</span>
          <button className="p-row-name" {...longPress({ type: 'save', ability: a })} onClick={() => tapStat(a, { save: true })}>
            {T('Tirada de salvación', 'Saving Throw')}
 {hasItem(c, { kind: 'save', ability: a }) && <i className="tag gear" title={T('Un objeto equipado lo cambia', 'An equipped item changes it')}>+</i>}
            {hasExtra(c, { kind: 'save', ability: a }) && <i className="tag plus" title={T('Suma un rasgo o un bonificador propio', 'A feature or custom bonus adds to it')}>✦</i>}
            {saveCtx.autoFail.length > 0 && <i className="tag bad">✕</i>}
            {saveCtx.advantage.length > 0 && <i className="tag good">V</i>}
            {saveCtx.disadvantage.length > 0 && <i className="tag bad">D</i>}
          </button>
        </div>
        {skills.map((s) => {
          const ctx = rollContext(c, { kind: 'check', ability: a, skill: s.id });
          return (
            <div key={s.id} className="p-row">
              <ProfDot level={c.skillProf[s.id] ?? 0} onClick={() => cycleSkill(s.id)} label={T(`Competencia en ${L(s.name)}`, `${L(s.name)} proficiency`)} />
              <span className="p-bonus">{fmt(skillBonus(c, s.id))}</span>
              <button className="p-row-name" {...longPress({ type: 'skill', id: s.id })} onClick={() => tapStat(a, { skill: s.id })}>
                {L(s.name)}
                {hasItem(c, { kind: 'skill', id: s.id }) && <i className="tag gear" title={T('Un objeto equipado lo cambia', 'An equipped item changes it')}>+</i>}
                {hasExtra(c, { kind: 'skill', id: s.id }) && <i className="tag plus" title={T('Suma un rasgo o un bonificador propio', 'A feature or custom bonus adds to it')}>✦</i>}
                {ctx.autoFail.length > 0 && <i className="tag bad">!</i>}
                {ctx.advantage.length > 0 && <i className="tag good">V</i>}
                {ctx.disadvantage.length > 0 && <i className="tag bad">D</i>}
              </button>
            </div>
          );
        })}
      </Box>
    );
  };

  return (
    <div className="tab sheet-tab">
      <div className="sheet-toolbar">
        <button className="btn small primary lvlup-btn" disabled={c.level >= 20} onClick={() => { useFx.getState().play('levelup', undefined, T(`Nivel ${c.level} → ${c.level + 1}`, `Level ${c.level} → ${c.level + 1}`)); setLevelUp(true); }}>⬆️ {T('Subir de nivel', 'Level up')}</button>
        <button className={`btn small ${c.level === 1 ? 'primary' : ''}`} onClick={() => setOrigin(true)}>🎓 {T('Origen y habilidades', 'Origin & skills')}</button>
        <button className="btn small" onClick={() => setImporting(true)}>📥 {T('Importar ficha', 'Import sheet')}</button>
        <button className="btn small" onClick={() => setEditing(true)}>⚙️ {T('Más opciones', 'More options')}</button>
      </div>

      <FlagsPanel />

      {reminders.length > 0 && (
        <div className="reminders">{reminders.map((r, i) => <div key={i}>⚠️ {r}</div>)}</div>
      )}

      <datalist id="dl-species">{SPECIES.map((s) => <option key={s.es} value={L(s)} />)}</datalist>
      <datalist id="dl-classes">{CLASSES.map((k) => <option key={k.id} value={L(k.name)} />)}</datalist>
      <datalist id="dl-sizes">{SIZES.map((s) => <option key={s.es} value={L(s)} />)}</datalist>

      <div className="sheet-pages">
      {/* ===================== PÁGINA 1 ===================== */}
      <div className="paper">
        <div className="p-header">
          <Box className="p-identity">
            <div className="p-ident-top">
              {c.portrait && <img className="p-avatar" src={c.portrait} alt="" onClick={uploadPortrait} />}
              <Field label={T('Nombre del personaje', 'Character name')} value={c.name} onChange={(v) => set((x) => { x.name = v; })} />
            </div>
            <div className="p-grid2">
              <BackgroundField />
              <ClassField />
              <SpeciesField />
              <SubclassField />
            </div>
          </Box>

          <div className="p-header-stats">
            <div className="p-level">
              <NumberInput className="p-level-num" value={c.level} min={1} max={20} ariaLabel={T('Nivel', 'Level')} onChange={(n) => set((x) => { x.level = Math.max(1, Math.min(20, n)); })} />
              <span>{T('Nivel', 'Level')}</span>
              <NumberInput className="p-xp" value={c.xp} min={0} ariaLabel={T('Puntos de experiencia', 'Experience points')} onChange={(n) => set((x) => { x.xp = Math.max(0, n); })} />
              <span>{T('PX', 'XP')}</span>
            </div>

            <div className="p-shield">
              <span className="p-mini">{T('Clase de armadura', 'Armor Class')}</span>
              <button className="p-ac" onClick={() => setInfo({ title: `${T('CA', 'AC')} ${ac.value}`, lines: ac.parts })}>{ac.value}{ac.gear.length > 0 && <GearPlus title={ac.gear.join(' · ')} />}</button>
              <label className="p-shield-toggle">
                <Diamond on={c.shield} onClick={() => set((x) => { x.shield = !x.shield; })} label={T('Escudo', 'Shield')} />
                <span>{T('Escudo', 'Shield')}</span>
              </label>
            </div>

            <Box title={T('Puntos de golpe', 'Hit Points')} className="p-hp">
              <div className="p-hp-grid">
                <button className="p-hp-current" onClick={() => setHpOpen(true)}>
                  <b>{c.dead ? '☠️' : c.hp.current + c.hp.temp}</b>
                  <span>{c.hp.temp > 0 && !c.dead ? `${c.hp.current} + ${c.hp.temp} ${T('temp.', 'temp')}` : T('Actuales', 'Current')}</span>
                </button>
                <label className="p-hp-small">
                  <NumberInput value={c.hp.temp} min={0} onChange={(n) => set((x) => { x.hp.temp = Math.max(0, n); })} />
                  <span>{T('Temp.', 'Temp')}</span>
                </label>
                <label className="p-hp-small">
                  <NumberInput value={c.hp.max} min={1} onChange={(n) => set((x) => { x.hp.max = Math.max(1, n); x.hp.current = Math.min(x.hp.current, maxHp({ ...x, hp: { ...x.hp, max: Math.max(1, n) } })); })} />
                  <span>{T('Máx.', 'Max')}<button className="gear-plus-btn" aria-label={T('Cómo se calculan los PG máximos', 'How max HP is calculated')} onClick={(e) => { e.preventDefault(); setExtras('hp'); }}>{maxHp(c) !== c.hp.max ? <><GearPlus item={hpX.some((x) => x.item && !x.off)} title={maxHpParts(c).slice(1).map((x) => x.label).join(' · ')} /> {fmt(maxHp(c) - c.hp.max)}</> : 'ℹ️'}</button></span>
                </label>
              </div>
            </Box>

            <Box title={T('Dados de golpe', 'Hit Dice')} className="p-hd">
              <label className="p-hp-small">
                <NumberInput value={c.hitDiceSpent} min={0} max={c.level} onChange={(n) => set((x) => { x.hitDiceSpent = Math.max(0, Math.min(x.level, n)); })} />
                <span>{T('Gastados', 'Spent')}</span>
              </label>
              <div className="p-hd-max">{hitDiceText(c)}<span>{T('Máx.', 'Max')}</span></div>
            </Box>

            <Box title={T('T. S. contra muerte', 'Death Saves')} className="p-death">
              <div className="p-death-row">
                {[0, 1, 2].map((i) => <Diamond key={i} on={c.deathSaves.success > i} label={T('Éxito', 'Success')} onClick={() => set((x) => { x.deathSaves.success = x.deathSaves.success > i ? i : i + 1; })} />)}
              </div>
              <span className="p-mini">{T('Éxitos', 'Successes')}</span>
              <div className="p-death-row">
                {[0, 1, 2].map((i) => <Diamond key={i} on={c.deathSaves.fail > i} label={T('Fallo', 'Failure')} onClick={() => set((x) => { x.deathSaves.fail = x.deathSaves.fail > i ? i : i + 1; })} />)}
              </div>
              <span className="p-mini">{T('Fallos', 'Failures')}</span>
            </Box>
          </div>
        </div>

        <div className="p-banner">DUNGEONS <span>&amp;</span> DRAGONS · {T('Hoja de personaje', 'Character Sheet')}</div>

        <div className="p-strip">
          <Box title={T('Bonif. competencia', 'Proficiency Bonus')}><button className="p-big" onClick={() => setParts({ title: T(`Bonificador de competencia ${fmt(pb)}`, `Proficiency Bonus ${fmt(pb)}`), parts: [{ label: T(`Nivel de personaje ${c.level}`, `Character level ${c.level}`), value: fmt(pb) }], total: fmt(pb), hint: T('Niveles 1-4: +2 · 5-8: +3 · 9-12: +4 · 13-16: +5 · 17-20: +6. Se suma a lo que dominas: habilidades y salvaciones con competencia, ataques con armas que dominas y conjuros. La pericia lo suma dos veces.', 'Levels 1-4: +2 · 5-8: +3 · 9-12: +4 · 13-16: +5 · 17-20: +6. It’s added to what you’re proficient in: skills and saves, attacks with weapons you’re proficient with, and spells. Expertise adds it twice.') })}>{fmt(pb)}</button></Box>
          <Box title={T('Iniciativa', 'Initiative')}>
            <button className="p-big" onClick={() => (tapToRoll ? run(T('Tiro iniciativa', 'Roll initiative'), [{ type: 'rollInitiative' }]) : setStatInfo({ ability: 'dex', init: true }))}>{fmt(initiativeBonus(c))}</button>
          </Box>
          <Box title={T('Velocidad', 'Speed')}><button className="p-big" onClick={() => setExtras('speed')}>{spd.value}{spd.gear.length > 0 && <GearPlus title={spd.gear.join(' · ')} />}</button></Box>
          <Box title={T('Tamaño', 'Size')}><input className="p-big-input" list="dl-sizes" value={c.size} onChange={(e) => set((x) => { x.size = e.target.value; })} /></Box>
          <Box title={T('Percepción pasiva', 'Passive Perception')}><button className="p-big" onClick={() => { const pp = passiveParts(c); setParts({ title: T(`Percepción pasiva ${pp.total}`, `Passive Perception ${pp.total}`), parts: pp.parts, total: String(pp.total), hint: T('Es lo que notas sin buscar activamente: el DM la compara con el Sigilo de quien se esconde. Con ventaja en Percepción suma 5; con desventaja resta 5.', 'It’s what you notice without actively searching: the DM compares it with the Stealth of anyone hiding. With Advantage on Perception add 5; with Disadvantage subtract 5.') }); }}>{passivePerception(c)}</button></Box>
        </div>

        <div className="p-body">
          <div className="p-abilities">
            <div className="p-col">
              {abilityBox('str')}
              {abilityBox('dex')}
              {abilityBox('con')}
              <Box title={T('Inspiración heroica', 'Heroic Inspiration')} className="p-inspiration">
                <Diamond on={c.heroicInspiration} label={T('Inspiración heroica', 'Heroic Inspiration')} onClick={() => run(null, [{ type: 'inspiration', value: !c.heroicInspiration }])} />
              </Box>
            </div>
            <div className="p-col">
              {abilityBox('int')}
              {abilityBox('wis')}
              {abilityBox('cha')}
            </div>
          </div>

          <div className="p-right">
            <Box title={T('Armas y trucos de daño', 'Weapons & Damage Cantrips')} right={<button className="p-add" onClick={() => { const id = uid(); set((x) => { x.attacks.push({ id, name: '', ability: 'str', proficient: true, damage: '1d6', damageType: 'cortante', range: '', extraBonus: 0 }); }); setAttackEdit(id); }}>+</button>}>
              <table className="p-table">
                <thead>
                  <tr><th>{T('Nombre', 'Name')}</th><th>{T('Bonif. at./CD', 'Atk Bonus/DC')}</th><th>{T('Daño y tipo', 'Damage & Type')}</th><th>{T('Notas', 'Notes')}</th><th aria-label={T('Borrar', 'Delete')}></th></tr>
                </thead>
                <tbody>
                  {c.attacks.map((a) => {
                    const flat = weaponDamageFlat(c, a);
                    const ax = attackExtras(c, a);
                    return (
                      <tr key={a.id} {...longPress({ type: 'attack', id: a.id })} onClick={() => setAttackEdit(a.id)}>
                        <td><b>{a.name || '—'}</b></td>
                        <td>{fmt(weaponAttack(c, a))}{(ax.attack.length > 0 || ax.damage.length > 0 || abSrc.sources[a.ability].length > 0) && <GearPlus title={[...ax.attack, ...ax.damage, ...abSrc.sources[a.ability]].map((x) => x.text).join(' · ')} />}</td>
                        <td>{a.damage}{flat ? fmt(flat) : ''} {damageTypeName(a.damageType).toLowerCase()}</td>
                        <td className="p-notes">{[a.range, findMastery(a.mastery) ? L(findMastery(a.mastery)!.name) : '', a.notes].filter(Boolean).join(' · ')}</td>
                        <td className="p-trash-cell"><button className="p-trash" aria-label={T(`Borrar ${a.name}`, `Delete ${a.name}`)} onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(a.name || T('arma', 'weapon'))) set((x) => { x.attacks = x.attacks.filter((y) => y.id !== a.id); }); }}>🗑</button></td>
                      </tr>
                    );
                  })}
                  {c.attacks.length === 0 && <tr><td colSpan={5} className="p-empty">{T('Toca + para añadir un arma', 'Tap + to add a weapon')}</td></tr>}
                </tbody>
              </table>
            </Box>

            <Box title={T('Rasgos de clase', 'Class Features')} right={<span className="p-title-actions"><button className="p-add" onClick={() => setBrowse('feature')}>📖 {T('Disponibles', 'Available')}</button><button className="p-add" aria-label={T('Añadir rasgo a mano', 'Add feature by hand')} onClick={() => { const id = uid(); set((x) => { x.features.push({ id, name: '', text: '' }); }); setFeatEdit(id); }}>+</button></span>}>
              {c.features.length === 0 && <p className="p-empty">{T('Sin rasgos.', 'No features.')}</p>}
              {c.features.map((f) => (
                <div key={f.id} className="p-feature-row">
                <button className="p-feature" {...longPress({ type: 'feature', id: f.id })} onClick={() => (f.name ? setFeatInfo(f.id) : setFeatEdit(f.id))}>
                  <b>{f.name || T('Nuevo rasgo', 'New feature')}{featureRecharge(c, f) && <span className="recharge-tag">{L(RECHARGE_LABEL[featureRecharge(c, f)!])}</span>}</b>
                  {f.text && <span className="p-feature-text">{f.text}</span>}
                </button>
                <button className="p-trash" aria-label={T(`Borrar ${f.name}`, `Delete ${f.name}`)} onClick={async () => { if (await confirmDelete(f.name || T('rasgo', 'feature'))) set((x) => { x.features = x.features.filter((y) => y.id !== f.id); }); }}>🗑</button>
                </div>
              ))}
              <FeatureCounter limits={featureLimits(c)} />
            </Box>

            <div className="p-grid2">
              <Box title={T('Atributos de especie', 'Species Traits')}><Area title={T('Atributos de especie', 'Species Traits')} value={c.speciesTraits} onChange={(v) => set((x) => { x.speciesTraits = v; })} /></Box>
              <Box title={T('Dotes', 'Feats')}><Area title={T('Dotes', 'Feats')} value={c.feats} onChange={(v) => set((x) => { x.feats = v; })} /></Box>
            </div>

            <Box title={T('Estado y recursos', 'Status & Resources')} className="p-status" right={<span className="p-title-actions"><button className="p-add" onClick={() => setCondOpen(true)}>{T('+ Condición', '+ Condition')}</button><button className="p-add" onClick={() => setEffOpen(true)}>{T('+ Efecto', '+ Effect')}</button></span>}>
              <div className="chips">
                {c.conditions.length === 0 && c.effects.length === 0 && <span className="p-empty">{T('Sin condiciones ni efectos activos.', 'No active conditions or effects.')}</span>}
                {c.conditions.map((id) => {
                  const ci = CONDITIONS.find((x) => x.id === id)!;
                  return (
                    <span key={id} className="chip bad">
                      <button className="chip-label" {...longPress({ type: 'condition', id })} onClick={() => setInfo({ title: L(ci.name), lines: ci.effects.map(L) })}>{L(ci.name)}</button>
                      <button className="chip-x" aria-label={T(`Quitar ${L(ci.name)}`, `Remove ${L(ci.name)}`)} onClick={() => run(null, [{ type: 'removeCondition', condition: id }])}>✕</button>
                    </span>
                  );
                })}
                {c.effects.map((e) => (
                  <span key={e.id} className={`chip ${e.kind === 'buff' ? 'good' : 'bad'}`}>
                    <button className="chip-label" {...longPress({ type: 'effect', id: e.id })} onClick={() => setInfo({ title: effectName(e), lines: [effectNotes(e), e.roundsLeft != null ? T(`Quedan ${e.roundsLeft} rondas.`, `${e.roundsLeft} rounds left.`) : ''].filter(Boolean) })}>
                      {effectName(e)}{e.roundsLeft != null ? ` · ${e.roundsLeft}r` : ''}
                    </button>
                    <button className="chip-x" aria-label={T(`Quitar ${effectName(e)}`, `Remove ${effectName(e)}`)} onClick={() => run(null, [{ type: 'removeEffect', name: effectName(e) }])}>✕</button>
                  </span>
                ))}
              </div>
              <div className="p-res-line">
                <span className="grow">{T('Agotamiento', 'Exhaustion')}</span>
                <button className="p-step" disabled={c.exhaustion === 0} onClick={() => run(null, [{ type: 'exhaustion', delta: -1 }])}>−</button>
                <b>{c.exhaustion}</b>
                <button className="p-step" onClick={() => run(null, [{ type: 'exhaustion', delta: 1 }])}>+</button>
              </div>
              {c.concentratingOn && (
                <div className="p-res-line">
                  <span className="grow">🧠 {T('Concentración', 'Concentration')}: <b>{c.concentratingOn}</b></span>
                  <button className="p-link" onClick={() => run(null, [{ type: 'endConcentration' }])}>{T('Terminar', 'End')}</button>
                </div>
              )}
              {c.resources.map((r) => (
                <div key={r.id} className="p-res-line">
                  <span className="grow" {...longPress({ type: 'resource', id: r.id })}>{resourceName(r)} <span className="p-mini">({r.recovers === 'short' ? T('desc. corto', 'short rest') : T('desc. largo', 'long rest')})</span></span>
                  {r.max <= 10 ? (
                    <Pips shape="diamond" max={r.max} used={r.used} onChange={(u) => set((x) => { x.resources.find((y) => y.id === r.id)!.used = u; })} />
                  ) : (
                    <>
                      <button className="p-step" onClick={() => set((x) => { const y = x.resources.find((z) => z.id === r.id)!; y.used = Math.min(y.max, y.used + 1); })}>−</button>
                      <b>{r.max - r.used}/{r.max}</b>
                      <button className="p-step" onClick={() => set((x) => { const y = x.resources.find((z) => z.id === r.id)!; y.used = Math.max(0, y.used - 1); })}>+</button>
                    </>
                  )}
                </div>
              ))}
              <div className="row mt">
                <button className="p-btn grow" onClick={() => run(T('Descanso corto', 'Short rest'), [{ type: 'rest', kind: 'short', hitDice: 0 }])}>⛺ {T('Descanso corto', 'Short rest')}</button>
                <button className="p-btn grow" onClick={() => run(T('Descanso largo', 'Long rest'), [{ type: 'rest', kind: 'long' }])}>🌙 {T('Descanso largo', 'Long rest')}</button>
              </div>
              {c.hitDiceSpent < c.level && c.hp.current < maxHp(c) && (
                <button className="p-link mt" onClick={() => run(T('Gasto 1 dado de golpe', 'Spend 1 hit die'), [{ type: 'rest', kind: 'short', hitDice: 1 }])}>{T('Gastar 1 dado de golpe', 'Spend 1 hit die')}</button>
              )}
            </Box>
          </div>
        </div>

        <Box title={T('Entrenamiento y competencias con equipo', 'Equipment Training & Proficiencies')} className="p-training">
          <div className="p-armor">
            <span className="p-mini">{T('Armaduras', 'Armor Training')}</span>
            {(['light', 'medium', 'heavy', 'shields'] as const).map((k) => (
              <label key={k} className="p-armor-item">
                <Diamond on={c.armorTraining[k]} label={k} onClick={() => set((x) => { x.armorTraining[k] = !x.armorTraining[k]; })} />
                {{ light: T('Ligeras', 'Light'), medium: T('Medias', 'Medium'), heavy: T('Pesadas', 'Heavy'), shields: T('Escudos', 'Shields') }[k]}
              </label>
            ))}
          </div>
          <span className="p-mini">{T('Armas', 'Weapons')}</span>
          <Area title={T('Armas', 'Weapons')} rows={2} value={c.weaponProf} onChange={(v) => set((x) => { x.weaponProf = v; })} />
          <span className="p-mini">{T('Herramientas', 'Tools')}</span>
          <Area title={T('Herramientas', 'Tools')} rows={2} value={c.toolProf} onChange={(v) => set((x) => { x.toolProf = v; })} />
        </Box>
      </div>

      {/* ===================== PÁGINA 2 ===================== */}
      <div className="paper">
        <div className="p-page2-top">
          <Box className="p-spellcasting">
            <label className="p-field">
              <select value={c.spellAbility ?? ''} onChange={(e) => set((x) => { x.spellAbility = (e.target.value || null) as Ability | null; })}>
                <option value="">—</option>
                {ABILITIES.map((a) => <option key={a.id} value={a.id}>{L(a.short)}</option>)}
              </select>
              <span>{T('Aptitud mágica', 'Spellcasting Ability')}</span>
            </label>
            <div className="p-spell-stats">
              <div><b>{c.spellAbility ? fmt(m[c.spellAbility]) : '—'}</b><span>{T('Modificador por aptitud mágica', 'Spellcasting Modifier')}</span></div>
              <button className="p-stat-btn" disabled={!c.spellAbility} onClick={() => setParts({ title: T(`CD de salvación de conjuros ${spellSaveDc(c)}`, `Spell Save DC ${spellSaveDc(c)}`), parts: [{ label: T('Base', 'Base'), value: '8' }, ...spellParts(c)], total: String(spellSaveDc(c)), hint: T('Lo que tiene que igualar o superar el objetivo en su salvación contra tus conjuros.', 'What the target must meet or beat on its saving throw against your spells.') })}><b>{spellSaveDc(c) ?? '—'}</b><span>{T('CD de salvación de conjuros', 'Spell Save DC')}</span></button>
              <button className="p-stat-btn" disabled={!c.spellAbility} onClick={() => setParts({ title: T(`Ataque de conjuros ${fmt(spellAttack(c) ?? 0)}`, `Spell attack ${fmt(spellAttack(c) ?? 0)}`), parts: [...spellParts(c), ...effectDice(c, 'attack'), ...exhaustionPart(c)], total: fmt(spellAttack(c) ?? 0), hint: T('Se suma al d20 en los conjuros que hacen tirada de ataque. Los dados de efectos (Bendición…) y el agotamiento se aplican al tirar.', 'Added to the d20 for spells that make an attack roll. Effect dice (Bless…) and Exhaustion apply when you roll.') })}><b>{c.spellAbility ? fmt(spellAttack(c)!) : '—'}</b><span>{T('Bonificador de ataque de conjuros', 'Spell Attack Bonus')}</span></button>
            </div>
          </Box>

          <Box title={T('Espacios de conjuro', 'Spell Slots')} className="p-slots">
            <div className="p-slots-grid">
              {Array.from({ length: 9 }, (_, i) => {
                const s = c.slots[i] ?? { max: 0, used: 0 };
                return (
                  <div key={i} className="p-slot">
                    <span className="p-mini">{T('Nivel', 'Level')} {i + 1}</span>
                    <NumberInput className="p-slot-max" value={s.max} min={0} max={4} ariaLabel={T(`Espacios totales de nivel ${i + 1}`, `Total level ${i + 1} slots`)} onChange={(n) => set((x) => {
                      while (x.slots.length <= i) x.slots.push({ max: 0, used: 0 });
                      x.slots[i].max = Math.max(0, Math.min(4, n));
                      x.slots[i].used = Math.min(x.slots[i].used, x.slots[i].max);
                    })} />
                    <Pips shape="diamond" max={s.max} used={s.used} onChange={(u) => set((x) => { x.slots[i].used = u; })} />
                  </div>
                );
              })}
            </div>
            {c.pactSlots && (
              <div className="p-res-line">
                <span className="grow">{T('Magia del pacto', 'Pact Magic')} ({T('nivel', 'level')} {c.pactSlots.level})</span>
                <Pips shape="diamond" max={c.pactSlots.max} used={c.pactSlots.used} onChange={(u) => set((x) => { x.pactSlots!.used = u; })} />
              </div>
            )}
          </Box>
        </div>

        <div className="p-page2-body">
          <Box title={T('Trucos y conjuros preparados', 'Cantrips & Prepared Spells')} className="p-spells" right={<span className="p-title-actions"><button className="p-add" onClick={() => setBrowse('spell')}>📖 {T('Disponibles', 'Available')}</button><button className="p-add" aria-label={T('Añadir conjuro a mano', 'Add spell by hand')} onClick={() => { const id = uid(); set((x) => { x.spells.push({ id, name: '', level: 0, prepared: true, castingTime: T('Acción', 'Action'), range: '', concentration: false }); }); setSpellEdit(id); }}>+</button></span>}>
            <table className="p-table">
              <thead>
                <tr><th>{T('Nv', 'Lvl')}</th><th>{T('Nombre', 'Name')}</th><th>{T('Tiempo', 'Time')}</th><th>{T('Alcance', 'Range')}</th><th title={T('Componentes: V verbal, S somático, M material · C concentración · R ritual', 'Components: V verbal, S somatic, M material · C concentration · R ritual')}>{T('Comp.', 'Comp.')}</th><th aria-label={T('Borrar', 'Delete')}></th></tr>
              </thead>
              <tbody>
                {[...c.spells].sort((a, b) => a.level - b.level).map((s) => (
                  <tr key={s.id} {...longPress({ type: 'spell', id: s.id })} onClick={() => (s.name ? setSpellInfo(s.id) : setSpellEdit(s.id))}>
                    <td>{s.level || T('T', 'C')}</td>
                    <td><b>{s.name || '—'}</b>{s.name && (() => { const u = spellUse(c, s); return <span className={`spell-use ${u.warn ? 'warn' : ''}`} title={u.text} aria-label={u.text}>{u.icon}</span>; })()}{s.notes ? <div className="p-notes">{s.notes}</div> : null}</td>
                    <td>{s.castingTime}</td>
                    <td>{s.range}</td>
                    <td className="p-crm"><SpellComp sp={s} /></td>
                    <td className="p-trash-cell"><button className="p-trash" aria-label={T(`Borrar ${s.name}`, `Delete ${s.name}`)} onClick={async (e) => { e.stopPropagation(); if (await confirmDelete(s.name || T('conjuro', 'spell'))) set((x) => { x.spells = x.spells.filter((y) => y.id !== s.id); }); }}>🗑</button></td>
                  </tr>
                ))}
                {c.spells.length === 0 && <tr><td colSpan={6} className="p-empty">{T('Toca + para añadir un conjuro', 'Tap + to add a spell')}</td></tr>}
              </tbody>
            </table>
            <SpellCounter />
          </Box>

          <div className="p-side">
            <Box title={T('Aspecto', 'Appearance')} className="p-appearance">
              {c.portrait ? (
                <div className="p-portrait-wrap">
                  <img className={`p-portrait ${c.portrait.startsWith('data:image/png') ? 'pixel' : ''}`} src={c.portrait} alt={T('Retrato del personaje', 'Character portrait')} onClick={uploadPortrait} />
                  <button className="p-link" onClick={() => set((x) => { x.portrait = null; x.portraitThumb = undefined; })}>{T('Quitar imagen', 'Remove image')}</button>
                </div>
              ) : (
                <>
                  <button className="p-upload" onClick={uploadPortrait}>🖼️ {T('Subir imagen del personaje', 'Upload character image')}</button>
                  {avatarOn && <p className="hint">{T('O créalo en la pestaña 🎨 Aspecto.', 'Or make one in the 🎨 Looks tab.')}</p>}
                </>
              )}
              {physicalLine(c.physical) && <p className="p-phys muted">{physicalLine(c.physical)}</p>}
              <Area title={T('Aspecto', 'Appearance')} rows={3} value={c.appearance} onChange={(v) => set((x) => { x.appearance = v; })} />
            </Box>
            <Box title={T('Historia y personalidad', 'Backstory & Personality')}>
              <Area title={T('Historia y personalidad', 'Backstory & Personality')} rows={6} value={c.backstory} onChange={(v) => set((x) => { x.backstory = v; })} />
              <Field label={T('Alineamiento', 'Alignment')} value={c.alignment} onChange={(v) => set((x) => { x.alignment = v; })} />
            </Box>
            <Box title={T('Idiomas', 'Languages')}><Area title={T('Idiomas', 'Languages')} rows={2} value={c.languages} onChange={(v) => set((x) => { x.languages = v; })} /></Box>
            <Box title={T('Equipo', 'Equipment')}>
              <Area title={T('Equipo', 'Equipment')} rows={6} value={c.inventory} onChange={(v) => set((x) => { x.inventory = v; })} />
              <ItemsBox />
              <Consumables mode="sheet" />
              <span className="p-mini">{T('Sintonización con objetos mágicos', 'Magic Item Attunement')}</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-attune">
                  <span className={`p-diamond ${c.attunement[i] ? 'on' : ''}`} aria-hidden />
                  <input className="p-inline" value={c.attunement[i]} onChange={(e) => set((x) => { x.attunement[i] = e.target.value; })} />
                </div>
              ))}
            </Box>
            <Box title={T('Monedas', 'Coins')}>
              <div className="p-coins">
                {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((k) => (
                  <label key={k}>
                    <span>{{ cp: T('PC', 'CP'), sp: T('PP', 'SP'), ep: T('PE', 'EP'), gp: T('PO', 'GP'), pp: T('PPT', 'PP') }[k]}</span>
                    <NumberInput value={c.coins[k]} min={0} onChange={(n) => set((x) => { x.coins[k] = Math.max(0, n); })} />
                  </label>
                ))}
              </div>
              <CoinsTotal />
            </Box>
          </div>
        </div>
        <p className="p-legal">{T('Reglas basadas en el SRD 5.2 (CC-BY-4.0). Diseño inspirado en la hoja oficial 2024.', 'Rules based on SRD 5.2 (CC-BY-4.0). Layout inspired by the official 2024 sheet.')}</p>
      </div>
      </div>

      {hpOpen && <HpModal onClose={() => setHpOpen(false)} />}
      {levelUp && <LevelUpPage onClose={() => setLevelUp(false)} />}
      {origin && <OriginPicker onClose={() => setOrigin(false)} />}
      {extras && <ExtrasModal kind={extras} onClose={() => setExtras(null)} />}
      {parts && <PartsModal {...parts} onClose={() => setParts(null)} />}
      {statInfo && <StatInfoModal {...statInfo} onClose={() => setStatInfo(null)} />}
      {attackEdit && <AttackModal id={attackEdit} onClose={() => setAttackEdit(null)} />}
      {spellEdit && <SpellModal id={spellEdit} onClose={() => setSpellEdit(null)} />}
      {spellInfo && <ExplainModal target={{ type: 'spell', id: spellInfo }} onClose={() => setSpellInfo(null)} onEdit={() => { setSpellEdit(spellInfo); setSpellInfo(null); }} />}
      {featInfo && <ExplainModal target={{ type: 'feature', id: featInfo }} onClose={() => setFeatInfo(null)} onEdit={() => { setFeatEdit(featInfo); setFeatInfo(null); }} />}
      {featEdit && <FeatureModal id={featEdit} onClose={() => setFeatEdit(null)} />}
      {browse && <AvailablePicker kind={browse} onClose={() => setBrowse(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {condOpen && (
        <Modal title={T('Añadir condición', 'Add condition')} onClose={() => setCondOpen(false)}>
          <div className="pick-list">
            {CONDITIONS.map((x) => (
              <button key={x.id} className="pick" disabled={c.conditions.includes(x.id)} onClick={() => { run(null, [{ type: 'addCondition', condition: x.id as ConditionId }]); setCondOpen(false); }}>
                <b>{L(x.name)}</b><span className="small muted">{L(x.short)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {effOpen && <EffectPicker onClose={() => setEffOpen(false)} />}
      {info && (
        <Modal title={info.title} onClose={() => setInfo(null)}>
          {info.lines.map((l, i) => <p key={i}>{l}</p>)}
        </Modal>
      )}
    </div>
  );
}

/** PG máximos o velocidad: la base de la hoja y lo que suman rasgos, dotes y objetos (los rasgos se pueden desmarcar) */
function ExtrasModal({ kind, onClose }: { kind: 'hp' | 'speed'; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const toggle = (id: string) => update((x) => { const off = new Set(x.rulesOff ?? []); if (off.has(id)) off.delete(id); else off.add(id); x.rulesOff = [...off]; });
  const removeTemp = (id: string) => update((x) => { x.hpMaxMods = (x.hpMaxMods ?? []).filter((m) => m.id !== id); x.hp.current = Math.min(x.hp.current, maxHp(x)); });
  if (kind === 'hp') {
    const parts = maxHpParts(c);
    const total = maxHp(c);
    return (
      <Modal title={T(`PG máximos: ${total}`, `Max HP: ${total}`)} onClose={onClose}>
        <div className="rule-list">
          {parts.map((x, i) => (
            <div key={`${x.kind}-${x.id ?? i}`} className={`rule-item ${x.off ? 'off' : ''}`}>
              {x.kind === 'trait' && x.id ? <input type="checkbox" checked={!x.off} onChange={() => toggle(x.id!)} aria-label={x.label} />
                : x.kind === 'item' ? <GearPlus />
                : x.kind === 'temp' ? <button className="btn small" aria-label={T('Quitar', 'Remove')} onClick={() => removeTemp(x.id!)}>✕</button>
                : <span className="rule-dot">{x.kind === 'effect' ? '✨' : '❤️'}</span>}
              <span className="grow">{x.label}</span>
              <b className={x.value < 0 ? 'neg' : ''}>{i === 0 ? x.value : fmt(x.value)}</b>
            </div>
          ))}
          <div className="rule-item total"><span className="rule-dot">＝</span><span className="grow"><b>{T('PG máximos', 'HP maximum')}</b></span><b>{total}</b></div>
        </div>
        <p className="hint">{x_hint()}</p>
        <p className="hint">{T('Los cambios temporales (Ayuda, drenajes necróticos…) se añaden tocando la vida → «Vida máxima temporal».', 'Temporary changes (Aid, necrotic drains…) are added by tapping your HP → “Temporary HP maximum”.')}</p>
      </Modal>
    );
  }
  const spd = speed(c);
  const extras = speedExtras(c, true);
  return (
    <Modal title={T(`Velocidad: ${spd.value} pies`, `Speed: ${spd.value} ft`)} onClose={onClose}>
      <div className="calc">{spd.parts.map((p) => <div key={p}>{p}</div>)}</div>
      {extras.length > 0 && (
        <div className="rule-list">
          {extras.map((x) => (
            <label key={x.id} className={`rule-item ${x.off ? 'off' : ''}`}>
              {x.item ? <GearPlus /> : <input type="checkbox" checked={!x.off} onChange={() => toggle(x.id)} />}
              <span className="grow"><b>{x.label}</b><br /><small className="muted">{x.text}</small></span>
              <b>{fmt(x.value)}</b>
            </label>
          ))}
        </div>
      )}
      <p className="hint">{x_hint()}</p>
    </Modal>
  );
}
/** Desglose genérico: cada sumando con su origen y el total */
function PartsModal({ title, parts, total, hint, onClose }: { title: string; parts: Part[]; total: string; hint?: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <PartsList parts={parts} total={total} />
      {hint && <p className="hint">{hint}</p>}
    </Modal>
  );
}

export function PartsList({ parts, total, totalLabel }: { parts: Part[]; total?: string; totalLabel?: string }) {
  return (
    <div className="rule-list parts">
      {parts.map((p, i) => (
        <div key={`${p.label}-${i}`} className={`rule-item ${p.kind ?? ''}`}>
          <span className="rule-dot">{p.kind === 'item' ? <GearPlus /> : p.kind === 'trait' ? '✦' : p.kind === 'effect' ? '✨' : p.kind === 'penalty' ? '➖' : '·'}</span>
          <span className="grow">{p.label}{p.kind === 'effect' && <small className="muted"> {T('(se tira aparte)', '(rolled separately)')}</small>}</span>
          <b className={p.value.startsWith('−') || p.value.startsWith('-') ? 'neg' : ''}>{p.value}</b>
        </div>
      ))}
      {total != null && <div className="rule-item total"><span className="rule-dot">＝</span><span className="grow"><b>{totalLabel ?? T('Total', 'Total')}</b></span><b>{total}</b></div>}
    </div>
  );
}

const x_hint = () => T('Los rasgos y dotes se suman solos. Si ya los habías sumado a mano en la hoja, desmárcalos aquí para no contarlos dos veces. Lo que dan los objetos se quita al desequiparlos.', 'Features and feats are added automatically. If you had already added them by hand on the sheet, untick them here so they don’t count twice. Item effects go away when you unequip the item.');

/** Información de una característica, salvación, habilidad o la iniciativa: qué cubre, cómo se calcula (con los
 *  rasgos de clase, especie y dotes que suman) y un bonificador propio para lo que la app no sepa */
function StatInfoModal({ ability, skill, save, init, onClose }: { ability: Ability; skill?: string; save?: boolean; init?: boolean; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const tapToRoll = useStore((s) => s.settings.tapToRoll);
  const roll = useRoll();
  const m = abilityMods(c);
  const pb = profBonus(c.level);
  const s = skill ? SKILLS.find((x) => x.id === skill) : undefined;
  const kind: RollKind = init ? { kind: 'initiative' } : save ? { kind: 'save', ability } : { kind: 'check', ability, skill };
  const target = targetOf(kind);
  const key = adjKey(target);
  const ctx = rollContext(c, kind);
  const rules = ruleMods(c, target);
  const { value: adjVal, adj } = adjValue(c, target);
  const ruleProf = save && !c.saveProf.includes(ability) && rules.some((r) => r.prof && !r.off);
  const p = s ? c.skillProf[s.id] ?? 0 : save ? (saveProficient(c, ability) ? 1 : 0) : 0;
  const total = init ? initiativeBonus(c) : s ? skillBonus(c, s.id) : save ? saveBonus(c, ability) : checkBonus(c, ability);
  const title = init ? T('Iniciativa', 'Initiative') : s ? L(s.name) : save ? T(`Salvación de ${abilityName(ability)}`, `${abilityName(ability)} saving throw`) : abilityName(ability);
  const [editAdj, setEditAdj] = useState(!!adj);

  const setAdj = (patch: Partial<BonusAdj> | null) => update((x) => {
    const all = { ...(x.bonusAdj ?? {}) };
    if (patch === null) delete all[key];
    else all[key] = { ...{ flat: 0, ability: null, note: '' }, ...all[key], ...patch };
    x.bonusAdj = all;
  });
  const toggleRule = (id: string) => update((x) => {
    const off = new Set(x.rulesOff ?? []);
    if (off.has(id)) off.delete(id); else off.add(id);
    x.rulesOff = [...off];
  });

  const doRoll = () => {
    roll(c, kind, total, title);
    onClose();
  };
  const effective = rules.filter((r) => !r.note);
  const notes = rules.filter((r) => r.note);

  return (
    <Modal title={title} onClose={onClose}>
      {s && <p>{L(s.desc)}</p>}
      {s && <p className="muted"><i>{T('Ejemplos', 'Examples')}:</i> {L(s.examples)}</p>}
      {init && <p>{T('La iniciativa es una prueba de Destreza que decide el orden de los turnos.', 'Initiative is a Dexterity check that sets the turn order.')}</p>}
      {!s && !save && !init && (
        <p>{T(`Puntuación ${c.abilities[ability]} → modificador ${fmt(mod(c.abilities[ability]))}. Se usa en las pruebas de ${abilityName(ability)} y en estas habilidades: `, `Score ${c.abilities[ability]} → modifier ${fmt(mod(c.abilities[ability]))}. Used for ${abilityName(ability)} checks and these skills: `)}
          {SKILLS.filter((x) => x.ability === ability).map((x) => L(x.name)).join(', ') || '—'}.</p>
      )}
      <div className="calc">
        <div>{T('Modificador de', 'Modifier from')} {abilityName(init ? 'dex' : ability)}: {fmt(m[init ? 'dex' : ability])}</div>
        {abilityScores(c).sources[init ? 'dex' : ability].map((x) => <div key={x.id} className="gear-line"><GearPlus /> {x.text}</div>)}
        {(s || save) && <div>{T('Competencia', 'Proficiency')}: {p === 0 ? T('no', 'no') : p === 1 ? `${T('sí', 'yes')} (${fmt(pb)})${ruleProf ? ` · ${rules.find((r) => r.prof)?.source}` : ''}` : `${T('pericia', 'expertise')} (${fmt(2 * pb)})`}</div>}
        {effective.filter((r) => !r.off && r.bonus).map((r) => <div key={r.id} className={r.item ? 'gear-line' : ''}>{r.item && <GearPlus />} {r.source}: {fmt(r.bonus!)}</div>)}
        {adj && adjVal !== 0 && <div>{adj.note || T('Otro bonificador', 'Other bonus')} ({adjText(adj)}): {fmt(adjVal)}</div>}
        {[...effectDice(c, init ? 'initiative' : save ? 'save' : 'check'), ...exhaustionPart(c)].map((x) => <div key={x.label} className={x.kind === 'penalty' ? 'neg-line' : 'effect-line'}>{x.kind === 'penalty' ? '➖' : '✨'} {x.label}: {x.value}{x.kind === 'effect' ? T(' (se tira aparte)', ' (rolled separately)') : T(' (al tirar)', ' (when rolling)')}</div>)}
        <div><b>{T('Bonificador total', 'Total bonus')}: {fmt(total)}</b></div>
      </div>

      {effective.length > 0 && (
        <div className="rule-list">
          <b>{T('Por tu clase, especie, dotes u objetos (reglas 2024)', 'From your class, species, feats or items (2024 rules)')}</b>
          {effective.map((r) => (
            <label key={r.id} className={`rule-item ${r.off ? 'off' : ''}`}>
              <input type="checkbox" checked={!r.off} onChange={() => toggleRule(r.id)} />
              <span>{r.item && <GearPlus />}<b>{r.source}</b>{r.bonus ? ` ${fmt(r.bonus)}` : r.adv ? ` · ${T('ventaja', 'advantage')}` : r.dis ? ` · ${T('desventaja', 'disadvantage')}` : r.prof ? ` · ${T('competencia', 'proficiency')}` : ''}<br /><small className="muted">{r.text}</small></span>
            </label>
          ))}
          <p className="hint">{T('Se aplican solas. Desmarca una si en tu mesa no se usa o no la tienes.', 'They apply automatically. Untick one if your table doesn’t use it or you don’t have it.')}</p>
        </div>
      )}

      <div className="adj-box">
        {!editAdj ? (
          <button className="btn small" onClick={() => setEditAdj(true)}>＋ {T('Añadir otro bonificador', 'Add another bonus')}</button>
        ) : (
          <>
            <b>{T('Otro bonificador (objetos, rasgos, reglas de la casa…)', 'Other bonus (items, features, house rules…)')}</b>
            <div className="row adj-row">
              <NumberInput value={adj?.flat ?? 0} min={-20} max={20} ariaLabel={T('Bonificador fijo', 'Flat bonus')} onChange={(n) => setAdj({ flat: n })} />
              <span>+</span>
              <select value={adj?.ability ?? ''} aria-label={T('Modificador de característica', 'Ability modifier')} onChange={(e) => setAdj({ ability: (e.target.value || null) as Ability | null })}>
                <option value="">{T('— sin característica', '— no ability')}</option>
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map((a) => <option key={a} value={a}>{T('mod. de', 'mod.')} {abilityShort(a)} ({fmt(m[a])})</option>)}
              </select>
            </div>
            <input value={adj?.note ?? ''} placeholder={T('De dónde sale (p. ej. Piedra de la suerte)', 'Where it comes from (e.g. Stone of Good Luck)')} onChange={(e) => setAdj({ note: e.target.value })} />
            {adj && <button className="link" onClick={() => { setAdj(null); setEditAdj(false); }}>{T('Quitar este bonificador', 'Remove this bonus')}</button>}
          </>
        )}
      </div>

      {(ctx.advantage.length + ctx.disadvantage.length + ctx.autoFail.length + ctx.penalties.length) > 0 ? (
        <div className="reminders">
          <b>{T('Ahora mismo', 'Right now')}:</b>
          {ctx.advantage.map((x) => <div key={x}>✅ {T('Ventaja por', 'Advantage from')} {x}</div>)}
          {ctx.disadvantage.map((x) => <div key={x}>⬇️ {T('Desventaja por', 'Disadvantage from')} {x}</div>)}
          {ctx.autoFail.map((x) => <div key={x}>⛔ {x}</div>)}
          {ctx.penalties.map((x) => <div key={x}>➖ {x}</div>)}
        </div>
      ) : <p className="muted">{T('Ahora mismo no tienes nada que afecte a esta tirada.', 'Nothing is affecting this roll right now.')}</p>}
      {notes.length > 0 && (
        <div className="rule-list notes">
          <b>📌 {T('Según la situación', 'Depending on the situation')}</b>
          {notes.map((r) => <div key={r.id} className={r.off ? 'off' : ''}><b>{r.source}:</b> <small>{r.text}</small></div>)}
        </div>
      )}
      {tapToRoll
        ? <button className="btn primary full" onClick={doRoll}>🎲 {T('Tirar', 'Roll')} {title}</button>
        : <p className="hint">{T('Puedes activar las tiradas de dados al tocar en Ajustes.', 'You can turn on dice rolls on tap in Settings.')}</p>}
    </Modal>
  );
}

function AttackModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const a = c.attacks.find((x) => x.id === id);
  if (!a) return null;
  const set = (fn: (x: Attack) => void) => update((ch) => { fn(ch.attacks.find((y) => y.id === id)!); });
  return (
    <Modal title={a.name || T('Nueva arma', 'New weapon')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={a.name} autoFocus={!a.name} onChange={(e) => set((x) => { x.name = e.target.value; })} /></label>
      <div className="grid3">
        <label className="field">{T('Caract.', 'Ability')}
          <select value={a.ability} onChange={(e) => set((x) => { x.ability = e.target.value as Ability; })}>
            {ABILITIES.map((ab) => <option key={ab.id} value={ab.id}>{L(ab.short)}</option>)}
          </select>
        </label>
        <label className="field">{T('Daño (dados)', 'Damage (dice)')}<input value={a.damage} onChange={(e) => set((x) => { x.damage = e.target.value; })} /></label>
        <label className="field">{T('Tipo', 'Type')}
          <select value={a.damageType} onChange={(e) => set((x) => { x.damageType = e.target.value as DamageType; })}>
            {DAMAGE_TYPES.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}
          </select>
        </label>
        <label className="field">{T('Alcance', 'Range')}<input value={a.range} onChange={(e) => set((x) => { x.range = e.target.value; })} /></label>
        <label className="field">{T('Bonus extra', 'Extra bonus')}<NumberInput value={a.extraBonus} onChange={(n) => set((x) => { x.extraBonus = n; })} /></label>
        <label className="field">{T('Maestría', 'Mastery')}
          <select value={findMastery(a.mastery)?.id ?? ''} onChange={(e) => set((x) => { x.mastery = e.target.value || undefined; })}>
            <option value="">—</option>
            {MASTERIES.map((mm) => <option key={mm.id} value={mm.id}>{L(mm.name)}</option>)}
          </select>
        </label>
      </div>
      <label className="check"><input type="checkbox" checked={a.proficient} onChange={(e) => set((x) => { x.proficient = e.target.checked; })} /> {T('Competente', 'Proficient')}</label>
      <label className="field">{T('Notas', 'Notes')}<input value={a.notes ?? ''} onChange={(e) => set((x) => { x.notes = e.target.value; })} /></label>
      {(() => { const ap = attackParts(c, a); return (<>
        <b className="small">{T('Tirada de ataque', 'Attack roll')}: d20 {fmt(ap.total)}</b>
        <PartsList parts={ap.attack} total={fmt(ap.total)} />
        <b className="small">{T('Daño', 'Damage')}: {a.damage}{fmt(weaponDamageFlat(c, a))}</b>
        <PartsList parts={ap.damage} />
      </>); })()}
      {a.itemId && <p className="hint">{T('Esta fila sale de un arma equipada en «Objetos»: se quita al desequiparla.', 'This row comes from a weapon equipped in “Items”: it goes away when you unequip it.')}</p>}
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await confirmDelete(a.name || T('arma', 'weapon'))) { update((ch) => { ch.attacks = ch.attacks.filter((y) => y.id !== id); }); onClose(); } }}>{T('Borrar', 'Delete')}</button>
        <button className="btn primary grow" onClick={onClose}>{T('Hecho', 'Done')}</button>
      </div>
    </Modal>
  );
}

/** Componentes como en el manual (V, S, M) y marcas de concentración y ritual */
export function SpellComp({ sp }: { sp: Spell }) {
  const comp = spellComponents(sp);
  const info = findSpell(sp.name);
  return (
    <span className="spell-comp">
      {['V', 'S', 'M'].filter((k) => comp.includes(k)).map((k) => <b key={k} className={`comp-${k}`} title={k === 'V' ? T('Verbal: tienes que poder hablar', 'Verbal: you must be able to speak') : k === 'S' ? T('Somático: necesitas una mano libre', 'Somatic: you need a free hand') : T('Material', 'Material')}>{k}</b>)}
      {(sp.concentration || info?.concentration) && <i className="comp-tag" title={T('Concentración', 'Concentration')}>C</i>}
      {(sp.ritual || info?.ritual) && <i className="comp-tag" title={T('Ritual', 'Ritual')}>R</i>}
    </span>
  );
}

function FeatureModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const f = c.features.find((x) => x.id === id);
  if (!f) return null;
  const set = (fn: (x: Character['features'][number]) => void) => update((ch) => { fn(ch.features.find((y) => y.id === id)!); });
  const featSugs = featureSuggestions({ ...c, features: c.features.filter((x) => x.id !== id) }, f.name);
  return (
    <Modal title={f.name || T('Nuevo rasgo', 'New feature')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}
        <SuggestInput value={f.name} autoFocus={!f.name} onChange={(v) => set((x) => { x.name = v; })}
          items={featSugs.map((x) => ({ key: x.name, label: x.name, sub: `${x.why}${x.recharge ? ` · ${L(RECHARGE_LABEL[x.recharge])}` : ''} — ${x.text.slice(0, 90)}${x.text.length > 90 ? '…' : ''}` }))}
          onPick={(k) => { const sg = featSugs.find((x) => x.name === k); if (sg) set((x) => { x.name = sg.name; x.text = sg.text; if (sg.recharge) x.recharge = sg.recharge; }); }} />
      </label>
      {!f.text && f.name.length >= 2 && featSugs.length === 0 && <p className="hint">{T('Ningún rasgo de tu clase, subclase, especie o dotes coincide; puedes escribirlo a mano.', 'No feature from your class, subclass, species or feats matches; you can type it by hand.')}</p>}
      <label className="field">{T('Qué hace', 'What it does')}<textarea className="tall" value={f.text} onChange={(e) => set((x) => { x.text = e.target.value; })} /></label>
      <label className="field">{T('Se recupera con', 'Recovers on')}
        <select value={f.recharge ?? ''} onChange={(e) => set((x) => { x.recharge = (e.target.value || undefined) as Recharge | undefined; })}>
          <option value="">{rechargeOf(f.name) ? `${T('Según las reglas', 'Per the rules')}: ${L(RECHARGE_LABEL[rechargeOf(f.name)!])}` : T('Pasivo / no tiene usos', 'Passive / no uses')}</option>
          {(Object.keys(RECHARGE_LABEL) as Recharge[]).map((k) => <option key={k} value={k}>{L(RECHARGE_LABEL[k])}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await confirmDelete(f.name || T('rasgo', 'feature'))) { update((ch) => { ch.features = ch.features.filter((y) => y.id !== id); }); onClose(); } }}>{T('Borrar', 'Delete')}</button>
        <button className="btn primary grow" onClick={onClose}>{T('Hecho', 'Done')}</button>
      </div>
    </Modal>
  );
}

function SpellModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const sp = c.spells.find((x) => x.id === id);
  if (!sp) return null;
  const set = (fn: (x: Spell) => void) => update((ch) => { fn(ch.spells.find((y) => y.id === id)!); });
  const spellSugs = findSpell(sp.name) ? [] : spellSuggestions({ ...c, spells: c.spells.filter((x) => x.id !== id) }, sp.name);
  return (
    <Modal title={sp.name || T('Nuevo conjuro', 'New spell')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}
        <SuggestInput value={sp.name} autoFocus={!sp.name} onChange={(v) => set((x) => { x.name = v; })}
          items={spellSugs.map((x) => ({ key: x.spell.name.en, label: L(x.spell.name), sub: `${x.spell.level ? T(`Nivel ${x.spell.level}`, `Level ${x.spell.level}`) : T('Truco', 'Cantrip')} · ${x.why} · ${x.spell.components}${x.spell.concentration ? ' · C' : ''} — ${L(x.spell.text).slice(0, 80)}…` }))}
          onPick={(k) => { const info = spellSugs.find((x) => x.spell.name.en === k)?.spell; if (info) set((x) => { x.name = L(info.name); x.level = info.level; x.castingTime = L(info.time); x.range = L(info.range); x.concentration = info.concentration; x.ritual = info.ritual; x.components = info.components; x.material = info.components.includes('M'); }); }} />
      </label>
      {sp.name.length >= 2 && !findSpell(sp.name) && spellSugs.length === 0 && <p className="hint">{T('Ningún conjuro de tus clases y nivel coincide en la base de la app; puedes escribirlo a mano.', 'No spell from your classes and level matches in the app’s database; you can type it by hand.')}</p>}
      <div className="grid3">
        <label className="field">{T('Nivel (0 = truco)', 'Level (0 = cantrip)')}<NumberInput value={sp.level} min={0} max={9} onChange={(n) => set((x) => { x.level = Math.max(0, Math.min(9, n)); })} /></label>
        <label className="field">{T('Tiempo', 'Casting time')}<input value={sp.castingTime} onChange={(e) => set((x) => { x.castingTime = e.target.value; })} /></label>
        <label className="field">{T('Alcance', 'Range')}<input value={sp.range} onChange={(e) => set((x) => { x.range = e.target.value; })} /></label>
      </div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={sp.concentration} onChange={(e) => set((x) => { x.concentration = e.target.checked; })} /> {T('Concentración', 'Concentration')}</label>
        <label className="check"><input type="checkbox" checked={!!sp.ritual} onChange={(e) => set((x) => { x.ritual = e.target.checked; })} /> {T('Ritual', 'Ritual')}</label>
        <label className="check" title={T('Conjuros de dominio, juramento, patrón… que un rasgo te da siempre preparados', 'Domain, oath, patron… spells a feature keeps always prepared')}><input type="checkbox" checked={!!sp.alwaysPrepared} onChange={(e) => set((x) => { x.alwaysPrepared = e.target.checked; })} /> {T('Siempre preparado (no cuenta)', 'Always prepared (doesn’t count)')}</label>
        {(['V', 'S', 'M'] as const).map((k) => {
          const comp = spellComponents(sp);
          const on = comp.includes(k);
          return (
            <label key={k} className="check"><input type="checkbox" checked={on} onChange={(e) => set((x) => {
              const list = ['V', 'S', 'M'].filter((y) => (y === k ? e.target.checked : comp.includes(y)));
              x.components = list.join(', ');
              x.material = list.includes('M');
            })} /> {k === 'V' ? T('V (verbal)', 'V (verbal)') : k === 'S' ? T('S (somático)', 'S (somatic)') : T('M (material)', 'M (material)')}</label>
          );
        })}
      </div>
      <label className="field">{T('Notas / qué hace', 'Notes / what it does')}<textarea value={sp.notes ?? ''} onChange={(e) => set((x) => { x.notes = e.target.value; })} /></label>
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await confirmDelete(sp.name || T('conjuro', 'spell'))) { update((ch) => { ch.spells = ch.spells.filter((y) => y.id !== id); }); onClose(); } }}>{T('Borrar', 'Delete')}</button>
        <button className="btn primary grow" onClick={onClose}>{T('Hecho', 'Done')}</button>
      </div>
    </Modal>
  );
}

export function EffectPicker({ onClose }: { onClose: () => void }) {
  const run = useStore((s) => s.runCommands);
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('');
  const [kind, setKind] = useState<'buff' | 'debuff'>('buff');
  const [notes, setNotes] = useState('');
  return (
    <Modal title={T('Añadir beneficio o perjuicio', 'Add buff or debuff')} onClose={onClose}>
      <div className="pick-list">
        {EFFECT_PRESETS.map((p) => (
          <button key={p.id} className="pick" onClick={() => { run(null, [{ type: 'addEffect', presetId: p.id }]); onClose(); }}>
            <b>{p.kind === 'buff' ? '🟢' : '🔴'} {L(p.name)}{p.concentration ? ' 🧠' : ''}</b>
            <span className="small muted">{L(p.notes)}</span>
          </button>
        ))}
      </div>
      <h4>{T('Personalizado', 'Custom')}</h4>
      <input placeholder={T('Nombre (p. ej. Bendición del druida)', 'Name (e.g. Druid’s blessing)')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="row">
        <input type="number" placeholder={T('Rondas (vacío = sin límite)', 'Rounds (empty = no limit)')} value={rounds} onChange={(e) => setRounds(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as 'buff' | 'debuff')}>
          <option value="buff">{T('Beneficio', 'Buff')}</option>
          <option value="debuff">{T('Perjuicio', 'Debuff')}</option>
        </select>
      </div>
      <input placeholder={T('Notas (qué hace)', 'Notes (what it does)')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn primary full" disabled={!name.trim()} onClick={() => {
        run(null, [{ type: 'addEffect', name: name.trim(), rounds: rounds ? Number(rounds) : null, notes, kind }]);
        onClose();
      }}>{T('Añadir', 'Add')}</button>
    </Modal>
  );
}

/** Cómo se recupera un rasgo: lo guardado, lo que dicen las reglas o el recurso de clase con el mismo nombre */
function featureRecharge(c: Character, f: Character['features'][number]): Recharge | undefined {
  if (f.recharge) return f.recharge;
  const known = rechargeOf(f.name);
  if (known) return known;
  const res = c.resources.find((r) => r.name.toLowerCase() === f.name.trim().toLowerCase());
  return res ? res.recovers : undefined;
}
