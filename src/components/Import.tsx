import { useState } from 'react';
import { useChar, useStore } from '../store';
import type { Character } from '../types';
import { Modal, pickFiles } from './common';
import { armorClass, fmt, mod } from '../rules/calc';
import { ABILITIES, SKILLS } from '../rules/srd';
import { L, T } from '../i18n';

type Step = 'pick' | 'reading' | 'preview';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const current = useChar();
  const settings = useStore((s) => s.settings);
  const addCharacter = useStore((s) => s.addCharacter);
  const replace = useStore((s) => s.replace);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ char: Character; warnings: string[] } | null>(null);

  const add = async (accept: string) => {
    const picked = await pickFiles(accept, true);
    if (picked.length) setFiles((f) => [...f, ...picked]);
  };

  const read = async () => {
    setError(null);
    setStep('reading');
    try {
      const [{ filesToBlocks, sheetToCharacter }, ai] = await Promise.all([import('../importer'), import('../ai')]);
      const blocks = await filesToBlocks(files);
      if (text.trim()) blocks.push({ type: 'text', text: `Character sheet text:\n"""\n${text.trim()}\n"""` });
      if (!blocks.length) throw new Error(T('Elige al menos una foto, documento o texto.', 'Pick at least one photo, document or text.'));
      try {
        const sheet = await ai.importWithClaude(settings.apiKey, settings.model, blocks);
        setResult({ char: sheetToCharacter(sheet), warnings: sheet.warnings ?? [] });
        setStep('preview');
      } catch (e) {
        throw new Error(ai.describeError(e));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('pick');
    }
  };

  if (!settings.apiKey) {
    return (
      <Modal title={T('Importar ficha', 'Import sheet')} onClose={onClose}>
        <p>{T('Para leer fotos, PDF o Word de una hoja real, la app usa Claude. Añade tu clave de API de Anthropic en Ajustes → Inteligencia artificial y vuelve aquí.', 'To read photos, PDFs or Word files of a real sheet, the app uses Claude. Add your Anthropic API key in Settings → Artificial intelligence and come back.')}</p>
        <p className="hint">{T('También puedes copiar una ficha desde otro móvil con Ajustes → Exportar / Importar ficha (sin IA).', 'You can also copy a sheet from another phone with Settings → Export / Import sheet (no AI needed).')}</p>
        <button className="btn primary full" onClick={onClose}>{T('Entendido', 'Got it')}</button>
      </Modal>
    );
  }

  return (
    <Modal title={T('Importar ficha', 'Import sheet')} onClose={onClose}>
      {step === 'pick' && (
        <>
          <p className="small">{T('Haz fotos de tu hoja (una por página), o elige un PDF o Word. Claude leerá los datos y podrás revisarlos antes de guardar.', 'Take photos of your sheet (one per page), or pick a PDF or Word file. Claude will read the data and you can review it before saving.')}</p>
          <div className="import-grid">
            <button className="btn" onClick={() => void add('image/*')}>📷 {T('Foto', 'Photo')}</button>
            <button className="btn" onClick={() => void add('application/pdf,.pdf')}>📄 PDF</button>
            <button className="btn" onClick={() => void add('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document')}>📝 Word</button>
          </div>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={i}>
                  <span className="grow">{f.name}</span>
                  <span className="muted small">{Math.round(f.size / 1024)} KB</span>
                  <button className="icon-btn" aria-label={T('Quitar', 'Remove')} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <label className="field">{T('…o pega el texto de la ficha', '…or paste the sheet text')}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={T('Nombre, clase, características…', 'Name, class, ability scores…')} />
          </label>
          {error && <p className="error">⚠️ {error}</p>}
          <button className="btn primary full" disabled={!files.length && !text.trim()} onClick={() => void read()}>✨ {T('Leer ficha', 'Read sheet')}</button>
        </>
      )}

      {step === 'reading' && (
        <div className="import-reading">
          <div className="spinner" />
          <p>{T('Leyendo la ficha… puede tardar un minuto.', 'Reading the sheet… this can take a minute.')}</p>
        </div>
      )}

      {step === 'preview' && result && (
        <>
          <div className="import-preview">
            <h3>{result.char.name}</h3>
            <p className="muted">{[result.char.species, result.char.className, `${T('nivel', 'level')} ${result.char.level}`, result.char.background].filter(Boolean).join(' · ')}</p>
            <div className="import-abilities">
              {ABILITIES.map((a) => (
                <div key={a.id}><b>{L(a.short)}</b><span>{result.char.abilities[a.id]}</span><small>{fmt(mod(result.char.abilities[a.id]))}</small></div>
              ))}
            </div>
            <ul className="import-facts">
              <li>{T('CA', 'AC')} {armorClass(result.char).value} · {T('PG', 'HP')} {result.char.hp.current}/{result.char.hp.max} · {T('Velocidad', 'Speed')} {result.char.speed}</li>
              <li>{T('Competencias en habilidades', 'Skill proficiencies')}: {SKILLS.filter((s) => result.char.skillProf[s.id]).map((s) => L(s.name)).join(', ') || '—'}</li>
              <li>{T('Armas', 'Weapons')}: {result.char.attacks.map((a) => a.name).join(', ') || '—'}</li>
              <li>{T('Conjuros', 'Spells')}: {result.char.spells.length} · {T('Rasgos', 'Features')}: {result.char.features.length}</li>
              {result.char.languages && <li>{T('Idiomas', 'Languages')}: {result.char.languages}</li>}
            </ul>
            {result.warnings.length > 0 && (
              <div className="reminders">
                <b>{T('Revisa esto', 'Please check')}:</b>
                {result.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
          </div>
          <button className="btn primary full" onClick={() => { addCharacter(result.char); onClose(); }}>➕ {T('Crear como nuevo personaje', 'Create as a new character')}</button>
          <button className="btn full" onClick={() => {
            if (!confirm(T(`¿Reemplazar la ficha de ${current.name}? Se conservan sus notas y su retrato.`, `Replace ${current.name}’s sheet? Notes and portrait are kept.`))) return;
            replace({ ...result.char, id: current.id, notes: current.notes, noteFolders: current.noteFolders, portrait: result.char.portrait ?? current.portrait });
            onClose();
          }}>♻️ {T(`Reemplazar la ficha de ${current.name}`, `Replace ${current.name}’s sheet`)}</button>
          <button className="btn full" onClick={() => setStep('pick')}>{T('Volver', 'Back')}</button>
        </>
      )}
    </Modal>
  );
}
