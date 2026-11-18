// Pestaña «Personajes» del DM: aliados y enemigos preparados con su nivel y datos básicos para
// tenerlos a mano y meterlos en el combate. Se guardan en el servidor de la partida.
import { DmBackupSection } from './DmBackup';
import { useRef, useState } from 'react';
import { useParty } from '../party/client';
import { useStore } from '../store';
import type { EncounterEntry, PreparedEncounter, RosterEntry } from '../party/protocol';
import { MONSTERS, searchMonsters } from '../party/monsters';
import { ENEMY_COLORS, setPrepFocus } from './Party';
import { LootEditor } from './Treasure';
import { encounterTemplateCsv, encountersRows, importEncounterFile, parseDelimited, rowsToEncounters } from '../party/encounterImport';
import { buildXlsx, XLSX_MIME } from '../export/xlsx';
import { NO_COINS, coinsText, hasCoins, itemLine } from '../rules/items';
import { saveBackupFile } from '../backup';
import { getLang } from '../i18n';
import { confirmDelete } from './Confirm';
import { uid } from '../rules/factory';
import { fmt } from '../rules/calc';
import { Modal, Section } from './common';
import { L, T } from '../i18n';

const goCombat = () => window.dispatchEvent(new CustomEvent('dnd-tab', { detail: 'dmcombat' }));
const lootLine = (l?: EncounterEntry['loot']) => (l ? [hasCoins(l.coins) ? coinsText(l.coins!) : '', ...(l.items ?? []).map(itemLine)].filter(Boolean).join(' · ') : '');
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
            <button className="btn small" onClick={() => setEntry(i, { kind: x.kind === 'npc' ? 'monster' : 'npc' })}>{x.kind === 'npc' ? `🤝 ${T('Aliado', 'Ally')}` : `👹 ${T('Enemigo', 'Enemy')}`}</button>
            <span className="color-row">{ENEMY_COLORS.map((col) => <button key={col} className={`color-dot small ${x.color === col ? 'on' : ''}`} style={{ background: col }} aria-label={col} onClick={() => setEntry(i, { color: x.color === col ? undefined : col })} />)}</span>
          </div>
          <details className="carried">
            <summary className="small">📝💰 {T('Notas y lo que lleva cada uno', 'Notes and what each one carries')}{x.loot ? `: ${lootLine(x.loot)}` : ''}</summary>
            <label className="field">{T('Notas privadas', 'Private notes')}<textarea value={x.notes ?? ''} onChange={(e) => setEntry(i, { notes: e.target.value })} /></label>
            <LootEditor loot={{ coins: { ...NO_COINS, ...x.loot?.coins }, items: x.loot?.items ?? [], note: '' }} noNote
              onChange={(l) => setEntry(i, { loot: hasCoins(l.coins) || l.items.length ? { coins: l.coins, items: l.items } : undefined })} />
          </details>
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
  const showToast = useStore((s) => s.showToast);
  const [edit, setEdit] = useState<PreparedEncounter | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!view) return null;
  const lang = getLang() === 'en' ? 'en' : 'es';
  /** Guarda los encuentros importados; si ya hay uno con el mismo nombre, lo sustituye */
  const saveAll = (list: PreparedEncounter[]) => {
    if (!list.length) { showToast(T('⚠️ No he encontrado enemigos', '⚠️ No enemies found'), [T('La primera fila deben ser las cabeceras (Nombre, Cantidad, PG, CA…). Descarga la plantilla para ver el formato.', 'The first row must be the headers (Name, Count, HP, AC…). Download the template to see the format.')]); return; }
    for (const enc of list) {
      const same = view.encounters.find((x) => x.name.trim().toLowerCase() === enc.name.trim().toLowerCase());
      send({ t: 'encounterSave', encounter: { ...enc, id: same?.id ?? '', notes: same?.notes ?? enc.notes } });
    }
    showToast(T('📥 Importado', '📥 Imported'), list.map((x) => `${x.name}: ${x.entries.reduce((n, y) => n + y.count, 0)} ${T('criaturas', 'creatures')}`));
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { saveAll(await importEncounterFile(f)); } catch { showToast(T('⚠️ No puedo leer ese archivo', '⚠️ Can’t read that file'), [T('Usa un .xlsx de Excel, un .csv o copia las celdas y pégalas.', 'Use an Excel .xlsx, a .csv or copy the cells and paste them.')]); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const prepareFrom = (enc: PreparedEncounter) => {
    setPrepFocus(enc.id);
    if (!view.encounter.active) send({ t: 'prepare', title: enc.name });
    goCombat();
  };
  return (
    <Section title={T('⚔️ Encuentros y lugares', '⚔️ Encounters and places')} right={<button className="btn small" onClick={() => setEdit({ id: '', name: '', notes: '', entries: [] })}>＋ {T('Nuevo', 'New')}</button>}>
      <p className="small muted">{T('Listas de los enemigos posibles de cada lugar («Taberna Malandra»): del bestiario, de tu lista o importados de Excel, con cuántos son, si empiezan ocultos y lo que lleva cada uno. Al preparar un combate eliges cuáles entran.', 'Lists of the possible enemies in each place (“Rascal Tavern”): from the bestiary, your list or imported from Excel, with how many, whether they start hidden and what each carries. When preparing a combat you choose who joins.')}</p>
      <div className="row wrap">
        <button className="btn small" onClick={() => fileRef.current?.click()}>📥 {T('Importar Excel / CSV', 'Import Excel / CSV')}</button>
        <button className="btn small" onClick={() => setPaste('')}>📋 {T('Pegar desde Excel', 'Paste from Excel')}</button>
        <button className="btn small" onClick={() => void saveBackupFile(encounterTemplateCsv(lang), T('plantilla-encuentros.csv', 'encounters-template.csv'), 'text/csv')}>📄 {T('Plantilla', 'Template')}</button>
        {view.encounters.length > 0 && <button className="btn small" onClick={() => void saveBackupFile(buildXlsx([{ name: T('Encuentros', 'Encounters'), rows: encountersRows(view.encounters, lang), widths: [20, 22, 10, 9, 6, 6, 9, 6, 7, 8, 6, 6, 6, 40, 40] }]), T('encuentros.xlsx', 'encounters.xlsx'), XLSX_MIME)}>📤 {T('Exportar a Excel', 'Export to Excel')}</button>}
        <input ref={fileRef} type="file" hidden accept=".xlsx,.csv,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {view.encounters.length === 0 && <p className="muted small">{T('Aún no tienes encuentros ni lugares.', 'No encounters or places yet.')}</p>}
      <div className="roster-grid">
        {view.encounters.map((enc) => (
          <div key={enc.id} className="roster-card monster">
            <button className="roster-main" onClick={() => setEdit(enc)}>
              <b>⚔️ {enc.name}</b>
              <span className="small">{enc.entries.map((x) => `${x.count > 1 ? `${x.count}× ` : ''}${x.name}${x.hidden ? ' 🙈' : ''}${x.loot ? ' 💰' : ''}`).join(' · ')}</span>
              {enc.notes && <span className="small muted roster-notes">{enc.notes}</span>}
            </button>
            <div className="row">
              {(!view.encounter.active || view.encounter.phase === 'prep')
                ? <button className="btn small primary grow" onClick={() => prepareFrom(enc)}>🛠️ {view.encounter.active ? T('Elegir de aquí', 'Pick from here') : T('Preparar combate', 'Prepare combat')}</button>
                : <button className="btn small grow" onClick={async () => { if (await askOk(T(`¿Meter a todos los de «${enc.name}» en el combate en marcha?`, `Put everyone from “${enc.name}” into the running combat?`))) { send({ t: 'encounterLoad', id: enc.id }); goCombat(); } }}>⤵️ {T('Refuerzos', 'Reinforcements')}</button>}
              <button className="btn small" aria-label={T('Borrar', 'Delete')} onClick={async () => { if (await confirmDelete(enc.name)) send({ t: 'encounterRemove', id: enc.id }); }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <EncounterModal encounter={edit} onClose={() => setEdit(null)} />}
      {paste != null && (
        <Modal title={T('📋 Pegar desde Excel', '📋 Paste from Excel')} onClose={() => setPaste(null)}>
          <p className="small">{T('Selecciona en Excel las celdas (con la fila de cabeceras: Lugar, Nombre, Cantidad, PG, CA, Iniciativa, Oculto, Oro, Objetos…), cópialas y pégalas aquí.', 'Select the cells in Excel (with the header row: Location, Name, Count, HP, AC, Initiative, Hidden, Gold, Items…), copy and paste them here.')}</p>
          <textarea className="tall" value={paste} autoFocus onChange={(e) => setPaste(e.target.value)} />
          <button className="btn primary full" disabled={!paste.trim()} onClick={() => { saveAll(rowsToEncounters(parseDelimited(paste), T('Encuentro pegado', 'Pasted encounter'))); setPaste(null); }}>📥 {T('Importar', 'Import')}</button>
        </Modal>
      )}
    </Section>
  );
}
