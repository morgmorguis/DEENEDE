// Pestaña «Personajes» del DM: aliados y enemigos preparados con su nivel y datos básicos para
// tenerlos a mano y meterlos en el combate. Se guardan en el servidor de la partida.
import { DmBackupSection } from './DmBackup';
import { useState } from 'react';
import { useParty } from '../party/client';
import { useStore } from '../store';
import type { EncounterEntry, PreparedEncounter, RosterEntry } from '../party/protocol';
import { MONSTERS, searchMonsters } from '../party/monsters';
import { ENEMY_COLORS } from './Party';
import { confirmDelete } from './Confirm';
import { uid } from '../rules/factory';
import { fmt } from '../rules/calc';
import { Modal, Section } from './common';
import { L, T } from '../i18n';
import { askOk } from './Confirm';

const empty = (kind: RosterEntry['kind']): RosterEntry => ({ id: '', name: '', kind, level: '', hpMax: null, ac: null, initBonus: 0, notes: '' });

function EntryModal({ entry, onClose }: { entry: RosterEntry; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [f, setF] = useState(entry);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const [mq, setMq] = useState('');
  const [base, setBase] = useState<{ hp: number | null; ac: number | null } | null>(null);
  const fromMonster = (id: string) => {
    const m = MONSTERS.find((x) => x.id === id);
    if (m) {
      setF({ ...f, name: f.name || L(m.name), level: `${T('VD', 'CR')} ${m.cr}`, hpMax: m.hp, ac: m.ac, initBonus: m.init, monster: m.id, attacks: f.attacks || (m.atk ? `${L(m.atk[0])} ${m.atk[1] >= 0 ? '+' : ''}${m.atk[1]}, ${m.atk[2]}` : '') });
      setBase({ hp: m.hp, ac: m.ac });
    }
  };
  // Potencia: ajusta PG y CA sobre los valores de partida (débil, normal, fuerte, élite)
  const power = (k: number, acPlus: number) => {
    const b = base ?? { hp: f.hpMax, ac: f.ac };
    if (!base) setBase(b);
    setF({ ...f, hpMax: b.hp != null ? Math.max(1, Math.round(b.hp * k)) : f.hpMax, ac: b.ac != null ? b.ac + acPlus : f.ac });
  };
  return (
    <Modal title={entry.id ? entry.name : f.kind === 'npc' ? T('Nuevo aliado', 'New ally') : T('Nuevo enemigo', 'New enemy')} onClose={onClose}>
      <div className="segmented">
        <button className={f.kind === 'npc' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'npc' })}>🤝 {T('Aliado / PNJ', 'Ally / NPC')}</button>
        <button className={f.kind === 'monster' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'monster' })}>👹 {T('Enemigo', 'Enemy')}</button>
      </div>
      <label className="field">{T(`Basado en un monstruo del bestiario (${MONSTERS.length}, opcional)`, `Based on a bestiary monster (${MONSTERS.length}, optional)`)}
        <input value={mq} placeholder={T('Buscar: goblin, dragón, ogro…', 'Search: goblin, dragon, ogre…')} onChange={(e) => setMq(e.target.value)} />
        <select value={f.monster ?? ''} onChange={(e) => fromMonster(e.target.value)}>
          <option value="">—</option>
          {searchMonsters(mq).map((m) => <option key={m.id} value={m.id}>{L(m.name)} ({T('VD', 'CR')} {m.cr} · {T('CA', 'AC')} {m.ac} · {m.hp} {T('PG', 'HP')})</option>)}
        </select>
      </label>
      <label className="field">{T('Nombre', 'Name')}<input value={f.name} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field">{T('Nivel o VD', 'Level or CR')}<input value={f.level} placeholder={T('5 · VD 1/2', '5 · CR 1/2')} onChange={(e) => setF({ ...f, level: e.target.value })} /></label>
        <label className="field">{T('PG máximos', 'Max HP')}<input type="number" value={f.hpMax ?? ''} onChange={(e) => setF({ ...f, hpMax: num(e.target.value) })} /></label>
        <label className="field">{T('CA', 'AC')}<input type="number" value={f.ac ?? ''} onChange={(e) => setF({ ...f, ac: num(e.target.value) })} /></label>
        <label className="field">{T('Bonif. iniciativa', 'Init bonus')}<input type="number" value={f.initBonus} onChange={(e) => setF({ ...f, initBonus: Number(e.target.value) || 0 })} /></label>
      </div>
      <div className="row wrap power-row">
        <span className="small muted">{T('Potencia', 'Power')}</span>
        <button className="btn small" onClick={() => power(0.75, -1)}>{T('Débil', 'Weak')}</button>
        <button className="btn small" onClick={() => power(1, 0)}>{T('Normal', 'Normal')}</button>
        <button className="btn small" onClick={() => power(1.5, 1)}>{T('Fuerte', 'Strong')}</button>
        <button className="btn small" onClick={() => power(2, 2)}>{T('Élite', 'Elite')}</button>
      </div>
      <label className="field">{T('Ataques (nombre, bonificador, daño)', 'Attacks (name, bonus, damage)')}<input value={f.attacks ?? ''} placeholder={T('Cimitarra +4, 1d6+2 cortante; Arco corto +4, 1d6+2', 'Scimitar +4, 1d6+2 slashing; Shortbow +4, 1d6+2')} onChange={(e) => setF({ ...f, attacks: e.target.value })} /></label>
      <label className="field">{T('Equipo', 'Equipment')}<input value={f.equipment ?? ''} placeholder={T('Cota de mallas, escudo, 12 po, llave de la torre', 'Chain mail, shield, 12 gp, tower key')} onChange={(e) => setF({ ...f, equipment: e.target.value })} /></label>
      <div className="color-row">
        <span className="small muted">{T('Color en el combate', 'Color in combat')}</span>
        {ENEMY_COLORS.map((col) => <button key={col} className={`color-dot ${f.color === col ? 'on' : ''}`} style={{ background: col }} aria-label={col} onClick={() => setF({ ...f, color: col })} />)}
        <button className="color-dot none" aria-label={T('Sin color', 'No color')} onClick={() => setF({ ...f, color: undefined })}>✕</button>
      </div>
      <label className="field">{T('Notas (secretos, motivaciones, tácticas…)', 'Notes (secrets, motives, tactics…)')}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="row">
        {entry.id && <button className="btn danger" onClick={async () => { if (await askOk(T(`¿Borrar a ${entry.name}?`, `Delete ${entry.name}?`))) { send({ t: 'rosterRemove', id: entry.id }); onClose(); } }}>{T('Borrar', 'Delete')}</button>}
        <button className="btn primary grow" disabled={!f.name.trim()} onClick={() => { send({ t: 'rosterSave', entry: f }); onClose(); }}>{T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}

