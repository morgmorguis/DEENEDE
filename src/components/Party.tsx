// Pestaña «Partida»: unirse a la partida del DM, ver la party, jugar el combate compartido por turnos,
// consultar el registro y (si eres el DM) organizarlo todo, incluidos monstruos ocultos.
import { useEffect, useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import { downloadAllSheets, fetchSavedSheet, httpBase, summaryOf, useParty } from '../party/client';
import type { CarriedLoot, CombatantView, HpState, LogEvent, RoomView } from '../party/protocol';
import { mergeLoot, splitLoot } from '../party/encounterImport';
import { NO_COINS, coinsText, hasCoins, itemLine } from '../rules/items';
import { saveBackupFile } from '../backup';
import { MONSTERS, searchMonsters, type MonsterInfo } from '../party/monsters';
import { rollExpr, fmt, initiativeBonus } from '../rules/calc';
import { Modal, Pips, Section } from './common';
import { CONDITIONS } from '../rules/srd';
import { encounterDifficulty } from '../party/difficulty';
import { Consumables } from './Consumables';
import { BundleList, LootEditor, MyGifts } from './Treasure';
import { TurnPanel, actionName } from './CombatActions';
import { combatTranscript, lastCombat, localNarrative } from '../party/narrative';
import { describeError, narrateCombatWithClaude } from '../ai';
import { DmImages, SharedGallery, useImageUrl } from './Images';
import { L, T, locale } from '../i18n';
import { askOk, askText } from './Confirm';
import { randomCombatPhrase } from '../party/phrases';

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

/** La app se ha abierto con el enlace del DM (…/dm) */
const DM_ENTRY = typeof window !== 'undefined' && /^\/dm\/?$/.test(window.location.pathname);
export const isDmEntry = () => DM_ENTRY;
const DM_KEY_STORE = 'di-en-di-dm-key';

/** Entrada del DM por su enlace propio: solo pide la clave (se recuerda en este dispositivo) */
export function DmLogin() {
  const connect = useParty((s) => s.connect);
  const conn = useParty((s) => s.conn);
  const status = useParty((s) => s.status);
  const error = useParty((s) => s.error);
  const leave = useParty((s) => s.leave);
  const [key, setKey] = useState(() => { try { return conn?.dmKey ?? localStorage.getItem(DM_KEY_STORE) ?? ''; } catch { return conn?.dmKey ?? ''; } });
  const busy = !!conn?.dmKey && status !== 'off';
  const go = () => {
    const k = key.trim();
    if (!k) return;
    try { localStorage.setItem(DM_KEY_STORE, k); } catch { /* sin almacenamiento */ }
    // Si estaba conectado como jugador en este navegador, se cambia a DM
    if (conn && !conn.dmKey) leave();
    connect({ url: window.location.origin, code: '', name: 'DM', dmKey: k });
  };
  return (
    <div className="tab dm-login">
      <img className="dm-login-icon" src="icon-dm-192.png" alt="" />
      <Section title={T('🎲 Pantalla del DM', '🎲 DM screen')}>
        <p className="small">{T('Este es el enlace del DM. Los jugadores usan el suyo (el de «Invitar jugadores»), que no da acceso a esta pantalla.', 'This is the DM link. Players use theirs (the one in “Invite players”), which gives no access to this screen.')}</p>
        <label className="field">{T('Clave del DM (la muestra el servidor)', 'DM key (shown by the server)')}
          <input value={key} autoCapitalize="off" autoCorrect="off" autoFocus onChange={(e) => setKey(e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && go()} />
        </label>
        {error && <p className="error">⚠️ {error}</p>}
        <button className="btn primary full big" disabled={!key || busy} onClick={go}>{busy ? T('Conectando…', 'Connecting…') : `🎲 ${T('Entrar como DM', 'Enter as DM')}`}</button>
        <p className="hint">{T('Guarda este enlace en favoritos: la próxima vez la clave ya estará puesta.', 'Bookmark this link: next time the key will already be filled in.')}</p>
      </Section>
      <p className="small muted center"><a href="/">{T('¿Eres jugador? Ir a la app del jugador', 'Are you a player? Go to the player app')}</a></p>
    </div>
  );
}

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
        <details className="dm-option" open={asDm}>
          <summary className="small muted">{T('¿Eres el DM?', 'Are you the DM?')}</summary>
          <p className="small muted">{T('Lo más cómodo es tu enlace de DM (termina en /dm). Desde aquí también puedes entrar con la clave:', 'The easiest way is your DM link (it ends in /dm). You can also enter with the key here:')}</p>
          <label className="check"><input type="checkbox" checked={asDm} onChange={(e) => setAsDm(e.target.checked)} /> {T('Soy el DM', 'I’m the DM')}</label>
        </details>
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
  const [report, setReport] = useState(false);
  void addNote; void c;
  return (
    <Section title={T('Registro del combate', 'Combat log')} right={<span className="row"><button className="btn small" disabled={!events.length} onClick={() => setStory(true)}>📖 {T('Resumen', 'Story')}</button><button className="btn small" disabled={!events.length} onClick={() => setReport(true)}>📜 {T('Informe', 'Report')}</button></span>}>
      {story && <NarrativeModal view={view} onClose={() => setStory(false)} />}
      {report && <CombatReportModal view={view} onClose={() => setReport(false)} />}
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

/** Informe del último combate bien ordenado: cabecera, quién participó, ronda a ronda y totales */
export function combatReport(view: RoomView): { title: string; text: string } {
  const dm = view.you.role === 'dm';
  const events = lastCombat(view.log, dm ? [] : view.encounter.order);
  const start = events.find((e) => e.kind === 'start');
  const name = start?.text || T('Combate', 'Combat');
  const when = new Date(start?.at ?? Date.now());
  const date = when.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const time = (at: number) => new Date(at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const party = view.encounter.order.filter((c) => c.kind === 'pc').map((c) => c.name);
  const others = [...new Set(events.filter((e) => e.kind === 'add' && e.target).map((e) => e.target!))];
  const begun = events.some((e) => e.kind === 'begin');
  const rounds = begun ? Math.max(1, ...events.map((e) => e.round)) : 0;
  const lines = [`⚔️ ${name.toUpperCase()}`, `${date} · ${time(when.getTime())}${events.length ? `–${time(events[events.length - 1].at)}` : ''}`];
  if (party.length) lines.push(`${T('Party', 'Party')}: ${party.join(', ')}`);
  if (others.length) lines.push(`${T('Enemigos y aliados', 'Enemies and allies')}: ${others.join(', ')}`);
  if (rounds) lines.push(T(`Duración: ${rounds} ronda(s)`, `Length: ${rounds} round(s)`));
  let started = false;
  for (const e of events) {
    if (e.kind === 'begin') started = true;
    // Quién entra ya está en la cabecera; dentro de las rondas solo los refuerzos
    if (e.kind === 'start' || (e.kind === 'add' && !started)) continue;
    if (e.kind === 'begin' || e.kind === 'round') { lines.push('', T(`— RONDA ${e.kind === 'begin' ? 1 : e.round} —`, `— ROUND ${e.kind === 'begin' ? 1 : e.round} —`)); continue; }
    if (e.kind === 'turn') { lines.push(logLine(e, dm)); continue; }
    if (e.kind === 'end') { lines.push('', logLine(e, dm)); continue; }
    lines.push(`   ${logLine(e, dm)}`);
  }
  // Daño hecho y bajas de cada uno
  const dmg = new Map<string, number>();
  const kills = new Map<string, number>();
  for (const e of events) {
    if (e.kind === 'hit' && e.actor) dmg.set(e.actor, (dmg.get(e.actor) ?? 0) + (e.amount ?? 0));
    if (e.kind === 'down' && e.actor) kills.set(e.actor, (kills.get(e.actor) ?? 0) + 1);
  }
  if (dmg.size) {
    lines.push('', T('— RESUMEN —', '— SUMMARY —'));
    for (const [actor, n] of [...dmg].sort((a, b) => b[1] - a[1])) {
      const k = kills.get(actor);
      lines.push(T(`   ${actor}: ${n} de daño${k ? ` · ${k} baja(s)` : ''}`, `   ${actor}: ${n} damage${k ? ` · ${k} kill(s)` : ''}`));
    }
  }
  return { title: `${name} · ${date}`, text: lines.join('\n').trim() };
}

/** Informe del combate: leerlo, guardarlo en el diario, descargarlo o copiarlo */
export function CombatReportModal({ view, onClose, ended }: { view: RoomView; onClose: () => void; ended?: boolean }) {
  const addNote = useStore((s) => s.addNote);
  const c = useChar();
  const dm = view.you.role === 'dm';
  const { title, text } = useMemo(() => combatReport(view), [view]);
  const [saved, setSaved] = useState(false);
  const save = () => {
    addNote({ title: `⚔️ ${title}`, body: text, kind: 'note', folderId: c.noteFolders.find((f) => f.key === 'chronicles')?.id ?? null });
    setSaved(true);
    useStore.getState().showToast(T('📜 Guardado en el diario (Crónicas)', '📜 Saved to the journal (Chronicles)'), []);
  };
  const download = () => void saveBackupFile(text, `${title.replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/\s+/g, '-').toLowerCase()}.txt`, 'text/plain');
  return (
    <Modal title={ended ? T('🏁 Fin del combate', '🏁 Combat over') : T('📜 Informe del combate', '📜 Combat report')} onClose={onClose}>
      {ended && <p className="small">{T('El combate ha terminado. Sigues conectado a la partida: vuelves a tu ficha y aquí tienes el registro completo.', 'The combat is over. You’re still connected to the game: you’re back on your sheet and here is the full log.')}</p>}
      <pre className="combat-report">{text}</pre>
      <div className="row wrap">
        {!dm && <button className="btn primary grow" disabled={saved} onClick={save}>📜 {saved ? T('Guardado', 'Saved') : T('Guardar en mi diario', 'Save to my journal')}</button>}
        <button className="btn" onClick={download}>⬇️ {T('Descargar', 'Download')}</button>
        <button className="btn" onClick={() => void navigator.clipboard?.writeText(text)}>📋 {T('Copiar', 'Copy')}</button>
      </div>
    </Modal>
  );
}

/** Cartel pequeño de «¡Tu turno!» cuando te toca (en cualquier pestaña) */
export function TurnBanner() {
  const view = useParty((s) => s.view);
  const [shown, setShown] = useState<string | null>(null);
  const e = view?.encounter;
  const myPc = e?.order.find((c) => c.kind === 'pc' && c.ownerId === view?.you.id);
  const key = e && e.phase === 'running' && myPc && e.currentId === myPc.id ? `${e.round}:${myPc.id}` : null;
  useEffect(() => {
    if (!key) { setShown(null); return; }
    setShown(key);
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* sin vibración */ }
    const t = window.setTimeout(() => setShown((k) => (k === key ? `${key}:off` : k)), 3500);
    return () => clearTimeout(t);
  }, [key]);
  if (!key || shown !== key) return null;
  return (
    <button className="turn-banner" onClick={() => { setShown(`${key}:off`); window.dispatchEvent(new CustomEvent('dnd-tab', { detail: 'party' })); }}>
      ⚔️ <b>{T('¡Tu turno!', 'Your turn!')}</b> <span className="small">{myPc?.name}</span>
    </button>
  );
}

// ---------- DM ----------

/** «Goblin 3», «Goblin 4»… siguiendo a los que ya hay en el combate */
function nextNames(view: RoomView, name: string, n: number): string[] {
  const taken = view.encounter.order.filter((c) => c.name === name || (c.name.startsWith(`${name} `) && /^\d+$/.test(c.name.slice(name.length + 1))))
    .map((c) => (c.name === name ? 1 : Number(c.name.slice(name.length + 1))));
  if (n === 1 && !taken.length) return [name];
  const start = taken.length ? Math.max(...taken) + 1 : 1;
  return Array.from({ length: n }, (_, i) => `${name} ${start + i}`);
}

function MonsterPicker({ view, onClose }: { view: RoomView; onClose: () => void }) {
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
    const names = nextNames(view, base.name, count);
    const combatants = Array.from({ length: count }, (_, i) => {
      const hp = rollHp && base.dice ? Math.max(1, rollExpr(base.dice).total) : base.hp;
      return {
        name: names[i],
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
      {c.kind !== 'pc' && (
        <details className="mt carried" open={!!c.loot}>
          <summary>💰 {T('Lo que lleva encima', 'What it carries')}{c.loot ? `: ${lootText(c.loot)}` : ''}</summary>
          <p className="small muted">{T('Solo lo ves tú. Al terminar el combate pasa al botín para repartirlo.', 'Only you see this. When the combat ends it goes to the loot to hand out.')}</p>
          <LootEditor loot={{ coins: { ...NO_COINS, ...c.loot?.coins }, items: c.loot?.items ?? [], note: '' }} noNote
            onChange={(l) => send({ t: 'update', id: c.id, patch: { loot: { coins: l.coins, items: l.items } } })} />
        </details>
      )}
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
/** Antesala del jugador: su estado actual (solo el suyo), su iniciativa y «Listo» */
function Lobby({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const c = useChar();
  const update = useStore((s) => s.update);
  const e = view.encounter;
  const myPc = e.order.find((x) => x.kind === 'pc' && x.ownerId === view.you.id);
  const [init, setInit] = useState(myPc?.initiative != null ? String(myPc.initiative) : '');
  const meReady = e.ready.includes(view.you.id);
  const dex = initiativeBonus(c);
  const s = summaryOf(c);
  const pcs = e.order.filter((x) => x.kind === 'pc');
  const waiting = pcs.filter((p) => p.ownerId && e.needed.includes(p.ownerId) && !e.ready.includes(p.ownerId));
  if (!myPc) return null;
  const roll = () => { const v = rollExpr('1d20').total + dex; setInit(String(v)); send({ t: 'setInitiative', id: myPc.id, value: v }); };
  return (
    <Section title={T('🏰 Antesala del combate', '🏰 Combat antechamber')} className="setup-panel lobby">
      {e.title && <p className="lobby-title">⚔️ {e.title}</p>}
      <p className="small muted">{T('Revisa cómo llegas al combate. Esto solo lo ves tú.', 'Check how you arrive at the fight. Only you can see this.')}</p>
      <div className="lobby-me">
        <div className="lobby-hp">
          <span className="lobby-big">❤️ {s.hp}<small>/{s.hpMax}</small>{s.temp ? <small> +{s.temp}</small> : null}</span>
          <span className="lobby-big">🛡️ {s.ac}<small> {T('CA', 'AC')}</small></span>
          <span className="lobby-big">👣 {s.speed}<small> {T('pies', 'ft')}</small></span>
        </div>
        {(s.conditions.length > 0 || s.concentration || (s.exhaustion ?? 0) > 0) && (
          <div className="chips">
            {s.concentration && <span className="cond-chip conc">🧠 {s.concentration}</span>}
            {(s.exhaustion ?? 0) > 0 && <span className="cond-chip bad">😩 {T('Agotamiento', 'Exhaustion')} {s.exhaustion}</span>}
            {s.conditions.map((x, i) => <span key={i} className="cond-chip">{x}</span>)}
          </div>
        )}
        {(s.items?.length ?? 0) > 0 && <p className="small"><b>🎒 {T('Equipo', 'Gear')}:</b> {s.items!.join(' · ')}</p>}
        {(s.slots?.length ?? 0) > 0 && <p className="small"><b>✨ {T('Espacios', 'Slots')}:</b> {s.slots!.map((x) => `${x.pact ? T('pacto ', 'pact ') : ''}${x.level}º ${x.left}/${x.max}`).join(' · ')}</p>}
        {(s.resources?.length ?? 0) > 0 && <p className="small"><b>🔋 {T('Recursos', 'Resources')}:</b> {s.resources!.map((x) => `${x.name} ${x.left}/${x.max}`).join(' · ')}</p>}
        <details className="mt">
          <summary className="small">✏️ {T('Corregir vida antes de empezar', 'Fix HP before starting')}</summary>
          <div className="grid2">
            <label className="field">{T('PG actuales', 'Current HP')}
              <input type="number" inputMode="numeric" value={c.hp.current} disabled={meReady} onChange={(ev) => update((x) => { x.hp.current = Math.max(0, Math.min(x.hp.max, Number(ev.target.value) || 0)); })} />
            </label>
            <label className="field">{T('PG temporales', 'Temp HP')}
              <input type="number" inputMode="numeric" value={c.hp.temp} disabled={meReady} onChange={(ev) => update((x) => { x.hp.temp = Math.max(0, Number(ev.target.value) || 0); })} />
            </label>
          </div>
        </details>
      </div>
      <div className="row lobby-init">
        <label className="field grow">{T('Iniciativa (total)', 'Initiative (total)')}
          <input type="number" inputMode="numeric" value={init} disabled={meReady} placeholder={`1d20 ${fmt(dex)}`}
            onChange={(ev) => setInit(ev.target.value)}
            onBlur={() => init !== '' && send({ t: 'setInitiative', id: myPc.id, value: Number(init) })} />
        </label>
        <button className="btn" disabled={meReady} onClick={roll}>🎲 {T('Tirar', 'Roll')} {fmt(dex)}</button>
      </div>
      {!meReady
        ? <button className="btn primary full big ready-btn" disabled={init === ''} onClick={() => { send({ t: 'setInitiative', id: myPc.id, value: Number(init) }); send({ t: 'ready', value: true }); }}>✅ {T('¡Listo!', 'Ready!')}</button>
        : <button className="btn full ready-btn on" onClick={() => send({ t: 'ready', value: false })}>✅ {T('Listo · tocar para quitar', 'Ready · tap to undo')}</button>}
      <h3 className="mt">{T('Tus compañeros', 'Your companions')}</h3>
      <ul className="setup-list">
        {pcs.map((p) => {
          const ready = !!p.ownerId && e.ready.includes(p.ownerId);
          return (
            <li key={p.id} className={ready ? 'ready' : ''}>
              <span className="grow"><b>{p.name}</b>{p.id === myPc.id && <span className="small muted"> {T('(tú)', '(you)')}</span>}</span>
              <span className="ready-mark">{ready ? '✅' : '⏳'}</span>
            </li>
          );
        })}
      </ul>
      {waiting.length > 0 && <p className="hint">{T('Esperando a', 'Waiting for')}: {waiting.map((p) => p.name).join(', ')}</p>}
    </Section>
  );
}

/** DM en la antesala: quién ha aceptado y quién está listo, con todos los datos */
function DmLobby({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const e = view.encounter;
  const pcs = e.order.filter((x) => x.kind === 'pc');
  const member = (id?: string) => view.members.find((m) => m.id === id);
  return (
    <Section title={T('🏰 Antesala · esperando a los jugadores', '🏰 Antechamber · waiting for players')} className="setup-panel">
      {e.title && <p className="lobby-title">⚔️ {e.title}</p>}
      <ul className="setup-list">
        {pcs.map((p) => {
          const m = member(p.ownerId);
          const ready = !!p.ownerId && e.ready.includes(p.ownerId);
          const accepted = ready || (!!p.ownerId && e.accepted.includes(p.ownerId));
          return (
            <li key={p.id} className={ready ? 'ready' : ''}>
              <span className="grow"><b>{m?.online ? '🟢' : '⚪'} {p.name}</b>{m && m.name !== p.name && <span className="small muted"> {m.name}</span>}</span>
              <span className="small">🎲 {p.initiative ?? '—'} · ❤️ {hpText(p)} · {T('CA', 'AC')} {p.ac ?? '—'}</span>
              <span className="ready-mark" title={ready ? T('Listo', 'Ready') : accepted ? T('Ha aceptado', 'Accepted') : T('Aún no ha aceptado', 'Not accepted yet')}>{ready ? '✅' : accepted ? '👀' : '📨'}</span>
            </li>
          );
        })}
      </ul>
      <p className="small muted">📨 {T('aviso enviado', 'invite sent')} · 👀 {T('en la antesala', 'in the antechamber')} · ✅ {T('listo', 'ready')}</p>
      <div className="row wrap">
        <button className="btn primary grow" onClick={async () => { if (await askOk(T('¿Empezar ya, sin esperar a que estén todos listos? A quien no tenga iniciativa se le quedará sin turno hasta que la ponga.', 'Start now without waiting for everyone? Anyone without initiative will have no turn until they set it.'))) send({ t: 'begin' }); }}>⏩ {T('Empezar ya', 'Start now')}</button>
        <button className="btn" onClick={() => e.order.filter((c) => c.kind !== 'pc' && c.initiative == null).forEach((c) => send({ t: 'setInitiative', id: c.id, value: rollExpr('1d20').total + (c.initBonus ?? 0) }))}>🎲 {T('Iniciativa de monstruos', 'Monster initiative')}</button>
      </div>
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

/** Lista del orden de combate (burbujas): el DM la ve con todo; los jugadores, la iniciativa y los estados */
function OrderList({ view, onEdit }: { view: RoomView; onEdit?: (c: CombatantView) => void }) {
  const dm = view.you.role === 'dm';
  const e = view.encounter;
  return (
    <ol className={`party-order ${dm ? '' : 'bubbles'}`}>
      {e.order.map((c) => {
        const active = c.id === e.currentId;
        const mine = c.kind === 'pc' && c.ownerId === view.you.id;
        return (
          <li key={c.id} className={`${c.kind} ${active ? 'active' : ''} ${mine ? 'mine' : ''} ${c.state === 'down' ? 'down' : ''} ${c.hidden ? 'hidden' : ''}`} style={c.color ? { borderLeft: `6px solid ${c.color}` } : undefined} onClick={() => dm && onEdit?.(c)}>
            <span className="po-init">{c.initiative ?? '–'}</span>
            <span className="po-name" style={c.color ? { color: c.color } : undefined}>{kindIcon(c)} {c.name}{c.hidden && <span className="hidden-tag">🙈 {T('oculto', 'hidden')}</span>}{active && <span className="bubble-turn">{T('turno', 'turn')}</span>}</span>
            <span className="po-hp">
              {c.hp != null && <b>❤️ {hpText(c)}</b>}
              {c.state !== 'unknown' && (c.kind !== 'pc' || c.hp == null) && <StateBadge state={c.state} />}
              {dm && c.ac != null && <span className="muted small"> · {T('CA', 'AC')} {c.ac}</span>}
              {dm && c.loot && <span className="muted small" title={lootText(c.loot)}> · 💰</span>}
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
  );
}

const lootText = (l: CarriedLoot) => [hasCoins(l.coins) ? coinsText(l.coins!) : '', ...(l.items ?? []).map(itemLine)].filter(Boolean).join(' · ');

/** Lugar que se abre al preparar el combate desde «Encuentros y lugares» */
let prepFocus = '';
export const setPrepFocus = (id: string) => { prepFocus = id; };

/** DM: lugares y encuentros guardados para sacar de ellos los enemigos que quiera */
function PrepLibrary({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const [encId, setEncId] = useState(() => (view.encounters.some((x) => x.id === prepFocus) ? prepFocus : view.encounters[0]?.id ?? ''));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const enc = view.encounters.find((x) => x.id === encId) ?? view.encounters[0];
  if (!view.encounters.length) return (
    <p className="hint">📚 {T('Aún no tienes lugares ni encuentros guardados. Créalos (o impórtalos de Excel) en 📜 Personajes → Encuentros y lugares, y aquí podrás sacar de ellos a los enemigos.', 'No saved places or encounters yet. Create them (or import from Excel) in 📜 Characters → Encounters and places, and you can pick enemies from them here.')}</p>
  );
  const inCombat = (name: string) => view.encounter.order.filter((c) => c.name === name || c.name.startsWith(`${name} `)).length;
  return (
    <div className="prep-library">
      <label className="field">📚 {T('Sacar enemigos de…', 'Take enemies from…')}
        <select value={enc?.id ?? ''} onChange={(ev) => setEncId(ev.target.value)}>
          {view.encounters.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.entries.reduce((s, y) => s + y.count, 0)})</option>)}
        </select>
      </label>
      {enc?.notes && <p className="small muted">📝 {enc.notes}</p>}
      <ul className="prep-entries">
        {enc?.entries.map((x) => {
          const n = counts[x.id] ?? 1;
          const there = inCombat(x.name);
          return (
            <li key={x.id} style={x.color ? { borderLeft: `5px solid ${x.color}` } : undefined}>
              <span className="grow">
                <b>{x.kind === 'npc' ? '🤝' : '👹'} {x.name}</b> {x.hidden && <span className="hidden-tag">🙈</span>}
                <span className="small muted"> · {x.hpMax ?? '?'} {T('PG', 'HP')} · {T('CA', 'AC')} {x.ac ?? '?'}{x.cr ? ` · ${T('VD', 'CR')} ${x.cr}` : ''}{x.loot ? ` · 💰 ${lootText(x.loot)}` : ''}</span>
                {there > 0 && <span className="small"> · ⚔️ {there} {T('en el combate', 'in combat')}</span>}
              </span>
              <span className="row prep-count">
                <button className="btn small" aria-label="-" onClick={() => setCounts({ ...counts, [x.id]: Math.max(1, n - 1) })}>−</button>
                <b>{n}</b>
                <button className="btn small" aria-label="+" onClick={() => setCounts({ ...counts, [x.id]: Math.min(20, n + 1) })}>+</button>
                <button className="btn small primary" onClick={() => send({ t: 'entryToCombat', encounterId: enc.id, entryId: x.id, count: n })}>➕</button>
              </span>
            </li>
          );
        })}
      </ul>
      <button className="btn small" onClick={() => enc && send({ t: 'encounterLoad', id: enc.id })}>⤵️ {T('Añadir todos los de la lista', 'Add everyone on the list')}</button>
    </div>
  );
}

/** DM: botín de los combates terminados, para repartirlo entre los jugadores */
function LootPanel({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const showToast = useStore((s) => s.showToast);
  const players = view.members.filter((m) => m.role === 'player');
  const [sel, setSel] = useState<string[]>(() => view.loot.map((x) => x.id));
  const [to, setTo] = useState<string[]>(() => players.filter((m) => m.online).map((m) => m.id));
  if (!view.loot.length) return null;
  const chosen = view.loot.filter((x) => sel.includes(x.id));
  const total = mergeLoot(chosen);
  const parts = splitLoot(total, to.length || 1);
  const empty = !hasCoins(total.coins) && !total.items.length;
  const give = () => {
    if (!to.length || !chosen.length) return;
    to.forEach((id, i) => {
      const part = parts[i];
      if (!hasCoins(part.coins) && !part.items.length) return;
      send({ t: 'give', toId: id, coins: part.coins, items: part.items, note: T(`Botín: ${chosen[0].combat ?? 'combate'}`, `Loot: ${chosen[0].combat ?? 'combat'}`) });
    });
    send({ t: 'lootDone', ids: chosen.map((x) => x.id) });
    showToast(T('🎁 Botín repartido', '🎁 Loot handed out'), to.map((id, i) => `${players.find((m) => m.id === id)?.summary?.name ?? players.find((m) => m.id === id)?.name}: ${lootText(parts[i]) || T('nada', 'nothing')}`));
  };
  return (
    <Section title={T('💰 Botín pendiente de repartir', '💰 Loot waiting to be handed out')}>
      <p className="small muted">{T('Lo que llevaban encima los enemigos. Elige qué repartir y entre quién: las monedas se dividen a partes iguales y los objetos por turnos.', 'What the enemies were carrying. Pick what to hand out and to whom: coins are split evenly and items in turns.')}</p>
      <ul className="loot-drops">
        {view.loot.map((x) => (
          <li key={x.id}>
            <label className="check">
              <input type="checkbox" checked={sel.includes(x.id)} onChange={(ev) => setSel(ev.target.checked ? [...sel, x.id] : sel.filter((y) => y !== x.id))} />
              <b>{x.defeated ? '💀' : '🏃'} {x.from}</b> <span className="small muted">{x.combat ? `· ${x.combat}` : ''}</span>
            </label>
            <span className="small">{lootText(x)}</span>
          </li>
        ))}
      </ul>
      <span className="p-mini">{T('Repartir entre', 'Split between')}</span>
      <div className="chips">
        {players.map((m) => (
          <button key={m.id} className={`chip ${to.includes(m.id) ? 'on' : ''}`} onClick={() => setTo(to.includes(m.id) ? to.filter((y) => y !== m.id) : [...to, m.id])}>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</button>
        ))}
      </div>
      {!empty && to.length > 0 && (
        <ul className="small loot-preview">
          {to.map((id, i) => <li key={id}><b>{players.find((m) => m.id === id)?.summary?.name ?? players.find((m) => m.id === id)?.name}</b>: {lootText(parts[i]) || T('nada', 'nothing')}</li>)}
        </ul>
      )}
      <div className="row">
        <button className="btn" disabled={!chosen.length} onClick={async () => { if (await askOk(T('¿Descartar el botín elegido sin darlo?', 'Discard the chosen loot without giving it?'))) send({ t: 'lootDone', ids: chosen.map((x) => x.id) }); }}>🗑️ {T('Descartar', 'Discard')}</button>
        <button className="btn primary grow" disabled={empty || !to.length} onClick={give}>🎁 {T('Repartir', 'Hand out')}</button>
      </div>
    </Section>
  );
}

/** Jugador con el combate lanzado que aún no ha aceptado el aviso */
export function EncounterInvite({ view, onAccept }: { view: RoomView; onAccept?: () => void }) {
  const send = useParty((s) => s.send);
  const e = view.encounter;
  // Una frase de la lista al azar cada vez que sale el aviso
  const [phrase] = useState(() => randomCombatPhrase());
  return (
    <div className="encounter-invite">
      <span className="ei-icon" aria-hidden>⚔️</span>
      <b className="ei-phrase">«{L(phrase)}»</b>
      <span className="small">{T('¡Comienza un encuentro!', 'An encounter begins!')}</span>
      {e.title && <span className="ei-title">{e.title}</span>}
      <span className="small muted">{T('El DM ha lanzado un combate. Acepta para entrar en la antesala.', 'The DM has launched a combat. Accept to enter the antechamber.')}</span>
      <button className="btn primary big" onClick={() => { send({ t: 'accept' }); onAccept?.(); }}>✅ {T('Aceptar', 'Accept')}</button>
    </div>
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
  const accepted = e.accepted.includes(view.you.id) || e.ready.includes(view.you.id);
  const prepare = async () => {
    const title = await askText(T('Nombre del encuentro (lo verán los jugadores al lanzarlo; puedes dejarlo vacío)', 'Encounter name (players see it when it’s launched; can be empty)'), '', T('Taberna Malandra', 'Rascal Tavern'), true);
    if (title === null) return;
    send({ t: 'prepare', title });
  };

  // ---- Sin combate ----
  if (!e.active) {
    if (!dm) return <Section title={T('Combate', 'Combat')}><p className="muted">{T('Cuando el DM lance un combate te llegará un aviso.', 'When the DM launches a combat you’ll get a notice.')}</p></Section>;
    return (
      <>
        <Section title={T('Combate', 'Combat')}>
          <p className="small">{T('Prepara el combate a solas: añade enemigos (de tus lugares guardados, de Excel o del bestiario), ajústalos y decide qué llevan encima. Los jugadores no ven nada hasta que pulses «Lanzar combate».', 'Prepare the combat on your own: add enemies (from your saved places, Excel or the bestiary), tweak them and decide what they carry. Players see nothing until you press “Launch combat”.')}</p>
          <button className="btn primary full big" onClick={() => void prepare()}>🛠️ {T('Preparar combate', 'Prepare combat')}</button>
        </Section>
        <LootPanel view={view} />
      </>
    );
  }

  // ---- Jugador que aún no ha aceptado ----
  if (!dm && myPc && !accepted) return <Section title={T('Combate', 'Combat')}><EncounterInvite view={view} /></Section>;

  const prep = e.phase === 'prep';
  return (
    <>
      {prep && dm && (
        <Section title={T('🛠️ Preparando el combate', '🛠️ Preparing the combat')} className="prep-panel">
          <label className="field">{T('Nombre del encuentro (lo ven los jugadores)', 'Encounter name (players see it)')}
            <input key={e.title ?? ''} defaultValue={e.title ?? ''} placeholder={T('Taberna Malandra', 'Rascal Tavern')} onBlur={(ev) => ev.target.value !== (e.title ?? '') && send({ t: 'encounterTitle', title: ev.target.value })} />
          </label>
          <p className="hint">🙈 {T('Los jugadores no ven nada todavía. Los que marques como ocultos seguirán ocultos al lanzarlo hasta que los reveles.', 'Players can’t see anything yet. The ones marked hidden stay hidden after launch until you reveal them.')}</p>
          <PrepLibrary view={view} />
        </Section>
      )}
      {e.phase === 'setup' && (dm ? <DmLobby view={view} /> : <Lobby view={view} />)}
      {(dm || e.phase === 'running') && (
        <Section title={prep ? T(`Enemigos y aliados (${e.order.length})`, `Enemies and allies (${e.order.length})`) : e.phase === 'setup' ? T('Combatientes', 'Combatants') : `${e.title ? `${e.title} · ` : ''}${T('Ronda', 'Round')} ${e.round}`}
          right={dm ? <button className="btn small danger" onClick={async () => {
            if (prep) { if (await askOk(T('¿Descartar la preparación? Se quitan los enemigos preparados.', 'Discard the preparation? Prepared enemies are removed.'))) send({ t: 'end' }); return; }
            if (await askOk(T('¿Terminar el combate? Los jugadores vuelven a su ficha y lo que llevaban los enemigos pasa al botín.', 'End combat? Players go back to their sheet and what the enemies carried goes to the loot.'))) send({ t: 'end' });
          }}>{prep ? `🗑️ ${T('Descartar', 'Discard')}` : `🏁 ${T('Terminar', 'End')}`}</button> : undefined}>
          {e.order.length === 0 && prep && <p className="muted small">{T('Aún no hay nadie. Añade enemigos de tu lista o del bestiario.', 'Nobody yet. Add enemies from your list or the bestiary.')}</p>}
          <OrderList view={view} onEdit={setEdit} />
          {dm && <DifficultyBar view={view} />}
          {e.hiddenTurn && <p className="hint">{T('Está actuando algo que aún no veis…', 'Something you can’t see yet is acting…')}</p>}
          {dm && (
            <div className="row wrap mt">
              <button className="btn small" onClick={() => setAdding(true)}>➕ {T('Bestiario / PNJ', 'Bestiary / NPCs')}</button>
              {!prep && <button className="btn small" onClick={() => send({ t: 'sort' })}>↕️ {T('Ordenar por iniciativa', 'Sort by initiative')}</button>}
            </div>
          )}
          {prep && dm && (
            <button className="btn primary full big mt launch-btn" disabled={!e.order.length} onClick={async () => {
              const players = view.members.filter((m) => m.role === 'player' && m.summary);
              if (await askOk(T(`¿Lanzar el combate? A ${players.length} jugador(es) les llegará el aviso${e.title ? ` «${e.title}»` : ''}.`, `Launch the combat? ${players.length} player(s) will get the notice${e.title ? ` “${e.title}”` : ''}.`))) send({ t: 'launch' });
            }}>🚀 {T('Lanzar combate', 'Launch combat')}</button>
          )}
        </Section>
      )}

      {e.phase === 'running' && (
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
          {!dm && myPc && myPc.initiative == null && <p className="hint">🎲 {T('No tienes iniciativa: pídesela al DM o díctasela para entrar en el orden.', 'You have no initiative: ask the DM to set it so you join the order.')}</p>}
          {!myPc && !dm && <p className="muted">{T('Tu ficha aún no está en el combate: pide al DM que te añada.', 'Your sheet isn’t in this combat yet: ask the DM to add you.')}</p>}
          <div className="row wrap mt">
            {view.canEndTurn && <button className="btn primary grow" onClick={() => send({ t: 'nextTurn' })}>⏭️ {dm ? T('Siguiente turno', 'Next turn') : T('Terminar mi turno', 'End my turn')}</button>}
            {dm && view.canUndo && <button className="btn" onClick={async () => { if (await askOk(T('¿Deshacer el último turno? Se revierten sus daños y curaciones.', 'Undo the last turn? Its damage and healing are reverted.'))) send({ t: 'undo' }); }}>↩️ {T('Deshacer último turno', 'Undo last turn')}</button>}
          </div>
        </Section>
      )}
      {edit && <DmCombatantModal c={view.encounter.order.find((x) => x.id === edit.id) ?? edit} onClose={() => setEdit(null)} />}
      {adding && <MonsterPicker view={view} onClose={() => setAdding(false)} />}
    </>
  );
}

/** DM en «Partida»: resumen del combate con acceso a su pestaña */
function DmCombatCard({ view }: { view: RoomView }) {
  const e = view.encounter;
  const send = useParty((s) => s.send);
  return (
    <Section title={T('Combate', 'Combat')}>
      <p className="small">{!e.active ? T('No hay combate en marcha. Prepáralo y llévalo desde la pestaña ⚔️ Combate.', 'No combat running. Prepare and run it from the ⚔️ Combat tab.') : e.phase === 'prep' ? T(`🛠️ Preparando${e.title ? ` «${e.title}»` : ''} · ${e.order.length} combatientes (los jugadores aún no lo ven)`, `🛠️ Preparing${e.title ? ` “${e.title}”` : ''} · ${e.order.length} combatants (players can’t see it yet)`) : e.phase === 'setup' ? T('🏰 En la antesala: esperando a que los jugadores estén listos', '🏰 In the antechamber: waiting for the players to be ready') : T(`⚔️ En marcha · ronda ${e.round} · ${e.order.length} combatientes`, `⚔️ Running · round ${e.round} · ${e.order.length} combatants`)}</p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent('dnd-tab', { detail: 'dmcombat' }))}>⚔️ {T('Ir a la pestaña Combate', 'Go to the Combat tab')}</button>
        {!e.active && <button className="btn" onClick={() => { send({ t: 'prepare' }); window.dispatchEvent(new CustomEvent('dnd-tab', { detail: 'dmcombat' })); }}>🛠️ {T('Preparar combate', 'Prepare combat')}</button>}
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
      {view && dm && <SessionPanel view={view} />}
      {/* Jugador en combate: el combate (antesala o turnos) va lo primero */}
      {view && !dm && view.encounter.active && <SharedCombat view={view} />}
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
          {view.you.role !== 'viewer' && !(!dm && view.encounter.active) && <SheetSync view={view} />}
          {dm ? <DmCombatCard view={view} /> : !view.encounter.active && <SharedCombat view={view} />}
          {dm && !view.encounter.active && <LootPanel view={view} />}
          {dm && <DmImages view={view} />}
          <SharedGallery view={view} />
          <MyGifts view={view} />
          {!dm && <CombatLog view={view} />}
        </>
      )}
    </div>
  );
}

/** Fichas en el servidor: el DM pide a todos que suban su ficha completa (p. ej. al acabar la sesión) y puede
 *  descargarlas todas; cada jugador puede subir la suya cuando quiera o recuperar la última que se guardó */
function SheetSync({ view }: { view: RoomView }) {
  const dm = view.you.role === 'dm';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const when = (ms?: number) => (ms ? new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
  const players = view.members.filter((m) => m.role === 'player');
  const me = view.members.find((m) => m.id === view.you.id);
  const run = async (job: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try { setMsg(await job()); } catch { setMsg(T('⚠️ No se ha podido hablar con el servidor.', '⚠️ Couldn’t reach the server.')); }
    setBusy(false);
  };
  if (dm) {
    const pending = view.syncRequest ? players.filter((m) => (m.sheetAt ?? 0) < view.syncRequest!) : [];
    return (
      <Section title={T('☁️ Fichas en el servidor', '☁️ Sheets on the server')}>
        <p className="hint">{T('Al acabar la sesión, guarda una copia de la ficha completa de cada jugador conectado. Los que no estén conectados la subirán al volver a entrar.', 'At the end of the session, save a copy of each connected player’s full sheet. Players who are offline upload theirs when they come back.')}</p>
        <div className="row">
          <button className="btn primary" onClick={() => useParty.getState().send({ t: 'syncSheets' })}>☁️ {T('Sincronizar todas las fichas', 'Sync all sheets')}</button>
          <button className="btn" disabled={busy || !players.some((m) => m.sheetAt)} onClick={() => run(async () => {
            const n = await downloadAllSheets();
            return n ? T(`💾 ${n} fichas en un archivo de copia (se abre en Ajustes → Copia de seguridad).`, `💾 ${n} sheets in a backup file (open it in Settings → Backup).`) : T('Aún no hay fichas guardadas.', 'No saved sheets yet.');
          })}>💾 {T('Descargar todas', 'Download all')}</button>
        </div>
        <ul className="small sheet-sync">
          {players.map((m) => (
            <li key={m.id}>{m.sheetAt && (!view.syncRequest || m.sheetAt >= view.syncRequest) ? '✅' : view.syncRequest ? '⏳' : '▫️'} {m.summary?.name ?? m.name} · <span className="muted">{when(m.sheetAt) ?? T('sin copia', 'no copy')}</span></li>
          ))}
        </ul>
        {view.syncRequest && pending.length > 0 && <p className="hint">{T(`Esperando a: ${pending.map((m) => m.summary?.name ?? m.name).join(', ')}`, `Waiting for: ${pending.map((m) => m.summary?.name ?? m.name).join(', ')}`)}</p>}
        {msg && <p className="small">{msg}</p>}
      </Section>
    );
  }
  return (
    <Section title={T('☁️ Tu ficha en el servidor', '☁️ Your sheet on the server')}>
      <p className="small muted">{me?.sheetAt ? T(`Última copia: ${when(me.sheetAt)}`, `Last copy: ${when(me.sheetAt)}`) : T('Aún no hay copia de tu ficha.', 'There’s no copy of your sheet yet.')}</p>
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => setMsg(useParty.getState().uploadSheet() ? T('☁️ Ficha enviada.', '☁️ Sheet sent.') : T('⚠️ Sin conexión con la partida.', '⚠️ Not connected to the game.'))}>☁️ {T('Guardar mi ficha', 'Save my sheet')}</button>
        <button className="btn" disabled={busy || !me?.sheetAt} onClick={() => run(async () => {
          const chars = await fetchSavedSheet();
          if (!chars) return T('No hay ninguna ficha tuya guardada.', 'There’s no saved sheet of yours.');
          const names = chars.map((c) => c.name).join(', ');
          if (!(await askOk(T(`¿Recuperar «${names}» tal como se guardó en el servidor? Sustituye a la ficha que tienes con el mismo personaje.`, `Restore “${names}” as saved on the server? It replaces your sheet of the same character.`)))) return '';
          useStore.getState().importCharacters(chars, 'merge');
          return T(`✅ Recuperada: ${names}`, `✅ Restored: ${names}`);
        })}>⤵️ {T('Recuperar la guardada', 'Restore saved copy')}</button>
      </div>
      {msg && <p className="small">{msg}</p>}
    </Section>
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
interface ServerInfo { code: string; lan: string[]; publish?: { mode: string; url: string | null; status: string; message: string; direct?: string } }

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
          {pub.direct && <Row label={T('🔗 Dirección directa (apps de Android 0.24 o anteriores)', '🔗 Direct address (Android app 0.24 or older)')} url={pub.direct} />}
        </>
      )}
      {pub && pub.status !== 'on' && <p className="hint">{pub.status === 'starting' ? '⏳ ' : pub.status === 'error' ? '⚠️ ' : 'ℹ️ '}{pub.message}</p>}
      {(info?.lan ?? []).map((u) => <Row key={u} label={T('🏠 Misma Wi-Fi', '🏠 Same Wi-Fi')} url={`${u}/?join=${code}`} />)}
      {failed && !info && <p className="hint">{T('No puedo leer las direcciones del servidor. Mira la ventana negra del servidor.', 'Can’t read the server addresses. Check the server’s black window.')}</p>}
      {conn?.dmKey && (
        <details className="dm-link">
          <summary className="small">🔑 {T('Tu enlace de DM (no lo compartas)', 'Your DM link (don’t share it)')}</summary>
          <Row label={T('Ábrelo en otro dispositivo para llevar la partida desde allí', 'Open it on another device to run the game from there')} url={`${pub?.status === 'on' && pub.url ? pub.url : httpBase(conn.url)}/dm?dm=${conn.dmKey}`} />
        </details>
      )}
    </details>
  );
}

/** DM: cambiar el código de la partida o empezar una sesión nueva */
function SessionPanel({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const [open, setOpen] = useState(false);
  const [removePlayers, setRemovePlayers] = useState(true);
  const [clearLog, setClearLog] = useState(false);
  const players = view.members.filter((m) => m.role === 'player').length;
  const toast = (title: string) => useStore.getState().showToast(title, [T('Pasa el código nuevo a los jugadores desde «Invitar jugadores».', 'Give the new code to the players from “Invite players”.')]);
  return (
    <details className="tv-link session-panel">
      <summary>🔁 {T('Sesión y código de la partida', 'Session and game code')} · <b>{view.code}</b></summary>
      <p className="small">{T('Para la siguiente sesión puedes cambiar solo el código o empezar de cero. Tus lugares, personajes preparados, imágenes, crónicas y entregas se conservan siempre.', 'For the next session you can change just the code or start fresh. Your places, prepared characters, images, chronicles and gifts are always kept.')}</p>
      <div className="row wrap">
        <button className="btn small" onClick={async () => {
          if (await askOk(T('¿Cambiar el código de la partida?', 'Change the game code?'), { text: T('Quien ya está dentro sigue conectado; para entrar de nuevo hará falta el código nuevo.', 'Anyone already in stays connected; joining again will need the new code.') })) { send({ t: 'newCode' }); toast(T('🔁 Código nuevo', '🔁 New code')); }
        }}>🔁 {T('Cambiar el código', 'Change the code')}</button>
        <button className="btn small primary" onClick={() => setOpen(true)}>🧹 {T('Empezar una sesión nueva', 'Start a new session')}</button>
      </div>
      {open && (
        <Modal title={T('🧹 Sesión nueva', '🧹 New session')} onClose={() => setOpen(false)}>
          <p className="small">{T('Código nuevo y sin combate en marcha. Se conservan tus lugares y encuentros, personajes preparados, imágenes, crónicas, entregas y el botín pendiente.', 'New code and no combat running. Your places and encounters, prepared characters, images, chronicles, gifts and pending loot are kept.')}</p>
          <label className="check"><input type="checkbox" checked={removePlayers} onChange={(e) => setRemovePlayers(e.target.checked)} /> 👋 {T(`Sacar a los jugadores (${players}): volverán a unirse con el código nuevo`, `Remove the players (${players}): they’ll join again with the new code`)}</label>
          <label className="check"><input type="checkbox" checked={clearLog} onChange={(e) => setClearLog(e.target.checked)} /> 🗑️ {T('Borrar el registro de los combates anteriores', 'Clear the log of previous combats')}</label>
          {clearLog && <p className="hint">💾 {T('Si quieres conservarlo, antes haz una copia en Personajes → Copia de la campaña.', 'To keep it, first make a copy in Characters → Campaign backup.')}</p>}
          <button className="btn primary full" onClick={() => { send({ t: 'newSession', removePlayers, clearLog }); setOpen(false); toast(T('🧹 Sesión nueva', '🧹 New session')); }}>🧹 {T('Empezar la sesión nueva', 'Start the new session')}</button>
        </Modal>
      )}
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
