import { useState } from 'react';
import { useChar, useStore } from '../store';
import type { Character } from '../types';
import { Modal, pickFiles } from './common';
import { armorClass, fmt, mod } from '../rules/calc';
import { ABILITIES, SKILLS } from '../rules/srd';
import { L, T } from '../i18n';
import { validate } from '../rules/flags';
import { FlagList } from './Flags';

type Step = 'pick' | 'reading' | 'preview';
type Method = 'offline' | 'claude';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const current = useChar();
  const settings = useStore((s) => s.settings);
  const addCharacter = useStore((s) => s.addCharacter);
  const replace = useStore((s) => s.replace);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [method, setMethod] = useState<Method>('offline');
  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState<{ msg: string; fraction?: number }>({ msg: '' });
  const [error, setError] = useState<string | null>(null);
  const [translatingLong, setTranslatingLong] = useState(false);
  const [result, setResult] = useState<{ char: Character; warnings: string[]; how: string } | null>(null);

  const add = async (accept: string) => {
    const picked = await pickFiles(accept, true);
    if (picked.length) setFiles((f) => [...f, ...picked]);
  };

  const read = async () => {
    setError(null);
    setStep('reading');
    setProgress({ msg: T('Preparando…', 'Preparing…') });
    try {
      const importer = await import('../importer');
      if (method === 'offline') {
        const { sheet, method: how } = await importer.importOffline(files, text, (msg, fraction) => setProgress({ msg, fraction }));
        const label = { 'pdf-form': T('formulario PDF', 'PDF form'), ocr: T('OCR en el móvil', 'on-device OCR'), text: T('texto', 'text') }[how];
        setResult({ char: importer.sheetToCharacter(sheet), warnings: sheet.warnings, how: label });
      } else {
        const ai = await import('../ai');
        setProgress({ msg: T('Claude está leyendo la ficha… puede tardar un minuto.', 'Claude is reading the sheet… this can take a minute.') });
        const blocks = await importer.filesToBlocks(files);
        if (text.trim()) blocks.push({ type: 'text', text: `Character sheet text:\n"""\n${text.trim()}\n"""` });
        if (!blocks.length) throw new Error(T('Elige al menos una foto, documento o texto.', 'Pick at least one photo, document or text.'));
        try {
          const sheet = await ai.importWithClaude(settings.apiKey, settings.model, blocks);
          setResult({ char: importer.sheetToCharacter(sheet), warnings: sheet.warnings ?? [], how: 'Claude' });
        } catch (e) {
          throw new Error(ai.describeError(e));
        }
      }
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('pick');
    }
  };

  return (
    <Modal title={T('Importar ficha', 'Import sheet')} onClose={onClose}>
      {step === 'pick' && (
        <>
          <p className="small">{T('Elige fotos de tu hoja (una por página), un PDF o un Word. Podrás revisar los datos antes de guardar.', 'Pick photos of your sheet (one per page), a PDF or a Word file. You can review the data before saving.')}</p>
          <div className="import-grid">
            <button className="btn" onClick={() => void add('image/*')}>📷 {T('Foto', 'Photo')}</button>
            <button className="btn" onClick={() => void add('application/pdf,.pdf')}>📄 PDF</button>
            <button className="btn" onClick={() => void add('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain')}>📝 Word</button>
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
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={T('Nombre: …\nClase: … Nivel 3\nFUE 15 DES 14 CON 13…', 'Name: …\nClass: … Level 3\nSTR 15 DEX 14 CON 13…')} />
          </label>

          <div className="segmented" role="radiogroup" aria-label={T('Método', 'Method')}>
            <button role="radio" aria-checked={method === 'offline'} className={method === 'offline' ? 'on' : ''} onClick={() => setMethod('offline')}>📴 {T('Sin conexión (gratis)', 'Offline (free)')}</button>
            <button role="radio" aria-checked={method === 'claude'} className={method === 'claude' ? 'on' : ''} disabled={!settings.apiKey} onClick={() => setMethod('claude')}>✨ Claude</button>
          </div>
          <p className="hint">
            {method === 'offline'
              ? T('Todo se procesa en el móvil. Los PDF rellenables de la hoja oficial se leen casi perfectos; las fotos usan OCR y habrá que revisar y marcar las competencias a mano.', 'Everything is processed on the device. Fillable PDFs of the official sheet are read almost perfectly; photos use OCR and you’ll need to check them and tick proficiencies by hand.')
              : T('Claude lee mejor las fotos (incluidas las casillas marcadas). Usa tu clave de API.', 'Claude reads photos better (including ticked boxes). Uses your API key.')}
            {!settings.apiKey && ' ' + T('Para usar Claude añade tu clave en Ajustes.', 'To use Claude, add your key in Settings.')}
          </p>
          {error && <p className="error">⚠️ {error}</p>}
          <button className="btn primary full" disabled={!files.length && !text.trim()} onClick={() => void read()}>🔎 {T('Leer ficha', 'Read sheet')}</button>
        </>
      )}

      {step === 'reading' && (
        <div className="import-reading">
          <div className="spinner" />
          <p>{progress.msg}</p>
          {progress.fraction != null && (
            <div className="progress"><div style={{ width: `${Math.round(progress.fraction * 100)}%` }} /></div>
          )}
        </div>
      )}

      {step === 'preview' && result && (
        <>
          <div className="import-preview">
            <h3>{result.char.name}</h3>
            <p className="muted">{[result.char.species, result.char.className, `${T('nivel', 'level')} ${result.char.level}`, result.char.background].filter(Boolean).join(' · ')}</p>
            <p className="hint">{T('Leído con', 'Read with')}: {result.how}</p>
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
            {validate(result.char).length > 0 && (
              <div className="import-flags">
                <b>{T('Avisos según las reglas', 'Rules warnings')}:</b>
                <FlagList flags={validate(result.char)} />
                <p className="hint">{T('Podrás ignorarlos desde la ficha.', 'You can ignore them from the sheet.')}</p>
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="reminders">
                <b>{T('Revisa esto', 'Please check')}:</b>
                {result.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
          </div>
          {method === 'offline' && settings.apiKey && (
            <button className="btn full" disabled={translatingLong} onClick={() => void (async () => {
              setTranslatingLong(true);
              const ai = await import('../ai');
              try {
                const char = await ai.translateLongTexts(settings.apiKey, settings.model, result.char);
                setResult({ ...result, char });
              } catch (e) {
                setError(ai.describeError(e));
              } finally {
                setTranslatingLong(false);
              }
            })()}>🌐 {translatingLong ? T('Traduciendo…', 'Translating…') : T('Traducir también historia y textos largos (Claude)', 'Also translate backstory and long texts (Claude)')}</button>
          )}
          {error && <p className="error">⚠️ {error}</p>}
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
