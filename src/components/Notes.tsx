import { useEffect, useRef, useState } from 'react';
import { useChar, useStore } from '../store';
import { startRecording, type Recorder } from '../speech';
import type { Note } from '../types';

export function NotesDrawer({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const c = useChar();
  const settings = useStore((s) => s.settings);
  const addNote = useStore((s) => s.addNote);
  const [draft, setDraft] = useState('');
  const [rec, setRec] = useState<Recorder | null>(null);
  const [live, setLive] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startRec = async () => {
    setError(null);
    try {
      const r = await startRecording(settings.speechLang, {
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
      addNote({ title: title.replace(/^#+\s*/, '').trim() || 'Crónica', body: rest.join('\n').trim(), kind: 'story' });
      setTranscript(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <>
      {!open && (
        <button className={`notes-fab ${rec ? 'recording' : ''}`} onClick={onToggle} aria-label="Abrir bloc de notas">
          {rec ? `⏺ ${mmss}` : '📜'}
        </button>
      )}
      <div className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="drawer-handle" onClick={onToggle} aria-label="Cerrar bloc de notas"><span /></button>
        <div className="drawer-body">
          <div className="drawer-title">
            <h2>📜 Diario de {c.name}</h2>
            <button className="icon-btn" onClick={onToggle} aria-label="Cerrar">⌄</button>
          </div>

          <div className="recorder">
            {!rec && transcript === null && (
              <button className="btn rec-btn" onClick={() => void startRec()}>🎙️ Grabar sesión y convertir en historia</button>
            )}
            {rec && (
              <>
                <div className="rec-status"><span className="rec-dot" /> Grabando {mmss}</div>
                <div className="live">{live || 'Habla con normalidad; puedes dejar el móvil en la mesa…'}</div>
                <button className="btn danger full" onClick={() => void stopRec()}>⏹ Parar</button>
              </>
            )}
            {transcript !== null && !rec && (
              <>
                <label className="field">Transcripción (puedes corregirla)
                  <textarea className="tall" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
                </label>
                <div className="row wrap">
                  <button className="btn primary grow" disabled={busy || !transcript.trim()} onClick={() => void makeStory()}>
                    {busy ? 'Escribiendo…' : settings.apiKey ? '✨ Convertir en historia' : '📄 Guardar como texto'}
                  </button>
                  <button className="btn" disabled={busy} onClick={() => { addNote({ title: 'Transcripción', body: transcript, kind: 'transcript' }); setTranscript(null); }}>Guardar tal cual</button>
                  <button className="btn" disabled={busy} onClick={() => setTranscript(null)}>Descartar</button>
                </div>
                {!settings.apiKey && <p className="hint">Añade tu clave de Claude en Ajustes para que la transcripción se reescriba como un relato.</p>}
              </>
            )}
            {error && <p className="error">⚠️ {error}</p>}
          </div>

          <div className="quick-note">
            <textarea placeholder="Nota rápida: nombres, pistas, deudas, misiones…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn" disabled={!draft.trim()} onClick={() => {
              const [first, ...rest] = draft.trim().split('\n');
              addNote({ title: first.slice(0, 60), body: rest.length ? rest.join('\n') : first.length > 60 ? first : '', kind: 'note' });
              setDraft('');
            }}>Guardar nota</button>
          </div>

          {c.notes.length === 0 && <p className="muted">Aún no hay notas.</p>}
          {c.notes.map((n) => <NoteItem key={n.id} note={n} />)}
        </div>
      </div>
      {open && <div className="drawer-backdrop" onClick={onToggle} />}
    </>
  );
}

function NoteItem({ note }: { note: Note }) {
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const [editing, setEditing] = useState(false);
  const icon = note.kind === 'story' ? '📖' : note.kind === 'transcript' ? '🎙️' : '📝';
  return (
    <details className="note">
      <summary>
        <span className="grow">{icon} {note.title}</span>
        <span className="muted small">{new Date(note.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
      </summary>
      {editing ? (
        <>
          <input value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value })} />
          <textarea className="tall" value={note.body} onChange={(e) => updateNote(note.id, { body: e.target.value })} />
        </>
      ) : (
        <div className="note-body">{note.body}</div>
      )}
      <div className="row">
        <button className="btn small" onClick={() => setEditing(!editing)}>{editing ? 'Listo' : 'Editar'}</button>
        <button className="btn small" onClick={() => void navigator.clipboard?.writeText(`${note.title}\n\n${note.body}`)}>Copiar</button>
        <button className="btn small danger" onClick={() => { if (confirm('¿Borrar esta nota?')) deleteNote(note.id); }}>Borrar</button>
      </div>
    </details>
  );
}
