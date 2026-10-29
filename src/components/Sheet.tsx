import { useState } from 'react';
import { useChar, useStore } from '../store';
import {
  abilityMods, activeReminders, armorClass, fmt, passivePerception, profBonus, rollContext, saveBonus, skillBonus,
  speed, spellAttack, spellSaveDc,
} from '../rules/calc';
import { ABILITIES, CONDITIONS, EFFECT_PRESETS, SKILLS, abilityShort, damageTypeName } from '../rules/srd';
import type { ConditionId } from '../types';
import { Modal, Pips, Section, useRoll } from './common';
import { Editor } from './Editor';

export function SheetTab() {
  const c = useChar();
  const roll = useRoll();
  const update = useStore((s) => s.update);
  const run = useStore((s) => s.runCommands);
  const [editing, setEditing] = useState(false);
  const [skillOpen, setSkillOpen] = useState<string | null>(null);
  const [condOpen, setCondOpen] = useState(false);
  const [effOpen, setEffOpen] = useState(false);
  const [info, setInfo] = useState<{ title: string; lines: string[] } | null>(null);
  const m = abilityMods(c);
  const ac = armorClass(c);
  const spd = speed(c);
  const reminders = activeReminders(c);

  if (editing) return <Editor onDone={() => setEditing(false)} />;

  return (
    <div className="tab">
      <div className="sheet-title">
        <div>
          <h1>{c.name}</h1>
          <div className="muted">{c.species} · {c.className}{c.subclass ? ` (${c.subclass})` : ''} {c.level} · {c.background}</div>
        </div>
        <button className="btn small" onClick={() => setEditing(true)}>✏️ Editar</button>
      </div>

      {reminders.length > 0 && (
        <div className="reminders">
          {reminders.map((r, i) => <div key={i}>⚠️ {r}</div>)}
        </div>
      )}

      <div className="stat-row">
        <button className="stat" onClick={() => setInfo({ title: `Clase de Armadura ${ac.value}`, lines: ac.parts })}>
          <span className="stat-label">CA</span><span className="stat-value">{ac.value}</span>
        </button>
        <button className="stat" onClick={() => run('Tiro iniciativa', [{ type: 'rollInitiative' }])}>
          <span className="stat-label">Iniciativa</span><span className="stat-value">{fmt(m.dex)}</span>
        </button>
        <button className="stat" onClick={() => setInfo({ title: `Velocidad ${spd.value} pies`, lines: spd.parts })}>
          <span className="stat-label">Velocidad</span><span className="stat-value">{spd.value}</span>
        </button>
        <div className="stat">
          <span className="stat-label">Competencia</span><span className="stat-value">{fmt(profBonus(c.level))}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Perc. pasiva</span><span className="stat-value">{passivePerception(c)}</span>
        </div>
      </div>

      <div className="abilities">
        {ABILITIES.map((a) => (
          <button key={a.id} className="ability" onClick={() => roll(c, { kind: 'check', ability: a.id }, m[a.id], `Prueba de ${a.name}`)}>
            <span className="ab-short">{a.short}</span>
            <span className="ab-mod">{fmt(m[a.id])}</span>
            <span className="ab-score">{c.abilities[a.id]}</span>
          </button>
        ))}
      </div>

      <Section title="Salvaciones">
        <div className="grid2">
          {ABILITIES.map((a) => {
            const ctx = rollContext(c, { kind: 'save', ability: a.id });
            return (
              <button key={a.id} className="line-btn" onClick={() => roll(c, { kind: 'save', ability: a.id }, saveBonus(c, a.id), `Salvación de ${a.short}`)}>
                <span className={`dot ${c.saveProf.includes(a.id) ? 'on' : ''}`} />
                <span className="grow">{a.name}</span>
                {ctx.autoFail.length > 0 && <span className="tag bad">falla</span>}
                {ctx.advantage.length > 0 && <span className="tag good">V</span>}
                {ctx.disadvantage.length > 0 && <span className="tag bad">D</span>}
                <b>{fmt(saveBonus(c, a.id))}</b>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Habilidades" right={<span className="hint">Toca para ver qué hace</span>}>
        <div className="skills">
          {SKILLS.map((s) => {
            const ctx = rollContext(c, { kind: 'check', ability: s.ability, skill: s.id });
            const p = c.skillProf[s.id] ?? 0;
            return (
              <button key={s.id} className="line-btn" onClick={() => setSkillOpen(s.id)}>
                <span className={`dot ${p === 2 ? 'exp' : p === 1 ? 'on' : ''}`} />
                <span className="grow">{s.name} <span className="muted small">({abilityShort(s.ability)})</span></span>
                {ctx.autoFail.length > 0 && <span className="tag bad">!</span>}
                {ctx.advantage.length > 0 && <span className="tag good">V</span>}
                {ctx.disadvantage.length > 0 && <span className="tag bad">D</span>}
                <b>{fmt(skillBonus(c, s.id))}</b>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Estado" right={<div className="row"><button className="btn small" onClick={() => setCondOpen(true)}>+ Condición</button><button className="btn small" onClick={() => setEffOpen(true)}>+ Efecto</button></div>}>
        <div className="chips">
          {c.conditions.length === 0 && c.effects.length === 0 && <span className="muted">Sin condiciones ni efectos activos.</span>}
          {c.conditions.map((id) => {
            const info = CONDITIONS.find((x) => x.id === id)!;
            return (
              <span key={id} className="chip bad">
                <button className="chip-label" onClick={() => setInfo({ title: info.name, lines: info.effects })}>{info.name}</button>
                <button className="chip-x" aria-label={`Quitar ${info.name}`} onClick={() => run(null, [{ type: 'removeCondition', condition: id }])}>✕</button>
              </span>
            );
          })}
          {c.effects.map((e) => (
            <span key={e.id} className={`chip ${e.kind === 'buff' ? 'good' : 'bad'}`}>
              <button className="chip-label" onClick={() => setInfo({ title: e.name, lines: [e.notes ?? '', e.roundsLeft != null ? `Quedan ${e.roundsLeft} rondas.` : 'Sin límite de rondas.', e.concentration ? 'Requiere concentración (de quien lo lanzó).' : ''].filter(Boolean) })}>
                {e.name}{e.roundsLeft != null ? ` · ${e.roundsLeft}r` : ''}
              </button>
              <button className="chip-x" aria-label={`Quitar ${e.name}`} onClick={() => run(null, [{ type: 'removeEffect', name: e.name }])}>✕</button>
            </span>
          ))}
        </div>
        <div className="row wrap mt">
          <span>Agotamiento:</span>
          <button className="btn small" onClick={() => run(null, [{ type: 'exhaustion', delta: -1 }])} disabled={c.exhaustion === 0}>−</button>
          <b>{c.exhaustion}</b>
          <button className="btn small" onClick={() => run(null, [{ type: 'exhaustion', delta: 1 }])}>+</button>
          <label className="check"><input type="checkbox" checked={c.heroicInspiration} onChange={(e) => run(null, [{ type: 'inspiration', value: e.target.checked }])} /> ⭐ Inspiración heroica</label>
        </div>
        {c.concentratingOn && (
          <div className="row mt">
            <span>🧠 Concentración: <b>{c.concentratingOn}</b></span>
            <button className="btn small" onClick={() => run(null, [{ type: 'endConcentration' }])}>Terminar</button>
          </div>
        )}
        {(c.resistances.length > 0 || c.immunities.length > 0 || c.vulnerabilities.length > 0) && (
          <div className="small mt">
            {c.resistances.length > 0 && <div>Resistencias: {c.resistances.map(damageTypeName).join(', ')}</div>}
            {c.immunities.length > 0 && <div>Inmunidades: {c.immunities.map(damageTypeName).join(', ')}</div>}
            {c.vulnerabilities.length > 0 && <div>Vulnerabilidades: {c.vulnerabilities.map(damageTypeName).join(', ')}</div>}
          </div>
        )}
      </Section>

      {(c.resources.length > 0 || c.hitDie) && (
        <Section title="Recursos">
          <div className="res-line">
            <span className="grow">Dados de golpe (d{c.hitDie})</span>
            <Pips max={c.level} used={c.hitDiceSpent} onChange={(u) => update((x) => { x.hitDiceSpent = u; })} />
          </div>
          {c.resources.map((r) => (
            <div key={r.id} className="res-line">
              <span className="grow">{r.name} <span className="muted small">({r.recovers === 'short' ? 'desc. corto' : 'desc. largo'})</span></span>
              {r.max <= 12 ? (
                <Pips max={r.max} used={r.used} onChange={(u) => update((x) => { x.resources.find((y) => y.id === r.id)!.used = u; })} />
              ) : (
                <div className="row">
                  <button className="btn small" onClick={() => update((x) => { const y = x.resources.find((z) => z.id === r.id)!; y.used = Math.min(y.max, y.used + 1); })}>−</button>
                  <b>{r.max - r.used}/{r.max}</b>
                  <button className="btn small" onClick={() => update((x) => { const y = x.resources.find((z) => z.id === r.id)!; y.used = Math.max(0, y.used - 1); })}>+</button>
                </div>
              )}
            </div>
          ))}
          <div className="row mt">
            <button className="btn grow" onClick={() => run('Descanso corto', [{ type: 'rest', kind: 'short', hitDice: 0 }])}>⛺ Descanso corto</button>
            <button className="btn grow" onClick={() => run('Descanso largo', [{ type: 'rest', kind: 'long' }])}>🌙 Descanso largo</button>
          </div>
          {c.hitDiceSpent < c.level && c.hp.current < c.hp.max && (
            <button className="btn small mt" onClick={() => run('Gasto 1 dado de golpe', [{ type: 'rest', kind: 'short', hitDice: 1 }])}>Gastar 1 dado de golpe (descanso corto)</button>
          )}
        </Section>
      )}

      {(c.slots.some((s) => s.max > 0) || c.pactSlots) && (
        <Section title="Conjuros" right={c.spellAbility ? <span className="muted small">CD {spellSaveDc(c)} · ataque {fmt(spellAttack(c)!)}</span> : undefined}>
          {c.slots.map((s, i) => s.max > 0 && (
            <div key={i} className="res-line">
              <span className="grow">Nivel {i + 1}</span>
              <Pips max={s.max} used={s.used} onChange={(u) => update((x) => { x.slots[i].used = u; })} />
            </div>
          ))}
          {c.pactSlots && (
            <div className="res-line">
              <span className="grow">Pacto (nivel {c.pactSlots.level})</span>
              <Pips max={c.pactSlots.max} used={c.pactSlots.used} onChange={(u) => update((x) => { x.pactSlots!.used = u; })} />
            </div>
          )}
          {c.spells.length > 0 && (
            <ul className="list">
              {[...c.spells].sort((a, b) => a.level - b.level).map((s) => (
                <li key={s.id}>
                  <button className="link" onClick={() => setInfo({ title: s.name, lines: [`${s.level ? `Nivel ${s.level}` : 'Truco'} · ${s.castingTime} · alcance ${s.range}${s.concentration ? ' · concentración' : ''}`, s.notes ?? ''] })}>
                    {s.level ? `${s.level}º` : 'T'} · {s.name}{s.concentration ? ' 🧠' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Rasgos y capacidades">
        {c.features.length === 0 && <span className="muted">Añade rasgos desde Editar.</span>}
        {c.features.map((f) => (
          <details key={f.id} className="feature">
            <summary>{f.name}</summary>
            <p>{f.text}</p>
          </details>
        ))}
      </Section>

      <Section title="Inventario">
        <textarea className="inv" value={c.inventory} placeholder="Equipo, monedas, objetos mágicos…" onChange={(e) => update((x) => { x.inventory = e.target.value; })} />
      </Section>

      {skillOpen && <SkillModal id={skillOpen} onClose={() => setSkillOpen(null)} />}
      {condOpen && (
        <Modal title="Añadir condición" onClose={() => setCondOpen(false)}>
          <div className="pick-list">
            {CONDITIONS.map((x) => (
              <button key={x.id} className="pick" disabled={c.conditions.includes(x.id)} onClick={() => { run(null, [{ type: 'addCondition', condition: x.id as ConditionId }]); setCondOpen(false); }}>
                <b>{x.name}</b><span className="small muted">{x.short}</span>
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

function SkillModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useChar();
  const roll = useRoll();
  const s = SKILLS.find((x) => x.id === id)!;
  const ctx = rollContext(c, { kind: 'check', ability: s.ability, skill: s.id });
  const p = c.skillProf[s.id] ?? 0;
  const ab = ABILITIES.find((a) => a.id === s.ability)!;
  return (
    <Modal title={s.name} onClose={onClose}>
      <p>{s.desc}</p>
      <p className="muted"><i>Ejemplos:</i> {s.examples}</p>
      <div className="calc">
        <div>Modificador de {ab.name}: {fmt(abilityMods(c)[s.ability])}</div>
        <div>Competencia: {p === 0 ? 'no' : p === 1 ? `sí (${fmt(profBonus(c.level))})` : `pericia (${fmt(2 * profBonus(c.level))})`}</div>
        <div><b>Bonificador total: {fmt(skillBonus(c, s.id))}</b></div>
      </div>
      {(ctx.advantage.length + ctx.disadvantage.length + ctx.autoFail.length + ctx.penalties.length) > 0 ? (
        <div className="reminders">
          <b>Limitaciones actuales:</b>
          {ctx.advantage.map((x) => <div key={x}>✅ Ventaja por {x}</div>)}
          {ctx.disadvantage.map((x) => <div key={x}>⬇️ Desventaja por {x}</div>)}
          {ctx.autoFail.map((x) => <div key={x}>⛔ {x}</div>)}
          {ctx.penalties.map((x) => <div key={x}>➖ {x}</div>)}
        </div>
      ) : <p className="muted">Ahora mismo no tienes nada que afecte a esta habilidad.</p>}
      <button className="btn primary full" onClick={() => { roll(c, { kind: 'check', ability: s.ability, skill: s.id }, skillBonus(c, s.id), s.name); onClose(); }}>🎲 Tirar {s.name}</button>
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
    <Modal title="Añadir beneficio o perjuicio" onClose={onClose}>
      <div className="pick-list">
        {EFFECT_PRESETS.map((p) => (
          <button key={p.id} className="pick" onClick={() => { run(null, [{ type: 'addEffect', presetId: p.id }]); onClose(); }}>
            <b>{p.kind === 'buff' ? '🟢' : '🔴'} {p.name}{p.concentration ? ' 🧠' : ''}</b>
            <span className="small muted">{p.notes}</span>
          </button>
        ))}
      </div>
      <h4>Personalizado</h4>
      <input placeholder="Nombre (p. ej. Bendición del druida)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="row">
        <input type="number" placeholder="Rondas (vacío = sin límite)" value={rounds} onChange={(e) => setRounds(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as 'buff' | 'debuff')}>
          <option value="buff">Beneficio</option>
          <option value="debuff">Perjuicio</option>
        </select>
      </div>
      <input placeholder="Notas (qué hace)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn primary full" disabled={!name.trim()} onClick={() => {
        run(null, [{ type: 'addEffect', name: name.trim(), rounds: rounds ? Number(rounds) : null, notes }]);
        if (kind === 'debuff') useStore.getState().update((c) => { const e = c.effects[c.effects.length - 1]; if (e) e.kind = 'debuff'; });
        onClose();
      }}>Añadir</button>
    </Modal>
  );
}
