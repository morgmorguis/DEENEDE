// Pestaña «Partida»: unirse a la partida del DM, ver la party, jugar el combate compartido por turnos,
// consultar el registro y (si eres el DM) organizarlo todo, incluidos monstruos ocultos.
import { useEffect, useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import { httpBase, useParty } from '../party/client';
import type { CombatantView, HpState, LogEvent, RoomView } from '../party/protocol';
import { MONSTERS, searchMonsters, type MonsterInfo } from '../party/monsters';
import { rollExpr, fmt, initiativeBonus } from '../rules/calc';
import { Modal, Pips, Section } from './common';
import { CONDITIONS } from '../rules/srd';
import { encounterDifficulty } from '../party/difficulty';
import { Consumables } from './Consumables';
import { BundleList, MyGifts } from './Treasure';
import { TurnPanel, actionName } from './CombatActions';
import { combatTranscript, lastCombat, localNarrative } from '../party/narrative';
import { describeError, narrateCombatWithClaude } from '../ai';
import { DmImages, SharedGallery, useImageUrl } from './Images';
import { L, T, locale } from '../i18n';
import { askOk, askText } from './Confirm';

const STATE_LABEL: Record<HpState, [string, string, string]> = {
  unhurt: ['Ileso', 'Unhurt', 'ok'],
  hurt: ['Herido', 'Hurt', 'hurt'],
  bloodied: ['Ensangrentado', 'Bloodied', 'bloodied'],
  down: ['Derrotado', 'Down', 'down'],
  unknown: ['?', '?', 'unknown'],
};
/** Colores para distinguir enemigos (rojo, naranja, amarillo, verde, azul, morado, rosa, blanco) */
export const ENEMY_COLORS = ['#e5484d', '#f2862d', '#f5c542', '#46b36b', '#3e8ef7', '#9b6bf2', '#e85aa8', '#d9d9d9'];
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
      <Section title={T('🎒 ¿Eres el DM? Prepara el botín', '🎒 Are you the DM? Prepare the loot')}>
        <p className="small">{T('Prepara antes de la partida, sin conexión, lo que vas a repartir: monedas, objetos del catálogo o creados por ti. Al conectarte como DM los tendrás en la pestaña 💰 Tesoro → Botines preparados.', 'Prepare what you’ll hand out before the session, offline: coins and items from the catalog or your own. Once you connect as the DM you’ll find them in 💰 Treasure → Prepared loot.')}</p>
        <BundleList />
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

// ---------- Registro ----------

export function logLine(ev: LogEvent, dm: boolean): string {
  void dm;
  const roll = ev.roll != null ? T(` (tirada ${ev.roll})`, ` (roll ${ev.roll})`) : '';
  const after = ev.after ? ` → ${ev.after}` : '';
  const how = [ev.reaction ? T('reacción', 'reaction') : '', ev.action && !['atacar'].includes(ev.action) ? actionName(ev.action) : '', ev.weapon ?? '', ev.spell ?? ''].filter(Boolean).join(' · ');
  const w = how ? ` [${how}]` : '';
  const crit = ev.crit ? T(' ¡CRÍTICO!', ' CRITICAL!') : '';
  const note = ev.text ? ` — ${ev.text}` : '';
  switch (ev.kind) {
    case 'hit': return T(`⚔️ ${ev.actor} golpea a ${ev.target}${w}: ${ev.amount} de daño${crit}${roll}${after}${note}`, `⚔️ ${ev.actor} hits ${ev.target}${w}: ${ev.amount} damage${crit}${roll}${after}${note}`);
    case 'miss': return T(`❌ ${ev.actor} falla${ev.target ? ` contra ${ev.target}` : ''}${w}${roll}${note}`, `❌ ${ev.actor} misses${ev.target ? ` ${ev.target}` : ''}${w}${roll}${note}`);
    case 'heal': return T(`💚 ${ev.actor} cura a ${ev.target}${w}: ${ev.amount} PG${roll}${after}`, `💚 ${ev.actor} heals ${ev.target}${w}: ${ev.amount} HP${roll}${after}`);
    case 'hurt': return T(`🩸 ${ev.actor} recibe ${ev.amount} de daño${roll}${after}`, `🩸 ${ev.actor} takes ${ev.amount} damage${roll}${after}`);
    case 'other': return `${ev.action ? '🎬' : '💬'} ${ev.actor}${ev.action ? `: ${actionName(ev.action)}` : ''}${ev.spell ? ` (${ev.spell})` : ''}${ev.target ? ` → ${ev.target}` : ''}${ev.text ? `${ev.action ? ' — ' : ': '}${ev.text}` : ''}${roll}`;
    case 'narrative': return `📖 ${ev.text ?? ''}`;
    case 'down': return T(`💀 ${ev.target} cae${ev.actor ? ` (golpe final de ${ev.actor})` : ''}`, `💀 ${ev.target} is down${ev.actor ? ` (final blow by ${ev.actor})` : ''}`);
    case 'turn': return T(`▶ Turno de ${ev.actor}`, `▶ ${ev.actor}’s turn`);
    case 'round': return T(`— Ronda ${ev.round} —`, `— Round ${ev.round} —`);
    case 'start': return T('⚔️ ¡Combate! Preparación', '⚔️ Combat! Getting ready');
    case 'begin': return T('✅ Todos listos: empiezan los turnos', '✅ Everyone ready: turns begin');
    case 'end': return T('🏁 Fin del combate', '🏁 Combat over');
    case 'undo': return T(`↩️ ${ev.actor} deshace el último turno`, `↩️ ${ev.actor} undoes the last turn`);
    case 'add': return T(`➕ ${ev.target} entra en el combate`, `➕ ${ev.target} joins the combat`);
    case 'reveal': return T(`👁️ ¡Aparece ${ev.target}!`, `👁️ ${ev.target} appears!`);
    default: return ev.text ?? '';
  }
}

/** Resumen narrativo del último combate: sin IA o con Claude; el DM lo comparte y el jugador lo guarda */
function NarrativeModal({ view, onClose }: { view: RoomView; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const send = useParty((s) => s.send);
  const addNote = useStore((s) => s.addNote);
  const c = useChar();
  const dm = view.you.role === 'dm';
  const events = lastCombat(view.log, view.encounter.order);
  const local = localNarrative(events);
  const [title, setTitle] = useState(local.title);
  const [text, setText] = useState(local.text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const withAi = async () => {
    setBusy(true); setErr('');
    try {
      const out = await narrateCombatWithClaude(settings.apiKey, settings.model, combatTranscript(events));
      const [first, ...rest] = out.trim().split('\n');
      setTitle(first.replace(/^#+\s*/, '').trim() || local.title);
      setText(rest.join('\n').trim());
    } catch (e) { setErr(describeError(e)); }
    setBusy(false);
  };
  return (
    <Modal title={T('📖 Resumen narrativo del combate', '📖 Combat narrative')} onClose={onClose}>
      <div className="row wrap">
        <button className="btn small" onClick={() => { setTitle(local.title); setText(local.text); }}>⚙️ {T('Sin IA', 'Without AI')}</button>
        <button className="btn small primary" disabled={busy || !settings.apiKey} onClick={() => void withAi()}>✨ {busy ? T('Escribiendo…', 'Writing…') : T('Con IA (Claude)', 'With AI (Claude)')}</button>
      </div>
      {!settings.apiKey && <p className="hint">{T('Para la versión con IA pon tu clave de Claude en Ajustes. La versión sin IA funciona siempre.', 'For the AI version add your Claude key in Settings. The version without AI always works.')}</p>}
      {err && <p className="error">⚠️ {err}</p>}
      <label className="field">{T('Título', 'Title')}<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <textarea className="tall" value={text} onChange={(e) => setText(e.target.value)} />
      {dm ? (
        <button className="btn primary full" disabled={!text.trim()} onClick={() => { send({ t: 'chronicleShare', title, text }); useStore.getState().showToast(T('📤 Crónica compartida', '📤 Chronicle shared'), [T('Se guarda en el diario de cada jugador (Compartido).', 'It’s saved in each player’s journal (Shared).')]); onClose(); }}>📤 {T('Compartir con los jugadores', 'Share with the players')}</button>
      ) : (
        <button className="btn primary full" disabled={!text.trim()} onClick={() => { addNote({ title: `📖 ${title}`, body: text, kind: 'story', folderId: c.noteFolders.find((f) => f.key === 'chronicles')?.id ?? null }); onClose(); }}>📜 {T('Guardar en mi diario', 'Save to my journal')}</button>
      )}
    </Modal>
  );
}

function CombatLog({ view }: { view: RoomView }) {
  const [story, setStory] = useState(false);
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
    <Section title={T('Registro del combate', 'Combat log')} right={<span className="row"><button className="btn small" disabled={!events.length} onClick={() => setStory(true)}>📖 {T('Resumen', 'Story')}</button><button className="btn small" disabled={!events.length} onClick={save}>📜 {T('Guardar', 'Save')}</button></span>}>
      {story && <NarrativeModal view={view} onClose={() => setStory(false)} />}
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
        cr: base.monster ? MONSTERS.find((x) => x.id === base.monster)?.cr : undefined,
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
      {c.kind !== 'pc' && (
        <div className="color-row">
          <span className="small muted">{T('Color (lo ven los jugadores)', 'Color (players see it)')}</span>
          {ENEMY_COLORS.map((col) => <button key={col} className={`color-dot ${c.color === col ? 'on' : ''}`} style={{ background: col }} aria-label={col} onClick={() => send({ t: 'update', id: c.id, patch: { color: col } })} />)}
          <button className="color-dot none" aria-label={T('Sin color', 'No color')} onClick={() => send({ t: 'update', id: c.id, patch: { color: undefined } })}>✕</button>
        </div>
      )}
      <div className="grid3">
        <label className="field">{T('PG', 'HP')}<input type="number" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} /></label>
        <label className="field">{T('Máx.', 'Max')}<input type="number" value={f.hpMax} onChange={(e) => setF({ ...f, hpMax: e.target.value })} /></label>
        <label className="field">{T('Temp.', 'Temp')}<input type="number" value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })} /></label>
        <label className="field">{T('CA', 'AC')}<input type="number" value={f.ac} onChange={(e) => setF({ ...f, ac: e.target.value })} /></label>
        <label className="field">{T('Iniciativa', 'Initiative')}<input type="number" value={f.initiative} onChange={(e) => setF({ ...f, initiative: e.target.value })} /></label>
      </div>
      <TimedConditions c={c} />
      {c.kind !== 'pc' && <CountersEditor c={c} />}
      {c.kind !== 'pc' && (
        <label className="field">{T('Valor de desafío (VD)', 'Challenge Rating (CR)')}
          <input value={c.cr ?? ''} placeholder="1/4, 2, 5…" onChange={(e) => send({ t: 'update', id: c.id, patch: { cr: e.target.value.trim() || undefined } })} />
        </label>
      )}
      {c.kind !== 'pc' && <label className="field">{T('Notas privadas del DM', 'Private DM notes')}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>}
      {c.kind === 'pc' && <p className="hint">{T('Si cambias la vida de un jugador, se actualiza también en su ficha.', 'If you change a player’s HP, their sheet is updated too.')}</p>}
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await askOk(T(`¿Quitar a ${c.name} del combate?`, `Remove ${c.name} from combat?`))) { send({ t: 'remove', id: c.id }); onClose(); } }}>{T('Quitar', 'Remove')}</button>
        <button className="btn primary grow" onClick={save}>{T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}