function ToCombat({ entry, onClose }: { entry: RosterEntry; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [count, setCount] = useState(1);
  const [hidden, setHidden] = useState(entry.kind === 'monster');
  return (
    <Modal title={T(`${entry.name} al combate`, `${entry.name} into combat`)} onClose={onClose}>
      <label className="field">{T('Cuántos', 'How many')}<input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
      <label className="check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> 🙈 {T('Oculto para los jugadores (lo revelas cuando quieras)', 'Hidden from players (reveal it whenever you want)')}</label>
      <p className="hint">{T('La iniciativa se tira sola (d20 + bonificador).', 'Initiative is rolled automatically (d20 + bonus).')}</p>
      <button className="btn primary full" onClick={() => { send({ t: 'rosterToCombat', id: entry.id, count, hidden }); onClose(); }}>⚔️ {T('Añadir al combate', 'Add to combat')}</button>
    </Modal>
  );
}

export function DmRosterTab() {
  const view = useParty((s) => s.view);
  const [edit, setEdit] = useState<RosterEntry | null>(null);
  const [toCombat, setToCombat] = useState<RosterEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'npc' | 'monster'>('all');
  if (!view) return <div className="tab"><p className="muted">{T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  const list = view.roster.filter((x) => filter === 'all' || x.kind === filter);
  return (
    <div className="tab">
      <Section title={T('Personajes del DM', 'DM characters')} right={
        <span className="row">
          <button className="btn small" onClick={() => setEdit(empty('npc'))}>+ 🤝 {T('Aliado', 'Ally')}</button>
          <button className="btn small" onClick={() => setEdit(empty('monster'))}>+ 👹 {T('Enemigo', 'Enemy')}</button>
        </span>}>
        <p className="small muted">{T('Prepara aquí los PNJ y enemigos de la campaña con sus datos básicos. Solo los ves tú; se guardan en el servidor y los tienes también en el PC.', 'Prepare your campaign’s NPCs and enemies with their basic data. Only you can see them; they’re saved on the server so you also have them on the PC.')}</p>
        <div className="segmented three">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{T('Todos', 'All')} ({view.roster.length})</button>
          <button className={filter === 'npc' ? 'on' : ''} onClick={() => setFilter('npc')}>🤝 {T('Aliados', 'Allies')}</button>
          <button className={filter === 'monster' ? 'on' : ''} onClick={() => setFilter('monster')}>👹 {T('Enemigos', 'Enemies')}</button>
        </div>
        {list.length === 0 && <p className="muted mt">{T('Aún no hay nadie. Añade aliados o enemigos con los botones de arriba.', 'Nobody yet. Add allies or enemies with the buttons above.')}</p>}
        <div className="roster-grid">
          {list.map((x) => (
            <div key={x.id} className={`roster-card ${x.kind}`}>
              <button className="roster-main" onClick={() => setEdit(x)}>
                <b>{x.kind === 'npc' ? '🤝' : '👹'} {x.name}</b>
                <span className="small">{[x.level && (/^\d+$/.test(x.level) ? `${T('Nivel', 'Level')} ${x.level}` : x.level), x.hpMax != null && `❤️ ${x.hpMax}`, x.ac != null && `${T('CA', 'AC')} ${x.ac}`, `${T('Ini', 'Init')} ${fmt(x.initBonus)}`].filter(Boolean).join(' · ')}</span>
                {x.notes && <span className="small muted roster-notes">{x.notes}</span>}
              </button>
              <button className="btn small" onClick={() => setToCombat(x)}>⚔️ {T('Al combate', 'To combat')}</button>
            </div>
          ))}
        </div>
      </Section>
      <EncountersSection />
      <DmBackupSection />
      {edit && <EntryModal entry={edit} onClose={() => setEdit(null)} />}
      {toCombat && <ToCombat entry={toCombat} onClose={() => setToCombat(null)} />}
    </div>
  );
}

// ---------- Encuentros preparados ----------

const newEntry = (): EncounterEntry => ({ id: uid(), name: '', kind: 'monster', count: 1, hidden: false, hpMax: null, ac: null, initBonus: 0 });

function EncounterModal({ encounter, onClose }: { encounter: PreparedEncounter; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const view = useParty((s) => s.view);
  const [f, setF] = useState<PreparedEncounter>(encounter);
  const [mq, setMq] = useState('');
  const setEntry = (i: number, patch: Partial<EncounterEntry>) => setF({ ...f, entries: f.entries.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const addMonster = (id: string) => {
    const m = MONSTERS.find((x) => x.id === id);
    if (m) setF({ ...f, entries: [...f.entries, { ...newEntry(), name: L(m.name), hpMax: m.hp, ac: m.ac, initBonus: m.init, cr: m.cr, monster: m.id, notes: m.atk ? `⚔️ ${L(m.atk[0])} +${m.atk[1]}, ${m.atk[2]}` : '' }] });
  };
  const addRoster = (id: string) => {
    const r = view?.roster.find((x) => x.id === id);
    if (r) setF({ ...f, entries: [...f.entries, { ...newEntry(), name: r.name, kind: r.kind, hpMax: r.hpMax, ac: r.ac, initBonus: r.initBonus, monster: r.monster, color: r.color, cr: r.level.match(/(?:VD|CR)\s*([\d/]+)/i)?.[1], notes: [r.notes, r.attacks && `⚔️ ${r.attacks}`, r.equipment && `🎒 ${r.equipment}`].filter(Boolean).join('\n') }] });
  };
  return (
    <Modal title={encounter.name || T('Nuevo encuentro', 'New encounter')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={f.name} autoFocus placeholder={T('Emboscada en el puente', 'Bridge ambush')} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field">{T('Notas (terreno, tácticas, botín…)', 'Notes (terrain, tactics, loot…)')}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <span className="p-mini">{T('Enemigos y aliados', 'Enemies and allies')}</span>
      {f.entries.map((x, i) => (
        <div key={x.id} className="enc-entry" style={x.color ? { borderLeft: `5px solid ${x.color}` } : undefined}>
          <div className="row">
            <input className="grow" value={x.name} onChange={(e) => setEntry(i, { name: e.target.value })} />
            <label className="small">×<input type="number" min={1} max={20} value={x.count} className="num-small" onChange={(e) => setEntry(i, { count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>
            <button className="btn small" aria-label={T('Quitar', 'Remove')} onClick={() => setF({ ...f, entries: f.entries.filter((_, j) => j !== i) })}>✕</button>
          </div>
          <div className="row wrap small">
            <label>{T('PG', 'HP')} <input type="number" className="num-small" value={x.hpMax ?? ''} onChange={(e) => setEntry(i, { hpMax: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>{T('CA', 'AC')} <input type="number" className="num-small" value={x.ac ?? ''} onChange={(e) => setEntry(i, { ac: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>{T('Ini', 'Init')} <input type="number" className="num-small" value={x.initBonus} onChange={(e) => setEntry(i, { initBonus: Number(e.target.value) || 0 })} /></label>
            <label className="check"><input type="checkbox" checked={x.hidden} onChange={(e) => setEntry(i, { hidden: e.target.checked })} /> 🙈 {T('Oculto', 'Hidden')}</label>
            <span className="color-row">{ENEMY_COLORS.map((col) => <button key={col} className={`color-dot small ${x.color === col ? 'on' : ''}`} style={{ background: col }} aria-label={col} onClick={() => setEntry(i, { color: x.color === col ? undefined : col })} />)}</span>
          </div>
        </div>
      ))}
      <div className="grid2">
        <label className="field">{T('➕ Del bestiario', '➕ From the bestiary')}
          <input value={mq} placeholder={T('Buscar…', 'Search…')} onChange={(e) => setMq(e.target.value)} />
          <select value="" onChange={(e) => { if (e.target.value) addMonster(e.target.value); }}>
            <option value="">—</option>
            {searchMonsters(mq).map((m) => <option key={m.id} value={m.id}>{L(m.name)} ({T('VD', 'CR')} {m.cr})</option>)}
          </select>
        </label>
        <label className="field">{T('➕ De tus personajes', '➕ From your characters')}
          <select value="" onChange={(e) => { if (e.target.value) addRoster(e.target.value); }}>
            <option value="">—</option>
            {(view?.roster ?? []).map((r) => <option key={r.id} value={r.id}>{r.kind === 'npc' ? '🤝' : '👹'} {r.name}</option>)}
          </select>
        </label>
      </div>
      <button className="btn small" onClick={() => setF({ ...f, entries: [...f.entries, { ...newEntry(), name: T('Enemigo', 'Enemy') }] })}>➕ {T('Uno a mano', 'One by hand')}</button>
      <button className="btn primary full" disabled={!f.name.trim() || !f.entries.length} onClick={() => { send({ t: 'encounterSave', encounter: f }); onClose(); }}>💾 {T('Guardar encuentro', 'Save encounter')}</button>
    </Modal>
  );
}

function EncountersSection() {
  const view = useParty((s) => s.view);
  const send = useParty((s) => s.send);
  const [edit, setEdit] = useState<PreparedEncounter | null>(null);
  if (!view) return null;
  return (
    <Section title={T('⚔️ Encuentros preparados', '⚔️ Prepared encounters')} right={<button className="btn small" onClick={() => setEdit({ id: '', name: '', notes: '', entries: [] })}>＋ {T('Nuevo', 'New')}</button>}>
      <p className="small muted">{T('Prepara combates antes de la sesión: enemigos del bestiario o de tu lista, cuántos, su color y si empiezan ocultos. Al cargarlos entran con la iniciativa ya tirada.', 'Prepare fights before the session: enemies from the bestiary or your list, how many, their color and whether they start hidden. When loaded they join with initiative already rolled.')}</p>
      {view.encounters.length === 0 && <p className="muted small">{T('Aún no tienes encuentros preparados.', 'No prepared encounters yet.')}</p>}
      <div className="roster-grid">
        {view.encounters.map((enc) => (
          <div key={enc.id} className="roster-card monster">
            <button className="roster-main" onClick={() => setEdit(enc)}>
              <b>⚔️ {enc.name}</b>
              <span className="small">{enc.entries.map((x) => `${x.count > 1 ? `${x.count}× ` : ''}${x.name}${x.hidden ? ' 🙈' : ''}`).join(' · ')}</span>
              {enc.notes && <span className="small muted roster-notes">{enc.notes}</span>}
            </button>
            <div className="row">
              <button className="btn small primary grow" onClick={() => { send({ t: 'encounterLoad', id: enc.id }); useStore.getState().showToast(T('⚔️ Encuentro cargado', '⚔️ Encounter loaded'), [enc.name, view.encounter.active ? T('Ya están en el combate.', 'They’re in the combat now.') : T('Están preparados: pulsa «Empezar combate» cuando quieras.', 'They’re ready: press “Start combat” whenever you want.')]); }}>▶ {T('Cargar', 'Load')}</button>
              <button className="btn small" aria-label={T('Borrar', 'Delete')} onClick={async () => { if (await confirmDelete(enc.name)) send({ t: 'encounterRemove', id: enc.id }); }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <EncounterModal encounter={edit} onClose={() => setEdit(null)} />}
    </Section>
  );
}
