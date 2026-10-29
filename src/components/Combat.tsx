import { useState } from 'react';
import { useChar, useStore } from '../store';
import { abilityMods, activeReminders, armorClass, attackBonus, fmt, rollContext, speed, spellAttack, spellSaveDc } from '../rules/calc';
import { ACTIONS, COST_NAMES, damageTypeName, effectName, effectNotes, findMastery, resourceName } from '../rules/srd';
import { Pips, Section, useDamageRoll, useRoll } from './common';
import { EffectPicker } from './Sheet';
import { InitiativePrompt, InitiativeTracker } from './Initiative';
import { L, T } from '../i18n';

export function CombatTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const run = useStore((s) => s.runCommands);
  const roll = useRoll();
  const dmgRoll = useDamageRoll();
  const [crit, setCrit] = useState(false);
  const [effOpen, setEffOpen] = useState(false);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [initPrompt, setInitPrompt] = useState(false);
  const startCombat = useStore((s) => s.startCombat);
  const endCombat = useStore((s) => s.endCombat);
  const endTurn = useStore((s) => s.endTurn);
  const spd = speed(c);
  const ac = armorClass(c);
  const m = abilityMods(c);
  const atkCtx = rollContext(c, { kind: 'attack' });
  const reminders = activeReminders(c);
  const incapacitated = c.conditions.some((x) => ['incapacitado', 'aturdido', 'paralizado', 'petrificado', 'inconsciente'].includes(x)) || c.hp.current === 0;
  const moveLeft = Math.max(0, spd.value - c.combat.movementUsed);
  const ft = T('pies', 'ft');
  const rage = c.resources.find((r) => r.key === 'rage');
  const secondWind = c.resources.find((r) => r.key === 'second_wind');

  if (!c.combat.active) {
    return (
      <div className="tab">
        {initPrompt && <InitiativePrompt onClose={() => setInitPrompt(false)} />}
        <div className="empty-combat">
          <div className="big-emoji">⚔️</div>
          <h2>{T('Modo combate', 'Combat mode')}</h2>
          <p className="muted">{T('Controla tu acción, acción adicional, reacción y movimiento cada ronda; ve tus ataques con su alcance y recuerda qué te afecta.', 'Track your action, bonus action, reaction and movement each round; see your attacks with their range and what is affecting you.')}</p>
          <button className="btn primary big" onClick={() => { startCombat(); setInitPrompt(true); }}>{T('¡Empezar combate!', 'Start combat!')}</button>
          <p className="hint">{T('Te preguntaré tu tirada de iniciativa; podrás añadir compañeros y enemigos y ordenar los turnos.', 'I’ll ask for your initiative roll; you can add allies and enemies and order the turns.')}</p>
        </div>
      </div>
    );
  }

  const Toggle = ({ k, label, hint }: { k: 'action' | 'bonus' | 'reaction'; label: string; hint: string }) => (
    <button className={`economy ${c.combat[k] ? 'used' : ''}`} disabled={incapacitated} onClick={() => update((x) => { x.combat[k] = !x.combat[k]; })}>
      <span className="eco-label">{label}</span>
      <span className="eco-state">{incapacitated ? T('No disponible', 'Unavailable') : c.combat[k] ? T('Usada', 'Used') : T('Disponible', 'Available')}</span>
      <span className="eco-hint">{hint}</span>
    </button>
  );

  return (
    <div className="tab">
      <div className="combat-head">
        <div><span className="muted">{T('Ronda', 'Round')}</span> <b className="big-num">{c.combat.round}</b></div>
        <button className="pill" onClick={() => setInitPrompt(true)}>{T('Iniciativa', 'Initiative')} {c.combat.initiative ?? '—'}</button>
        <div className="pill">{T('CA', 'AC')} <b>{ac.value}</b></div>
        <div className="pill">{T('Vel.', 'Speed')} <b>{spd.value}</b></div>
        <button className="pill end-turn" onClick={endTurn}>{T('Fin de turno', 'End turn')} ⏭️</button>
      </div>

      <InitiativeTracker />

      {reminders.length > 0 && <div className="reminders">{reminders.map((r, i) => <div key={i}>⚠️ {r}</div>)}</div>}

      <div className="economy-row">
        <Toggle k="action" label={T('Acción', 'Action')} hint={T('Atacar, Magia, Correr…', 'Attack, Magic, Dash…')} />
        <Toggle k="bonus" label={T('Adicional', 'Bonus')} hint={T('Si un rasgo lo permite', 'If a feature allows it')} />
        <Toggle k="reaction" label={T('Reacción', 'Reaction')} hint={T('Ataque de oportunidad…', 'Opportunity attack…')} />
      </div>

      <div className="combat-grid">
      <Section title={`${T('Movimiento', 'Movement')}: ${moveLeft} / ${spd.value} ${ft}`}>
        <div className="move-track"><div style={{ width: `${spd.value ? Math.min(100, (moveLeft / spd.value) * 100) : 0}%` }} /></div>
        <div className="row wrap mt">
          {[5, 10, 15, 30].map((n) => (
            <button key={n} className="btn small" disabled={moveLeft < n} onClick={() => update((x) => { x.combat.movementUsed += n; })}>−{n}</button>
          ))}
          <button className="btn small" onClick={() => update((x) => { x.combat.movementUsed -= spd.value; })}>{T('Correr', 'Dash')} (+{spd.value})</button>
          <button className="btn small" onClick={() => update((x) => { x.combat.movementUsed = 0; })}>{T('Reiniciar', 'Reset')}</button>
        </div>
        {c.conditions.includes('derribado') && <p className="hint">{T(`Derribado: levantarte cuesta ${Math.floor(spd.value / 2)} pies.`, `Prone: standing up costs ${Math.floor(spd.value / 2)} ft.`)} <button className="link" onClick={() => run(T('Me levanto', 'I stand up'), [{ type: 'removeCondition', condition: 'derribado' }])}>{T('Levantarme', 'Stand up')}</button></p>}
        <p className="hint">{T('Terreno difícil: cada pie cuesta 2. Arrastrarse o trepar sin velocidad de trepar: también cuesta el doble.', 'Difficult terrain: every foot costs 2. Crawling or climbing without a climb speed also costs double.')}</p>
      </Section>

      <Section title={T('Ataques', 'Attacks')} right={<label className="check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> {T('Crítico', 'Critical')}</label>}>
        {(atkCtx.advantage.length > 0 || atkCtx.disadvantage.length > 0) && (
          <p className="hint">
            {atkCtx.advantage.length > 0 && <>✅ {T('Ventaja', 'Advantage')}: {atkCtx.advantage.join(', ')}. </>}
            {atkCtx.disadvantage.length > 0 && <>⬇️ {T('Desventaja', 'Disadvantage')}: {atkCtx.disadvantage.join(', ')}.</>}
          </p>
        )}
        {c.attacks.length === 0 && <p className="muted">{T('Añade tus armas en la hoja (tabla «Armas y trucos de daño»).', 'Add your weapons on the sheet (“Weapons & Damage Cantrips” table).')}</p>}
        {c.attacks.map((a) => {
          const bonus = attackBonus(c, a.ability, a.proficient, a.extraBonus);
          const flat = m[a.ability];
          const mastery = findMastery(a.mastery);
          return (
            <div key={a.id} className="attack">
              <div className="attack-head">
                <b>{a.name}</b>
                <span className="range">📏 {a.range || '—'}</span>
              </div>
              <div className="muted small">{fmt(bonus)} {T('para impactar', 'to hit')} · {a.damage}{flat ? fmt(flat) : ''} {damageTypeName(a.damageType).toLowerCase()}{a.notes ? ` · ${a.notes}` : ''}</div>
              {mastery && <div className="small mastery">⚙️ {L(mastery.name)}: {L(mastery.text)}</div>}
              <div className="row mt">
                <button className="btn grow" onClick={() => { roll(c, { kind: 'attack' }, bonus, `${T('Ataque', 'Attack')}: ${a.name}`); if (!c.combat.action) update((x) => { x.combat.action = true; }); }}>🎲 {T('Atacar', 'Attack')} {fmt(bonus)}</button>
                <button className="btn grow" onClick={() => { dmgRoll(c, a.name, a.damage, flat, crit, 'damage', a.ability === 'str'); setCrit(false); }}>💥 {T('Daño', 'Damage')}</button>
              </div>
            </div>
          );
        })}
      </Section>

      {(c.spells.length > 0 || c.spellAbility) && (
        <Section title={T('Conjuros', 'Spells')} right={c.spellAbility ? <span className="small muted">{T('CD', 'DC')} {spellSaveDc(c)} · {fmt(spellAttack(c)!)}</span> : undefined}>
          {c.effects.some((e) => e.presetId === 'furia') && <p className="hint">⚠️ {T('En Furia no puedes lanzar conjuros ni concentrarte.', 'While raging you can’t cast spells or concentrate.')}</p>}
          {c.spellAbility && <button className="btn small" onClick={() => roll(c, { kind: 'attack' }, spellAttack(c)!, T('Ataque de conjuro', 'Spell attack'))}>🎲 {T('Ataque de conjuro', 'Spell attack')} {fmt(spellAttack(c)!)}</button>}
          <div className="slots-inline">
            {c.slots.map((s, i) => s.max > 0 && (
              <div key={i} className="res-line"><span className="grow">{T('Nv', 'Lvl')} {i + 1}</span><Pips max={s.max} used={s.used} onChange={(u) => update((x) => { x.slots[i].used = u; })} /></div>
            ))}
            {c.pactSlots && <div className="res-line"><span className="grow">{T('Pacto nv', 'Pact lvl')} {c.pactSlots.level}</span><Pips max={c.pactSlots.max} used={c.pactSlots.used} onChange={(u) => update((x) => { x.pactSlots!.used = u; })} /></div>}
          </div>
          {[...c.spells].sort((a, b) => a.level - b.level).map((s) => (
            <div key={s.id} className="spell-line">
              <div className="grow">
                <b>{s.name}</b> <span className="muted small">{s.level ? `${T('nv', 'lvl')} ${s.level}` : T('truco', 'cantrip')} · {s.castingTime} · 📏 {s.range}{s.concentration ? ' · 🧠' : ''}</span>
                {s.notes && <div className="small muted">{s.notes}</div>}
              </div>
              <button className="btn small" onClick={() => {
                const cmds = [] as Parameters<typeof run>[1];
                if (s.level > 0) cmds.push({ type: 'useSlot', level: s.level });
                if (s.concentration) cmds.push({ type: 'concentrate', spell: s.name });
                run(T(`Lanzo ${s.name}`, `I cast ${s.name}`), cmds.length ? cmds : [{ type: 'info', text: T(`Lanzas ${s.name}.`, `You cast ${s.name}.`) }]);
              }}>{T('Lanzar', 'Cast')}</button>
            </div>
          ))}
        </Section>
      )}

      {c.resources.length > 0 && (
        <Section title={T('Recursos', 'Resources')}>
          {c.resources.map((r) => (
            <div key={r.id} className="res-line">
              <span className="grow">{resourceName(r)}</span>
              {r.max <= 12 ? <Pips max={r.max} used={r.used} onChange={(u) => update((x) => { x.resources.find((y) => y.id === r.id)!.used = u; })} /> : <b>{r.max - r.used}/{r.max}</b>}
            </div>
          ))}
          {rage && !c.effects.some((e) => e.presetId === 'furia') && (
            <button className="btn full mt" onClick={() => { run(T('Entro en furia', 'I rage'), [{ type: 'addEffect', presetId: 'furia' }]); update((x) => { x.combat.bonus = true; }); }}>😡 {T('Entrar en Furia (acción adicional)', 'Rage (bonus action)')}</button>
          )}
          {secondWind && (
            <button className="btn full mt" onClick={() => { run(T('Uso Tomar aliento', 'I use Second Wind'), [{ type: 'useResource', name: 'second_wind' }, { type: 'heal', dice: `1d10+${c.level}`, source: resourceName(secondWind) }]); update((x) => { x.combat.bonus = true; }); }}>💨 {resourceName(secondWind)} (1d10+{c.level})</button>
          )}
        </Section>
      )}

      <Section title={T('Efectos activos', 'Active effects')} right={<button className="btn small" onClick={() => setEffOpen(true)}>+ {T('Efecto', 'Effect')}</button>}>
        {c.effects.length === 0 && <span className="muted">{T('Ninguno.', 'None.')}</span>}
        {c.effects.map((e) => (
          <div key={e.id} className="res-line">
            <span className="grow">{e.kind === 'buff' ? '🟢' : '🔴'} {effectName(e)} <span className="muted small">{effectNotes(e)}</span></span>
            <b>{e.roundsLeft != null ? `${e.roundsLeft}r` : '∞'}</b>
            <button className="icon-btn" aria-label={T(`Quitar ${effectName(e)}`, `Remove ${effectName(e)}`)} onClick={() => run(null, [{ type: 'removeEffect', name: effectName(e) }])}>✕</button>
          </div>
        ))}
      </Section>

      </div>

      <Section title={T('¿Qué puedo hacer?', 'What can I do?')}>
        <div className="actions-grid">
          {ACTIONS.map((a) => (
            <button key={a.id} className={`action-chip cost-${a.cost} ${openAction === a.id ? 'open' : ''}`} onClick={() => setOpenAction(openAction === a.id ? null : a.id)}>
              <b>{L(a.name)}</b><span className="small">{L(COST_NAMES[a.cost])}</span>
              {openAction === a.id && <span className="small action-text">{L(a.text)}</span>}
            </button>
          ))}
        </div>
      </Section>

      <div className="combat-footer">
        <button className="btn primary grow big" onClick={endTurn}>⏭️ {T('Fin de turno', 'End turn')}</button>
        <button className="btn" onClick={endCombat}>{T('Terminar', 'End')}</button>
      </div>
      {effOpen && <EffectPicker onClose={() => setEffOpen(false)} />}
      {initPrompt && <InitiativePrompt onClose={() => setInitPrompt(false)} />}
    </div>
  );
}
