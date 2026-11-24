// Campaña: tablón de misiones y personajes no jugadores (el DM decide qué ven los jugadores) y el resumen
// «En la sesión anterior…» que el DM prepara (sin IA o con Claude) y a los jugadores les sale en grande al entrar.
import { useState } from 'react';
import { useParty } from '../party/client';
import type { Npc, NpcAttitude, Quest, QuestStatus, RoomView } from '../party/protocol';
import { lastSessionRange, localRecap, recapIsEmpty, recapMaterial, recapTranscript } from '../party/recap';
import { describeError, recapWithClaude } from '../ai';
import { Modal, Section } from './common';
import { confirmDelete } from './Confirm';
import { useImageUrl } from './Images';
import { useStore } from '../store';
import { T, locale } from '../i18n';

const STATUS: Record<QuestStatus, () => string> = {
  active: () => T('🟡 En curso', '🟡 In progress'),
  done: () => T('✅ Cumplida', '✅ Completed'),
  failed: () => T('❌ Fallida', '❌ Failed'),
};
const ATTITUDE: Record<NpcAttitude, () => string> = {
  friendly: () => T('🙂 Amistoso', '🙂 Friendly'),
  neutral: () => T('😐 Neutral', '😐 Neutral'),
  hostile: () => T('😠 Hostil', '😠 Hostile'),
  unknown: () => T('❔ Sin saber', '❔ Unknown'),
};
const day = (ms: number) => new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

// ---------- Misiones ----------

