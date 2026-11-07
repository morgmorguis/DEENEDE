// Turno en el combate compartido con las acciones de las reglas 2024: atacar (con arma, sin armas, agarrar,
// empujar), magia, correr, destrabarse, esquivar, ayudar, esconderse, influir, preparar, buscar, estudiar,
// utilizar, acción adicional, reacción, moverse, hablar… Cada una se anota en el registro del combate.
// El jugador solo actúa en su turno (y una reacción por ronda fuera de él); el DM actúa por cualquiera.
import { useMemo, useState } from 'react';
import { useParty } from '../party/client';
import type { ActKind, CombatantView, RoomView } from '../party/protocol';
import { useStore } from '../store';
import { useSharedChar } from './Treasure';
import { fmt, rollD20, rollExpr, weaponAttack, weaponDamageFlat } from '../rules/calc';
import { ACTIONS, COST_NAMES, type ActionCost } from '../rules/srd';
import { Modal, critDice } from './common';
import { L, T, type Tr } from '../i18n';
import { MONSTERS } from '../party/monsters';

const r = (es: string, en: string): Tr => ({ es, en });

/** Acciones que se pueden elegir en el combate compartido */
interface TurnAction { id: string; icon: string; name: Tr; cost: ActionCost; text: Tr; flow: 'attack' | 'magic' | 'contest' | 'heal' | 'simple' }
const BASE = new Map(ACTIONS.map((a) => [a.id, a]));
const A = (id: string, icon: string, flow: TurnAction['flow'], extra?: Partial<TurnAction>): TurnAction => {
  const b = BASE.get(id);
  return { id, icon, flow, name: extra?.name ?? b!.name, cost: extra?.cost ?? b!.cost, text: extra?.text ?? b!.text };
};
export const TURN_ACTIONS: TurnAction[] = [
  A('atacar', '⚔️', 'attack'),
  A('magia', '✨', 'magic'),
  A('correr', '🏃', 'simple'),
  A('destrabarse', '🚪', 'simple'),
  A('esquivar', '🛡️', 'simple'),
  A('ayudar', '🤝', 'simple'),
  A('esconderse', '👤', 'contest'),
  A('influir', '🗣️', 'contest'),
  A('preparar', '⏳', 'simple'),
  A('buscar', '🔍', 'contest'),
  A('estudiar', '📖', 'contest'),
  A('utilizar', '🧰', 'simple'),
  A('agarrar', '🤼', 'contest', { name: r('Agarrar', 'Grapple'), cost: 'action', text: r('Ataque sin armas: el objetivo hace una salvación de FUE o DES contra CD 8 + mod. FUE + competencia o queda Agarrado. Necesitas una mano libre.', 'Unarmed Strike: the target makes a STR or DEX save against DC 8 + STR mod + proficiency or has the Grappled condition. You need a free hand.') }),
  A('empujar', '💥', 'contest', { name: r('Empujar', 'Shove'), cost: 'action', text: r('Ataque sin armas: el objetivo hace una salvación de FUE o DES contra CD 8 + mod. FUE + competencia o lo empujas 5 pies o lo derribas.', 'Unarmed Strike: the target makes a STR or DEX save against DC 8 + STR mod + proficiency or you push it 5 ft or knock it Prone.') }),
  A('curar', '💚', 'heal', { name: r('Curar', 'Heal'), cost: 'action', text: r('Un conjuro, un rasgo (Imposición de manos, Tomar aliento…) o un útil de sanador.', 'A spell, a feature (Lay On Hands, Second Wind…) or a Healer’s Kit.') }),
  A('accion_adicional', '➕', 'attack', { name: r('Acción adicional', 'Bonus Action'), cost: 'bonus', text: r('Solo si algo te la da: ataque con la otra arma Ligera, conjuro de acción adicional, Acción astuta, Furia, Inspiración bárdica…', 'Only if something grants it: off-hand Light weapon attack, Bonus Action spell, Cunning Action, Rage, Bardic Inspiration…') }),
  A('pocion', '🧪', 'heal'),
  A('levantarse', '🧍', 'simple'),
  A('interactuar', '🚪', 'simple'),
  A('moverse', '👣', 'simple', { name: r('Moverse', 'Move'), cost: 'movement', text: r('Te mueves hasta tu Velocidad; puedes partir el movimiento antes y después de la acción.', 'Move up to your Speed; you can split it before and after your action.') }),
  A('hablar', '💬', 'simple', { name: r('Hablar', 'Talk'), cost: 'free', text: r('Unas frases son gratis.', 'A few sentences are free.') }),
];
export const REACTIONS: TurnAction[] = [
  A('ataque_oportunidad', '⚔️', 'attack'),
  A('reaccion_conjuro', '✨', 'magic', { name: r('Conjuro de reacción', 'Reaction spell'), cost: 'reaction', text: r('Escudo, Contraconjuro, Represión infernal, Caída de pluma…', 'Shield, Counterspell, Hellish Rebuke, Feather Fall…') }),
  A('reaccion_otra', '⚡', 'simple', { name: r('Otra reacción', 'Other reaction'), cost: 'reaction', text: r('La acción que preparaste, Esquiva asombrosa, Proteger a un aliado…', 'Your readied action, Uncanny Dodge, protecting an ally…') }),
];
const ALL = [...TURN_ACTIONS, ...REACTIONS];
export const actionName = (id?: string) => { const a = ALL.find((x) => x.id === id) ?? (id ? BASE.get(id) : undefined); return a ? L(a.name) : ''; };

