import { useState } from 'react';
import { useStore, type Theme } from '../store';
import { createCharacter, normalizeCharacter, uid } from '../rules/factory';
import { ABILITIES, CLASSES, SKILLS, SPECIES, classById } from '../rules/srd';
import { fmt, mod } from '../rules/calc';
import type { Ability, Character } from '../types';
import { Modal, NumberInput, Section } from './common';
import { ImportModal } from './Import';
import { DEFAULT_MODEL } from '../config';
import { L, T, getLang } from '../i18n';
import { translateCharacter } from '../rules/glossary';

export function SettingsTab() {
  const characters = useStore((s) => s.characters);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const remove = useStore((s) => s.removeCharacter);
  const add = useStore((s) => s.addCharacter);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [io, setIo] = useState<'export' | 'import' | null>(null);
  const [ioText, setIoText] = useState('');
  const [ioError, setIoError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const replace = useStore((s) => s.replace);
  const [translating, setTranslating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = characters.find((c) => c.id === activeId)!;

  return (
    <div className="tab">
      <Section title={T('Idioma', 'Language')}>
        <div className="segmented" role="radiogroup" aria-label={T('Idioma', 'Language')}>
          <button role="radio" aria-checked={settings.lang === 'es'} className={settings.lang === 'es' ? 'on' : ''} onClick={() => setSettings({ lang: 'es' })}>🇪🇸 Español</button>
          <button role="radio" aria-checked={settings.lang === 'en'} className={settings.lang === 'en' ? 'on' : ''} onClick={() => setSettings({ lang: 'en' })}>🇬🇧 English</button>
        </div>
        <p className="hint">{T('Cambia toda la app: interfaz, reglas, avisos y el asistente. Las notas no se traducen; la ficha, con el botón de abajo.', 'Changes the whole app: interface, rules, messages and the assistant. Notes aren’t translated; the sheet can be, with the button below.')}</p>
        <button className="btn" disabled={busy} onClick={() => void (async () => {
          setTranslating(null);
          let next = translateCharacter(active, getLang());
          if (settings.apiKey) {
            setBusy(true);
            setTranslating(T('Traduciendo textos largos con Claude…', 'Translating long texts with Claude…'));
            try {
              const { translateLongTexts } = await import('../ai');
              next = await translateLongTexts(settings.apiKey, settings.model, next);
              setTranslating(null);
            } catch (e) {
              const { describeError } = await import('../ai');
              setTranslating(`⚠️ ${describeError(e)}`);
            }
            setBusy(false);
          }
          replace(next);
          if (!settings.apiKey) setTranslating(T('Términos traducidos. La historia y los textos largos solo se traducen con Claude.', 'Terms translated. The backstory and long texts are only translated with Claude.'));
        })()}>🌐 {T(`Traducir la ficha de ${active.name} al español`, `Translate ${active.name}’s sheet into English`)}</button>
        {translating && <p className="hint">{translating}</p>}
      </Section>

      <Section title={T('Colores', 'Colors')}>
        <div className="themes" role="radiogroup" aria-label={T('Colores', 'Colors')}>
          {THEMES.map((th) => (
            <button key={th.id} role="radio" aria-checked={settings.theme === th.id} className={`theme-opt ${settings.theme === th.id ? 'on' : ''}`} onClick={() => setSettings({ theme: th.id })}>
              <span className="theme-swatch">{th.colors.map((col) => <span key={col} style={{ background: col }} />)}</span>
              {settings.theme === th.id ? '✓ ' : ''}{L(th.name)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={T('Hoja de personaje', 'Character sheet')}>
        <label className="switch-row">
          <span className="grow">
            <b>{T('Tirar dados al tocar una estadística', 'Roll dice when tapping a stat')}</b>
            <span className="hint block">{T('Desactivado: al tocar una característica, salvación o habilidad se muestra qué hace y qué te afecta, sin tirar.', 'Off: tapping an ability, save or skill shows what it does and what affects you, without rolling.')}</span>
          </span>
          <input type="checkbox" className="switch" checked={settings.tapToRoll} onChange={(e) => setSettings({ tapToRoll: e.target.checked })} />
        </label>
        <p className="hint">💬 {T('Mantén pulsada 1,5 s una habilidad, salvación, arma, conjuro, rasgo, recurso o condición para ver qué hace y qué te limita ahora mismo.', 'Press and hold a skill, save, weapon, spell, feature, resource or condition for 1.5 s to see what it does and what limits it right now.')}</p>
      </Section>

      <Section title={T('Personajes', 'Characters')} right={<button className="btn small primary" onClick={() => setCreating(true)}>+ {T('Nuevo', 'New')}</button>}>
        {characters.map((c) => (
          <div key={c.id} className={`char-line ${c.id === activeId ? 'active' : ''}`}>
            {c.portrait ? <img className="char-thumb" src={c.portrait} alt="" /> : <span className="char-thumb empty">🧙</span>}
            <button className="grow link-left" onClick={() => setActive(c.id)}>
              <b>{c.name}</b> <span className="muted small">{c.species} {classById(c.classId) ? L(classById(c.classId)!.name) : c.className} {c.level}</span>
            </button>
            <button className="icon-btn" aria-label={T(`Borrar ${c.name}`, `Delete ${c.name}`)} onClick={() => { if (confirm(T(`¿Borrar a ${c.name}? No se puede deshacer.`, `Delete ${c.name}? This can’t be undone.`))) remove(c.id); }}>🗑️</button>
          </div>
        ))}
        <button className="btn full mt" onClick={() => setImporting(true)}>📥 {T('Importar desde foto, PDF o Word', 'Import from photo, PDF or Word')}</button>
        <div className="row mt">
          <button className="btn grow" onClick={() => { setIo('export'); setIoText(JSON.stringify(active, null, 1)); }}>{T('Exportar ficha', 'Export sheet')}</button>
          <button className="btn grow" onClick={() => { setIo('import'); setIoText(''); setIoError(''); }}>{T('Importar copia', 'Import copy')}</button>
        </div>
      </Section>

      <Section title={T('Inteligencia artificial (opcional)', 'Artificial intelligence (optional)')}>
        <p className="small">{T('Con una clave de API de Claude, el asistente entiende frases libres, el diario convierte tus grabaciones en una crónica y puedes importar fichas desde fotos y documentos. Sin clave, todo lo demás funciona sin conexión.', 'With a Claude API key, the assistant understands free phrasing, the journal turns your recordings into a chronicle, and you can import sheets from photos and documents. Without a key everything else works offline.')}</p>
        <label className="field">{T('Clave de API de Anthropic', 'Anthropic API key')}
          <div className="row">
            <input className="grow" type={showKey ? 'text' : 'password'} value={settings.apiKey} placeholder="sk-ant-…" autoComplete="off" onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} />
            <button className="btn small" onClick={() => setShowKey(!showKey)}>{showKey ? T('Ocultar', 'Hide') : T('Ver', 'Show')}</button>
          </div>
        </label>
        <p className="hint">{T('La clave se guarda solo en este dispositivo y se envía únicamente a api.anthropic.com. Consíguela en console.anthropic.com.', 'The key is stored only on this device and sent only to api.anthropic.com. Get one at console.anthropic.com.')}</p>
        <label className="field">{T('Modelo', 'Model')}
          <input value={settings.model} onChange={(e) => setSettings({ model: e.target.value.trim() || DEFAULT_MODEL })} />
        </label>
        <label className="check"><input type="checkbox" checked={settings.useAiFallback} onChange={(e) => setSettings({ useAiFallback: e.target.checked })} /> {T('Usar Claude cuando el intérprete local no entienda una frase', 'Use Claude when the local interpreter doesn’t understand a phrase')}</label>
      </Section>

      <Section title={T('Voz', 'Voice')}>
        <label className="field">{T('Idioma del reconocimiento de voz', 'Speech recognition language')}
          <select value={settings.speechLang} onChange={(e) => setSettings({ speechLang: e.target.value })}>
            <option value="auto">{T('Igual que la app', 'Same as the app')}</option>
            <option value="es-ES">Español (España)</option>
            <option value="es-MX">Español (México)</option>
            <option value="es-AR">Español (Argentina)</option>
            <option value="ca-ES">Català</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </label>
      </Section>

      <Section title={T('Acerca de', 'About')}>
        <p className="small">{T('Compañero de D&D 5e (reglas 2024). Los textos de reglas se basan en el System Reference Document 5.2 de Wizards of the Coast LLC, disponible bajo licencia Creative Commons Attribution 4.0 International. Esta app no está afiliada ni respaldada por Wizards of the Coast.', 'D&D 5e companion (2024 rules). Rules text is based on the System Reference Document 5.2 by Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0 International license. This app is not affiliated with or endorsed by Wizards of the Coast.')}</p>
      </Section>

      {creating && <NewCharacter onClose={() => setCreating(false)} onCreate={(c) => { add(c); setCreating(false); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {io && (
        <Modal title={io === 'export' ? T('Exportar ficha', 'Export sheet') : T('Importar copia', 'Import copy')} onClose={() => setIo(null)}>
          {io === 'export' ? (
            <>
              <p className="small">{T('Copia este texto y guárdalo donde quieras (o pásalo a otro móvil).', 'Copy this text and keep it wherever you like (or move it to another phone).')}</p>
              <textarea className="tall mono" readOnly value={ioText} />
              <button className="btn primary full" onClick={() => void navigator.clipboard?.writeText(ioText)}>{T('Copiar', 'Copy')}</button>
            </>
          ) : (
            <>
              <p className="small">{T('Pega aquí el texto de una ficha exportada.', 'Paste the text of an exported sheet here.')}</p>
              <textarea className="tall mono" value={ioText} onChange={(e) => setIoText(e.target.value)} />
              {ioError && <p className="error">{ioError}</p>}
              <button className="btn primary full" onClick={() => {
                try {
                  const c = JSON.parse(ioText) as Character;
                  if (!c.name || !c.abilities || !c.hp) throw new Error(T('No parece una ficha válida.', 'This doesn’t look like a valid sheet.'));
                  add(normalizeCharacter({ ...c, id: uid() } as never));
                  setIo(null);
                } catch (e) {
                  setIoError(e instanceof Error ? e.message : T('Texto no válido', 'Invalid text'));
                }
              }}>{T('Importar', 'Import')}</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const THEMES: { id: Theme; name: { es: string; en: string }; colors: string[] }[] = [
  { id: 'basic', name: { es: 'Básico', en: 'Basic' }, colors: ['#15110f', '#d4a14a', '#efe2c4'] },
  { id: 'green', name: { es: 'Verdoso', en: 'Green' }, colors: ['#0e1611', '#79bf6f', '#e2ecdb'] },
  { id: 'gray', name: { es: 'Grises', en: 'Grayscale' }, colors: ['#121212', '#d0d0d0', '#e6e6e6'] },
  { id: 'blue', name: { es: 'Azules', en: 'Blue' }, colors: ['#0c1320', '#5d9df0', '#dfe8f4'] },
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function NewCharacter({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Character) => void }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState(L(SPECIES[6]));
  const [classId, setClassId] = useState('guerrero');
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [abilities, setAbilities] = useState<Record<Ability, number>>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [skills, setSkills] = useState<string[]>([]);

  const applyStandard = () => {
    // Reparte el array estándar priorizando las salvaciones de la clase y después CON y DES
    const cls = CLASSES.find((c) => c.id === classId)!;
    const order = [...cls.saves, 'con', 'dex', 'wis', 'str', 'cha', 'int'].filter((a, i, arr) => arr.indexOf(a) === i) as Ability[];
    const next = { ...abilities };
    order.forEach((a, i) => { next[a] = STANDARD_ARRAY[i]; });
    setAbilities(next);
  };

  return (
    <Modal title={T('Nuevo personaje', 'New character')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field">{T('Especie', 'Species')}
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>{SPECIES.map((s) => <option key={s.es}>{L(s)}</option>)}</select>
        </label>
        <label className="field">{T('Clase', 'Class')}
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>{CLASSES.map((c) => <option key={c.id} value={c.id}>{L(c.name)}</option>)}</select>
        </label>
        <label className="field">{T('Nivel', 'Level')}<NumberInput value={level} min={1} max={20} onChange={(n) => setLevel(Math.max(1, Math.min(20, n)))} /></label>
        <label className="field">{T('Trasfondo', 'Background')}<input value={background} onChange={(e) => setBackground(e.target.value)} placeholder={T('Soldado, Sabio…', 'Soldier, Sage…')} /></label>
      </div>
      <div className="row"><h4 className="grow">{T('Características', 'Ability scores')}</h4><button className="btn small" onClick={applyStandard}>{T('Array estándar', 'Standard array')}</button></div>
      <p className="hint">{T('Recuerda sumar los aumentos de tu trasfondo (+2/+1 o +1/+1/+1).', 'Remember to add your background increases (+2/+1 or +1/+1/+1).')}</p>
      <div className="grid3">
        {ABILITIES.map((a) => (
          <label key={a.id} className="field center">{L(a.short)} <span className="muted">({fmt(mod(abilities[a.id]))})</span>
            <NumberInput value={abilities[a.id]} min={1} max={20} onChange={(n) => setAbilities({ ...abilities, [a.id]: n })} />
          </label>
        ))}
      </div>
      <h4>{T('Habilidades con competencia', 'Skill proficiencies')}</h4>
      <div className="chips">
        {SKILLS.map((s) => (
          <button key={s.id} className={`chip toggle ${skills.includes(s.id) ? 'on' : ''}`} onClick={() => setSkills(skills.includes(s.id) ? skills.filter((x) => x !== s.id) : [...skills, s.id])}>{L(s.name)}</button>
        ))}
      </div>
      <button className="btn primary full mt" onClick={() => onCreate(createCharacter({ name, species, classId, level, background, abilities, skills }))}>{T('Crear personaje', 'Create character')}</button>
      <p className="hint">{T('Se calculan automáticamente PG, salvaciones, dado de golpe, espacios de conjuro y recursos de clase. Después completa armas, conjuros y equipo en la hoja.', 'HP, saves, hit die, spell slots and class resources are calculated automatically. Then fill in weapons, spells and equipment on the sheet.')}</p>
    </Modal>
  );
}