function QuestForm({ initial, onClose }: { initial?: Quest; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const [q, setQ] = useState<Quest>(initial ?? { id: '', title: '', text: '', status: 'active', shared: true, at: 0, updatedAt: 0 });
  const set = (p: Partial<Quest>) => setQ({ ...q, ...p });
  return (
    <Modal title={initial ? T('Editar misión', 'Edit quest') : T('Nueva misión', 'New quest')} onClose={onClose}>
      <label className="field">{T('Título', 'Title')}<input value={q.title} placeholder={T('El ídolo robado', 'The stolen idol')} onChange={(e) => set({ title: e.target.value })} /></label>
      <label className="field">{T('Quién la encarga', 'Quest giver')}<input value={q.giver ?? ''} placeholder={T('Bruna, la tabernera', 'Bruna, the innkeeper')} onChange={(e) => set({ giver: e.target.value })} /></label>
      <label className="field">{T('Lo que saben los jugadores', 'What the players know')}<textarea value={q.text} onChange={(e) => set({ text: e.target.value })} /></label>
      <label className="field">🔒 {T('Notas secretas (solo tú)', 'Secret notes (only you)')}<textarea value={q.secret ?? ''} placeholder={T('Quién la tiene de verdad, qué pasa si fallan…', 'Who really has it, what happens if they fail…')} onChange={(e) => set({ secret: e.target.value })} /></label>
      <div className="chips">
        {(['active', 'done', 'failed'] as QuestStatus[]).map((s) => <button key={s} className={`chip toggle ${q.status === s ? 'on' : ''}`} onClick={() => set({ status: s })}>{STATUS[s]()}</button>)}
      </div>
      <label className="check"><input type="checkbox" checked={q.shared} onChange={(e) => set({ shared: e.target.checked })} /> 👁️ {T('Los jugadores la ven en su tablón', 'Players see it on their board')}</label>
      <div className="row">
        {initial && <button className="btn danger" onClick={async () => { if (await confirmDelete(q.title)) { send({ t: 'questRemove', id: q.id }); onClose(); } }}>🗑️</button>}
        <button className="btn primary grow" disabled={!q.title.trim()} onClick={() => { send({ t: 'questSave', quest: q }); onClose(); }}>💾 {T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}

function QuestList({ quests, dm, onEdit }: { quests: Quest[]; dm: boolean; onEdit?: (q: Quest) => void }) {
  const open = quests.filter((q) => q.status === 'active');
  const closed = quests.filter((q) => q.status !== 'active');
  const row = (q: Quest) => (
    <li key={q.id} className={`quest ${q.status}`} onClick={onEdit ? () => onEdit(q) : undefined}>
      <div className="row">
        <b className="grow">{q.title}</b>
        {dm && <span className="tiny" title={q.shared ? T('La ven los jugadores', 'Players see it') : T('Solo la ves tú', 'Only you see it')}>{q.shared ? '👁️' : '🔒'}</span>}
        <span className="tiny">{STATUS[q.status]()}</span>
      </div>
      {q.giver && <span className="tiny muted">{T('Encargo de', 'From')} {q.giver} · {day(q.at)}</span>}
      {q.text && <p className="small pre">{q.text}</p>}
      {dm && q.secret && <p className="tiny muted pre">🔒 {q.secret}</p>}
    </li>
  );
  return (
    <>
      <ul className={`quest-list ${onEdit ? 'editable' : ''}`}>{open.map(row)}</ul>
      {!open.length && <p className="small muted">{T('No hay misiones en curso.', 'No quests in progress.')}</p>}
      {closed.length > 0 && <details><summary className="small">{T(`Terminadas (${closed.length})`, `Finished (${closed.length})`)}</summary><ul className={`quest-list ${onEdit ? 'editable' : ''}`}>{closed.map(row)}</ul></details>}
    </>
  );
}

// ---------- PNJ ----------

function NpcFace({ npc, big }: { npc: Npc; big?: boolean }) {
  const url = useImageUrl();
  return (
    <span className={`npc-face ${big ? 'big' : ''}`}>
      {npc.imageId ? <img src={url(npc.imageId)} alt="" loading="lazy" /> : npc.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function NpcForm({ initial, view, onClose }: { initial?: Npc; view: RoomView; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const url = useImageUrl();
  const [n, setN] = useState<Npc>(initial ?? { id: '', name: '', text: '', attitude: 'unknown', shared: false, at: 0, updatedAt: 0 });
  const set = (p: Partial<Npc>) => setN({ ...n, ...p });
  const imgs = [...view.images].sort((a, b) => Number(b.category === 'character') - Number(a.category === 'character') || b.at - a.at);
  return (
    <Modal title={initial ? T('Editar personaje', 'Edit character') : T('Nuevo personaje no jugador', 'New non-player character')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={n.name} placeholder="Bruna" onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="field">{T('Dónde se le encuentra', 'Where to find them')}<input value={n.place ?? ''} placeholder={T('Taberna del Cuervo', 'The Raven Inn')} onChange={(e) => set({ place: e.target.value })} /></label>
      <div className="chips">
        {(['friendly', 'neutral', 'hostile', 'unknown'] as NpcAttitude[]).map((a) => <button key={a} className={`chip toggle ${n.attitude === a ? 'on' : ''}`} onClick={() => set({ attitude: a })}>{ATTITUDE[a]()}</button>)}
      </div>
      <label className="field">{T('Lo que saben los jugadores', 'What the players know')}<textarea value={n.text} placeholder={T('Tabernera, sabe todo lo que pasa en el pueblo', 'Innkeeper, knows everything going on in town')} onChange={(e) => set({ text: e.target.value })} /></label>
      <label className="field">🔒 {T('Notas secretas (solo tú)', 'Secret notes (only you)')}<textarea value={n.secret ?? ''} placeholder={T('Es una espía del barón…', 'She’s a spy for the baron…')} onChange={(e) => set({ secret: e.target.value })} /></label>
      <span className="p-mini">{T('Retrato (de tus imágenes)', 'Portrait (from your images)')}</span>
      {imgs.length ? (
        <div className="npc-pick">
          <button className={`plain npc-pick-item ${!n.imageId ? 'on' : ''}`} onClick={() => set({ imageId: undefined })}><span className="npc-face">∅</span></button>
          {imgs.map((im) => (
            <button key={im.id} className={`plain npc-pick-item ${n.imageId === im.id ? 'on' : ''}`} title={im.title} onClick={() => set({ imageId: im.id })}>
              <span className="npc-face"><img src={url(im.id)} alt={im.title} loading="lazy" /></span>
            </button>
          ))}
        </div>
      ) : <p className="tiny muted">{T('Sube imágenes en «Partida» → Imágenes y podrás elegir una como retrato.', 'Upload images in “Game” → Images and you can pick one as a portrait.')}</p>}
      <label className="check"><input type="checkbox" checked={n.shared} onChange={(e) => set({ shared: e.target.checked })} /> 👁️ {T('Los jugadores ya lo conocen (sale en su tablón, con el retrato)', 'Players have met them (shows on their board, with the portrait)')}</label>
      <div className="row">
        {initial && <button className="btn danger" onClick={async () => { if (await confirmDelete(n.name)) { send({ t: 'npcRemove', id: n.id }); onClose(); } }}>🗑️</button>}
        <button className="btn primary grow" disabled={!n.name.trim()} onClick={() => { send({ t: 'npcSave', npc: n }); onClose(); }}>💾 {T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}

function NpcGrid({ npcs, dm, onOpen }: { npcs: Npc[]; dm: boolean; onOpen: (n: Npc) => void }) {
  return (
    <div className="npc-grid">
      {npcs.map((n) => (
        <button key={n.id} className="plain npc-card" onClick={() => onOpen(n)}>
          <NpcFace npc={n} />
          <span className="npc-info">
            <b>{n.name}{dm && <span className="tiny"> {n.shared ? '👁️' : '🔒'}</span>}</b>
            <span className="tiny muted">{ATTITUDE[n.attitude]()}{n.place ? ` · ${n.place}` : ''}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function NpcDetail({ npc, onClose }: { npc: Npc; onClose: () => void }) {
  return (
    <Modal title={npc.name} onClose={onClose}>
      <div className="npc-detail">
        <NpcFace npc={npc} big />
        <p className="small">{ATTITUDE[npc.attitude]()}{npc.place ? ` · ${npc.place}` : ''}</p>
        {npc.text && <p className="pre">{npc.text}</p>}
      </div>
    </Modal>
  );
}

// ---------- Resumen de la sesión anterior ----------

function RecapModal({ view, onClose }: { view: RoomView; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const send = useParty((s) => s.send);
  const material = recapMaterial(view);
  const local = localRecap(material);
  const [title, setTitle] = useState(T('En la sesión anterior…', 'Previously on…'));
  const [text, setText] = useState(local);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const withAi = async () => {
    setBusy(true); setErr('');
    try { setText((await recapWithClaude(settings.apiKey, settings.model, recapTranscript(material))).trim()); } catch (e) { setErr(describeError(e)); }
    setBusy(false);
  };
  return (
    <Modal title={T('📖 En la sesión anterior…', '📖 Previously on…')} onClose={onClose}>
      {recapIsEmpty(material) && <p className="hint">{T('No he encontrado nada de la sesión anterior (combates, crónicas, botín, misiones o PNJ compartidos). Puedes escribirlo tú.', 'I found nothing from the last session (fights, chronicles, loot, shared quests or NPCs). You can write it yourself.')}</p>}
      <div className="row wrap">
        <button className="btn small" onClick={() => setText(local)}>⚙️ {T('Sin IA', 'Without AI')}</button>
        <button className="btn small primary" disabled={busy || !settings.apiKey || recapIsEmpty(material)} onClick={() => void withAi()}>✨ {busy ? T('Escribiendo…', 'Writing…') : T('Como relato (Claude)', 'As a story (Claude)')}</button>
      </div>
      {!settings.apiKey && <p className="hint">{T('Para el relato con IA pon tu clave de Claude en Ajustes. La lista sin IA funciona siempre.', 'For the AI story add your Claude key in Settings. The list without AI always works.')}</p>}
      {err && <p className="error">⚠️ {err}</p>}
      <label className="field">{T('Título', 'Title')}<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <textarea className="tall" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="tiny muted">{T('Revísalo antes: lo que compartas lo verá todo el grupo al entrar.', 'Check it first: whatever you share, the whole party will see when they join.')}</p>
      <button className="btn primary full" disabled={!text.trim()} onClick={() => {
        send({ t: 'chronicleShare', title: title.trim() || T('En la sesión anterior…', 'Previously on…'), text, recap: true });
        useStore.getState().showToast(T('📖 Resumen compartido', '📖 Recap shared'), [T('A cada jugador le sale en grande al entrar y se guarda en su diario.', 'Each player sees it full-screen when they join, and it’s saved in their journal.')]);
        onClose();
      }}>📤 {T('Compartir con el grupo', 'Share with the party')}</button>
    </Modal>
  );
}

function RecapSection({ view }: { view: RoomView }) {
  const [open, setOpen] = useState(false);
  const range = lastSessionRange(view);
  const recaps = view.chronicles.filter((c) => c.recap).slice(-3).reverse();
  return (
    <Section title={T('📖 En la sesión anterior…', '📖 Previously on…')}>
      <p className="small muted">{T('Al empezar la sesión, un resumen de la anterior: combates, bajas, botín, crónicas, PNJ que conocieron y misiones. A los jugadores les sale en grande al entrar y se queda en su diario.', 'At the start of the session, a recap of the last one: fights, fallen foes, loot, chronicles, NPCs met and quests. Players see it full-screen when they join and it stays in their journal.')}</p>
      <p className="tiny muted">{range.from ? T(`Sesión anterior: del ${day(range.from)} al ${day(range.to)}`, `Last session: ${day(range.from)} to ${day(range.to)}`) : T('Aún no hay sesiones anteriores apuntadas: se usa todo lo que hay.', 'No earlier sessions recorded yet: everything is used.')}</p>
      <button className="btn primary full" onClick={() => setOpen(true)}>📖 {T('Preparar el resumen', 'Prepare the recap')}</button>
      {recaps.length > 0 && <p className="tiny muted">{T('Compartidos:', 'Shared:')} {recaps.map((c) => `${c.title} (${day(c.at)})`).join(' · ')}</p>}
      {open && <RecapModal view={view} onClose={() => setOpen(false)} />}
    </Section>
  );
}

/** Pestaña «Campaña» del DM */
export function DmCampaignTab() {
  const view = useParty((s) => s.view);
  const [quest, setQuest] = useState<Quest | 'new' | null>(null);
  const [npc, setNpc] = useState<Npc | 'new' | null>(null);
  if (!view) return <div className="tab"><p className="muted">{T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  return (
    <div className="tab">
      <RecapSection view={view} />
      <Section title={T('🗺️ Misiones', '🗺️ Quests')} right={<button className="btn small" onClick={() => setQuest('new')}>＋ {T('Nueva', 'New')}</button>}>
        <p className="tiny muted">{T('👁️ = la ven los jugadores · 🔒 = solo tú', '👁️ = players see it · 🔒 = only you')}</p>
        <QuestList quests={view.quests} dm onEdit={(q) => setQuest(q)} />
      </Section>
      <Section title={T('👥 Personajes no jugadores', '👥 Non-player characters')} right={<button className="btn small" onClick={() => setNpc('new')}>＋ {T('Nuevo', 'New')}</button>}>
        {view.npcs.length ? <NpcGrid npcs={view.npcs} dm onOpen={(n) => setNpc(n)} /> : <p className="small muted">{T('Apunta aquí a quién van a conocer. Cuando lo conozcan, márcalo y les aparecerá con su retrato.', 'Note here who they will meet. When they do, tick it and they’ll see them with their portrait.')}</p>}
      </Section>
      {quest && <QuestForm initial={quest === 'new' ? undefined : quest} onClose={() => setQuest(null)} />}
      {npc && <NpcForm initial={npc === 'new' ? undefined : npc} view={view} onClose={() => setNpc(null)} />}
    </div>
  );
}

/** Jugadores, en «Partida»: el tablón de la campaña */
export function CampaignBoard({ view }: { view: RoomView }) {
  const [npc, setNpc] = useState<Npc | null>(null);
  if (view.you.role !== 'player' || (!view.quests.length && !view.npcs.length)) return null;
  return (
    <Section title={T('🗺️ Tablón de la campaña', '🗺️ Campaign board')}>
      {view.quests.length > 0 && <><span className="p-mini">{T('Misiones', 'Quests')}</span><QuestList quests={view.quests} dm={false} /></>}
      {view.npcs.length > 0 && <><span className="p-mini">{T('Personajes que conocéis', 'People you know')}</span><NpcGrid npcs={view.npcs} dm={false} onOpen={setNpc} /></>}
      {npc && <NpcDetail npc={npc} onClose={() => setNpc(null)} />}
    </Section>
  );
}

const SEEN_KEY = 'di-en-di-resumenes-vistos';
const seenRecaps = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; } };

/** Jugador: el resumen de la sesión anterior le sale en grande una vez */
export function RecapNotifier() {
  const view = useParty((s) => s.view);
  const [seen, setSeen] = useState<string[]>(seenRecaps);
  if (!view || view.you.role !== 'player') return null;
  const recap = [...view.chronicles].reverse().find((c) => c.recap);
  if (!recap || seen.includes(recap.id)) return null;
  const close = () => {
    const next = [...seen, recap.id].slice(-50);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
    setSeen(next);
  };
  return (
    <div className="modal-backdrop invite-backdrop">
      <div className="modal recap-modal" role="dialog" aria-label={recap.title}>
        <h3>📖 {recap.title}</h3>
        <div className="recap-text pre">{recap.text}</div>
        <p className="tiny muted">{T('Lo tienes en tu diario → 🤝 Compartido conmigo.', 'It’s in your journal → 🤝 Shared with me.')}</p>
        <button className="btn primary full" onClick={close}>⚔️ {T('¡A jugar!', 'Let’s play!')}</button>
      </div>
    </div>
  );
}
