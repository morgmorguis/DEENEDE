// Ajustes → Copia de seguridad: exportar fichas y notas a un archivo y recuperarlas más tarde.
import { useState } from 'react';
import { useChar, useStore } from '../store';
import type { Character } from '../types';
import { backupFileName, buildBackup, parseBackup, saveBackupFile } from '../backup';
import { classById } from '../rules/srd';
import { Modal, Section, pickFiles } from './common';
import { L, T, locale } from '../i18n';
import { askOk } from './Confirm';

const when = (ms: number) => new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const className = (c: Character) => (classById(c.classId) ? L(classById(c.classId)!.name) : c.className);

export function BackupSection() {
  const characters = useStore((s) => s.characters);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const active = useChar();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restore, setRestore] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [pasting, setPasting] = useState(false);
  const notes = characters.reduce((n, c) => n + c.notes.length, 0);

  const exportChars = async (chars: Character[], label: string) => {
    setError(null);
    setStatus(null);
    try {
      const st = useStore.getState();
      const json = JSON.stringify(buildBackup(chars, { log: st.log, customItems: st.settings.customItems, lootBundles: st.settings.lootBundles }));
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
    <Section title={T('Archivo de guardado', 'Save file')}>
      <p className="small">{T(
        'Guarda en un archivo tus fichas con todo su progreso (PG, recursos, conjuros, objetos, monedas), sus notas con sus categorías y crónicas, el historial, tus plantillas de objetos y los botines preparados.',
        'Save your sheets with all their progress (HP, resources, spells, items, coins), their notes with categories and chronicles, the history, your item templates and prepared loot to a file.')}</p>
      <p className="hint">🔁 {T('Es el mismo archivo (.json) en Android, Windows y el navegador: guárdalo en uno y ábrelo en otro con «Restaurar copia». En Android se guarda en Documentos/DiEnDi y se abre el menú para enviarlo a Drive, correo o WhatsApp.', 'It’s the same file (.json) on Android, Windows and the browser: save it on one and open it on another with “Restore backup”. On Android it’s saved to Documents/DiEnDi and the share menu opens to send it to Drive, email or WhatsApp.')}</p>
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
      {data.exportedAt && <p className="hint">{T('Copia del', 'Backup from')} {when(Date.parse(data.exportedAt))}{data.platform ? ` · ${T('guardada en', 'saved on')} ${data.platform}` : ''}</p>}
      {(data.extras.customItems?.length || data.extras.lootBundles?.length) ? <p className="hint">{T(`También trae ${data.extras.customItems?.length ?? 0} plantilla(s) de objeto y ${data.extras.lootBundles?.length ?? 0} botín(es) preparado(s).`, `It also has ${data.extras.customItems?.length ?? 0} item template(s) and ${data.extras.lootBundles?.length ?? 0} prepared loot bundle(s).`)}</p> : null}
      <ul className="restore-list">
        {data.characters.map((c) => {
          const here = current.find((x) => x.id === c.id);
          return (
            <li key={c.id}>
              {c.portrait ? <img className="char-thumb" src={c.portraitThumb ?? c.portrait} alt="" /> : <span className="char-thumb empty">🧙</span>}
              <span className="grow">
                <b>{c.name}</b> <span className="muted small">{className(c)} {c.level} · {T(`${c.notes.length} nota(s)`, `${c.notes.length} note(s)`)}</span>
              </span>
              <span className={`tag ${here ? 'bad' : 'good'}`}>{here ? T('se actualiza', 'updates') : T('nueva', 'new')}</span>
            </li>
          );
        })}
      </ul>
      <button className="btn primary full" onClick={() => {
        importCharacters(data.characters, 'merge', data.extras);
        onDone(T(`Restauradas ${data.characters.length} ficha(s).`, `Restored ${data.characters.length} sheet(s).`));
      }}>📥 {T('Añadir a mis fichas', 'Add to my sheets')}</button>
      {existing > 0 && <p className="hint">{T(`${existing} ficha(s) ya existen: se sustituirán por la versión de la copia. Las demás fichas no se tocan.`, `${existing} sheet(s) already exist and will be replaced by the backup version. Other sheets are left untouched.`)}</p>}
      <button className="btn danger full" onClick={async () => {
        if (!(await askOk(T('¿Reemplazar TODAS tus fichas y notas por las de la copia? Las que no estén en la copia se perderán.', 'Replace ALL your sheets and notes with the backup? Anything not in the backup will be lost.'), { danger: true, ok: T('Reemplazar', 'Replace') }))) return;
        importCharacters(data.characters, 'replace', data.extras);
        onDone(T('Copia restaurada: tus fichas se han reemplazado.', 'Backup restored: your sheets were replaced.'));
      }}>♻️ {T('Reemplazar todo por la copia', 'Replace everything with the backup')}</button>
      <button className="btn full" onClick={onClose}>{T('Cancelar', 'Cancel')}</button>
    </Modal>
  );
}