/** Condiciones con duración en rondas: bajan solas al terminar el turno de la criatura */
function TimedConditions({ c }: { c: CombatantView }) {
  const send = useParty((s) => s.send);
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('');
  const list = c.conditions ?? [];
  const setList = (conditions: NonNullable<CombatantView['conditions']>) => send({ t: 'update', id: c.id, patch: { conditions } });
  return (
    <div className="field">
      <span>{T('Condiciones y efectos', 'Conditions & effects')}</span>
      <div className="target-chips">
        {list.map((x, i) => (
          <span key={i} className="cond-chip">{x.name}{x.rounds != null ? ` · ${x.rounds}r` : ''} <button className="link" aria-label={T('Quitar', 'Remove')} onClick={() => setList(list.filter((_, j) => j !== i))}>✕</button></span>
        ))}
        {!list.length && <span className="muted small">{T('Ninguna', 'None')}</span>}
      </div>
      <div className="row wrap">
        <input className="grow" list="dl-conds" value={name} placeholder={T('Derribado, Bendición…', 'Prone, Bless…')} onChange={(e) => setName(e.target.value)} />
        <input style={{ width: 80 }} type="number" min={1} value={rounds} placeholder={T('rondas', 'rounds')} onChange={(e) => setRounds(e.target.value)} />
        <button className="btn small" disabled={!name.trim()} onClick={() => { setList([...list, { name: name.trim(), rounds: rounds ? Math.max(1, Number(rounds)) : null }]); setName(''); setRounds(''); }}>＋</button>
      </div>
      <datalist id="dl-conds">{CONDITIONS.map((x) => <option key={x.id} value={L(x.name)} />)}</datalist>
      <span className="hint">{T('Con rondas, la duración baja al terminar su turno y se quita sola. Las ven también los jugadores (si la criatura es visible).', 'With rounds, the duration goes down at the end of its turn and is removed automatically. Players see them too (if the creature is visible).')}</span>
    </div>
  );
}

