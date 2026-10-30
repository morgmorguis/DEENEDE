// Ajustes → Copia de seguridad: exportar fichas y notas a un archivo y recuperarlas más tarde.
import { useState } from 'react';
import { useChar, useStore } from '../store';
import type { Character } from '../types';
import { backupFileName, buildBackup, parseBackup, saveBackupFile } from '../backup';
import { classById } from '../rules/srd';
import { Modal, Section, pickFiles } from './common';
import { L, T, locale } from '../i18n';

const when = (ms: number) => new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const className = (c: Character) => (classById(c.classId) ? L(classById(c.classId)!.name) : c.className);

export function BackupSection() {
  const characters = useStore((s) => s.characters);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const active = useChar();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ characters: Character[]; exportedAt: string | null } | null>(null);
  const [pasting, setPasting] = useState(false);
  const notes = characters.reduce((n, c) => n + c.notes.length, 0);

  const exportChars = async (chars: Character[], label: string) => {
    setError(null);
    setStatus(null);
    try {
      const json = JSON.stringify(buildBackup(chars));
      const where = await saveBackupFile(json, backupFileName(label));
      if (chars.length === characters.length) setSettings({ lastBackupAt: Date.now() });
      setStatus(where ? T(`Copia guardada en ${where}.`, `Backup saved to ${where}.`) : T('Copia creada.', 'Backup created.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openFile = async () => {
    setError(null);
    setStatus(null);
    const [file] = await pickFiles('*/*', false);
    if (!file) return;
    try {
      setRestore(parseBackup(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
    <Section title={T('Copia de seguridad', 'Backup')}>
      <p className="small">{T(
        'Guarda tus fichas con todo su progreso (PG, recursos, conjuros, efectos) y su diario (notas, carpetas y crónicas) en un archivo. Podrás recuperarlo más tarde, tras reinstalar la app o en otro móvil.',
        'Save your sheets with all their progress (HP, resources, spells, effects) and their journal (notes, folders and chronicles) to a file. You can restore it later, after reinstalling the app or on another phone.')}</p>
      <p className="hint">{settings.lastBackupAt
        ? T(`Última copia completa: ${when(settings.lastBackupAt)}.`, `Last full backup: ${when(settings.lastBackupAt)}.`)
        : T('Aún no has hecho ninguna copia completa.', 'You haven’t made a full backup yet.')}</p>
      <button className="btn primary full" onClick={() => void exportChars(characters, T('todo', 'all'))}>
        💾 {T(`Exportar todo (${characters.length} ficha(s), ${notes} nota(s))`, `Export everything (${characters.length} sheet(s), ${notes} note(s))`)}
      </button>
      <div className="row mt">
        <button className="btn grow" onClick={() => void exportChars([active], active.name)}>📤 {T(`Solo ${active.name}`, `Only ${active.name}`)}</button>
        <button className="btn grow" onClick={() => void openFile()}>📂 {T('Restaurar copia', 'Restore backup')}</button>
      </div>
      <button className="p-link mt" onClick={() => setPasting(true)}>{T('…o pegar el texto de una copia', '…or paste the text of a backup')}</button>
      {status && <p className="hint">✅ {status}</p>}
      {error && <p className="error">⚠️ {error}</p>}
    </Section>
      {pasting && <PasteModal onClose={() => setPasting(false)} onParsed={(r) => { setPasting(false); setRestore(r); }} />}
      {restore && <RestoreModal data={restore} onClose={() => setRestore(null)} onDone={(msg) => { setRestore(null); setStatus(msg); }} />}
    </>
  );
}

function PasteModal({ onClose, onParsed }: { onClose: () => void; onParsed: (r: ReturnType<typeof parseBackup>) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title={T('Pegar copia', 'Paste backup')} onClose={onClose}>
      <p className="small">{T('Pega aquí el contenido de un archivo de copia o de una ficha exportada.', 'Paste the contents of a backup file or an exported sheet here.')}</p>
      <textarea className="tall mono" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn primary full" disabled={!text.trim()} onClick={() => {
        try { onParsed(parseBackup(text)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      }}>{T('Continuar', 'Continue')}</button>
    </Modal>
  );
}

function RestoreModal({ data, onClose, onDone }: { data: ReturnType<typeof parseBackup>; onClose: () => void; onDone: (msg: string) => void }) {
  const current = useStore((s) => s.characters);
  const importCharacters = useStore((s) => s.importCharacters);
  const existing = data.characters.filter((c) => current.some((x) => x.id === c.id)).length;

  return (
    <Modal title={T('Restaurar copia', 'Restore backup')} onClose={onClose}>
      {data.exportedAt && <p className="hint">{T('Copia del', 'Backup from')} {when(Date.parse(data.exportedAt))}</p>}
      <ul className="restore-list">
        {data.characters.map((c) => {
          const here = current.find((x) => x.id === c.id);
          return (
            <li key={c.id}>
              {c.portrait ? <img className="char-thumb" src={c.portrait} alt="" /> : <span className="char-thumb empty">🧙</span>}
              <span className="grow">
                <b>{c.name}</b> <span className="muted small">{className(c)} {c.level} · {T(`${c.notes.length} nota(s)`, `${c.notes.length} note(s)`)}</span>
              </span>
              <span className={`tag ${here ? 'bad' : 'good'}`}>{here ? T('se actualiza', 'updates') : T('nueva', 'new')}</span>
            </li>
          );
        })}
      </ul>
      <button className="btn primary full" onClick={() => {
        importCharacters(data.characters, 'merge');
        onDone(T(`Restauradas ${data.characters.length} ficha(s).`, `Restored ${data.characters.length} sheet(s).`));
      }}>📥 {T('Añadir a mis fichas', 'Add to my sheets')}</button>
      {existing > 0 && <p className="hint">{T(`${existing} ficha(s) ya existen: se sustituirán por la versión de la copia. Las demás fichas no se tocan.`, `${existing} sheet(s) already exist and will be replaced by the backup version. Other sheets are left untouched.`)}</p>}
      <button className="btn danger full" onClick={() => {
        if (!confirm(T('¿Reemplazar TODAS tus fichas y notas por las de la copia? Las que no estén en la copia se perderán.', 'Replace ALL your sheets and notes with the backup? Anything not in the backup will be lost.'))) return;
        importCharacters(data.characters, 'replace');
        onDone(T('Copia restaurada: tus fichas se han reemplazado.', 'Backup restored: your sheets were replaced.'));
      }}>♻️ {T('Reemplazar todo por la copia', 'Replace everything with the backup')}</button>
      <button className="btn full" onClick={onClose}>{T('Cancelar', 'Cancel')}</button>
    </Modal>
  );
}
