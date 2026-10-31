// Pantalla «Subir de nivel»: muestra lo que ganas según tu clase, te deja elegir las opciones que
// permiten las reglas (explicadas) y al pulsar LVL UP actualiza toda la ficha.
import { useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import type { Ability } from '../types';
import { L, T } from '../i18n';
import { ABILITIES, CLASSES, RESOURCE_NAMES, SKILLS, abilityShort, slotsFor, pactSlotsFor } from '../rules/srd';
import { fmt, mod, profBonus, rollExpr } from '../rules/calc';
import { BOONS, FEATS, FIGHTING_STYLES, INVOCATIONS, METAMAGIC, RECHARGE_LABEL, SUBCLASSES, levelEntry, inClassList, type Option } from '../rules/progression';
import { applyLevelUp, averageHitDie, levelUpDiff, newSpellAllowance, type LevelUpChoices } from '../rules/levelup';
import { SPELLS, findSpell } from '../rules/spells';

function OptionList({ options, selected, onToggle, max = 1 }: { options: Option[]; selected: string[]; onToggle: (id: string) => void; max?: number }) {
  return (
    <div className="lu-options">
      {options.map((op) => {
        const on = selected.includes(op.id);
        const full = !on && max > 1 && selected.length >= max;
        return (
          <button key={op.id} className={`lu-option ${on ? 'on' : ''}`} disabled={full} aria-pressed={on} onClick={() => onToggle(op.id)}>
            <b>{on ? '✓ ' : ''}{L(op.name)}</b>
            <span>{L(op.text)}</span>
          </button>
        );
      })}
    </div>
  );
}

function AbilityChips({ allowed, value, onChange }: { allowed: Ability[]; value: Ability | null; onChange: (a: Ability) => void }) {
  return (
    <div className="row wrap lu-abil">
      <span className="small muted">{T('+1 a:', '+1 to:')}</span>
      {allowed.map((a) => <button key={a} className={`btn small ${value === a ? 'primary' : ''}`} onClick={() => onChange(a)}>{abilityShort(a)}</button>)}
    </div>
  );
}

function Card({ title, done, children }: { title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card lu-card ${done === false ? 'pending' : ''}`}>
      <div className="card-head"><h2>{done ? '✅ ' : done === false ? '⬜ ' : ''}{title}</h2></div>
      {children}
    </section>
  );
}

export function LevelUpPage({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const replace = useStore((s) => s.replace);
  const showToast = useStore((s) => s.showToast);
  const cls = CLASSES.find((x) => x.id === c.classId);
  const level = c.level + 1;
  const entry = cls ? levelEntry(cls.id, level) : { features: [], choices: [] };
  const con = mod(c.abilities.con);
  const hitDie = cls?.hitDie ?? c.hitDie;

  const [hpMode, setHpMode] = useState<'avg' | 'roll'>('avg');
  const [hpRoll, setHpRoll] = useState('');
  const [subclass, setSubclass] = useState<string | undefined>();
  const [asiMode, setAsiMode] = useState<'asi' | 'feat'>('asi');
  const [plus, setPlus] = useState<Partial<Record<Ability, number>>>({});
  const [featId, setFeatId] = useState<string | undefined>();
  const [featAbility, setFeatAbility] = useState<Ability | null>(null);
  const [boonId, setBoonId] = useState<string | undefined>();
  const [boonAbility, setBoonAbility] = useState<Ability | null>(null);
  const [style, setStyle] = useState<string | undefined>();
  const [expertise, setExpertise] = useState<string[]>([]);
  const [metamagic, setMetamagic] = useState<string[]>([]);
  const [invocations, setInvocations] = useState<string[]>([]);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [spells, setSpells] = useState<string[]>([]);

  const rolled = Math.floor(Number(hpRoll));
  const rollValid = Number.isFinite(rolled) && rolled >= 1 && rolled <= hitDie;
  const hpGain = Math.max(1, (hpMode === 'avg' ? averageHitDie(hitDie) : rollValid ? rolled : 0) + con);

  const choice = <K extends string>(k: K) => entry.choices.find((x) => x.kind === k);
  const expChoice = entry.choices.find((x) => x.kind === 'expertise');
  const metaChoice = entry.choices.find((x) => x.kind === 'metamagic');
  const invChoice = entry.choices.find((x) => x.kind === 'invocation');
  const optionChoices = entry.choices.filter((x) => x.kind === 'option');
  const allowance = cls ? newSpellAllowance(cls.id, c.level) : { cantrips: 0, spells: 0, maxLevel: 0 };

  const knownSpell = (en: string) => c.spells.some((s) => findSpell(s.name)?.name.en === en);
  const classSpells = useMemo(() => (cls ? SPELLS.filter((s) => inClassList(s.name.en, cls.id) && s.level <= allowance.maxLevel && !knownSpell(s.name.en)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cls?.id, allowance.maxLevel, c.spells]);
  const pickedCantrips = spells.filter((n) => SPELLS.find((s) => s.name.en === n)?.level === 0).length;
  const pickedSpells = spells.length - pickedCantrips;

  const plusTotal = Object.values(plus).reduce((a, b) => a + (b ?? 0), 0);
  const feat = FEATS.find((f) => f.id === featId);
  const boon = BOONS.find((f) => f.id === boonId);
  const expPool = SKILLS.filter((s) => c.skillProf[s.id] === 1 && (!(expChoice && 'intOnly' in expChoice && expChoice.intOnly) || s.ability === 'int'));
  const expNeeded = expChoice && expChoice.kind === 'expertise' ? Math.min(expChoice.count, expPool.length) : 0;
  const invPool = INVOCATIONS.filter((x) => (x.minLevel ?? 1) <= level && !c.features.some((f) => f.name.includes(L(x.name))));
  const metaPool = METAMAGIC.filter((x) => !c.features.some((f) => f.name.includes(L(x.name))));

  const done = {
    hp: hpMode === 'avg' || rollValid,
    subclass: !choice('subclass') || !!subclass,
    asi: !choice('asi') || (asiMode === 'asi' ? plusTotal === 2 : !!feat && (!feat.abilities || !!featAbility)),
    boon: !choice('boon') || (!!boon && !!boonAbility),
    style: !choice('fightingStyle') || !!style,
    expertise: !expChoice || expertise.length === expNeeded,
    metamagic: !metaChoice || metamagic.length === (metaChoice.kind === 'metamagic' ? metaChoice.count : 0),
    invocations: !invChoice || invocations.length === Math.min(invChoice.kind === 'invocation' ? invChoice.count : 0, invPool.length),
    options: optionChoices.every((x) => x.kind === 'option' && options[x.id]),
  };
  const ready = Object.values(done).every(Boolean);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : max === 1 ? [id] : list.length < max ? [...list, id] : list);

  // Resumen de lo que cambia automáticamente
  const autoGains: string[] = [];
  if (profBonus(level) > profBonus(c.level)) autoGains.push(T(`Bonificador por competencia ${fmt(profBonus(c.level))} → ${fmt(profBonus(level))}`, `Proficiency Bonus ${fmt(profBonus(c.level))} → ${fmt(profBonus(level))}`));
  if (cls) {
    if (cls.caster === 'pact') {
      const a = pactSlotsFor(c.level); const b = pactSlotsFor(level);
      if (a.max !== b.max || a.level !== b.level) autoGains.push(T(`Espacios de pacto: ${b.max} de nivel ${b.level}`, `Pact slots: ${b.max} of level ${b.level}`));
    } else if (cls.caster !== 'none') {
      const a = slotsFor(cls.caster, c.level); const b = slotsFor(cls.caster, level);
      b.forEach((n, i) => { if (n > (a[i] ?? 0)) autoGains.push(T(`Espacios de nivel ${i + 1}: ${a[i] ?? 0} → ${n}`, `Level ${i + 1} slots: ${a[i] ?? 0} → ${n}`)); });
    }
    const ra = cls.resources(c.level, { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: mod(c.abilities.cha) });
    for (const r of cls.resources(level, { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: mod(c.abilities.cha) })) {
      const before = ra.find((x) => x.key === r.key)?.max ?? 0;
      if (r.max > before) autoGains.push(`${L(RESOURCE_NAMES[r.key])}: ${before} → ${r.max}`);
    }
    if ([5, 11, 17].includes(level) && c.spells.some((s) => s.level === 0)) autoGains.push(T('Tus trucos de daño mejoran.', 'Your damage cantrips get stronger.'));
  }

  const choices: LevelUpChoices = {
    hpGain,
    subclass,
    asi: choice('asi') && (asiMode === 'asi' || featId) ? (asiMode === 'asi' ? { mode: 'asi', plus } : { mode: 'feat', featId: featId!, ability: featAbility }) : undefined,
    boon: boonId ? { id: boonId, ability: boonAbility } : undefined,
    fightingStyle: style,
    expertise,
    metamagic,
    invocations,
    options,
    spells,
  };
  // Vista previa: la ficha tal y como quedará con lo elegido hasta ahora
  const preview = c.level < 20 ? applyLevelUp(c, choices) : c;
  const diff = levelUpDiff(c, preview);

  const lvlUp = () => {
    replace(preview);
    showToast(T(`⬆️ ¡Nivel ${level}!`, `⬆️ Level ${level}!`), [
      ...diff.stats.filter((x) => x.label !== T('Nivel', 'Level')).map((x) => (x.from ? `${x.label}: ${x.from} → ${x.to}` : `${x.label}: ${x.to}`)),
      ...diff.features.map((f) => `${f.updated ? '⬆️' : '+'} ${f.name}${f.recharge ? ` (${L(RECHARGE_LABEL[f.recharge])})` : ''}`),
      ...diff.spells.map((sp) => `✨ ${sp.name}`),
    ]);
    onClose();
  };

  return (
    <div className="levelup-page" role="dialog" aria-label={T('Subir de nivel', 'Level up')}>
      <div className="lu-head">
        <button className="icon-btn" onClick={onClose} aria-label={T('Cerrar', 'Close')}>✕</button>
        <div className="grow">
          <h2>⬆️ {T('Subir de nivel', 'Level up')}</h2>
          <p className="muted">{c.name} · {cls ? L(cls.name) : c.className || T('Sin clase', 'No class')} · {T('nivel', 'level')} {c.level} → <b>{level}</b></p>
        </div>
      </div>

      <div className="lu-body">
        {c.level >= 20 && <p className="reminders">{T('Ya estás en el nivel máximo (20).', 'You’re already at the maximum level (20).')}</p>}
        {!cls && <p className="reminders">{T('No reconozco tu clase, así que solo subiré el nivel y los PG. Elige una clase en «Más opciones» para ver tus opciones.', 'I don’t recognize your class, so I’ll only raise your level and HP. Pick a class in “More options” to see your options.')}</p>}

        <Card title={T('Puntos de golpe', 'Hit points')} done={done.hp}>
          <div className="segmented">
            <button className={hpMode === 'avg' ? 'on' : ''} onClick={() => setHpMode('avg')}>{T('Media fija', 'Fixed average')} ({averageHitDie(hitDie)})</button>
            <button className={hpMode === 'roll' ? 'on' : ''} onClick={() => setHpMode('roll')}>🎲 {T('Tirar', 'Roll')} 1d{hitDie}</button>
          </div>
          {hpMode === 'roll' && (
            <div className="row mt">
              <input className="grow big-input" type="number" inputMode="numeric" min={1} max={hitDie} placeholder={`1–${hitDie}`} value={hpRoll} onChange={(e) => setHpRoll(e.target.value)} />
              <button className="btn" onClick={() => setHpRoll(String(rollExpr(`1d${hitDie}`).total))}>{T('Que tire la app', 'Let the app roll')}</button>
            </div>
          )}
          <p className="lu-big">+{hpGain} {T('PG', 'HP')} <span className="muted small">({hpMode === 'avg' ? averageHitDie(hitDie) : rollValid ? rolled : '?'} {fmt(con)} CON)</span></p>
          <p className="hint">{T('Si subes la Constitución en este nivel, tus PG máximos aumentan además 1 por cada nivel.', 'If you raise Constitution at this level, your max HP also go up by 1 per level.')}</p>
        </Card>

        {(entry.features.length > 0 || autoGains.length > 0) && (
          <Card title={T('Lo que ganas', 'What you gain')}>
            <ul className="lu-gains">
              {autoGains.map((g) => <li key={g}>➕ {g}</li>)}
              {entry.features.map((f) => (
                <li key={f.name.en}><b>{f.subclass && c.subclass ? `${c.subclass}: ` : ''}{L(f.name)}</b><span>{L(f.text)}</span></li>
              ))}
            </ul>
          </Card>
        )}

        {cls && choice('subclass') && (
          <Card title={T('Elige tu subclase', 'Choose your subclass')} done={done.subclass}>
            <OptionList options={SUBCLASSES[cls.id] ?? []} selected={subclass ? [subclass] : []} onToggle={(id) => setSubclass(id)} />
          </Card>
        )}

        {choice('asi') && (
          <Card title={T('Mejora de característica o dote', 'Ability Score Improvement or feat')} done={done.asi}>
            <div className="segmented">
              <button className={asiMode === 'asi' ? 'on' : ''} onClick={() => setAsiMode('asi')}>{T('Características', 'Abilities')}</button>
              <button className={asiMode === 'feat' ? 'on' : ''} onClick={() => setAsiMode('feat')}>{T('Dote', 'Feat')}</button>
            </div>
            {asiMode === 'asi' ? (
              <>
                <p className="hint">{T('Reparte 2 puntos: +2 a una o +1 a dos (máximo 20).', 'Spend 2 points: +2 to one or +1 to two (maximum 20).')} {T('Quedan', 'Left')}: <b>{2 - plusTotal}</b></p>
                <div className="lu-asi">
                  {ABILITIES.map((a) => {
                    const p = plus[a.id] ?? 0;
                    const score = c.abilities[a.id] + p;
                    return (
                      <div key={a.id} className="lu-asi-row">
                        <b>{L(a.short)}</b>
                        <span>{c.abilities[a.id]}{p ? ` → ${score}` : ''} <small className="muted">({fmt(mod(score))})</small></span>
                        <button className="btn small" disabled={p === 0} onClick={() => setPlus({ ...plus, [a.id]: p - 1 })}>−</button>
                        <button className="btn small" disabled={plusTotal >= 2 || p >= 2 || score >= 20} onClick={() => setPlus({ ...plus, [a.id]: p + 1 })}>+</button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <OptionList options={FEATS} selected={featId ? [featId] : []} onToggle={(id) => { setFeatId(id); setFeatAbility(FEATS.find((f) => f.id === id)?.abilities?.length === 1 ? FEATS.find((f) => f.id === id)!.abilities![0] : null); }} />
                {feat?.abilities && <AbilityChips allowed={feat.abilities} value={featAbility} onChange={setFeatAbility} />}
              </>
            )}
          </Card>
        )}

        {choice('boon') && (
          <Card title={T('Don épico', 'Epic Boon')} done={done.boon}>
            <OptionList options={BOONS} selected={boonId ? [boonId] : []} onToggle={(id) => { setBoonId(id); setBoonAbility(null); }} />
            {boon?.abilities && <AbilityChips allowed={boon.abilities} value={boonAbility} onChange={setBoonAbility} />}
          </Card>
        )}

        {choice('fightingStyle') && (
          <Card title={T('Estilo de combate', 'Fighting Style')} done={done.style}>
            <OptionList options={FIGHTING_STYLES.filter((x) => !c.features.some((f) => f.name.includes(L(x.name))))} selected={style ? [style] : []} onToggle={setStyle} />
          </Card>
        )}

        {expChoice && expChoice.kind === 'expertise' && (
          <Card title={T(`Pericia (elige ${expNeeded})`, `Expertise (choose ${expNeeded})`)} done={done.expertise}>
            <p className="hint">{T('Duplicas tu bonificador de competencia en estas habilidades.', 'You double your Proficiency Bonus for these skills.')}</p>
            {expPool.length === 0 && <p className="muted">{T('No tienes habilidades competentes elegibles. Marca tus competencias en la hoja.', 'You have no eligible proficient skills. Tick your proficiencies on the sheet.')}</p>}
            <div className="row wrap">
              {expPool.map((s) => (
                <button key={s.id} className={`btn small ${expertise.includes(s.id) ? 'primary' : ''}`} onClick={() => toggle(expertise, setExpertise, s.id, expNeeded)}>{L(s.name)}</button>
              ))}
            </div>
          </Card>
        )}

        {metaChoice && metaChoice.kind === 'metamagic' && (
          <Card title={T(`Metamagia (elige ${metaChoice.count})`, `Metamagic (choose ${metaChoice.count})`)} done={done.metamagic}>
            <OptionList options={metaPool} selected={metamagic} max={metaChoice.count} onToggle={(id) => toggle(metamagic, setMetamagic, id, metaChoice.count)} />
          </Card>
        )}

        {invChoice && invChoice.kind === 'invocation' && (
          <Card title={T(`Invocaciones (elige ${invChoice.count})`, `Invocations (choose ${invChoice.count})`)} done={done.invocations}>
            <OptionList options={invPool} selected={invocations} max={invChoice.count} onToggle={(id) => toggle(invocations, setInvocations, id, invChoice.count)} />
          </Card>
        )}

        {optionChoices.map((oc) => oc.kind === 'option' && (
          <Card key={oc.id} title={L(oc.title)} done={!!options[oc.id]}>
            <OptionList options={oc.options} selected={options[oc.id] ? [options[oc.id]] : []} onToggle={(id) => setOptions({ ...options, [oc.id]: id })} />
          </Card>
        ))}

        {cls && (allowance.cantrips > 0 || allowance.spells > 0) && (
          <Card title={T('Conjuros nuevos (opcional)', 'New spells (optional)')}>
            <p className="hint">
              {allowance.cantrips > 0 && T(`Puedes aprender ${allowance.cantrips} truco(s) más. `, `You can learn ${allowance.cantrips} more cantrip(s). `)}
              {allowance.spells > 0 && T(`Puedes preparar ${allowance.spells} conjuro(s) más, de nivel ${allowance.maxLevel} como máximo.`, `You can prepare ${allowance.spells} more spell(s), up to level ${allowance.maxLevel}.`)}
              {' '}{T('Solo aparecen los conjuros de la base de la app; los demás añádelos a mano en la hoja.', 'Only spells in the app’s database are listed; add others by hand on the sheet.')}
            </p>
            <div className="lu-options">
              {classSpells.filter((s) => (s.level === 0 ? allowance.cantrips > 0 : allowance.spells > 0)).map((s) => {
                const on = spells.includes(s.name.en);
                const full = !on && (s.level === 0 ? pickedCantrips >= allowance.cantrips : pickedSpells >= allowance.spells);
                return (
                  <button key={s.name.en} className={`lu-option ${on ? 'on' : ''}`} disabled={full} onClick={() => setSpells(on ? spells.filter((x) => x !== s.name.en) : [...spells, s.name.en])}>
                    <b>{on ? '✓ ' : ''}{L(s.name)} <small className="muted">{s.level ? T(`nv ${s.level}`, `lvl ${s.level}`) : T('truco', 'cantrip')} · {L(s.time)} · {L(s.range)}{s.concentration ? ' · 🧠' : ''}</small></b>
                    <span>{L(s.text)}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <Card title={T('Resumen: así quedará tu ficha', 'Summary: your sheet after leveling up')}>
          <table className="lu-summary">
            <tbody>
              {diff.stats.map((x) => (
                <tr key={x.label}><th>{x.label}</th><td>{x.from && <><span className="muted">{x.from}</span> → </>}<b>{x.to}</b></td></tr>
              ))}
            </tbody>
          </table>
          {diff.features.length > 0 && (
            <>
              <h3 className="lu-sub">{T('Rasgos nuevos o mejorados en tu ficha', 'New or improved features on your sheet')}</h3>
              <ul className="lu-gains">
                {diff.features.map((f) => (
                  <li key={f.name}><b>{f.updated ? '⬆️ ' : '➕ '}{f.name}{f.updated && <small className="muted"> ({T('mejora', 'improved')})</small>}{f.recharge && <span className="recharge-tag">{L(RECHARGE_LABEL[f.recharge])}</span>}</b><span>{f.text}</span></li>
                ))}
              </ul>
            </>
          )}
          {diff.spells.length > 0 && (
            <>
              <h3 className="lu-sub">{T('Conjuros que se añaden', 'Spells added')}</h3>
              <ul className="lu-gains">
                {diff.spells.map((sp) => (
                  <li key={sp.name}>
                    <b>{sp.name} <span className="spell-comp">{['V', 'S', 'M'].filter((k) => sp.components.includes(k)).map((k) => <b key={k} className={`comp-${k}`}>{k}</b>)}{sp.concentration && <i className="comp-tag">C</i>}</span></b>
                    <span>{sp.level === 0 ? T('Truco · a voluntad', 'Cantrip · at will') : T(`Nivel ${sp.level} · gasta un espacio de conjuro`, `Level ${sp.level} · uses a spell slot`)}{sp.always ? T(' · siempre preparado (rasgo de clase)', ' · always prepared (class feature)') : ''}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {diff.feats.length > 0 && <p className="small">🎖️ {T('Dotes', 'Feats')}: {diff.feats.join(', ')}</p>}
        </Card>
      </div>

      <div className="lu-foot">
        {!ready && <span className="small muted">{T('Completa las opciones marcadas con ⬜', 'Complete the options marked ⬜')}</span>}
        <button className="btn primary big grow lu-go" disabled={!ready || c.level >= 20} onClick={lvlUp}>⬆️ LVL UP</button>
      </div>
    </div>
  );
}
