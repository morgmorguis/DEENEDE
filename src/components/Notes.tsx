import { useEffect, useRef, useState } from 'react';
import { speechLangFor, useChar, useStore } from '../store';
import { startRecording, type Recorder } from '../speech';
import type { Note, NoteFolder } from '../types';
import { DEFAULT_FOLDERS } from '../rules/srd';
import { L, T, locale } from '../i18n';

const folderLabel = (f: NoteFolder) => {
  const d = f.key ? DEFAULT_FOLDERS.find((x) => x.key === f.key) : undefined;
  return d ? `${d.icon} ${L(d.name)}` : `📁 ${f.name}`;
};

export function NotesDrawer({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const c = useChar();
  const settings = useStore((s) => s.settings);
  const addNote = useStore((s) => s.addNote);
  const addFolder = useStore((s) => s.addFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [rec, setRec] = useState<Recorder | null>(null);
  const [live, setLive] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const folder = c.noteFolders.find((f) => f.id === folderId) ?? null;
  const chroniclesId = c.noteFolders.find((f) => f.key === 'chronicles')?.id ?? folder?.id ?? null;
  const notes = folder ? c.notes.filter((n) => n.folderId === folder.id) : c.notes;

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
    const text = await rec.stop();
    setRec(null);
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

  const newFolder = () => {
    const name = prompt(T('Nombre de la carpeta', 'Folder name'));
    if (name?.trim()) setFolderId(addFolder(name.trim()));
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <>
      {!open && (
        <button className={`notes-fab ${rec ? 'recording' : ''}`} onClick={onToggle} aria-label={T('Abrir bloc de notas', 'Open notebook')}>
          {rec ? `⏺ ${mmss}` : '📜'}
        </button>
      )}
      <div className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="drawer-handle" onClick={onToggle} aria-label={T('Cerrar bloc de notas', 'Close notebook')}><span /></button>
        <div className="drawer-body">
          <div className="drawer-title">
            <h2>📜 {T('Diario de', 'Journal of')} {c.name}</h2>
            <button className="icon-btn" onClick={onToggle} aria-label={T('Cerrar', 'Close')}>⌄</button>
          </div>

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
            {error && <p className="error">⚠️ {error}</p>}
          </div>

          <div className="folders">
            <button className={`folder-chip ${folderId === null ? 'on' : ''}`} onClick={() => setFolderId(null)}>🗂️ {T('Todas', 'All')} <small>{c.notes.length}</small></button>
            {c.noteFolders.map((f) => (
              <button key={f.id} className={`folder-chip ${folderId === f.id ? 'on' : ''}`} onClick={() => setFolderId(f.id)}>
                {folderLabel(f)} <small>{c.notes.filter((n) => n.folderId === f.id).length}</small>
              </button>
            ))}
            <button className="folder-chip add" onClick={newFolder} aria-label={T('Nueva carpeta', 'New folder')}>＋ {T('Carpeta', 'Folder')}</button>
          </div>
          {folder && (
            <div className="row folder-actions">
              <span className="grow"><b>{folderLabel(folder)}</b></span>
              <button className="btn small" onClick={() => { const n = prompt(T('Nuevo nombre', 'New name'), folder.key ? folderLabel(folder).replace(/^\S+\s/, '') : folder.name); if (n?.trim()) renameFolder(folder.id, n.trim()); }}>✏️ {T('Renombrar', 'Rename')}</button>
              <button className="btn small danger" onClick={() => { if (confirm(T('¿Borrar la carpeta? Las notas no se borran: pasan a «Todas».', 'Delete this folder? Notes are kept under “All”.'))) { deleteFolder(folder.id); setFolderId(null); } }}>🗑️</button>
            </div>
          )}

          <div className="quick-note">
            <textarea placeholder={folder?.key === 'names'
              ? T('Nombre y quién es: «Bram, posadero del Grifo, nos debe 20 po»', 'Name and who they are: “Bram, innkeeper at the Griffin, owes us 20 gp”')
              : T('Nota rápida: nombres, pistas, deudas, misiones…', 'Quick note: names, clues, debts, quests…')} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn" disabled={!draft.trim()} onClick={() => {
              const [first, ...rest] = draft.trim().split('\n');
              addNote({ title: first.slice(0, 80), body: rest.length ? rest.join('\n') : first.length > 80 ? first : '', kind: 'note', folderId });
              setDraft('');
            }}>{T('Guardar nota', 'Save note')}{folder ? ` → ${folderLabel(folder)}` : ''}</button>
          </div>

          {notes.length === 0 && <p className="muted">{T('Aún no hay notas aquí.', 'No notes here yet.')}</p>}
          {notes.map((n) => <NoteItem key={n.id} note={n} folders={c.noteFolders} />)}
        </div>
      </div>
      {open && <div className="drawer-backdrop" onClick={onToggle} />}
    </>
  );
}

function NoteItem({ note, folders }: { note: Note; folders: NoteFolder[] }) {
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const [editing, setEditing] = useState(false);
  const icon = note.kind === 'story' ? '📖' : note.kind === 'transcript' ? '🎙️' : '📝';
  const folder = folders.find((f) => f.id === note.folderId);
  return (
    <details className="note">
      <summary>
        <span className="grow">{icon} {note.title}</span>
        {folder && <span className="note-folder">{folderLabel(folder)}</span>}
        <span className="muted small">{new Date(note.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
      </summary>
      {editing ? (
        <>
          <input value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value })} />
          <textarea className="tall" value={note.body} onChange={(e) => updateNote(note.id, { body: e.target.value })} />
        </>
      ) : (
        note.body && <div className="note-body">{note.body}</div>
      )}
      <div className="row wrap">
        <select className="note-move" value={note.folderId ?? ''} aria-label={T('Mover a carpeta', 'Move to folder')} onChange={(e) => updateNote(note.id, { folderId: e.target.value || null })}>
          <option value="">{T('Sin carpeta', 'No folder')}</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{folderLabel(f)}</option>)}
        </select>
        <button className="btn small" onClick={() => setEditing(!editing)}>{editing ? T('Listo', 'Done') : T('Editar', 'Edit')}</button>
        <button className="btn small" onClick={() => void navigator.clipboard?.writeText(`${note.title}\n\n${note.body}`)}>{T('Copiar', 'Copy')}</button>
        <button className="btn small danger" onClick={() => { if (confirm(T('¿Borrar esta nota?', 'Delete this note?'))) deleteNote(note.id); }}>{T('Borrar', 'Delete')}</button>
      </div>
    </details>
  );
}