/** Uso de la acción, acción adicional, reacción y movimiento en este turno (solo para orientarse) */
const ECONOMY: ActionCost[] = ['action', 'bonus', 'reaction', 'movement'];
const used = new Map<string, Set<ActionCost>>();

const enemyOf = (actor: CombatantView | undefined, c: CombatantView) => (actor?.kind === 'monster') !== (c.kind === 'monster');

/** Botón de objetivo con el color que haya puesto el DM */
export function TargetChip({ c, on, onClick, children }: { c: CombatantView; on: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button className={`target-chip ${c.kind === 'monster' ? 'enemy' : ''} ${on ? 'on' : ''}`} style={c.color ? { borderColor: c.color, color: c.color } : undefined} onClick={onClick}>
      {c.color && <span className="po-color" style={{ background: c.color }} />}{c.name}
      <small>{c.hp != null ? ` ${c.hp}/${c.hpMax ?? '?'}` : ''}</small>{children}
    </button>
  );
}

function Targets({ view, actor, multi, value, onChange, friendly }: { view: RoomView; actor?: CombatantView; multi?: boolean; value: string[]; onChange: (ids: string[]) => void; friendly?: boolean }) {
  const order = view.encounter.order.filter((c) => !c.hidden || view.you.role === 'dm');
  const first = order.filter((c) => (friendly ? !enemyOf(actor, c) : enemyOf(actor, c)) && c.state !== 'down');
  const rest = order.filter((c) => !first.includes(c));
  const toggle = (id: string) => onChange(multi ? (value.includes(id) ? value.filter((x) => x !== id) : [...value, id]) : [id]);
  return (
    <>
      <div className="target-chips">{first.map((c) => <TargetChip key={c.id} c={c} on={value.includes(c.id)} onClick={() => toggle(c.id)} />)}</div>
      {rest.length > 0 && <details><summary className="small muted">{T('Otros', 'Others')}</summary><div className="target-chips">{rest.map((c) => <TargetChip key={c.id} c={c} on={value.includes(c.id)} onClick={() => toggle(c.id)} />)}</div></details>}
    </>
  );
}

interface Weapon { name: string; bonus: number; dice: string; flat: number; type?: string }

