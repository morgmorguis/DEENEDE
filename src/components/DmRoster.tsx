// Pestaña «Personajes» del DM: aliados y enemigos preparados con su nivel y datos básicos para
// tenerlos a mano y meterlos en el combate. Se guardan en el servidor de la partida.
import { useState } from 'react';
import { useParty } from '../party/client';
import type { RosterEntry } from '../party/protocol';
import { MONSTERS } from '../party/monsters';
import { fmt } from '../rules/calc';
import { Modal, Section } from './common';
import { L, T } from '../i18n';

const empty = (kind: RosterEntry['kind']): RosterEntry => ({ id: '', name: '', kind, level: '', hpMax: null, ac: null, initBonus: 0, notes: '' });

function EntryModal({ entry, onClose }: { entry: RosterEntry; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [f, setF] = useState(entry);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const fromMonster = (id: string) => {
    const m = MONSTERS.find((x) => x.id === id);
    if (m) setF({ ...f, name: f.name || L(m.name), level: `${T('VD', 'CR')} ${m.cr}`, hpMax: m.hp, ac: m.ac, initBonus: m.init, monster: m.id });
  };
  return (
    <Modal title={entry.id ? entry.name : f.kind === 'npc' ? T('Nuevo aliado', 'New ally') : T('Nuevo enemigo', 'New enemy')} onClose={onClose}>
      <div className="segmented">
        <button className={f.kind === 'npc' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'npc' })}>🤝 {T('Aliado / PNJ', 'Ally / NPC')}</button>
        <button className={f.kind === 'monster' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'monster' })}>👹 {T('Enemigo', 'Enemy')}</button>
      </div>
      <label className="field">{T('Basado en un monstruo del SRD (opcional)', 'Based on an SRD monster (optional)')}
        <select value={f.monster ?? ''} onChange={(e) => fromMonster(e.target.value)}>
          <option value="">—</option>
          {MONSTERS.map((m) => <option key={m.id} value={m.id}>{L(m.name)} ({T('VD', 'CR')} {m.cr})</option>)}
        </select>
      </label>
      <label className="field">{T('Nombre', 'Name')}<input value={f.name} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field">{T('Nivel o VD', 'Level or CR')}<input value={f.level} placeholder={T('5 · VD 1/2', '5 · CR 1/2')} onChange={(e) => setF({ ...f, level: e.target.value })} /></label>
        <label className="field">{T('PG máximos', 'Max HP')}<input type="number" value={f.hpMax ?? ''} onChange={(e) => setF({ ...f, hpMax: num(e.target.value) })} /></label>
        <label className="field">{T('CA', 'AC')}<input type="number" value={f.ac ?? ''} onChange={(e) => setF({ ...f, ac: num(e.target.value) })} /></label>
        <label className="field">{T('Bonif. iniciativa', 'Init bonus')}<input type="number" value={f.initBonus} onChange={(e) => setF({ ...f, initBonus: Number(e.target.value) || 0 })} /></label>
      </div>
      <label className="field">{T('Notas (ataques, secretos, motivaciones…)', 'Notes (attacks, secrets, motives…)')}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="row">
        {entry.id && <button className="btn danger" onClick={() => { if (confirm(T(`¿Borrar a ${entry.name}?`, `Delete ${entry.name}?`))) { send({ t: 'rosterRemove', id: entry.id }); onClose(); } }}>{T('Borrar', 'Delete')}</button>}
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
      {edit && <EntryModal entry={edit} onClose={() => setEdit(null)} />}
      {toCombat && <ToCombat entry={toCombat} onClose={() => setToCombat(null)} />}
    </div>
  );
}