/** Contadores del DM: acciones legendarias (vuelven al empezar su turno), resistencias legendarias… */
function CountersEditor({ c }: { c: CombatantView }) {
  const send = useParty((s) => s.send);
  const list = c.counters ?? [];
  const setList = (counters: NonNullable<CombatantView['counters']>) => send({ t: 'update', id: c.id, patch: { counters } });
  const add = (label: string, max: number, reset: 'turn' | 'never') => setList([...list, { id: Math.random().toString(36).slice(2, 8), label, max, used: 0, reset }]);
  return (
    <div className="field">
      <span>{T('Contadores (solo los ves tú)', 'Counters (only you see them)')}</span>
      {list.map((ct) => (
        <div key={ct.id} className="row counter-row">
          <span className="grow">{ct.label} <span className="muted small">{ct.reset === 'turn' ? T('(vuelven en su turno)', '(refresh on its turn)') : ''}</span></span>
          <Pips max={ct.max} used={ct.used} onChange={(u) => setList(list.map((x) => (x.id === ct.id ? { ...x, used: u } : x)))} />
          <button className="link" aria-label={T('Quitar', 'Remove')} onClick={() => setList(list.filter((x) => x.id !== ct.id))}>✕</button>
        </div>
      ))}
      <div className="row wrap">
        <button className="btn small" onClick={() => add(T('Acciones legendarias', 'Legendary actions'), 3, 'turn')}>＋ {T('Acciones legendarias (3)', 'Legendary actions (3)')}</button>
        <button className="btn small" onClick={() => add(T('Resistencias legendarias', 'Legendary resistances'), 3, 'never')}>＋ {T('Resistencias legendarias (3)', 'Legendary resistances (3)')}</button>
        <button className="btn small" onClick={async () => { const l = await askText(T('Nombre del contador', 'Counter name')); if (!l?.trim()) return; const m = Number(await askText(T('¿Cuántos usos?', 'How many uses?'), '1')); if (m > 0) add(l.trim(), Math.min(10, m), 'never'); }}>＋ {T('Otro', 'Other')}</button>
      </div>
    </div>
  );
}

