import { useState, type ReactNode } from 'react';
import { useChar, useStore } from '../store';
import {
  abilityMods, activeReminders, armorClass, attackBonus, fmt, maxHp, mod, passivePerception, profBonus, rollContext, saveBonus,
  skillBonus, speed, spellAttack, spellSaveDc,
} from '../rules/calc';
import {
  ABILITIES, CLASSES, CONDITIONS, DAMAGE_TYPES, EFFECT_PRESETS, MASTERIES, SIZES, SKILLS, SPECIES, abilityName, abilityShort,
  classById, damageTypeName, effectName, effectNotes, findMastery, resourceName,
} from '../rules/srd';
import { uid } from '../rules/factory';
import type { Ability, Attack, Character, ConditionId, DamageType, ProfLevel, Spell } from '../types';
import { Modal, NumberInput, Pips, pickFiles, useRoll } from './common';
import { HpModal } from './Hp';
import { Editor } from './Editor';
import { ImportModal } from './Import';
import { L, T } from '../i18n';
import { imageFileToBase64 } from '../importer';
import { longPress } from './InfoBubble';
import { FlagsPanel } from './Flags';

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

function Area({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="p-area" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Diamond({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`p-diamond ${on ? 'on' : ''}`} onClick={onClick} aria-label={label} aria-pressed={on} />;
}

function ProfDot({ level, onClick, label }: { level: ProfLevel; onClick: () => void; label: string }) {
  return <button className={`p-dot ${level === 2 ? 'exp' : level === 1 ? 'on' : ''}`} onClick={onClick} aria-label={label} />;
}

// ---------- Hoja ----------

export function SheetTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const run = useStore((s) => s.runCommands);
  const tapToRoll = useStore((s) => s.settings.tapToRoll);
  const roll = useRoll();
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hpOpen, setHpOpen] = useState(false);
  const [statInfo, setStatInfo] = useState<{ ability: Ability; skill?: string; save?: boolean } | null>(null);
  const [info, setInfo] = useState<{ title: string; lines: string[] } | null>(null);
  const [condOpen, setCondOpen] = useState(false);
  const [effOpen, setEffOpen] = useState(false);
  const [attackEdit, setAttackEdit] = useState<string | null>(null);
  const [spellEdit, setSpellEdit] = useState<string | null>(null);

  if (editing) return <Editor onDone={() => setEditing(false)} />;

  const set = (fn: (x: Character) => void) => update(fn);
  const m = abilityMods(c);
  const pb = profBonus(c.level);
  const ac = armorClass(c);
  const spd = speed(c);
  const reminders = activeReminders(c);
  const cls = classById(c.classId || c.className);

  // Tocar una estadística: tira el dado solo si el usuario lo ha activado en Ajustes
  const tapStat = (ability: Ability, opts: { skill?: string; save?: boolean } = {}) => {
    if (!tapToRoll) return setStatInfo({ ability, ...opts });
    if (opts.save) roll(c, { kind: 'save', ability }, saveBonus(c, ability), T(`Salvación de ${abilityShort(ability)}`, `${abilityShort(ability)} save`));
    else if (opts.skill) {
      const s = SKILLS.find((x) => x.id === opts.skill)!;
      roll(c, { kind: 'check', ability, skill: s.id }, skillBonus(c, s.id), L(s.name));
    } else roll(c, { kind: 'check', ability }, m[ability], T(`Prueba de ${abilityName(ability)}`, `${abilityName(ability)} check`));
  };

  const cycleSkill = (id: string) => set((x) => { x.skillProf[id] = (((x.skillProf[id] ?? 0) + 1) % 3) as ProfLevel; });
  const toggleSave = (a: Ability) => set((x) => { x.saveProf = x.saveProf.includes(a) ? x.saveProf.filter((y) => y !== a) : [...x.saveProf, a]; });

  const setClass = (v: string) => set((x) => {
    x.className = v;
    x.classId = classById(v)?.id ?? '';
  });

  const uploadPortrait = async () => {
    const [file] = await pickFiles('image/*', false);
    if (!file) return;
    const data = await imageFileToBase64(file, 640, 0.82);
    set((x) => { x.portrait = `data:image/jpeg;base64,${data}`; });
  };

  const abilityBox = (a: Ability) => {
    const skills = SKILLS.filter((s) => s.ability === a);
    const saveCtx = rollContext(c, { kind: 'save', ability: a });
    return (
      <Box key={a} title={abilityName(a)} className="p-ability">
        <div className="p-ab-top">
          <button className="p-ab-mod" {...longPress({ type: 'ability', ability: a })} onClick={() => tapStat(a)} aria-label={`${abilityName(a)} ${fmt(m[a])}`}>{fmt(m[a])}</button>
          <NumberInput className="p-ab-score" value={c.abilities[a]} min={1} max={30} ariaLabel={T(`Puntuación de ${abilityName(a)}`, `${abilityName(a)} score`)} onChange={(n) => set((x) => { x.abilities[a] = Math.max(1, Math.min(30, n)); })} />
        </div>
        <div className="p-row save">
          <ProfDot level={c.saveProf.includes(a) ? 1 : 0} onClick={() => toggleSave(a)} label={T('Competencia en salvación', 'Saving throw proficiency')} />
          <span className="p-bonus">{fmt(saveBonus(c, a))}</span>
          <button className="p-row-name" {...longPress({ type: 'save', ability: a })} onClick={() => tapStat(a, { save: true })}>
            {T('Tirada de salvación', 'Saving Throw')}
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
              <Field label={T('Trasfondo', 'Background')} value={c.background} onChange={(v) => set((x) => { x.background = v; })} />
              <Field label={T('Clase', 'Class')} value={cls && (!c.className || c.className === cls.name.es || c.className === cls.name.en) ? L(cls.name) : c.className} list="dl-classes" onChange={setClass} />
              <Field label={T('Especie', 'Species')} value={c.species} list="dl-species" onChange={(v) => set((x) => { x.species = v; })} />
              <Field label={T('Subclase', 'Subclass')} value={c.subclass} onChange={(v) => set((x) => { x.subclass = v; })} />
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
              <button className="p-ac" onClick={() => setInfo({ title: `${T('CA', 'AC')} ${ac.value}`, lines: ac.parts })}>{ac.value}</button>
              <label className="p-shield-toggle">
                <Diamond on={c.shield} onClick={() => set((x) => { x.shield = !x.shield; })} label={T('Escudo', 'Shield')} />
                <span>{T('Escudo', 'Shield')}</span>
              </label>
            </div>

            <Box title={T('Puntos de golpe', 'Hit Points')} className="p-hp">
              <div className="p-hp-grid">
                <button className="p-hp-current" onClick={() => setHpOpen(true)}>
                  <b>{c.dead ? '☠️' : c.hp.current}</b>
                  <span>{T('Actuales', 'Current')}</span>
                </button>
                <label className="p-hp-small">
                  <NumberInput value={c.hp.temp} min={0} onChange={(n) => set((x) => { x.hp.temp = Math.max(0, n); })} />
                  <span>{T('Temp.', 'Temp')}</span>
                </label>
                <label className="p-hp-small">
                  <NumberInput value={c.hp.max} min={1} onChange={(n) => set((x) => { x.hp.max = Math.max(1, n); x.hp.current = Math.min(x.hp.current, maxHp({ ...x, hp: { ...x.hp, max: Math.max(1, n) } })); })} />
                  <span>{T('Máx.', 'Max')}</span>
                </label>
              </div>
            </Box>

            <Box title={T('Dados de golpe', 'Hit Dice')} className="p-hd">
              <label className="p-hp-small">
                <NumberInput value={c.hitDiceSpent} min={0} max={c.level} onChange={(n) => set((x) => { x.hitDiceSpent = Math.max(0, Math.min(x.level, n)); })} />
                <span>{T('Gastados', 'Spent')}</span>
              </label>
              <div className="p-hd-max">{c.level}d{c.hitDie}<span>{T('Máx.', 'Max')}</span></div>
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
          <Box title={T('Bonif. competencia', 'Proficiency Bonus')}><div className="p-big">{fmt(pb)}</div></Box>
          <Box title={T('Iniciativa', 'Initiative')}>
            <button className="p-big" onClick={() => (tapToRoll ? run(T('Tiro iniciativa', 'Roll initiative'), [{ type: 'rollInitiative' }]) : setInfo({ title: T('Iniciativa', 'Initiative'), lines: [T(`Prueba de Destreza: ${fmt(m.dex)}.`, `Dexterity check: ${fmt(m.dex)}.`), ...rollContext(c, { kind: 'initiative' }).disadvantage.map((d) => T(`Desventaja por ${d}`, `Disadvantage from ${d}`))] }))}>{fmt(m.dex)}</button>
          </Box>
          <Box title={T('Velocidad', 'Speed')}><button className="p-big" onClick={() => setInfo({ title: `${T('Velocidad', 'Speed')} ${spd.value}`, lines: spd.parts })}>{spd.value}</button></Box>
          <Box title={T('Tamaño', 'Size')}><input className="p-big-input" list="dl-sizes" value={c.size} onChange={(e) => set((x) => { x.size = e.target.value; })} /></Box>
          <Box title={T('Percepción pasiva', 'Passive Perception')}><div className="p-big">{passivePerception(c)}</div></Box>
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
                  <tr><th>{T('Nombre', 'Name')}</th><th>{T('Bonif. at./CD', 'Atk Bonus/DC')}</th><th>{T('Daño y tipo', 'Damage & Type')}</th><th>{T('Notas', 'Notes')}</th></tr>
                </thead>
                <tbody>
                  {c.attacks.map((a) => {
                    const flat = m[a.ability];
                    return (
                      <tr key={a.id} {...longPress({ type: 'attack', id: a.id })} onClick={() => setAttackEdit(a.id)}>
                        <td><b>{a.name || '—'}</b></td>
                        <td>{fmt(attackBonus(c, a.ability, a.proficient, a.extraBonus))}</td>
                        <td>{a.damage}{flat ? fmt(flat) : ''} {damageTypeName(a.damageType).toLowerCase()}</td>
                        <td className="p-notes">{[a.range, findMastery(a.mastery) ? L(findMastery(a.mastery)!.name) : '', a.notes].filter(Boolean).join(' · ')}</td>
                      </tr>
                    );
                  })}
                  {c.attacks.length === 0 && <tr><td colSpan={4} className="p-empty">{T('Toca + para añadir un arma', 'Tap + to add a weapon')}</td></tr>}
                </tbody>
              </table>
            </Box>

            <Box title={T('Rasgos de clase', 'Class Features')} right={<button className="p-add" onClick={() => set((x) => { x.features.push({ id: uid(), name: '', text: '' }); })}>+</button>}>
              {c.features.length === 0 && <p className="p-empty">{T('Sin rasgos.', 'No features.')}</p>}
              {c.features.map((f) => (
                <details key={f.id} className="p-feature" open={!f.name}>
                  <summary {...longPress({ type: 'feature', id: f.id })}>{f.name || T('Nuevo rasgo', 'New feature')}</summary>
                  <input className="p-inline" value={f.name} placeholder={T('Nombre', 'Name')} onChange={(e) => set((x) => { x.features.find((y) => y.id === f.id)!.name = e.target.value; })} />
                  <textarea className="p-area" rows={3} value={f.text} onChange={(e) => set((x) => { x.features.find((y) => y.id === f.id)!.text = e.target.value; })} />
                  <button className="p-link" onClick={() => set((x) => { x.features = x.features.filter((y) => y.id !== f.id); })}>{T('Borrar', 'Delete')}</button>
                </details>
              ))}
            </Box>

            <div className="p-grid2">
              <Box title={T('Atributos de especie', 'Species Traits')}><Area value={c.speciesTraits} onChange={(v) => set((x) => { x.speciesTraits = v; })} /></Box>
              <Box title={T('Dotes', 'Feats')}><Area value={c.feats} onChange={(v) => set((x) => { x.feats = v; })} /></Box>
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
          <Area rows={2} value={c.weaponProf} onChange={(v) => set((x) => { x.weaponProf = v; })} />
          <span className="p-mini">{T('Herramientas', 'Tools')}</span>
          <Area rows={2} value={c.toolProf} onChange={(v) => set((x) => { x.toolProf = v; })} />
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
              <div><b>{spellSaveDc(c) ?? '—'}</b><span>{T('CD de salvación de conjuros', 'Spell Save DC')}</span></div>
              <div><b>{c.spellAbility ? fmt(spellAttack(c)!) : '—'}</b><span>{T('Bonificador de ataque de conjuros', 'Spell Attack Bonus')}</span></div>
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
          <Box title={T('Trucos y conjuros preparados', 'Cantrips & Prepared Spells')} className="p-spells" right={<button className="p-add" onClick={() => { const id = uid(); set((x) => { x.spells.push({ id, name: '', level: 0, prepared: true, castingTime: T('Acción', 'Action'), range: '', concentration: false }); }); setSpellEdit(id); }}>+</button>}>
            <table className="p-table">
              <thead>
                <tr><th>{T('Nv', 'Lvl')}</th><th>{T('Nombre', 'Name')}</th><th>{T('Tiempo', 'Time')}</th><th>{T('Alcance', 'Range')}</th><th>C R M</th></tr>
              </thead>
              <tbody>
                {[...c.spells].sort((a, b) => a.level - b.level).map((s) => (
                  <tr key={s.id} {...longPress({ type: 'spell', id: s.id })} onClick={() => setSpellEdit(s.id)}>
                    <td>{s.level || T('T', 'C')}</td>
                    <td><b>{s.name || '—'}</b>{s.notes ? <div className="p-notes">{s.notes}</div> : null}</td>
                    <td>{s.castingTime}</td>
                    <td>{s.range}</td>
                    <td className="p-crm">{s.concentration ? '◆' : '◇'}{s.ritual ? '◆' : '◇'}{s.material ? '◆' : '◇'}</td>
                  </tr>
                ))}
                {c.spells.length === 0 && <tr><td colSpan={5} className="p-empty">{T('Toca + para añadir un conjuro', 'Tap + to add a spell')}</td></tr>}
              </tbody>
            </table>
          </Box>

          <div className="p-side">
            <Box title={T('Aspecto', 'Appearance')} className="p-appearance">
              {c.portrait ? (
                <div className="p-portrait-wrap">
                  <img className="p-portrait" src={c.portrait} alt={T('Retrato del personaje', 'Character portrait')} onClick={uploadPortrait} />
                  <button className="p-link" onClick={() => set((x) => { x.portrait = null; })}>{T('Quitar imagen', 'Remove image')}</button>
                </div>
              ) : (
                <button className="p-upload" onClick={uploadPortrait}>🖼️ {T('Subir imagen del personaje', 'Upload character image')}</button>
              )}
              <Area rows={3} value={c.appearance} onChange={(v) => set((x) => { x.appearance = v; })} />
            </Box>
            <Box title={T('Historia y personalidad', 'Backstory & Personality')}>
              <Area rows={6} value={c.backstory} onChange={(v) => set((x) => { x.backstory = v; })} />
              <Field label={T('Alineamiento', 'Alignment')} value={c.alignment} onChange={(v) => set((x) => { x.alignment = v; })} />
            </Box>
            <Box title={T('Idiomas', 'Languages')}><Area rows={2} value={c.languages} onChange={(v) => set((x) => { x.languages = v; })} /></Box>
            <Box title={T('Equipo', 'Equipment')}>
              <Area rows={6} value={c.inventory} onChange={(v) => set((x) => { x.inventory = v; })} />
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
            </Box>
          </div>
        </div>
        <p className="p-legal">{T('Reglas basadas en el SRD 5.2 (CC-BY-4.0). Diseño inspirado en la hoja oficial 2024.', 'Rules based on SRD 5.2 (CC-BY-4.0). Layout inspired by the official 2024 sheet.')}</p>
      </div>
      </div>

      {hpOpen && <HpModal onClose={() => setHpOpen(false)} />}
      {statInfo && <StatInfoModal {...statInfo} onClose={() => setStatInfo(null)} />}
      {attackEdit && <AttackModal id={attackEdit} onClose={() => setAttackEdit(null)} />}
      {spellEdit && <SpellModal id={spellEdit} onClose={() => setSpellEdit(null)} />}
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

/** Información de una característica, salvación o habilidad: qué cubre, cómo se calcula y qué te afecta ahora */
function StatInfoModal({ ability, skill, save, onClose }: { ability: Ability; skill?: string; save?: boolean; onClose: () => void }) {
  const c = useChar();
  const tapToRoll = useStore((s) => s.settings.tapToRoll);
  const roll = useRoll();
  const m = abilityMods(c);
  const pb = profBonus(c.level);
  const s = skill ? SKILLS.find((x) => x.id === skill) : undefined;
  const kind = save ? { kind: 'save' as const, ability } : { kind: 'check' as const, ability, skill };
  const ctx = rollContext(c, kind);
  const p = s ? c.skillProf[s.id] ?? 0 : save ? (c.saveProf.includes(ability) ? 1 : 0) : 0;
  const total = s ? skillBonus(c, s.id) : save ? saveBonus(c, ability) : m[ability];
  const title = s ? L(s.name) : save ? T(`Salvación de ${abilityName(ability)}`, `${abilityName(ability)} saving throw`) : abilityName(ability);

  const doRoll = () => {
    roll(c, kind, total, title);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      {s && <p>{L(s.desc)}</p>}
      {s && <p className="muted"><i>{T('Ejemplos', 'Examples')}:</i> {L(s.examples)}</p>}
      {!s && !save && (
        <p>{T(`Puntuación ${c.abilities[ability]} → modificador ${fmt(mod(c.abilities[ability]))}. Se usa en las pruebas de ${abilityName(ability)} y en estas habilidades: `, `Score ${c.abilities[ability]} → modifier ${fmt(mod(c.abilities[ability]))}. Used for ${abilityName(ability)} checks and these skills: `)}
          {SKILLS.filter((x) => x.ability === ability).map((x) => L(x.name)).join(', ') || '—'}.</p>
      )}
      <div className="calc">
        <div>{T('Modificador de', 'Modifier from')} {abilityName(ability)}: {fmt(m[ability])}</div>
        {(s || save) && <div>{T('Competencia', 'Proficiency')}: {p === 0 ? T('no', 'no') : p === 1 ? `${T('sí', 'yes')} (${fmt(pb)})` : `${T('pericia', 'expertise')} (${fmt(2 * pb)})`}</div>}
        <div><b>{T('Bonificador total', 'Total bonus')}: {fmt(total)}</b></div>
      </div>
      {(ctx.advantage.length + ctx.disadvantage.length + ctx.autoFail.length + ctx.penalties.length) > 0 ? (
        <div className="reminders">
          <b>{T('Limitaciones actuales', 'Current limitations')}:</b>
          {ctx.advantage.map((x) => <div key={x}>✅ {T('Ventaja por', 'Advantage from')} {x}</div>)}
          {ctx.disadvantage.map((x) => <div key={x}>⬇️ {T('Desventaja por', 'Disadvantage from')} {x}</div>)}
          {ctx.autoFail.map((x) => <div key={x}>⛔ {x}</div>)}
          {ctx.penalties.map((x) => <div key={x}>➖ {x}</div>)}
        </div>
      ) : <p className="muted">{T('Ahora mismo no tienes nada que afecte a esta tirada.', 'Nothing is affecting this roll right now.')}</p>}
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
      <p className="hint">{T(`Bonificador de ataque: ${fmt(attackBonus(c, a.ability, a.proficient, a.extraBonus))}. El modificador de característica se suma al daño automáticamente.`, `Attack bonus: ${fmt(attackBonus(c, a.ability, a.proficient, a.extraBonus))}. The ability modifier is added to damage automatically.`)}</p>
      <div className="row">
        <button className="btn danger" onClick={() => { update((ch) => { ch.attacks = ch.attacks.filter((y) => y.id !== id); }); onClose(); }}>{T('Borrar', 'Delete')}</button>
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
  return (
    <Modal title={sp.name || T('Nuevo conjuro', 'New spell')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={sp.name} autoFocus={!sp.name} onChange={(e) => set((x) => { x.name = e.target.value; })} /></label>
      <div className="grid3">
        <label className="field">{T('Nivel (0 = truco)', 'Level (0 = cantrip)')}<NumberInput value={sp.level} min={0} max={9} onChange={(n) => set((x) => { x.level = Math.max(0, Math.min(9, n)); })} /></label>
        <label className="field">{T('Tiempo', 'Casting time')}<input value={sp.castingTime} onChange={(e) => set((x) => { x.castingTime = e.target.value; })} /></label>
        <label className="field">{T('Alcance', 'Range')}<input value={sp.range} onChange={(e) => set((x) => { x.range = e.target.value; })} /></label>
      </div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={sp.concentration} onChange={(e) => set((x) => { x.concentration = e.target.checked; })} /> {T('Concentración', 'Concentration')}</label>
        <label className="check"><input type="checkbox" checked={!!sp.ritual} onChange={(e) => set((x) => { x.ritual = e.target.checked; })} /> {T('Ritual', 'Ritual')}</label>
        <label className="check"><input type="checkbox" checked={!!sp.material} onChange={(e) => set((x) => { x.material = e.target.checked; })} /> {T('Material', 'Material')}</label>
      </div>
      <label className="field">{T('Notas / qué hace', 'Notes / what it does')}<textarea value={sp.notes ?? ''} onChange={(e) => set((x) => { x.notes = e.target.value; })} /></label>
      <div className="row">
        <button className="btn danger" onClick={() => { update((ch) => { ch.spells = ch.spells.filter((y) => y.id !== id); }); onClose(); }}>{T('Borrar', 'Delete')}</button>
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
