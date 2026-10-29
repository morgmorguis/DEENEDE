import { useState } from 'react';
import { useChar, useStore } from '../store';
import { abilityMods, activeReminders, armorClass, attackBonus, fmt, rollContext, speed, spellAttack, spellSaveDc } from '../rules/calc';
import { ACTIONS, MASTERIES, damageTypeName } from '../rules/srd';
import { Pips, Section, useDamageRoll, useRoll } from './common';
import { EffectPicker } from './Sheet';

export function CombatTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const run = useStore((s) => s.runCommands);
  const roll = useRoll();
  const dmgRoll = useDamageRoll();
  const [crit, setCrit] = useState(false);
  const [effOpen, setEffOpen] = useState(false);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const spd = speed(c);
  const ac = armorClass(c);
  const m = abilityMods(c);
  const atkCtx = rollContext(c, { kind: 'attack' });
  const reminders = activeReminders(c);
  const incapacitated = c.conditions.some((x) => ['incapacitado', 'aturdido', 'paralizado', 'petrificado', 'inconsciente'].includes(x)) || c.hp.current === 0;
  const moveLeft = Math.max(0, spd.value - c.combat.movementUsed);

  if (!c.combat.active) {
    return (
      <div className="tab">
        <div className="empty-combat">
          <div className="big-emoji">⚔️</div>
          <h2>Modo combate</h2>
          <p className="muted">Controla tu acción, acción adicional, reacción y movimiento cada ronda; ve tus ataques con su alcance y recuerda qué te afecta.</p>
          <button className="btn primary big" onClick={() => {
            update((x) => { x.combat = { active: true, round: 1, initiative: null, action: false, bonus: false, reaction: false, movementUsed: 0 }; });
            run('¡Empieza el combate! Tiro iniciativa', [{ type: 'rollInitiative' }]);
          }}>¡Empezar combate! (tira iniciativa)</button>
        </div>
      </div>
    );
  }

  const Toggle = ({ k, label, hint }: { k: 'action' | 'bonus' | 'reaction'; label: string; hint: string }) => (
    <button className={`economy ${c.combat[k] ? 'used' : ''}`} disabled={incapacitated} onClick={() => update((x) => { x.combat[k] = !x.combat[k]; })}>
      <span className="eco-label">{label}</span>
      <span className="eco-state">{incapacitated ? 'No disponible' : c.combat[k] ? 'Usada' : 'Disponible'}</span>
      <span className="eco-hint">{hint}</span>
    </button>
  );

  return (
    <div className="tab">
      <div className="combat-head">
        <div><span className="muted">Ronda</span> <b className="big-num">{c.combat.round}</b></div>
        <button className="pill" onClick={() => run('Tiro iniciativa', [{ type: 'rollInitiative' }])}>Iniciativa {c.combat.initiative ?? '—'}</button>
        <div className="pill">CA <b>{ac.value}</b></div>
        <div className="pill">Vel. <b>{spd.value}</b></div>
        <button className="pill end-turn" onClick={() => run('Fin de turno', [{ type: 'nextRound' }])}>Fin de turno ⏭️</button>
      </div>

      {reminders.length > 0 && <div className="reminders">{reminders.map((r, i) => <div key={i}>⚠️ {r}</div>)}</div>}

      <div className="economy-row">
        <Toggle k="action" label="Acción" hint="Atacar, Magia, Correr…" />
        <Toggle k="bonus" label="Adicional" hint="Si un rasgo lo permite" />
        <Toggle k="reaction" label="Reacción" hint="Ataque de oportunidad…" />
      </div>

      <Section title={`Movimiento: ${moveLeft} / ${spd.value} pies`}>
        <div className="move-track"><div style={{ width: `${spd.value ? Math.min(100, (moveLeft / spd.value) * 100) : 0}%` }} /></div>
        <div className="row wrap mt">
          {[5, 10, 15, 30].map((n) => (
            <button key={n} className="btn small" disabled={moveLeft < n} onClick={() => update((x) => { x.combat.movementUsed += n; })}>−{n}</button>
          ))}
          <button className="btn small" onClick={() => update((x) => { x.combat.movementUsed -= spd.value; })} title="Acción Correr">Correr (+{spd.value})</button>
          <button className="btn small" onClick={() => update((x) => { x.combat.movementUsed = 0; })}>Reiniciar</button>
        </div>
        {c.conditions.includes('derribado') && <p className="hint">Derribado: levantarte cuesta {Math.floor(spd.value / 2)} pies. <button className="link" onClick={() => run('Me levanto', [{ type: 'removeCondition', condition: 'derribado' }])}>Levantarme</button></p>}
        <p className="hint">Terreno difícil: cada pie cuesta 2. Arrastrarse o trepar sin velocidad de trepar: también cuesta el doble.</p>
      </Section>

      <Section title="Ataques" right={<label className="check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Crítico</label>}>
        {(atkCtx.advantage.length > 0 || atkCtx.disadvantage.length > 0) && (
          <p className="hint">
            {atkCtx.advantage.length > 0 && <>✅ Ventaja: {atkCtx.advantage.join(', ')}. </>}
            {atkCtx.disadvantage.length > 0 && <>⬇️ Desventaja: {atkCtx.disadvantage.join(', ')}.</>}
          </p>
        )}
        {c.attacks.length === 0 && <p className="muted">Añade tus armas en Hoja → Editar.</p>}
        {c.attacks.map((a) => {
          const bonus = attackBonus(c, a.ability, a.proficient, a.extraBonus);
          const flat = m[a.ability];
          const mastery = MASTERIES.find((x) => x.name === a.mastery);
          return (
            <div key={a.id} className="attack">
              <div className="attack-head">
                <b>{a.name}</b>
                <span className="range">📏 {a.range}</span>
              </div>
              <div className="muted small">{fmt(bonus)} para impactar · {a.damage}{flat ? fmt(flat) : ''} {damageTypeName(a.damageType).toLowerCase()}{a.notes ? ` · ${a.notes}` : ''}</div>
              {mastery && <div className="small mastery">⚙️ {mastery.name}: {mastery.text}</div>}
              <div className="row mt">
                <button className="btn grow" onClick={() => { roll(c, { kind: 'attack' }, bonus, `Ataque: ${a.name}`); if (!c.combat.action) update((x) => { x.combat.action = true; }); }}>🎲 Atacar {fmt(bonus)}</button>
                <button className="btn grow" onClick={() => { dmgRoll(c, a.name, a.damage, flat, crit, 'damage', a.ability === 'str'); setCrit(false); }}>💥 Daño</button>
              </div>
            </div>
          );
        })}
      </Section>

      {(c.spells.length > 0 || c.spellAbility) && (
        <Section title="Conjuros" right={c.spellAbility ? <span className="small muted">CD {spellSaveDc(c)} · {fmt(spellAttack(c)!)}</span> : undefined}>
          {c.effects.some((e) => e.presetId === 'furia') && <p className="hint">⚠️ En Furia no puedes lanzar conjuros ni concentrarte.</p>}
          {c.spellAbility && <button className="btn small" onClick={() => roll(c, { kind: 'attack' }, spellAttack(c)!, 'Ataque de conjuro')}>🎲 Ataque de conjuro {fmt(spellAttack(c)!)}</button>}
          <div className="slots-inline">
            {c.slots.map((s, i) => s.max > 0 && (
              <div key={i} className="res-line"><span className="grow">Nv {i + 1}</span><Pips max={s.max} used={s.used} onChange={(u) => update((x) => { x.slots[i].used = u; })} /></div>
            ))}
            {c.pactSlots && <div className="res-line"><span className="grow">Pacto nv {c.pactSlots.level}</span><Pips max={c.pactSlots.max} used={c.pactSlots.used} onChange={(u) => update((x) => { x.pactSlots!.used = u; })} /></div>}
          </div>
          {[...c.spells].sort((a, b) => a.level - b.level).map((s) => (
            <div key={s.id} className="spell-line">
              <div className="grow">
                <b>{s.name}</b> <span className="muted small">{s.level ? `nv ${s.level}` : 'truco'} · {s.castingTime} · 📏 {s.range}{s.concentration ? ' · 🧠' : ''}</span>
                {s.notes && <div className="small muted">{s.notes}</div>}
              </div>
              <button className="btn small" onClick={() => {
                const cmds = [] as Parameters<typeof run>[1];
                if (s.level > 0) cmds.push({ type: 'useSlot', level: s.level });
                if (s.concentration) cmds.push({ type: 'concentrate', spell: s.name });
                run(`Lanzo ${s.name}`, cmds.length ? cmds : [{ type: 'info', text: `Lanzas ${s.name}.` }]);
              }}>Lanzar</button>
            </div>
          ))}
        </Section>
      )}

      {c.resources.length > 0 && (
        <Section title="Recursos">
          {c.resources.map((r) => (
            <div key={r.id} className="res-line">
              <span className="grow">{r.name}</span>
              {r.max <= 12 ? <Pips max={r.max} used={r.used} onChange={(u) => update((x) => { x.resources.find((y) => y.id === r.id)!.used = u; })} /> : <b>{r.max - r.used}/{r.max}</b>}
            </div>
          ))}
          {c.resources.some((r) => r.name === 'Furia') && !c.effects.some((e) => e.presetId === 'furia') && (
            <button className="btn full mt" onClick={() => { run('Entro en furia', [{ type: 'addEffect', presetId: 'furia' }]); update((x) => { x.combat.bonus = true; }); }}>😡 Entrar en Furia (acción adicional)</button>
          )}
          {c.resources.some((r) => r.name === 'Tomar aliento') && (
            <button className="btn full mt" onClick={() => { run('Uso Tomar aliento', [{ type: 'useResource', name: 'Tomar aliento' }, { type: 'heal', dice: `1d10+${c.level}`, source: 'Tomar aliento' }]); update((x) => { x.combat.bonus = true; }); }}>💨 Tomar aliento (1d10+{c.level})</button>
          )}
        </Section>
      )}

      <Section title="Efectos activos" right={<button className="btn small" onClick={() => setEffOpen(true)}>+ Efecto</button>}>
        {c.effects.length === 0 && <span className="muted">Ninguno.</span>}
        {c.effects.map((e) => (
          <div key={e.id} className="res-line">
            <span className="grow">{e.kind === 'buff' ? '🟢' : '🔴'} {e.name} <span className="muted small">{e.notes}</span></span>
            <b>{e.roundsLeft != null ? `${e.roundsLeft}r` : '∞'}</b>
            <button className="icon-btn" aria-label={`Quitar ${e.name}`} onClick={() => run(null, [{ type: 'removeEffect', name: e.name }])}>✕</button>
          </div>
        ))}
      </Section>

      <Section title="¿Qué puedo hacer?">
        <div className="actions-grid">
          {ACTIONS.map((a) => (
            <button key={a.id} className={`action-chip cost-${a.cost.replace(/\s/g, '-')} ${openAction === a.id ? 'open' : ''}`} onClick={() => setOpenAction(openAction === a.id ? null : a.id)}>
              <b>{a.name}</b><span className="small">{a.cost}</span>
              {openAction === a.id && <span className="small action-text">{a.text}</span>}
            </button>
          ))}
        </div>
      </Section>

      <div className="combat-footer">
        <button className="btn primary grow big" onClick={() => run('Fin de turno', [{ type: 'nextRound' }])}>⏭️ Fin de turno / nueva ronda</button>
        <button className="btn" onClick={() => {
          update((x) => { x.combat.active = false; x.combat.initiative = null; });
          useStore.getState().pushLog({ role: 'app', text: 'Fin del combate.' });
        }}>Terminar</button>
      </div>
      {effOpen && <EffectPicker onClose={() => setEffOpen(false)} />}
    </div>
  );
}
