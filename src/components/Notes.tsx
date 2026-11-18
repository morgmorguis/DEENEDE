import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { speechLangFor, useChar, useStore } from '../store';
import { startRecording, type Recorder } from '../speech';
import type { Note, NoteFolder } from '../types';
import { DEFAULT_FOLDERS } from '../rules/srd';
import { L, T, locale } from '../i18n';
import { askOk, askText } from './Confirm';
import { exportEverything, saveBackupFile } from '../backup';
import { create } from 'zustand';
import { loadSharedImage, removeSharedImage, sharedImageBase64, stripDataUrl } from '../sharedImages';

/** Abrir el diario desde otra pantalla, ya en una carpeta (p. ej. «Compartido conmigo» desde Partida) */
const useNotesNav = create<{ folderKey: string | null; tick: number }>(() => ({ folderKey: null, tick: 0 }));
export const openNotesAt = (folderKey: string) => useNotesNav.setState((s) => ({ folderKey, tick: s.tick + 1 }));

/** Las notas con su imagen completa (la que quedó guardada en el dispositivo), para exportarlas */
async function withFullImages(notes: Note[]): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => {
    const full = n.imageKey ? await sharedImageBase64(n.imageKey) : null;
    return full ? { ...n, image: full } : n;
  }));
}

/** Imagen a pantalla completa: la original si está guardada en el dispositivo, con zoom para leer los mapas y botón para guardarla */
function ImageViewer({ note, onClose }: { note: Note; onClose: () => void }) {
  const [src, setSrc] = useState(note.image ?? '');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!note.imageKey) return;
    let url: string | null = null;
    void loadSharedImage(note.imageKey).then((b) => { if (b) { url = URL.createObjectURL(b); setSrc(url); setBlob(b); } });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [note.imageKey]);
  const save = async () => {
    const data = blob ? new Uint8Array(await blob.arrayBuffer()) : Uint8Array.from(atob(stripDataUrl(note.image ?? '')), (ch) => ch.charCodeAt(0));
    const name = `${note.title.replace(/^\S+\s/, '').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').toLowerCase() || 'imagen'}.jpg`;
    const where = await saveBackupFile(data, name, 'image/jpeg');
    useStore.getState().showToast(T('🖼️ Imagen guardada', '🖼️ Image saved'), [where ?? name]);
  };
  return createPortal(
    <div className={`img-viewer ${zoom ? 'zoom' : ''}`} role="dialog" aria-label={note.title}>
      <div className="img-viewer-pane" onClick={() => setZoom(!zoom)}><img src={src} alt={note.title} /></div>
      <div className="img-viewer-bar">
        <b className="grow">{note.title}</b>
        <button className="btn small" onClick={() => setZoom(!zoom)}>{zoom ? '🔎 −' : '🔍 +'}</button>
        <button className="btn small" onClick={() => void save()}>⬇️ {T('Guardar', 'Save')}</button>
        <button className="btn small" onClick={onClose}>✕ {T('Cerrar', 'Close')}</button>
      </div>
    </div>, document.body);
}

const folderLabel = (f: NoteFolder) => {
  const d = f.key ? DEFAULT_FOLDERS.find((x) => x.key === f.key) : undefined;
  return d ? `${d.icon} ${L(d.name)}` : `📁 ${f.name}`;
};
/** Icono y nombre por separado (el índice los pinta aparte) */
const folderParts = (f: NoteFolder): [string, string] => { const t = folderLabel(f); const i = t.indexOf(' '); return [t.slice(0, i), t.slice(i + 1)]; };

/** Lo compartido es «solo para ti» o «para el grupo»; en lo guardado antes de la 0.29 se deduce: las entregas eran tuyas */
const sharedScope = (n: Note): 'me' | 'all' => n.sharedTo ?? (n.ref?.startsWith('gift:') ? 'me' : 'all');

const LOOSE = '__loose';
const BIG_KEY = 'di-en-di-grimoire-big';

