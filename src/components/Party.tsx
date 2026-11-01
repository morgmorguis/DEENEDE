// Pestaña «Partida»: unirse a la partida del DM, ver la party, jugar el combate compartido por turnos,
// consultar el registro y (si eres el DM) organizarlo todo, incluidos monstruos ocultos.
import { useEffect, useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import { useParty } from '../party/client';
import type { ActKind, CombatantView, HpState, LogEvent, RoomView } from '../party/protocol';
import { MONSTERS, searchMonsters, type MonsterInfo } from '../party/monsters';
import { rollExpr, fmt } from '../rules/calc';
import { Modal, Section } from './common';
import { L, T, locale } from '../i18n';

const STATE_LABEL: Record<HpState, [string, string, string]> = {
  unhurt: ['Ileso', 'Unhurt', 'ok'],
  hurt: ['Herido', 'Hurt', 'hurt'],
  bloodied: ['Ensangrentado', 'Bloodied', 'bloodied'],
  down: ['Derrotado', 'Down', 'down'],
  unknown: ['?', '?', 'unknown'],
};
const kindIcon = (c: { kind: string }) => (c.kind === 'pc' ? '🛡️' : c.kind === 'npc' ? '🤝' : '👹');

export function StateBadge({ state }: { state: HpState }) {
  if (state === 'unknown') return null;
  const [es, en, cls] = STATE_LABEL[state];
  return <span className={`hp-state ${cls}`}>{state === 'bloodied' ? '🩸 ' : state === 'down' ? '💀 ' : ''}{T(es, en)}</span>;
}

function hpText(c: CombatantView) {
  if (c.hp == null) return '?';
  return `${c.hp}${c.hpMax != null ? `/${c.hpMax}` : ''}${c.temp ? ` +${c.temp}` : ''}`;
}

// ---------- Unirse ----------

function JoinForm() {
  const c = useChar();
  const connect = useParty((s) => s.connect);
  const error = useParty((s) => s.error);
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(c.name);
  const [dmKey, setDmKey] = useState('');
  const [asDm, setAsDm] = useState(false);
  return (
    <div className="tab">
      <Section title={T('Unirse a una partida', 'Join a game')}>
        <p className="small">{T('El DM abre el servidor de «Di en Di» en su PC y os pasa la dirección y el código. Vuestras fichas siguen en vuestro móvil; a la partida solo se envía un resumen (vida, CA, condiciones…).', 'The DM runs the «Di en Di» server on their PC and gives you the address and code. Your sheets stay on your phone; only a summary (HP, AC, conditions…) is shared.')}</p>
        <label className="field">{T('Dirección del servidor', 'Server address')}
          <input value={url} inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="192.168.1.20:3000 · https://mi-pc.tail1234.ts.net" onChange={(e) => setUrl(e.target.value)} />
        </label>
        <div className="grid2">
          <label className="field">{T('Código de la partida', 'Game code')}
            <input value={code} autoCapitalize="characters" placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label className="field">{T('Tu nombre', 'Your name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={asDm} onChange={(e) => setAsDm(e.target.checked)} /> {T('Soy el DM', 'I’m the DM')}</label>
        {asDm && (
          <label className="field">{T('Clave del DM (la muestra el servidor)', 'DM key (shown by the server)')}
            <input value={dmKey} autoCapitalize="off" onChange={(e) => setDmKey(e.target.value.trim())} />
          </label>
        )}
        {!asDm && <p className="hint">{T(`Compartirás la ficha de ${c.name}. Cambia de personaje en Ajustes antes de unirte si quieres usar otro.`, `You’ll share ${c.name}’s sheet. Switch characters in Settings before joining to use another one.`)}</p>}
        {error && <p className="error">⚠️ {error}</p>}
        <button className="btn primary full" disabled={!url.trim() || (!asDm && !code.trim()) || (asDm && !dmKey)} onClick={() => connect({ url, code, name: name.trim() || c.name, dmKey: asDm ? dmKey : undefined, characterId: c.id })}>
          🎲 {T('Unirse', 'Join')}
        </button>
      </Section>
      <Section title={T('¿Eres el DM? Monta el servidor', 'Are you the DM? Set up the server')}>
        <ol className="small steps">
          <li>{T('Descarga «Di en Di - Servidor.exe» (GitHub → Actions → artefacto di-en-di-servidor-windows) y ábrelo en tu PC con Windows.', 'Download «Di en Di - Servidor.exe» (GitHub → Actions → artifact di-en-di-servidor-windows) and open it on your Windows PC.')}</li>
          <li>{T('Se abre tu pantalla de DM en el navegador. La ventana negra muestra el código y las direcciones.', 'Your DM screen opens in the browser. The black window shows the code and addresses.')}</li>
          <li>{T('En la misma Wi-Fi: los jugadores usan la dirección http://192.168…:3000.', 'Same Wi-Fi: players use the http://192.168…:3000 address.')}</li>
          <li>{T('A distancia: instala Tailscale en el PC y ejecuta «tailscale funnel 3000»; comparte la dirección https://….ts.net (los jugadores no instalan nada).', 'Remote: install Tailscale on the PC and run “tailscale funnel 3000”; share the https://….ts.net address (players install nothing).')}</li>
        </ol>
      </Section>
    </div>
  );
}

// ---------- Acciones de turno ----------

function ActModal({ view, actorId, kind, onClose }: { view: RoomView; actorId: string; kind: ActKind; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const manualRolls = useStore((s) => s.settings.manualRolls);
  const order = view.encounter.order;
  const actor = order.find((c) => c.id === actorId)!;
  const friendly = (c: CombatantView) => c.kind !== 'monster';
  const suggested = kind === 'heal' ? order.filter((c) => friendly(c) === friendly(actor)) : order.filter((c) => friendly(c) !== friendly(actor));
  const others = order.filter((c) => !suggested.includes(c));
  const [target, setTarget] = useState(suggested.find((c) => c.state !== 'down')?.id ?? suggested[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [roll, setRoll] = useState('');
  const [text, setText] = useState('');
  const n = Math.floor(Number(amount));
  const needsTarget = kind === 'hit' || kind === 'heal';
  const ok = kind === 'other' ? !!text.trim() : Number.isFinite(n) && n >= 0 && amount !== '' && (!needsTarget || !!target);
  const title = kind === 'hit' ? T(`${actor.name} pega a…`, `${actor.name} hits…`) : kind === 'heal' ? T(`${actor.name} cura a…`, `${actor.name} heals…`) : kind === 'hurt' ? T(`${actor.name} recibe daño`, `${actor.name} takes damage`) : T(`¿Qué hace ${actor.name}?`, `What does ${actor.name} do?`);
  const chip = (c: CombatantView) => (
    <button key={c.id} className={`target-chip ${c.kind === 'monster' ? 'enemy' : ''} ${target === c.id ? 'on' : ''}`} onClick={() => setTarget(c.id)}>
      {kindIcon(c)} {c.name} <small>{c.hp != null ? hpText(c) : <StateBadge state={c.state} />}</small>
    </button>
  );
  return (
    <Modal title={title} onClose={onClose}>
      {needsTarget && (
        <>
          <div className="target-chips">{suggested.map(chip)}</div>
          {others.length > 0 && <details><summary className="small muted">{T('Otros', 'Others')}</summary><div className="target-chips">{others.map(chip)}</div></details>}
        </>
      )}
      {kind === 'other' ? (
        <>
          <div className="target-chips">
            {[['Habla', 'Talks'], ['Se mueve', 'Moves'], ['Esquiva', 'Dodges'], ['Ayuda', 'Helps'], ['Se esconde', 'Hides'], ['Lanza un conjuro', 'Casts a spell'], ['Usa un objeto', 'Uses an item'], ['Huye', 'Flees']].map(([es, en]) => (
              <button key={en} className="target-chip" onClick={() => setText(text ? `${text}, ${T(es, en).toLowerCase()}` : T(es, en))}>{T(es, en)}</button>
            ))}
          </div>
          <label className="field">{T('Qué hace', 'What happens')}<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
        </>
      ) : (
        <label className="field">{kind === 'heal' ? T('PG curados', 'HP healed') : T('Daño', 'Damage')}
          <input className="big-input" type="number" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      )}
      {manualRolls && (
        <label className="field">{T('Tirada (opcional)', 'Roll (optional)')}<input type="number" inputMode="numeric" value={roll} onChange={(e) => setRoll(e.target.value)} /></label>
      )}
      <button className="btn primary full" disabled={!ok} onClick={() => {
        send({ t: 'act', actorId, kind, targetId: needsTarget ? target : undefined, amount: kind === 'other' ? undefined : n, roll: roll.trim() ? Number(roll) : null, text: kind === 'other' ? text.trim() : undefined });
        onClose();
      }}>{T('Anotar', 'Log it')}</button>
    </Modal>
  );
}

function ActionButtons({ view, actorId }: { view: RoomView; actorId: string }) {
  const [act, setAct] = useState<ActKind | null>(null);
  return (
    <>
      <div className="turn-actions">
        <button className="btn" onClick={() => setAct('hit')}>⚔️ {T('Daño hecho', 'Damage dealt')}</button>
        <button className="btn" onClick={() => setAct('heal')}>💚 {T('Curación', 'Healing')}</button>
        <button className="btn" onClick={() => setAct('hurt')}>🩸 {T('Daño recibido', 'Damage taken')}</button>
        <button className="btn" onClick={() => setAct('other')}>💬 {T('Otra acción', 'Other action')}</button>
      </div>
      {act && <ActModal view={view} actorId={actorId} kind={act} onClose={() => setAct(null)} />}
    </>
  );
}

// ---------- Registro ----------

function logLine(ev: LogEvent, dm: boolean): string {
  const roll = ev.roll != null ? T(` (tirada ${ev.roll})`, ` (roll ${ev.roll})`) : '';
  const after = ev.after && dm ? ` → ${ev.after}` : ev.after ? ` → ${ev.after}` : '';
  switch (ev.kind) {
    case 'hit': return T(`⚔️ ${ev.actor} golpea a ${ev.target}: ${ev.amount} de daño${roll}${after}`, `⚔️ ${ev.actor} hits ${ev.target}: ${ev.amount} damage${roll}${after}`);
    case 'heal': return T(`💚 ${ev.actor} cura a ${ev.target}: ${ev.amount} PG${roll}${after}`, `💚 ${ev.actor} heals ${ev.target}: ${ev.amount} HP${roll}${after}`);
    case 'hurt': return T(`🩸 ${ev.actor} recibe ${ev.amount} de daño${roll}${after}`, `🩸 ${ev.actor} takes ${ev.amount} damage${roll}${after}`);
    case 'other': return `💬 ${ev.actor}${ev.target ? ` → ${ev.target}` : ''}: ${ev.text}${roll}`;
    case 'down': return T(`💀 ${ev.target} cae`, `💀 ${ev.target} is down`);
    case 'turn': return T(`▶ Turno de ${ev.actor}`, `▶ ${ev.actor}’s turn`);
    case 'round': return T(`— Ronda ${ev.round} —`, `— Round ${ev.round} —`);
    case 'start': return T('⚔️ ¡Combate! Preparación', '⚔️ Combat! Getting ready');
    case 'begin': return T('✅ Todos listos: empiezan los turnos', '✅ Everyone ready: turns begin');
    case 'end': return T('🏁 Fin del combate', '🏁 Combat over');
    case 'undo': return T(`↩️ ${ev.actor} deshace el último turno`, `↩️ ${ev.actor} undoes the last turn`);
    case 'add': return T(`➕ ${ev.target} entra en el combate`, `➕ ${ev.target} joins the combat`);
    case 'reveal': return T(`👁️ ¡Aparece ${ev.target}!`, `👁️ ${ev.target} appears!`);
  }
}

function CombatLog({ view }: { view: RoomView }) {
  const addNote = useStore((s) => s.addNote);
  const c = useChar();
  const dm = view.you.role === 'dm';
  const [all, setAll] = useState(false);
  // El último combate: desde el último «empieza el combate»
  const lastStart = view.log.map((e) => e.kind).lastIndexOf('start');
  const events = all || lastStart < 0 ? view.log : view.log.slice(lastStart);
  const save = () => {
    const lines = events.filter((e) => !e.undone).map((e) => logLine(e, dm));
    const folder = c.noteFolders.find((f) => f.key === 'chronicles')?.id ?? null;
    addNote({ title: T(`Combate del ${new Date().toLocaleDateString(locale())}`, `Combat on ${new Date().toLocaleDateString(locale())}`), body: lines.join('\n'), kind: 'note', folderId: folder });
    useStore.getState().showToast(T('📜 Guardado en el diario (Crónicas)', '📜 Saved to the journal (Chronicles)'), []);
  };
  return (
    <Section title={T('Registro del combate', 'Combat log')} right={<button className="btn small" disabled={!events.length} onClick={save}>📜 {T('Guardar en el diario', 'Save to journal')}</button>}>
      {events.length === 0 && <p className="muted">{T('Aún no ha pasado nada.', 'Nothing has happened yet.')}</p>}
      <ol className="party-log">
        {[...events].reverse().map((ev) => (
          <li key={ev.id} className={`${ev.kind} ${ev.undone ? 'undone' : ''}`}>
            <span className="log-time">{new Date(ev.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span> {logLine(ev, dm)}
          </li>
        ))}
      </ol>
      {lastStart > 0 && <button className="p-link" onClick={() => setAll(!all)}>{all ? T('Ver solo el último combate', 'Show only the last combat') : T('Ver combates anteriores', 'Show earlier combats')}</button>}
    </Section>
  );
}

// ---------- DM ----------

function MonsterPicker({ onClose }: { onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<MonsterInfo | null>(null);
  const [count, setCount] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [rollHp, setRollHp] = useState(false);
  const [rollInit, setRollInit] = useState(true);
  const [custom, setCustom] = useState({ name: '', hp: '', ac: '', init: '0', kind: 'monster' as 'monster' | 'npc' });
  const list = useMemo(() => searchMonsters(q), [q]);
  const add = (base: { name: string; hp: number; ac: number | null; init: number; kind: 'monster' | 'npc'; dice?: string; monster?: string }) => {
    const combatants = Array.from({ length: count }, (_, i) => {
      const hp = rollHp && base.dice ? Math.max(1, rollExpr(base.dice).total) : base.hp;
      return {
        name: count > 1 ? `${base.name} ${i + 1}` : base.name,
        kind: base.kind,
        hpMax: hp,
        hp,
        ac: base.ac,
        initBonus: base.init,
        initiative: rollInit ? rollExpr('1d20').total + base.init : null,
        hidden,
        showHp: base.kind === 'npc',
        monster: base.monster,
      };
    });
    send({ t: 'add', combatants });
    onClose();
  };
  return (
    <Modal title={T('Añadir al combate', 'Add to combat')} onClose={onClose}>
      <div className="grid3">
        <label className="field">{T('Cantidad', 'How many')}<input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
        <label className="check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> 👁️ {T('Oculto', 'Hidden')}</label>
        <label className="check"><input type="checkbox" checked={rollInit} onChange={(e) => setRollInit(e.target.checked)} /> 🎲 {T('Tirar iniciativa', 'Roll initiative')}</label>
      </div>
      <label className="check"><input type="checkbox" checked={rollHp} onChange={(e) => setRollHp(e.target.checked)} /> {T('Tirar los PG (si no, la media)', 'Roll HP (otherwise average)')}</label>
      <input className="mt" placeholder={T('Buscar monstruo…', 'Search monster…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="monster-list">
        {list.map((mo) => (
          <button key={mo.id} className={`monster-row ${pick?.id === mo.id ? 'on' : ''}`} onClick={() => setPick(mo)}>
            <b>{L(mo.name)}</b>
            <span className="muted small">{L(mo.type)} · {T('VD', 'CR')} {mo.cr} · {T('CA', 'AC')} {mo.ac} · {mo.hp} {T('PG', 'HP')} ({mo.dice}) · {T('Ini', 'Init')} {fmt(mo.init)}</span>
          </button>
        ))}
      </div>
      <button className="btn primary full" disabled={!pick} onClick={() => pick && add({ name: L(pick.name), hp: pick.hp, ac: pick.ac, init: pick.init, kind: 'monster', dice: pick.dice, monster: pick.id })}>
        ➕ {pick ? T(`Añadir ${count} × ${L(pick.name)}`, `Add ${count} × ${L(pick.name)}`) : T('Elige un monstruo', 'Pick a monster')}
      </button>
      <details className="mt">
        <summary>{T('Personalizado o PNJ aliado', 'Custom or allied NPC')}</summary>
        <div className="segmented mt">
          <button className={custom.kind === 'monster' ? 'on' : ''} onClick={() => setCustom({ ...custom, kind: 'monster' })}>👹 {T('Enemigo', 'Enemy')}</button>
          <button className={custom.kind === 'npc' ? 'on' : ''} onClick={() => setCustom({ ...custom, kind: 'npc' })}>🤝 {T('PNJ aliado', 'Allied NPC')}</button>
        </div>
        <label className="field">{T('Nombre', 'Name')}<input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
        <div className="grid3">
          <label className="field">{T('PG', 'HP')}<input type="number" value={custom.hp} onChange={(e) => setCustom({ ...custom, hp: e.target.value })} /></label>
          <label className="field">{T('CA', 'AC')}<input type="number" value={custom.ac} onChange={(e) => setCustom({ ...custom, ac: e.target.value })} /></label>
          <label className="field">{T('Bonif. iniciativa', 'Init bonus')}<input type="number" value={custom.init} onChange={(e) => setCustom({ ...custom, init: e.target.value })} /></label>
        </div>
        <button className="btn full" disabled={!custom.name.trim() || !custom.hp} onClick={() => add({ name: custom.name.trim(), hp: Math.max(1, Number(custom.hp)), ac: custom.ac ? Number(custom.ac) : null, init: Number(custom.init) || 0, kind: custom.kind })}>➕ {T('Añadir', 'Add')}</button>
      </details>
      <p className="hint">{T(`Monstruos del SRD 5.2 (${MONSTERS.length}). Los valores se pueden ajustar después tocando al monstruo.`, `SRD 5.2 monsters (${MONSTERS.length}). Values can be adjusted afterwards by tapping the monster.`)}</p>
    </Modal>
  );
}

function DmCombatantModal({ c, onClose }: { c: CombatantView; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [f, setF] = useState({ name: c.name, hp: String(c.hp ?? ''), hpMax: String(c.hpMax ?? ''), temp: String(c.temp ?? 0), ac: String(c.ac ?? ''), initiative: String(c.initiative ?? ''), notes: c.notes ?? '' });
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const save = () => {
    send({ t: 'update', id: c.id, patch: { name: f.name.trim() || c.name, hp: num(f.hp), hpMax: num(f.hpMax), temp: Math.max(0, Number(f.temp) || 0), ac: num(f.ac), initiative: num(f.initiative), notes: f.notes } });
    onClose();
  };
  return (
    <Modal title={`${kindIcon(c)} ${c.name}`} onClose={onClose}>
      {c.kind !== 'pc' && (
        <div className="row wrap">
          <button className={`btn small ${c.hidden ? 'primary' : ''}`} onClick={() => send({ t: 'update', id: c.id, patch: { hidden: !c.hidden } })}>{c.hidden ? `👁️ ${T('Revelar a los jugadores', 'Reveal to players')}` : `🙈 ${T('Ocultar', 'Hide')}`}</button>
          <button className="btn small" onClick={() => send({ t: 'update', id: c.id, patch: { showHp: !c.showHp } })}>{c.showHp ? T('Ocultar su vida a los jugadores', 'Hide its HP from players') : T('Mostrar su vida exacta', 'Show its exact HP')}</button>
        </div>
      )}
      <label className="field">{T('Nombre', 'Name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid3">
        <label className="field">{T('PG', 'HP')}<input type="number" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} /></label>
        <label className="field">{T('Máx.', 'Max')}<input type="number" value={f.hpMax} onChange={(e) => setF({ ...f, hpMax: e.target.value })} /></label>
        <label className="field">{T('Temp.', 'Temp')}<input type="number" value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })} /></label>
        <label className="field">{T('CA', 'AC')}<input type="number" value={f.ac} onChange={(e) => setF({ ...f, ac: e.target.value })} /></label>
        <label className="field">{T('Iniciativa', 'Initiative')}<input type="number" value={f.initiative} onChange={(e) => setF({ ...f, initiative: e.target.value })} /></label>
      </div>
      {c.kind !== 'pc' && <label className="field">{T('Notas privadas del DM', 'Private DM notes')}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>}
      {c.kind === 'pc' && <p className="hint">{T('Si cambias la vida de un jugador, se actualiza también en su ficha.', 'If you change a player’s HP, their sheet is updated too.')}</p>}
      <div className="row">
        <button className="btn danger" onClick={() => { if (confirm(T(`¿Quitar a ${c.name} del combate?`, `Remove ${c.name} from combat?`))) { send({ t: 'remove', id: c.id }); onClose(); } }}>{T('Quitar', 'Remove')}</button>
        <button className="btn primary grow" onClick={save}>{T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}

// ---------- Combate compartido ----------

/** Preparación: cada jugador introduce sus datos, ve los de sus aliados y marca «Listo» */
function SetupPanel({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const c = useChar();
  const update = useStore((s) => s.update);
  const dm = view.you.role === 'dm';
  const e = view.encounter;
  const myPc = e.order.find((x) => x.kind === 'pc' && x.ownerId === view.you.id);
  const [init, setInit] = useState(myPc?.initiative != null ? String(myPc.initiative) : '');
  const meReady = e.ready.includes(view.you.id);
  const dex = Math.floor((c.abilities.dex - 10) / 2);
  const waiting = e.needed.filter((id) => !e.ready.includes(id)).map((id) => view.members.find((m) => m.id === id)).filter(Boolean);
  const pcs = e.order.filter((x) => x.kind === 'pc');
  const nameOf = (id: string) => view.members.find((m) => m.id === id);
  const dmMember = view.members.find((m) => m.role === 'dm' && e.needed.includes(m.id));

  return (
    <Section title={T('⚔️ Preparación del combate', '⚔️ Getting ready for combat')} className="setup-panel">
      {myPc && (
        <div className="setup-me">
          <h3>{T('Tus datos', 'Your data')}</h3>
          <div className="grid3">
            <label className="field">{T('Iniciativa (total)', 'Initiative (total)')}
              <input type="number" inputMode="numeric" value={init} disabled={meReady} placeholder={`1d20 ${fmt(dex)}`}
                onChange={(ev) => setInit(ev.target.value)}
                onBlur={() => init !== '' && send({ t: 'setInitiative', id: myPc.id, value: Number(init) })} />
            </label>
            <label className="field">{T('PG actuales', 'Current HP')}
              <input type="number" inputMode="numeric" value={c.hp.current} disabled={meReady} onChange={(ev) => update((x) => { x.hp.current = Math.max(0, Math.min(x.hp.max, Number(ev.target.value) || 0)); })} />
            </label>
            <label className="field">{T('PG temporales', 'Temp HP')}
              <input type="number" inputMode="numeric" value={c.hp.temp} disabled={meReady} onChange={(ev) => update((x) => { x.hp.temp = Math.max(0, Number(ev.target.value) || 0); })} />
            </label>
          </div>
          <p className="small muted">{T(`CA ${myPc.ac ?? '—'} · los demás datos salen de tu ficha.`, `AC ${myPc.ac ?? '—'} · everything else comes from your sheet.`)}</p>
          {!meReady
            ? <button className="btn primary full big ready-btn" disabled={init === ''} onClick={() => { send({ t: 'setInitiative', id: myPc.id, value: Number(init) }); send({ t: 'ready', value: true }); }}>✅ {T('¡Listo!', 'Ready!')}</button>
            : <button className="btn full ready-btn on" onClick={() => send({ t: 'ready', value: false })}>✅ {T('Listo · tocar para quitar', 'Ready · tap to undo')}</button>}
        </div>
      )}
      {dm && (
        <div className="row wrap">
          {!meReady
            ? <button className="btn primary grow ready-btn" onClick={() => send({ t: 'ready', value: true })}>✅ {T('DM listo', 'DM ready')}</button>
            : <button className="btn grow ready-btn on" onClick={() => send({ t: 'ready', value: false })}>✅ {T('DM listo · quitar', 'DM ready · undo')}</button>}
          <button className="btn" onClick={() => { if (confirm(T('¿Empezar ya, sin esperar a que estén todos listos?', 'Start now without waiting for everyone?'))) send({ t: 'begin' }); }}>⏩ {T('Empezar ya', 'Start now')}</button>
        </div>
      )}
      <h3 className="mt">{T('La party', 'The party')}</h3>
      <ul className="setup-list">
        {pcs.map((p) => {
          const ready = !!p.ownerId && e.ready.includes(p.ownerId);
          return (
            <li key={p.id} className={ready ? 'ready' : ''}>
              <span className="grow"><b>{p.name}</b>{nameOf(p.ownerId ?? '')?.name !== p.name && <span className="small muted"> {nameOf(p.ownerId ?? '')?.name}</span>}</span>
              <span className="small">🎲 {p.initiative ?? '—'} · ❤️ {hpText(p)} · {T('CA', 'AC')} {p.ac ?? '—'}</span>
              <span className="ready-mark">{ready ? '✅' : '⏳'}</span>
            </li>
          );
        })}
        {dmMember && <li className={e.ready.includes(dmMember.id) ? 'ready' : ''}><span className="grow"><b>🎲 DM</b></span><span className="ready-mark">{e.ready.includes(dmMember.id) ? '✅' : '⏳'}</span></li>}
      </ul>
      {waiting.length > 0 && <p className="hint">{T('Esperando a', 'Waiting for')}: {waiting.map((m) => m!.summary?.name ?? m!.name).join(', ')}</p>}
    </Section>
  );
}

function SharedCombat({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const dm = view.you.role === 'dm';
  const [edit, setEdit] = useState<CombatantView | null>(null);
  const [adding, setAdding] = useState(false);
  const e = view.encounter;
  const myPc = e.order.find((c) => c.kind === 'pc' && c.ownerId === view.you.id);
  const cur = e.order.find((c) => c.id === e.currentId);
  const myTurn = !!cur && !!myPc && cur.id === myPc.id;
  const actorForDm = cur && cur.kind !== 'pc' ? cur.id : null;

  return (
    <>
      {e.active && e.phase === 'setup' && <SetupPanel view={view} />}
      <Section title={e.active ? (e.phase === 'setup' ? T('Combatientes', 'Combatants') : `${T('Combate', 'Combat')} · ${T('Ronda', 'Round')} ${e.round}`) : T('Combate', 'Combat')}
        right={dm ? (e.active
          ? <button className="btn small danger" onClick={() => { if (confirm(T('¿Terminar el combate? Los monstruos se quitarán.', 'End combat? Monsters will be removed.'))) send({ t: 'end' }); }}>🏁 {T('Terminar', 'End')}</button>
          : <button className="btn small primary" onClick={() => send({ t: 'start' })}>⚔️ {T('Empezar combate', 'Start combat')}</button>) : undefined}>
        {!e.active && !dm && <p className="muted">{T('Cuando el DM empiece un combate aparecerá aquí.', 'When the DM starts a combat it will show up here.')}</p>}
        {(e.active || (dm && e.order.length > 0)) && (
          <>
            <ol className="party-order">
              {e.order.map((c) => {
                const active = c.id === e.currentId;
                return (
                  <li key={c.id} className={`${c.kind} ${active ? 'active' : ''} ${c.state === 'down' ? 'down' : ''} ${c.hidden ? 'hidden' : ''}`} onClick={() => dm && setEdit(c)}>
                    <span className="po-init">{c.initiative ?? '–'}</span>
                    <span className="po-name">{kindIcon(c)} {c.name}{c.hidden && <span className="hidden-tag">🙈 {T('oculto', 'hidden')}</span>}{active && <span className="bubble-turn">{T('turno', 'turn')}</span>}</span>
                    <span className="po-hp">
                      {c.hp != null && <b>❤️ {hpText(c)}</b>}
                      {c.hp == null && <b>❤️ ?</b>}
                      {c.kind !== 'pc' && <StateBadge state={c.state} />}
                      {dm && c.ac != null && <span className="muted small"> · {T('CA', 'AC')} {c.ac}</span>}
                    </span>
                    {dm && c.notes && <span className="po-notes">📝 {c.notes}</span>}
                  </li>
                );
              })}
            </ol>
            {e.hiddenTurn && <p className="hint">{T('Está actuando algo que aún no veis…', 'Something you can’t see yet is acting…')}</p>}
            {dm && (
              <div className="row wrap mt">
                <button className="btn small" onClick={() => setAdding(true)}>➕ {T('Monstruos / PNJ', 'Monsters / NPCs')}</button>
                <button className="btn small" onClick={() => send({ t: 'sort' })}>↕️ {T('Ordenar por iniciativa', 'Sort by initiative')}</button>
                <button className="btn small" onClick={() => e.order.filter((c) => c.kind !== 'pc' && c.initiative == null).forEach((c) => send({ t: 'setInitiative', id: c.id, value: rollExpr('1d20').total + (c.initBonus ?? 0) }))}>🎲 {T('Iniciativa de monstruos', 'Monster initiative')}</button>
              </div>
            )}
          </>
        )}
      </Section>

      {e.active && e.phase === 'running' && (
        <Section title={cur ? (myTurn ? T('⚔️ ¡Tu turno!', '⚔️ Your turn!') : T(`Turno de ${cur.name}`, `${cur.name}’s turn`)) : T('Turno', 'Turn')}>
          {myPc && !myTurn && <p className="small muted">{T('No es tu turno: anota aquí solo reacciones o daño que recibas.', 'Not your turn: only log reactions or damage you take here.')}</p>}
          {myPc && <ActionButtons view={view} actorId={myPc.id} />}
          {dm && actorForDm && (
            <>
              <p className="small muted">{T(`Anota lo que hace ${cur!.name}:`, `Log what ${cur!.name} does:`)}</p>
              <ActionButtons view={view} actorId={actorForDm} />
            </>
          )}
          {!myPc && !dm && <p className="muted">{T('Tu ficha aún no está en el combate: pide al DM que lo reinicie o espera a que entre.', 'Your sheet isn’t in this combat yet: ask the DM to restart it.')}</p>}
          <div className="row wrap mt">
            {view.canEndTurn && <button className="btn primary grow" onClick={() => send({ t: 'nextTurn' })}>⏭️ {T('Pasar turno', 'End turn')}</button>}
            {view.canUndo && <button className="btn" onClick={() => { if (confirm(T('¿Deshacer el último turno? Se revierten sus daños y curaciones.', 'Undo the last turn? Its damage and healing are reverted.'))) send({ t: 'undo' }); }}>↩️ {T('Deshacer último turno', 'Undo last turn')}</button>}
          </div>
        </Section>
      )}
      {edit && <DmCombatantModal c={edit} onClose={() => setEdit(null)} />}
      {adding && <MonsterPicker onClose={() => setAdding(false)} />}
    </>
  );
}

// ---------- Pestaña ----------

export function PartyTab() {
  const conn = useParty((s) => s.conn);
  const status = useParty((s) => s.status);
  const view = useParty((s) => s.view);
  const error = useParty((s) => s.error);
  const leave = useParty((s) => s.leave);
  useEffect(() => {
    if (conn && status === 'off') useParty.getState().connect(conn);
  }, [conn, status]);
  if (!conn) return <JoinForm />;
  const dm = view?.you.role === 'dm';
  return (
    <div className="tab">
      <div className="party-head">
        <span className={`party-status ${status}`}>{status === 'online' ? '🟢' : status === 'off' ? '⚪' : '🟡'} {status === 'online' ? T('Conectado', 'Connected') : status === 'retrying' ? T('Reconectando…', 'Reconnecting…') : T('Conectando…', 'Connecting…')}</span>
        {view && <span className="small muted">{T('Partida', 'Game')} <b>{view.code}</b> · {dm ? T('eres el DM', 'you’re the DM') : T('jugador', 'player')}</span>}
        <button className="btn small" onClick={() => { if (confirm(T('¿Salir de la partida?', 'Leave the game?'))) leave(); }}>{T('Salir', 'Leave')}</button>
      </div>
      {error && <p className="error">⚠️ {error}</p>}
      {view && (
        <>
          <Section title={T('Party', 'Party')}>
            <div className="party-members">
              {view.members.filter((m) => m.role === 'player').map((m) => (
                <div key={m.id} className={`member ${m.online ? '' : 'offline'}`}>
                  <b>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</b>
                  {m.summary ? (
                    <span className="small">
                      {m.summary.species} {m.summary.className} {m.summary.level} · ❤️ {m.summary.hp}/{m.summary.hpMax}{m.summary.temp ? ` +${m.summary.temp}` : ''} · {T('CA', 'AC')} {m.summary.ac} · 👁️ {m.summary.passive}
                      {m.summary.conditions.length > 0 && <> · <span className="warn">{m.summary.conditions.join(', ')}</span></>}
                    </span>
                  ) : <span className="small muted">{T('Sin ficha', 'No sheet')}</span>}
                  {m.summary && m.summary.name !== m.name && <span className="tiny muted">{m.name}</span>}
                </div>
              ))}
              {view.members.filter((m) => m.role === 'player').length === 0 && <p className="muted">{T(`Aún no hay jugadores. Código: ${view.code}`, `No players yet. Code: ${view.code}`)}</p>}
            </div>
          </Section>
          <SharedCombat view={view} />
          <CombatLog view={view} />
        </>
      )}
    </div>
  );
}