/** Dificultad del encuentro según las reglas 2024 (solo el DM) */
function DifficultyBar({ view }: { view: RoomView }) {
  const pcs = view.members.filter((m) => m.role === 'player' && m.summary && view.encounter.order.some((c) => c.ownerId === m.id));
  const monsters = view.encounter.order.filter((c) => c.kind === 'monster' && c.state !== 'down');
  if (!pcs.length || !monsters.length) return null;
  const crs = monsters.map((m) => m.cr ?? MONSTERS.find((x) => x.id === m.monster)?.cr);
  const d = encounterDifficulty(pcs.map((m) => m.summary!.level), crs);
  const label = { trivial: T('Trivial', 'Trivial'), low: T('Baja', 'Low'), moderate: T('Moderada', 'Moderate'), high: T('Alta', 'High'), deadly: T('¡Mortal!', 'Deadly!') }[d.level];
  return (
    <div className={`difficulty ${d.level}`}>
      <b>⚖️ {T('Dificultad', 'Difficulty')}: {label}</b>
      <span className="small">{d.xp} PX · {T('presupuesto', 'budget')} {T('baja', 'low')} {d.budget[0]} / {T('moderada', 'moderate')} {d.budget[1]} / {T('alta', 'high')} {d.budget[2]}</span>
      {d.unknown > 0 && <span className="small muted">{T(`${d.unknown} criatura(s) sin VD: ponlo tocándolas.`, `${d.unknown} creature(s) without CR: set it by tapping them.`)}</span>}
    </div>
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
  const dex = initiativeBonus(c);
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
          <button className="btn" onClick={async () => { if (await askOk(T('¿Empezar ya, sin esperar a que estén todos listos?', 'Start now without waiting for everyone?'))) send({ t: 'begin' }); }}>⏩ {T('Empezar ya', 'Start now')}</button>
        </div>
      )}
      <h3 className="mt">{T('La party', 'The party')}</h3>
      <ul className="setup-list">
        {pcs.map((p) => {
          const ready = !!p.ownerId && e.ready.includes(p.ownerId);
          return (
            <li key={p.id} className={ready ? 'ready' : ''}>
              <span className="grow"><b>{p.name}</b>{nameOf(p.ownerId ?? '')?.name !== p.name && <span className="small muted"> {nameOf(p.ownerId ?? '')?.name}</span>}</span>
              <span className="small">🎲 {p.initiative ?? '—'} · {p.hp != null ? `❤️ ${hpText(p)}` : <StateBadge state={p.state} />} · {T('CA', 'AC')} {p.ac ?? '—'}</span>
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

/** Jugador fuera de su turno: mira, y puede usar una reacción por ronda */
function Spectator({ view, me }: { view: RoomView; me: CombatantView }) {
  const [react, setReact] = useState(false);
  const usedReaction = me.reactionRound === view.encounter.round;
  return (
    <>
      <p className="spectator">👀 {T('Eres espectador hasta que te toque. Fuera de tu turno solo puedes usar tu reacción (ataque de oportunidad, Escudo…).', 'You’re a spectator until your turn. Off-turn you can only use your reaction (opportunity attack, Shield…).')}</p>
      <button className="btn" disabled={usedReaction} onClick={() => setReact(!react)}>⚡ {usedReaction ? T('Reacción ya usada esta ronda', 'Reaction already used this round') : react ? T('Cerrar reacción', 'Close reaction') : T('Usar mi reacción', 'Use my reaction')}</button>
      {react && !usedReaction && <TurnPanel view={view} actor={me} reaction />}
    </>
  );
}

/** DM: actúa por la criatura del turno (o por cualquiera) */
function DmTurn({ view }: { view: RoomView }) {
  const e = view.encounter;
  const [actorId, setActorId] = useState<string | null>(null);
  const id = actorId && e.order.some((c) => c.id === actorId) ? actorId : e.currentId;
  const actor = e.order.find((c) => c.id === id);
  return (
    <>
      <label className="field">{T('Actúa', 'Acting')}
        <select value={id ?? ''} onChange={(ev) => setActorId(ev.target.value || null)}>
          {e.order.map((c) => <option key={c.id} value={c.id}>{c.id === e.currentId ? '▶ ' : ''}{kindIcon(c)} {c.name}{c.hidden ? ` (${T('oculto', 'hidden')})` : ''}</option>)}
        </select>
      </label>
      {actor && <TurnPanel view={view} actor={actor} />}
      {actor && actor.kind === 'pc' && <p className="hint">{T('Estás actuando por un jugador (lo normal es que lo haga él desde su móvil).', 'You’re acting for a player (normally they do it from their phone).')}</p>}
    </>
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

  return (
    <>
      {e.active && e.phase === 'setup' && <SetupPanel view={view} />}
      <Section title={e.active ? (e.phase === 'setup' ? T('Combatientes', 'Combatants') : `${T('Combate', 'Combat')} · ${T('Ronda', 'Round')} ${e.round}`) : T('Combate', 'Combat')}
        right={dm ? (e.active
          ? <button className="btn small danger" onClick={async () => { if (await askOk(T('¿Terminar el combate? Los monstruos se quitarán.', 'End combat? Monsters will be removed.'))) send({ t: 'end' }); }}>🏁 {T('Terminar', 'End')}</button>
          : <button className="btn small primary" onClick={() => send({ t: 'start' })}>⚔️ {T('Empezar combate', 'Start combat')}</button>) : undefined}>
        {!e.active && !dm && <p className="muted">{T('Cuando el DM empiece un combate aparecerá aquí.', 'When the DM starts a combat it will show up here.')}</p>}
        {(e.active || (dm && e.order.length > 0)) && (
          <>
            <ol className="party-order">
              {e.order.map((c) => {
                const active = c.id === e.currentId;
                return (
                  <li key={c.id} className={`${c.kind} ${active ? 'active' : ''} ${c.state === 'down' ? 'down' : ''} ${c.hidden ? 'hidden' : ''}`} style={c.color ? { borderLeft: `6px solid ${c.color}` } : undefined} onClick={() => dm && setEdit(c)}>
                    <span className="po-init">{c.initiative ?? '–'}</span>
                    <span className="po-name" style={c.color ? { color: c.color } : undefined}>{kindIcon(c)} {c.name}{c.hidden && <span className="hidden-tag">🙈 {T('oculto', 'hidden')}</span>}{active && <span className="bubble-turn">{T('turno', 'turn')}</span>}</span>
                    <span className="po-hp">
                      {c.hp != null && <b>❤️ {hpText(c)}</b>}
                      {c.hp == null && c.kind !== 'pc' && <b>❤️ ?</b>}
                      {(c.kind !== 'pc' || c.hp == null) && <StateBadge state={c.state} />}
                      {dm && c.ac != null && <span className="muted small"> · {T('CA', 'AC')} {c.ac}</span>}
                    </span>
                    {(() => {
                      // Condiciones de la criatura, y de los jugadores las de su ficha, concentración y salvaciones de muerte
                      const sum = c.kind === 'pc' ? view.members.find((m) => m.id === c.ownerId)?.summary : undefined;
                      const conds = [...(c.conditions ?? []).map((x) => `${x.name}${x.rounds != null ? ` ${x.rounds}r` : ''}`), ...(sum?.conditions ?? [])];
                      if (!conds.length && !sum?.concentration && !sum?.deathSaves && !(dm && c.counters?.length)) return null;
                      return (
                        <span className="po-extra">
                          {sum?.deathSaves && <span className="cond-chip bad">💀 {sum.hpHidden ? T('salvaciones de muerte', 'death saves') : `${sum.deathSaves.success}✓ ${sum.deathSaves.fail}✗`}</span>}
                          {sum?.concentration && <span className="cond-chip conc">🧠 {sum.concentration}</span>}
                          {conds.map((x, i) => <span key={i} className="cond-chip">{x}</span>)}
                          {dm && c.counters?.map((ct) => <span key={ct.id} className="cond-chip counter" title={ct.label}>{ct.label.split(' ')[0]} {ct.max - ct.used}/{ct.max}</span>)}
                        </span>
                      );
                    })()}
                    {dm && c.notes && <span className="po-notes">📝 {c.notes}</span>}
                  </li>
                );
              })}
            </ol>
            {dm && <DifficultyBar view={view} />}
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
        <Section className="turn-section" title={cur ? (myTurn ? T('⚔️ ¡Tu turno!', '⚔️ Your turn!') : T(`Turno de ${cur.name}`, `${cur.name}’s turn`)) : T('Turno', 'Turn')}>
          {dm && <DmTurn view={view} />}
          {!dm && myPc && myTurn && (
            <>
              <TurnPanel view={view} actor={myPc} />
              <details className="mt cons-details">
                <summary>🏹 {T('Munición y consumibles', 'Ammo & consumables')}</summary>
                <Consumables mode="combat" />
              </details>
            </>
          )}
          {!dm && myPc && !myTurn && <Spectator view={view} me={myPc} />}
          {!myPc && !dm && <p className="muted">{T('Tu ficha aún no está en el combate: pide al DM que lo reinicie o espera a que entre.', 'Your sheet isn’t in this combat yet: ask the DM to restart it.')}</p>}
          <div className="row wrap mt">
            {view.canEndTurn && <button className="btn primary grow" onClick={() => send({ t: 'nextTurn' })}>⏭️ {dm ? T('Siguiente turno', 'Next turn') : T('Terminar mi turno', 'End my turn')}</button>}
            {dm && view.canUndo && <button className="btn" onClick={async () => { if (await askOk(T('¿Deshacer el último turno? Se revierten sus daños y curaciones.', 'Undo the last turn? Its damage and healing are reverted.'))) send({ t: 'undo' }); }}>↩️ {T('Deshacer último turno', 'Undo last turn')}</button>}
          </div>
        </Section>
      )}
      {edit && <DmCombatantModal c={edit} onClose={() => setEdit(null)} />}
      {adding && <MonsterPicker onClose={() => setAdding(false)} />}
    </>
  );
}

/** DM en «Partida»: resumen del combate con acceso a su pestaña */
function DmCombatCard({ view }: { view: RoomView }) {
  const e = view.encounter;
  const send = useParty((s) => s.send);
  return (
    <Section title={T('Combate', 'Combat')}>
      <p className="small">{e.active ? T(`⚔️ En marcha · ronda ${e.round} · ${e.order.length} combatientes`, `⚔️ Running · round ${e.round} · ${e.order.length} combatants`) : T('No hay combate en marcha. Prepáralo y llévalo desde la pestaña ⚔️ Combate.', 'No combat running. Prepare and run it from the ⚔️ Combat tab.')}</p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent('dnd-tab', { detail: 'dmcombat' }))}>⚔️ {T('Ir a la pestaña Combate', 'Go to the Combat tab')}</button>
        {!e.active && <button className="btn" onClick={() => send({ t: 'start' })}>{T('Empezar combate', 'Start combat')}</button>}
      </div>
    </Section>
  );
}

/** Pestaña «Combate» del DM: orden de turnos, acciones y registro a la vez (en pantalla ancha, en dos columnas) */
export function DmCombatTab() {
  const view = useParty((s) => s.view);
  if (!view) return <div className="tab"><p className="muted">{T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  return (
    <div className="tab dm-combat">
      <div className="dm-combat-main"><SharedCombat view={view} /></div>
      <div className="dm-combat-side"><CombatLog view={view} /></div>
    </div>
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
        <button className="btn small" onClick={async () => { if (await askOk(T('¿Salir de la partida?', 'Leave the game?'))) leave(); }}>{T('Salir', 'Leave')}</button>
      </div>
      {error && <p className="error">⚠️ {error}</p>}
      {view && dm && <InvitePanel code={view.code} />}
      {view && dm && <TvLink code={view.code} />}
      {view && (
        <>
          <Section title={T('Party', 'Party')}>
            {dm && (
              <label className="check party-hp-toggle">
                <input type="checkbox" checked={!!view.settings?.showPartyHp} onChange={(ev) => useParty.getState().send({ t: 'roomSettings', patch: { showPartyHp: ev.target.checked } })} />
                ❤️ {T('Los jugadores ven la vida de sus compañeros', 'Players see their allies’ HP')}
              </label>
            )}
            {!dm && view.you.role === 'player' && !view.settings?.showPartyHp && <p className="hint">{T('El DM no muestra la vida de tus compañeros: solo ves si están heridos o ensangrentados.', 'The DM doesn’t show your allies’ HP: you only see if they’re hurt or bloodied.')}</p>}
            <div className="party-members">
              {view.members.filter((m) => m.role === 'player').map((m) => (
                <div key={m.id} className={`member ${m.online ? '' : 'offline'}`}>
                  <b>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</b>
                  {m.summary ? (
                    <span className="small">
                      {m.summary.species} {m.summary.className} {m.summary.level}{!m.summary.hpHidden && <> · ❤️ {m.summary.hp}/{m.summary.hpMax}{m.summary.temp ? ` +${m.summary.temp}` : ''}</>} · {T('CA', 'AC')} {m.summary.ac} · 👁️ {m.summary.passive}
                      {m.summary.conditions.length > 0 && <> · <span className="warn">{m.summary.conditions.join(', ')}</span></>}
                    </span>
                  ) : <span className="small muted">{T('Sin ficha', 'No sheet')}</span>}
                  {m.summary && m.summary.name !== m.name && <span className="tiny muted">{m.name}</span>}
                </div>
              ))}
              {view.members.filter((m) => m.role === 'player').length === 0 && <p className="muted">{T(`Aún no hay jugadores. Código: ${view.code}`, `No players yet. Code: ${view.code}`)}</p>}
            </div>
          </Section>
          {dm ? <DmCombatCard view={view} /> : <SharedCombat view={view} />}
          {dm && <DmImages view={view} />}
          <SharedGallery view={view} />
          <MyGifts view={view} />
          {!dm && <CombatLog view={view} />}
        </>
      )}
    </div>
  );
}

/** Pantalla para la tele o un portátil en la mesa: orden de turnos, estados y lo último que ha pasado, sin secretos */
export function TvView() {
  const view = useParty((s) => s.view);
  const status = useParty((s) => s.status);
  const leave = useParty((s) => s.leave);
  const imgUrl = useImageUrl();
  if (!view) return <div className="tv"><p className="tv-wait">🎲 {T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  const e = view.encounter;
  const last = view.log.filter((ev) => !ev.undone && ev.kind !== 'turn').slice(-6).reverse();
  // La última imagen compartida con todos se ve en grande
  const latestImage = [...view.images].filter((im) => im.shared).sort((a, b) => (b.sharedAt ?? 0) - (a.sharedAt ?? 0))[0];
  return (
    <div className="tv">
      <header className="tv-head">
        <b>🎲 Di en Di</b>
        <span>{e.active ? (e.phase === 'setup' ? T('⚔️ Preparando el combate…', '⚔️ Getting ready…') : `${T('Ronda', 'Round')} ${e.round}`) : T('Fuera de combate', 'Out of combat')}</span>
        <span className="muted small">{status === 'online' ? '🟢' : '🟡'} {view.code}</span>
        <button className="btn small" onClick={leave}>✕</button>
      </header>
      {e.active ? (
        <ol className="tv-order">
          {e.order.map((c) => {
            const sum = c.kind === 'pc' ? view.members.find((m) => m.id === c.ownerId)?.summary : undefined;
            return (
              <li key={c.id} className={`${c.kind} ${c.id === e.currentId ? 'active' : ''} ${c.state === 'down' ? 'down' : ''}`}>
                <span className="tv-init">{c.initiative ?? '–'}</span>
                <span className="tv-name">{kindIcon(c)} {c.name}</span>
                <span className="tv-hp">{c.hp != null ? `❤️ ${hpText(c)}` : <StateBadge state={c.state} />}</span>
                <span className="tv-conds">
                  {sum?.concentration && <span className="cond-chip conc">🧠 {sum.concentration}</span>}
                  {[...(c.conditions ?? []).map((x) => x.name), ...(sum?.conditions ?? [])].map((x, i) => <span key={i} className="cond-chip">{x}</span>)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="tv-party">
          {view.members.filter((m) => m.role === 'player' && m.summary).map((m) => (
            <div key={m.id} className="member"><b>{m.summary!.name}</b><span>{m.summary!.className} {m.summary!.level}{m.summary!.hpHidden ? '' : ` · ❤️ ${m.summary!.hp}/${m.summary!.hpMax}`} · {T('CA', 'AC')} {m.summary!.ac}</span></div>
          ))}
        </div>
      )}
      {e.hiddenTurn && <p className="tv-hidden">{T('Algo acecha en las sombras…', 'Something lurks in the shadows…')}</p>}
      {latestImage && <figure className="tv-figure"><img className="tv-image" src={imgUrl(latestImage.id)} alt={latestImage.title} /><figcaption>{latestImage.title}</figcaption></figure>}
      <ul className="tv-log">{last.map((ev) => <li key={ev.id}>{logLine(ev, false)}</li>)}</ul>
    </div>
  );
}

/** Enlace para abrir la vista de la tele en cualquier navegador de la red */
interface ServerInfo { code: string; lan: string[]; publish?: { mode: string; url: string | null; status: string; message: string } }

/** DM: cómo se unen los jugadores — dirección pública (Internet) y de la red local, con el código */
function InvitePanel({ code }: { code: string }) {
  const conn = useParty((s) => s.conn);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!conn?.dmKey) return;
    let stop = false;
    const load = () => fetch(`${httpBase(conn.url)}/api/info?dm=${encodeURIComponent(conn.dmKey!)}`).then((r) => r.json()).then((j: ServerInfo) => { if (!stop && j.code) setInfo(j); }).catch(() => { if (!stop) setFailed(true); });
    void load();
    const t = window.setInterval(load, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [conn?.url, conn?.dmKey]);
  const pub = info?.publish;
  const copy = (t: string) => void navigator.clipboard?.writeText(t);
  const Row = ({ label, url }: { label: string; url: string }) => (
    <div className="invite-row">
      <span className="small muted">{label}</span>
      <div className="row"><code className="grow">{url}</code><button className="btn small" onClick={() => copy(url)}>{T('Copiar', 'Copy')}</button></div>
    </div>
  );
  return (
    <details className="tv-link invite" open={!!pub && pub.status === 'on'}>
      <summary>📨 {T('Invitar jugadores', 'Invite players')} · <b>{code}</b> {pub?.status === 'on' ? '🌍' : '🏠'}</summary>
      {pub?.status === 'on' && pub.url && (
        <>
          <Row label={T('🌍 Desde cualquier sitio (Internet)', '🌍 From anywhere (Internet)')} url={`${pub.url}/?join=${code}`} />
          <p className="hint">{T(`En la app: Partida → dirección ${pub.url} y código ${code}. Abierto en el navegador, el enlace ya entra solo.`, `In the app: Game → address ${pub.url} and code ${code}. Opened in a browser, the link joins directly.`)}</p>
        </>
      )}
      {pub && pub.status !== 'on' && <p className="hint">{pub.status === 'starting' ? '⏳ ' : pub.status === 'error' ? '⚠️ ' : 'ℹ️ '}{pub.message}</p>}
      {(info?.lan ?? []).map((u) => <Row key={u} label={T('🏠 Misma Wi-Fi', '🏠 Same Wi-Fi')} url={`${u}/?join=${code}`} />)}
      {failed && !info && <p className="hint">{T('No puedo leer las direcciones del servidor. Mira la ventana negra del servidor.', 'Can’t read the server addresses. Check the server’s black window.')}</p>}
    </details>
  );
}

function TvLink({ code }: { code: string }) {
  const conn = useParty((s) => s.conn);
  const base = httpBase(conn?.url);
  const url = `${base}/?view=${code}`;
  return (
    <details className="tv-link">
      <summary>📺 {T('Vista para la tele / pantalla de la mesa', 'TV / table screen view')}</summary>
      <p className="small">{T('Ábrelo en el navegador de una tele, portátil o tablet: muestra el orden de turnos, los estados y lo último que ha pasado, sin nada oculto.', 'Open it in the browser of a TV, laptop or tablet: it shows the turn order, states and latest events, with nothing hidden revealed.')}</p>
      <div className="row"><code className="grow">{url}</code><button className="btn small" onClick={() => void navigator.clipboard?.writeText(url)}>{T('Copiar', 'Copy')}</button></div>
    </details>
  );
}