/** Flujo de una acción: elegir con qué y contra quién, tirar, y anotar acierto, fallo, daño o curación */
function ActionFlow({ view, actor, action, reaction, onClose }: { view: RoomView; actor: CombatantView; action: TurnAction; reaction: boolean; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const dm = view.you.role === 'dm';
  const c = useSharedChar();
  const st = useStore.getState();
  const isPc = actor.kind === 'pc' && actor.ownerId === view.you.id;
  const weapons: Weapon[] = useMemo(() => isPc ? [
    ...c.attacks.map((a) => ({ name: a.name || T('Arma', 'Weapon'), bonus: weaponAttack(c, a), dice: a.damage, flat: weaponDamageFlat(c, a), type: a.damageType })),
    { name: T('Ataque sin armas', 'Unarmed Strike'), bonus: weaponAttack(c, { id: 'u', name: '', ability: 'str', proficient: true, damage: '0', damageType: 'contundente', range: '', extraBonus: 0 }), dice: '', flat: 1 + Math.floor((c.abilities.str - 10) / 2) },
  ] : [], [c, isPc]);
  const spells = isPc ? c.spells.filter((s) => s.name && (s.level === 0 || s.prepared || s.alwaysPrepared)) : [];
  const [wi, setWi] = useState(0);
  // Monstruos del bestiario: su ataque habitual ya viene puesto (el DM lo puede cambiar)
  const mAtk = !isPc && action.flow === 'attack' ? MONSTERS.find((m) => m.id === actor.monster)?.atk : undefined;
  const [wName, setWName] = useState(mAtk ? L(mAtk[0]) : '');
  const [bonus, setBonus] = useState(mAtk ? String(mAtk[1]) : '');
  const [dice, setDice] = useState(mAtk ? mAtk[2] : '');
  const [spell, setSpell] = useState('');
  const [slot, setSlot] = useState(1);
  const [targets, setTargets] = useState<string[]>([]);
  const [roll, setRoll] = useState('');
  const [natural, setNatural] = useState<number | null>(null);
  const [rollLines, setRollLines] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<'hit' | 'miss' | 'heal' | 'effect' | null>(action.flow === 'heal' ? 'heal' : null);
  const [amount, setAmount] = useState('');
  const [half, setHalf] = useState<string[]>([]);
  const [text, setText] = useState('');
  const flow = action.flow;
  const w = weapons[wi];
  const weaponLabel = isPc ? (flow === 'attack' ? w?.name : undefined) : wName.trim() || undefined;
  const atkBonus = isPc ? w?.bonus ?? 0 : Number(bonus) || 0;
  const dmgDice = isPc ? (w ? `${w.dice}${w.flat ? fmt(w.flat) : ''}` : '') : dice;

  const rollAttack = () => {
    if (isPc) {
      const res = rollD20(c, { kind: 'attack' }, atkBonus, weaponLabel ?? '');
      setRoll(String(res.total)); setNatural(res.natural); setRollLines(res.lines);
      if (res.natural === 1) setOutcome('miss');
    } else {
      const res = rollExpr(`1d20${fmt(atkBonus)}`);
      setRoll(String(res.total)); setNatural(res.total - atkBonus); setRollLines([res.text]);
    }
  };
  const crit = natural === 20;
  const rollDamage = () => { if (!dmgDice || dmgDice === '+0') return; const res = rollExpr(crit ? critDice(dmgDice) : dmgDice); setAmount(String(Math.max(0, res.total))); setRollLines((l) => [...l, `${T('Daño', 'Damage')}: ${res.text} = ${res.total}`]); };
  const target = (id: string) => view.encounter.order.find((x) => x.id === id);
  const label = `${action.icon} ${L(action.name)}`;

  const spendSlot = () => {
    if (!isPc || !spell) return;
    const info = c.spells.find((s) => s.name === spell);
    if (info && info.level > 0) st.runCommands(null, [{ type: 'useSlot', level: Math.max(info.level, slot) }], [], true);
  };
  const base = { action: action.id, reaction, ...(weaponLabel ? { weapon: weaponLabel } : {}), ...(spell ? { spell } : {}) };
  const sendAct = (kind: ActKind, targetId?: string, amt?: number, extra: Record<string, unknown> = {}) =>
    send({ t: 'act', actorId: actor.id, kind, targetId, amount: amt, roll: roll ? Number(roll) : null, text: text.trim() || undefined, ...base, ...extra });

  const finish = () => {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (flow === 'magic' && spell) spendSlot();
    if (outcome === 'miss') { (targets.length ? targets : [undefined]).forEach((t) => sendAct('miss', t)); }
    else if (outcome === 'hit') targets.forEach((t) => sendAct('hit', t, half.includes(t) ? Math.floor(n / 2) : n, { crit, ...(half.includes(t) ? { text: T('salvó: mitad de daño', 'saved: half damage') } : {}) }));
    else if (outcome === 'heal') targets.forEach((t) => sendAct('heal', t, n));
    else (targets.length ? targets : [undefined]).forEach((t) => sendAct('other', t));
    const key = `${view.encounter.round}:${actor.id}`;
    const set = used.get(key) ?? new Set<ActionCost>();
    set.add(reaction ? 'reaction' : action.cost);
    used.set(key, set);
    onClose();
  };

  const canFinish = outcome === 'hit' || outcome === 'heal' ? targets.length > 0 && amount !== '' : outcome != null || flow === 'simple' || flow === 'contest';

  return (
    <Modal title={`${actor.name}: ${label}`} onClose={onClose}>
      <p className="hint">{L(action.text)} <i>({L(COST_NAMES[reaction ? 'reaction' : action.cost])})</i></p>

      {(flow === 'attack') && (isPc ? (
        <label className="field">{T('Con', 'With')}
          <select value={wi} onChange={(e) => setWi(Number(e.target.value))}>
            {weapons.map((x, i) => <option key={i} value={i}>{x.name} ({fmt(x.bonus)}{x.dice ? `, ${x.dice}${x.flat ? fmt(x.flat) : ''}` : ''})</option>)}
          </select>
        </label>
      ) : (
        <div className="grid3">
          <label className="field">{T('Ataque', 'Attack')}<input value={wName} placeholder={T('Garras, cimitarra…', 'Claws, scimitar…')} onChange={(e) => setWName(e.target.value)} /></label>
          <label className="field">{T('Bonif.', 'Bonus')}<input type="number" value={bonus} placeholder="+4" onChange={(e) => setBonus(e.target.value)} /></label>
          <label className="field">{T('Daño', 'Damage')}<input value={dice} placeholder="1d6+2" onChange={(e) => setDice(e.target.value)} /></label>
        </div>
      ))}

      {flow === 'magic' && (
        <div className="grid2">
          {spells.length > 0 ? (
            <label className="field">{T('Conjuro', 'Spell')}
              <select value={spell} onChange={(e) => { setSpell(e.target.value); const s = c.spells.find((x) => x.name === e.target.value); if (s) setSlot(Math.max(1, s.level)); }}>
                <option value="">—</option>
                {spells.map((s) => <option key={s.id} value={s.name}>{s.level === 0 ? T('Truco', 'Cantrip') : `${T('Nv', 'Lv')} ${s.level}`} · {s.name}</option>)}
              </select>
            </label>
          ) : <label className="field">{T('Conjuro', 'Spell')}<input value={spell} placeholder={T('Bola de fuego…', 'Fireball…')} onChange={(e) => setSpell(e.target.value)} /></label>}
          {isPc && spell && (c.spells.find((s) => s.name === spell)?.level ?? 0) > 0 && (
            <label className="field">{T('Espacio de nivel', 'Slot level')}<input type="number" min={1} max={9} value={slot} onChange={(e) => setSlot(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} /></label>
          )}
        </div>
      )}

      {flow !== 'simple' || ['ayudar', 'preparar', 'reaccion_otra'].includes(action.id) ? (
        <>
          <span className="p-mini">{flow === 'heal' ? T('¿A quién?', 'Who?') : T('Objetivo', 'Target')}{flow === 'magic' ? T(' (puedes elegir varios)', ' (you can pick several)') : ''}</span>
          <Targets view={view} actor={actor} multi={flow === 'magic' || flow === 'heal'} value={targets} onChange={setTargets} friendly={flow === 'heal' || action.id === 'ayudar'} />
        </>
      ) : null}

      {(flow === 'attack' || flow === 'magic' || flow === 'contest') && (
        <div className="row wrap">
          <input className="grow" type="number" inputMode="numeric" placeholder={flow === 'contest' ? T('Tirada (opcional)', 'Roll (optional)') : T('Tirada de ataque (total)', 'Attack roll (total)')} value={roll} onChange={(e) => { setRoll(e.target.value); setNatural(null); }} />
          {flow === 'attack' && <button className="btn" onClick={rollAttack}>🎲 {T('Tirar', 'Roll')} {fmt(atkBonus)}</button>}
        </div>
      )}
      {rollLines.length > 0 && <div className="roll-lines">{rollLines.map((l, i) => <div key={i} className="small">{l}</div>)}</div>}
      {crit && <p className="good small">💥 {T('¡20 natural: crítico! Se tiran el doble de dados de daño.', 'Natural 20: critical hit! Roll double damage dice.')}</p>}

      {(flow === 'attack' || flow === 'magic') && (
        <div className="outcome-row">
          <button className={`btn grow ${outcome === 'hit' ? 'primary' : ''}`} onClick={() => setOutcome('hit')}>✅ {flow === 'magic' ? T('Daña', 'Damages') : T('Impacta', 'Hits')}</button>
          <button className={`btn grow ${outcome === 'miss' ? 'danger' : ''}`} onClick={() => setOutcome('miss')}>❌ {T('He fallado', 'I missed')}</button>
          {flow === 'magic' && <button className={`btn grow ${outcome === 'heal' ? 'primary' : ''}`} onClick={() => setOutcome('heal')}>💚 {T('Cura', 'Heals')}</button>}
          {flow === 'magic' && <button className={`btn grow ${outcome === 'effect' ? 'primary' : ''}`} onClick={() => setOutcome('effect')}>🌀 {T('Solo efecto', 'Effect only')}</button>}
        </div>
      )}
      {flow === 'contest' && (
        <div className="outcome-row">
          <button className={`btn grow ${outcome === 'effect' ? 'primary' : ''}`} onClick={() => setOutcome('effect')}>✅ {T('Lo consigue', 'Succeeds')}</button>
          <button className={`btn grow ${outcome === 'miss' ? 'danger' : ''}`} onClick={() => setOutcome('miss')}>❌ {T('Falla', 'Fails')}</button>
        </div>
      )}

      {(outcome === 'hit' || outcome === 'heal') && (
        <>
          <div className="row">
            <input className="grow big-input" type="number" inputMode="numeric" placeholder={outcome === 'heal' ? T('PG curados', 'HP healed') : T('Daño', 'Damage')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            {outcome === 'hit' && dmgDice && dmgDice !== '+0' && <button className="btn" onClick={rollDamage}>🎲 {crit ? critDice(dmgDice) : dmgDice}</button>}
          </div>
          {outcome === 'hit' && flow === 'magic' && targets.length > 0 && (
            <div className="target-chips">
              <span className="small muted">{T('Superan la salvación (mitad):', 'Saved (half):')}</span>
              {targets.map((id) => { const t = target(id); return t ? <TargetChip key={id} c={t} on={half.includes(id)} onClick={() => setHalf(half.includes(id) ? half.filter((x) => x !== id) : [...half, id])} /> : null; })}
            </div>
          )}
        </>
      )}

      <label className="field">{T('Detalle (opcional)', 'Detail (optional)')}<input value={text} placeholder={action.id === 'preparar' ? T('Si el ogro cruza la puerta, le ataco', 'If the ogre crosses the door, I attack it') : action.id === 'hablar' ? T('¡Rendíos!', 'Surrender!') : T('Lo que quieras contar', 'Anything you want to add')} onChange={(e) => setText(e.target.value)} /></label>
      <button className="btn primary full" disabled={!canFinish} onClick={finish}>{T('Anotar', 'Log it')}</button>
      {dm && !isPc && <p className="hint">{T('El daño a un jugador se aplica en su ficha (con sus resistencias).', 'Damage to a player is applied on their sheet (with their resistances).')}</p>}
    </Modal>
  );
}

/** Panel del turno: el jugador en su turno (o una reacción fuera de él) y el DM por cualquier criatura */
export function TurnPanel({ view, actor, reaction = false }: { view: RoomView; actor: CombatantView; reaction?: boolean }) {
  const [open, setOpen] = useState<TurnAction | null>(null);
  const [showAll, setShowAll] = useState(false);
  const key = `${view.encounter.round}:${actor.id}`;
  const spent = used.get(key) ?? new Set<ActionCost>();
  const list = reaction ? REACTIONS : TURN_ACTIONS;
  const main = list.filter((a) => reaction || showAll || ['atacar', 'magia', 'correr', 'destrabarse', 'esquivar', 'ayudar', 'esconderse', 'curar', 'accion_adicional', 'moverse'].includes(a.id));
  return (
    <div className="turn-panel">
      {!reaction && (
        <div className="economy-chips">
          {ECONOMY.map((k) => <span key={k} className={`eco-chip ${spent.has(k) ? 'used' : ''}`}>{spent.has(k) ? '✔' : '○'} {L(COST_NAMES[k])}</span>)}
        </div>
      )}
      <div className="action-grid">
        {main.map((a) => (
          <button key={a.id} className={`action-btn ${spent.has(reaction ? 'reaction' : a.cost) && a.cost !== 'free' && a.cost !== 'movement' ? 'spent' : ''}`} onClick={() => setOpen(a)} title={L(a.text)}>
            <span className="action-icon">{a.icon}</span><b>{L(a.name)}</b><small>{L(COST_NAMES[reaction ? 'reaction' : a.cost])}</small>
          </button>
        ))}
      </div>
      {!reaction && <button className="p-link" onClick={() => setShowAll(!showAll)}>{showAll ? T('Menos acciones', 'Fewer actions') : T('Todas las acciones (influir, preparar, buscar, estudiar, utilizar, agarrar, empujar, poción…)', 'All actions (influence, ready, search, study, utilize, grapple, shove, potion…)')}</button>}
      {open && <ActionFlow view={view} actor={actor} action={open} reaction={reaction} onClose={() => setOpen(null)} />}
    </div>
  );
}
