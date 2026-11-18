// Exportar la ficha: en PDF sobre la hoja oficial de 2024 (el jugador elige el PDF una vez y se guarda en el dispositivo), en Excel o en Markdown.
import { useEffect, useRef, useState } from 'react';
import { useChar, useStore } from '../store';
import { Modal } from './common';
import { T } from '../i18n';
import { SHEET_TEMPLATE, loadFile, removeFile, saveFile } from '../export/templateStore';
import { saveBackupFile } from '../backup';

export function SheetPdfModal({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const [has, setHas] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadFile(SHEET_TEMPLATE).then((d) => setHas(!!d)); }, []);

  const pick = async (f?: File) => {
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const data = await f.arrayBuffer();
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(data, { ignoreEncryption: true });
      const { width, height } = doc.getPage(0).getSize();
      // La hoja oficial de 2024 en español: 2 páginas de 603 × 774 puntos
      if (doc.getPageCount() < 2 || Math.abs(width - 603) > 15 || Math.abs(height - 774) > 15) {
        setError(T('Ese PDF no parece la hoja de personaje oficial de 2024 (2 páginas). Los datos podrían salir descolocados.', 'That PDF doesn’t look like the official 2024 character sheet (2 pages). The data might not line up.'));
      }
      await saveFile(SHEET_TEMPLATE, data);
      setHas(true);
    } catch {
      setError(T('No puedo abrir ese PDF.', 'Can’t open that PDF.'));
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const exportPdf = async () => {
    setBusy(true);
    setError('');
    try {
      const tpl = await loadFile(SHEET_TEMPLATE);
      if (!tpl) { setHas(false); setBusy(false); return; }
      const { buildSheetPdf } = await import('../export/sheetPdf');
      const { exportFileName } = await import('../export/notesExport');
      const bytes = await buildSheetPdf(c, tpl);
      const file = exportFileName(T('ficha', 'sheet'), c.name, 'pdf');
      const where = await saveBackupFile(bytes, file, 'application/pdf');
      useStore.getState().showToast(T('📄 Ficha en PDF', '📄 Sheet as PDF'), [where ? T(`En ${where}.`, `In ${where}.`) : file]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  // Excel o Markdown: no necesitan la hoja oficial (sirven también para las fichas de PNJ del DM)
  const exportText = async (kind: 'xlsx' | 'md') => {
    setBusy(true);
    setError('');
    try {
      const { characterXlsx, characterMarkdown } = await import('../export/dmExport');
      const { exportFileName } = await import('../export/notesExport');
      const file = exportFileName(T('ficha', 'sheet'), c.name, kind);
      const where = kind === 'xlsx'
        ? await saveBackupFile(characterXlsx(c), file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        : await saveBackupFile(characterMarkdown(c), file, 'text/markdown');
      useStore.getState().showToast(kind === 'xlsx' ? T('📊 Ficha en Excel', '📊 Sheet as Excel') : T('📝 Ficha en Markdown', '📝 Sheet as Markdown'), [where ? T(`En ${where}.`, `In ${where}.`) : file]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <Modal title={T('📄 Exportar la ficha', '📄 Export the sheet')} onClose={onClose}>
      <div className="row">
        <button className="btn grow" disabled={busy} onClick={() => void exportText('xlsx')}>📊 Excel</button>
        <button className="btn grow" disabled={busy} onClick={() => void exportText('md')}>📝 Markdown</button>
      </div>
      <p className="hint">{T('Excel y Markdown no necesitan nada más: también sirven para las fichas de tus PNJ.', 'Excel and Markdown need nothing else: they also work for your NPC sheets.')}</p>
      <h3>📄 PDF</h3>
      <p className="small">{T(`Rellena la hoja de personaje oficial de D&D 2024 con los datos de ${c.name}: características, habilidades, ataques, rasgos, conjuros, equipo, monedas…`, `Fills the official D&D 2024 character sheet with ${c.name}’s data: abilities, skills, attacks, features, spells, gear, coins…`)}</p>
      {has === false && (
        <p className="hint">{T('La primera vez elige el PDF de la hoja oficial (la de 2 páginas en español, gratis en la web oficial de D&D). Se guarda solo en este dispositivo y no hace falta volver a elegirla.', 'The first time, pick the official sheet PDF (the 2-page Spanish one, free on the official D&D website). It’s stored only on this device and you won’t need to pick it again.')}</p>
      )}
      {error && <p className="error">⚠️ {error}</p>}
      {has ? (
        <>
          <button className="btn primary full big" disabled={busy} onClick={() => void exportPdf()}>{busy ? T('Rellenando…', 'Filling…') : `📄 ${T('Exportar mi ficha', 'Export my sheet')}`}</button>
          <div className="row mt">
            <button className="btn small grow" disabled={busy} onClick={() => input.current?.click()}>🔁 {T('Cambiar la hoja', 'Change the sheet')}</button>
            <button className="btn small" disabled={busy} onClick={async () => { await removeFile(SHEET_TEMPLATE); setHas(false); }}>🗑️</button>
          </div>
        </>
      ) : (
        <button className="btn primary full big" disabled={busy || has === null} onClick={() => input.current?.click()}>📂 {T('Elegir la hoja oficial (PDF)', 'Pick the official sheet (PDF)')}</button>
      )}
      <input ref={input} type="file" hidden accept="application/pdf,.pdf" onChange={(e) => void pick(e.target.files?.[0])} />
    </Modal>
  );
}