/** Un capítulo del grimorio: una carpeta (o las notas sin carpeta), con sus notas de la más reciente a la más antigua */
interface Chapter { id: string; icon: string; name: string; folder: NoteFolder | null; notes: Note[] }

const toRoman = (n: number) => {
  let out = '';
  for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) while (n >= v) { out += s; n -= v; }
  return out;
};

function useWide(query = '(min-width: 900px)') {
  const [wide, setWide] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}

export function NotesDrawer({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const c = useChar();
  const settings = useStore((s) => s.settings);
  const addNote = useStore((s) => s.addNote);
  const addFolder = useStore((s) => s.addFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  /** Página abierta: null = índice; si no, el id del capítulo */
  const [page, setPage] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [big, setBigState] = useState(() => { try { return localStorage.getItem(BIG_KEY) === '1'; } catch { return false; } });
  const setBig = (v: boolean) => { setBigState(v); try { localStorage.setItem(BIG_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  // Libro abierto a dos páginas (índice a la izquierda) cuando está grande y la pantalla da para ello
  const spread = useWide() && big;
  // El borrador se guarda en el dispositivo: no se pierde si Android cierra la app o cambias de pestaña
  const draftKey = `di-en-di-draft-${c.id}`;
  const [draft, setDraftState] = useState(() => { try { return localStorage.getItem(draftKey) ?? ''; } catch { return ''; } });
  const setDraft = (v: string) => { setDraftState(v); try { if (v) localStorage.setItem(draftKey, v); else localStorage.removeItem(draftKey); } catch { /* sin almacenamiento */ } };
  const [writing, setWriting] = useState(false);
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [rec, setRec] = useState<Recorder | null>(null);
  const [live, setLive] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // Abierto desde otra pantalla en una carpeta concreta
  const nav = useNotesNav();
  useEffect(() => {
    if (!nav.tick) return;
    const f = c.noteFolders.find((x) => x.key === nav.folderKey);
    setPage(f?.id ?? null);
    setFocus(null);
    if (!open) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al pedirlo
  }, [nav.tick]);

  // Ir a una nota desde el índice: se baja hasta ella y se resalta un momento
  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => document.getElementById(`note-${focus.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    const off = window.setTimeout(() => setFocus(null), 2200);
    return () => { clearTimeout(t); clearTimeout(off); };
  }, [focus]);

  const sharedFolder = c.noteFolders.find((f) => f.key === 'shared');
  const known = new Set(c.noteFolders.map((f) => f.id));
  const chapters: Chapter[] = [...(sharedFolder ? [sharedFolder] : []), ...c.noteFolders.filter((f) => f !== sharedFolder)].map((f) => {
    const [icon, name] = folderParts(f);
    return { id: f.id, icon, name, folder: f, notes: c.notes.filter((n) => n.folderId === f.id) };
  });
  const loose = c.notes.filter((n) => !n.folderId || !known.has(n.folderId));
  if (loose.length) chapters.push({ id: LOOSE, icon: '🪶', name: T('Sin categoría', 'No category'), folder: null, notes: loose });
  // A dos páginas siempre hay un capítulo abierto a la derecha (el elegido, o el primero que tenga algo)
  const chapter = chapters.find((x) => x.id === page) ?? (spread ? chapters.find((x) => x.notes.length) ?? chapters[0] : undefined);
  const chroniclesId = c.noteFolders.find((f) => f.key === 'chronicles')?.id ?? null;

  const openChapter = (id: string, noteId?: string) => { setPage(id); setFocus(noteId ? { id: noteId, tick: Date.now() } : null); };

  const startRec = async () => {
    setError(null);
    try {
      const r = await startRecording(speechLangFor(settings), {
        onText: (full, partial) => setLive(`${full} ${partial}`.trim()),
        onError: (m) => setError(m),
      });
      setRec(r);
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopRec = async () => {
    if (!rec) return;
    setRec(null);
    const text = await rec.stop();
    if (timer.current) clearInterval(timer.current);
    setTranscript((text || live).trim());
    setLive('');
  };

  const makeStory = async () => {
    if (!transcript) return;
    setBusy(true);
    setError(null);
    const { describeError, narrateOffline, narrateWithClaude } = await import('../ai');
    try {
      let story: string;
      if (settings.apiKey) {
        const previous = c.notes.find((n) => n.kind === 'story')?.body;
        story = await narrateWithClaude(settings.apiKey, settings.model, transcript, c, previous);
      } else {
        story = narrateOffline(transcript);
      }
      const [title, ...rest] = story.split('\n');
      addNote({ title: title.replace(/^#+\s*/, '').trim() || T('Crónica', 'Chronicle'), body: rest.join('\n').trim(), kind: 'story', folderId: chroniclesId });
      setTranscript(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const askChapterName = () => askText(T('Nombre del capítulo', 'Chapter name'), '', T('Pistas, PNJ, misiones…', 'Clues, NPCs, quests…'));
  const newFolder = async () => {
    const name = await askChapterName();
    if (name?.trim()) openChapter(addFolder(name.trim()));
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  /** Un capítulo (o todo el grimorio) a Markdown o PDF */
  const exportNotes = async (kind: 'md' | 'pdf', ch?: Chapter) => {
    setError(null);
    try {
      const { notesMarkdown, notesPdf, exportFileName } = await import('../export/notesExport');
      const title = ch ? `${T('Diario de', 'Journal of')} ${c.name} · ${ch.name}` : undefined;
      const file = exportFileName(T('diario', 'journal'), c.name, kind);
      const full = await withFullImages(ch ? ch.notes : c.notes);
      const where = kind === 'md'
        ? await saveBackupFile(notesMarkdown(c, full, title), file, 'text/markdown')
        : await saveBackupFile(await notesPdf(c, full, title), file, 'application/pdf');
      useStore.getState().showToast(kind === 'md' ? T('📝 Notas en Markdown', '📝 Notes as Markdown') : T('📄 Notas en PDF', '📄 Notes as PDF'), [where ? T(`En ${where}.`, `In ${where}.`) : file]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const saveDraft = (dest: string | null) => {
    const [first, ...rest] = draft.trim().split('\n');
    addNote({ title: first.slice(0, 80), body: rest.length ? rest.join('\n') : first.length > 80 ? first : '', kind: 'note', folderId: dest });
    setDraft('');
    setTarget(undefined);
    setWriting(false);
  };

  const recorder = (
    <div className="recorder">
      {!rec && transcript === null && (
        <button className="btn rec-btn" onClick={() => void startRec()}>🎙️ {T('Grabar sesión y convertir en historia', 'Record session and turn it into a story')}</button>
      )}
      {rec && (
        <>
          <div className="rec-status"><span className="rec-dot" /> {T('Grabando', 'Recording')} {mmss}</div>
          <div className="live">{live || T('Habla con normalidad; puedes dejar el móvil en la mesa…', 'Talk normally; you can leave the phone on the table…')}</div>
          <button className="btn danger full" onClick={() => void stopRec()}>⏹ {T('Parar', 'Stop')}</button>
        </>
      )}
      {transcript !== null && !rec && (
        <>
          <label className="field">{T('Transcripción (puedes corregirla)', 'Transcript (you can edit it)')}
            <textarea className="tall" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          </label>
          <div className="row wrap">
            <button className="btn primary grow" disabled={busy || !transcript.trim()} onClick={() => void makeStory()}>
              {busy ? T('Escribiendo…', 'Writing…') : settings.apiKey ? `✨ ${T('Convertir en historia', 'Turn into a story')}` : `📄 ${T('Guardar como texto', 'Save as text')}`}
            </button>
            <button className="btn" disabled={busy} onClick={() => { addNote({ title: T('Transcripción', 'Transcript'), body: transcript, kind: 'transcript', folderId: chroniclesId }); setTranscript(null); }}>{T('Guardar tal cual', 'Save as is')}</button>
            <button className="btn" disabled={busy} onClick={() => setTranscript(null)}>{T('Descartar', 'Discard')}</button>
          </div>
          {!settings.apiKey && <p className="hint">{T('Añade tu clave de Claude en Ajustes para que la transcripción se reescriba como un relato.', 'Add your Claude key in Settings to have the transcript rewritten as a story.')}</p>}
        </>
      )}
    </div>
  );

  /** Escribir una nota: en el índice se elige el capítulo; dentro de un capítulo va a ese */
  const composer = (fixed?: Chapter) => {
    const dest = fixed ? (fixed.folder?.id ?? null) : target ?? null;
    if (!writing && !draft) return <button className="btn grim-write" onClick={() => setWriting(true)}>✒️ {fixed ? T('Escribir en este capítulo', 'Write in this chapter') : T('Escribir una nota', 'Write a note')}</button>;
    return (
      <div className="quick-note grim-compose">
        <textarea autoFocus={writing} placeholder={fixed?.folder?.key === 'names'
          ? T('Nombre y quién es: «Bram, posadero del Grifo, nos debe 20 po»', 'Name and who they are: “Bram, innkeeper at the Griffin, owes us 20 gp”')
          : T('La primera línea es el título. Nombres, pistas, deudas, misiones…', 'The first line is the title. Names, clues, debts, quests…')} value={draft} onChange={(e) => setDraft(e.target.value)} />
        {!fixed && (
          <div className="row note-target">
            <label className="grow small">{T('Capítulo', 'Chapter')}
              <select value={dest ?? ''} onChange={(e) => setTarget(e.target.value || null)}>
                <option value="">{T('Sin categoría', 'No category')}</option>
                {c.noteFolders.filter((f) => f.key !== 'shared').map((f) => <option key={f.id} value={f.id}>{folderLabel(f)}</option>)}
              </select>
            </label>
            <button className="btn small" onClick={async () => { const name = await askChapterName(); if (name?.trim()) setTarget(addFolder(name.trim())); }}>＋ {T('Nuevo', 'New')}</button>
          </div>
        )}
        <div className="row">
          <button className="btn primary grow" disabled={!draft.trim()} onClick={() => saveDraft(dest)}>💾 {T('Guardar nota', 'Save note')}</button>
          <button className="btn" onClick={() => { setWriting(false); if (!draft.trim()) setDraft(''); }}>{T('Cerrar', 'Close')}</button>
        </div>
      </div>
    );
  };

  const index = (
    <nav className="grim-page grim-index" aria-label={T('Índice', 'Contents')}>
      <h3 className="grim-heading">{T('Índice', 'Contents')}</h3>
      <ol className="grim-toc">
        {chapters.map((ch, i) => {
          const shared = ch.folder?.key === 'shared';
          const mine = shared ? ch.notes.filter((n) => sharedScope(n) === 'me').length : 0;
          return (
            <li key={ch.id} className={`grim-toc-ch ${spread && chapter?.id === ch.id ? 'on' : ''} ${shared ? 'shared' : ''}`}>
              <button className="plain grim-toc-head" onClick={() => openChapter(ch.id)}>
                <span className="grim-toc-num">{toRoman(i + 1)}</span>
                <span className="grim-toc-name">{ch.icon} {ch.name}</span>
                <span className="grim-leader" />
                <span className="grim-toc-count">{ch.notes.length}</span>
              </button>
              {shared && ch.notes.length > 0 && <span className="grim-toc-sub">🔒 {T(`${mine} solo para ti`, `${mine} only for you`)} · 👥 {T(`${ch.notes.length - mine} para el grupo`, `${ch.notes.length - mine} for the party`)}</span>}
              {ch.notes.length > 0 && (
                <ul className="grim-toc-notes">
                  {ch.notes.slice(0, 5).map((n) => (
                    <li key={n.id}><button className="plain" onClick={() => openChapter(ch.id, n.id)}>{n.title || T('Sin título', 'Untitled')}</button></li>
                  ))}
                  {ch.notes.length > 5 && <li><button className="plain grim-more" onClick={() => openChapter(ch.id)}>{T(`… y ${ch.notes.length - 5} más`, `… and ${ch.notes.length - 5} more`)}</button></li>}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <button className="btn small grim-add-ch" onClick={() => void newFolder()}>＋ {T('Nuevo capítulo', 'New chapter')}</button>

      <div className="grim-ornament" aria-hidden>❦</div>
      {composer()}
      {recorder}
      {error && <p className="error">⚠️ {error}</p>}

      <h3 className="grim-heading small">{T('Apéndices', 'Appendices')}</h3>
      <KillCount />
      {c.notes.length > 0 && (
        <div className="notes-export">
          <span className="small muted">{T('Exportar todo el grimorio', 'Export the whole grimoire')} ({c.notes.length})</span>
          <div className="row">
            <button className="btn grow" onClick={() => void exportNotes('md')}>📝 Markdown</button>
            <button className="btn grow" onClick={() => void exportNotes('pdf')}>📄 PDF</button>
          </div>
        </div>
      )}
      <button className="btn full" onClick={async () => {
        try {
          const where = await exportEverything();
          useStore.getState().showToast(T('💾 Archivo de guardado creado', '💾 Save file created'), [where ? T(`En ${where}.`, `In ${where}.`) : T('Fichas, notas e historial. Ábrelo en otro dispositivo con Ajustes → Restaurar copia.', 'Sheets, notes and history. Open it on another device with Settings → Restore backup.')]);
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      }}>💾 {T('Guardar archivo (fichas y notas)', 'Save file (sheets and notes)')}</button>
    </nav>
  );

  const chapterPage = (ch: Chapter) => {
    const shared = ch.folder?.key === 'shared';
    const groups: [string, Note[]][] = shared
      ? [[T('🔒 Solo para ti', '🔒 Only for you'), ch.notes.filter((n) => sharedScope(n) === 'me')], [T('👥 Para todo el grupo', '👥 For the whole party'), ch.notes.filter((n) => sharedScope(n) === 'all')]]
      : [['', ch.notes]];
    return (
      <section key={ch.id} className="grim-page grim-chapter" aria-label={ch.name}>
        <header className="grim-ch-head">
          <span className="grim-ch-num">{T('Capítulo', 'Chapter')} {toRoman(chapters.indexOf(ch) + 1)}</span>
          <h3>{ch.icon} {ch.name}</h3>
          {ch.folder && !shared && (
            <div className="grim-ch-tools">
              <button className="btn small" onClick={async () => { const n = await askText(T('Nuevo nombre', 'New name'), ch.name); if (n?.trim()) renameFolder(ch.folder!.id, n.trim()); }}>✏️ {T('Renombrar', 'Rename')}</button>
              <button className="btn small" aria-label={T('Borrar capítulo', 'Delete chapter')} title={T('Borrar capítulo', 'Delete chapter')} onClick={async () => { if (await askOk(T('¿Borrar el capítulo? Las notas no se borran: pasan a «Sin categoría».', 'Delete this chapter? Notes are kept under “No category”.'))) { deleteFolder(ch.folder!.id); setPage(null); } }}>🗑️</button>
            </div>
          )}
        </header>
        {shared && <p className="hint grim-ch-hint">{T('Lo que el DM te manda a ti o a todo el grupo: cartas, mapas, crónicas, informes de combate y entregas. Se guarda en este dispositivo aunque la partida termine.', 'What the DM sends to you or to the whole party: letters, maps, chronicles, combat reports and gifts. It’s kept on this device even after the game ends.')}</p>}
        {!shared && composer(ch)}
        {ch.notes.length === 0 && <p className="muted grim-empty">{shared ? T('Aún no te han compartido nada.', 'Nothing has been shared with you yet.') : T('Página en blanco. Escribe la primera nota de este capítulo.', 'A blank page. Write the first note of this chapter.')}</p>}
        {groups.filter(([label, list]) => list.length || !label).map(([label, list]) => (
          <div key={label || 'all'} className="grim-group">
            {label && <h4 className="grim-group-title">{label} <small>{list.length}</small></h4>}
            {list.map((n) => <GrimEntry key={n.id} note={n} folders={c.noteFolders} flash={focus?.id === n.id} />)}
          </div>
        ))}
        {ch.notes.length > 0 && (
          <div className="notes-export mt">
            <span className="small muted">{T(`Exportar «${ch.name}»`, `Export “${ch.name}”`)} ({ch.notes.length})</span>
            <div className="row">
              <button className="btn grow" onClick={() => void exportNotes('md', ch)}>📝 Markdown</button>
              <button className="btn grow" onClick={() => void exportNotes('pdf', ch)}>📄 PDF</button>
            </div>
          </div>
        )}
        <div className="grim-ornament" aria-hidden>✦ ✦ ✦</div>
      </section>
    );
  };

  return (
    <>
      {!open && (
        <button className={`notes-fab grim-fab ${rec ? 'recording' : ''}`} onClick={onToggle} aria-label={T('Abrir el grimorio', 'Open the grimoire')}>
          {rec ? `⏺ ${mmss}` : '📖'}
        </button>
      )}
      <div className={`drawer grimoire ${open ? 'open' : ''} ${big ? 'big' : ''} ${spread ? 'spread' : ''}`} aria-hidden={!open}>
        <button className="drawer-handle" onClick={onToggle} aria-label={T('Cerrar el grimorio', 'Close the grimoire')}><span /></button>
        <header className="grim-top">
          {!spread && chapter
            ? <button className="btn small grim-back" onClick={() => setPage(null)}>‹ {T('Índice', 'Contents')}</button>
            : <span className="grim-sigil" aria-hidden>📖</span>}
          <h2 className="grim-title"><small>{T('Grimorio de', 'Grimoire of')}</small> <span>{c.name}</span></h2>
          {rec && <span className="grim-rec">⏺ {mmss}</span>}
          <button className="icon-btn grim-size" onClick={() => setBig(!big)} aria-pressed={big}
            aria-label={big ? T('Hacer el grimorio más pequeño', 'Make the grimoire smaller') : T('Hacer el grimorio más grande', 'Make the grimoire bigger')}
            title={big ? T('Más pequeño', 'Smaller') : T('Más grande', 'Bigger')}>{big ? '🗗' : '⛶'}</button>
          <button className="icon-btn" onClick={onToggle} aria-label={T('Cerrar', 'Close')}>✕</button>
        </header>
        <div className="grim-book">
          {(spread || !chapter) && index}
          {chapter && chapterPage(chapter)}
        </div>
      </div>
      {open && <div className="drawer-backdrop" onClick={onToggle} />}
    </>
  );
}

/** Una entrada del grimorio: título y contenido a la vista, con sus herramientas discretas debajo */
function GrimEntry({ note, folders, flash }: { note: Note; folders: NoteFolder[]; flash: boolean }) {
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const [editing, setEditing] = useState(false);
  const [big, setBig] = useState(false);
  // Lo compartido ya trae su icono en el título (🖼️, 📖, ✉️, ⚔️, 🎁)
  const icon = note.image || note.ref ? '' : note.kind === 'story' ? '📖 ' : note.kind === 'transcript' ? '🎙️ ' : '';
  return (
    <article id={`note-${note.id}`} className={`grim-entry ${flash ? 'flash' : ''}`}>
      {editing ? (
        <>
          <input value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value })} aria-label={T('Título', 'Title')} />
          <textarea className="tall" value={note.body} onChange={(e) => updateNote(note.id, { body: e.target.value })} aria-label={T('Contenido', 'Content')} />
        </>
      ) : (
        <>
          <header className="grim-entry-head">
            <h4>{icon}{note.title || T('Sin título', 'Untitled')}</h4>
            <time>{new Date(note.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}</time>
          </header>
          {note.body && <div className={`grim-entry-body ${note.body.length > 160 ? 'drop' : ''}`}>{note.body}</div>}
        </>
      )}
      {note.image && <img className="note-img grim-img" src={note.image} alt={note.title} onClick={() => setBig(true)} />}
      {big && note.image && <ImageViewer note={note} onClose={() => setBig(false)} />}
      <div className="grim-entry-tools">
        <button className="btn small" onClick={() => setEditing(!editing)}>{editing ? `✔ ${T('Listo', 'Done')}` : `✏️ ${T('Editar', 'Edit')}`}</button>
        <button className="btn small" aria-label={T('Copiar', 'Copy')} title={T('Copiar', 'Copy')} onClick={() => void navigator.clipboard?.writeText(`${note.title}\n\n${note.body}`)}>📋</button>
        <select className="note-move" value={note.folderId ?? ''} aria-label={T('Mover a otro capítulo', 'Move to another chapter')} onChange={(e) => updateNote(note.id, { folderId: e.target.value || null })}>
          <option value="">{T('Sin categoría', 'No category')}</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{folderLabel(f)}</option>)}
        </select>
        <button className="btn small" aria-label={T('Borrar', 'Delete')} title={T('Borrar', 'Delete')} onClick={async () => { if (await askOk(T('¿Borrar esta nota?', 'Delete this note?'))) { if (note.imageKey) void removeSharedImage(note.imageKey); deleteNote(note.id); } }}>🗑️</button>
      </div>
    </article>
  );
}

/** «Goblin guerrero 2» → «Goblin guerrero» para agrupar */
const baseName = (n: string) => n.replace(/\s+\d+$/, '').trim() || n;

function KillCount() {
  const c = useChar();
  const addKill = useStore((s) => s.addKill);
  const removeKill = useStore((s) => s.removeKill);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const groups = new Map<string, number>();
  for (const k of c.kills) groups.set(baseName(k.name), (groups.get(baseName(k.name)) ?? 0) + 1);
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  const sourceLabel = (s: string) => (s === 'party' ? T('partida', 'game') : s === 'local' ? T('combate', 'combat') : T('a mano', 'manual'));
  return (
    <details className="killcount" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span className="grow">☠️ {T('Kill count', 'Kill count')}</span>
        <b className="kill-total">{c.kills.length}</b>
      </summary>
      <p className="hint">{T(`Enemigos a los que ${c.name} ha dado el golpe final. Se apunta solo en el combate (también en la partida compartida, y se quita si se deshace el turno). Solo cuentan tus bajas.`, `Enemies ${c.name} landed the final blow on. Tracked automatically in combat (including the shared game, and removed if the turn is undone). Only your kills count.`)}</p>
      {sorted.length > 0 && (
        <div className="kill-groups">
          {sorted.map(([n, count]) => <span key={n} className="kill-chip">💀 {n} <b>×{count}</b></span>)}
        </div>
      )}
      {c.kills.length > 0 && (
        <ul className="kill-list">
          {[...c.kills].reverse().map((k) => (
            <li key={k.id}>
              <span className="grow">{k.name}</span>
              <span className="muted small">{new Date(k.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · {sourceLabel(k.source)}</span>
              <button className="icon-btn" aria-label={T(`Quitar ${k.name}`, `Remove ${k.name}`)} onClick={async () => { if (await askOk(T(`¿Quitar «${k.name}» del kill count?`, `Remove “${k.name}” from the kill count?`))) removeKill(k.id); }}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input className="grow" value={name} placeholder={T('Añadir a mano: «Jefe orco»', 'Add manually: “Orc chief”')} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { addKill(name); setName(''); }}>＋</button>
      </div>
    </details>
  );
}
