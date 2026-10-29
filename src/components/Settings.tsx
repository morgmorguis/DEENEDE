import { useState } from 'react';
import { useStore } from '../store';
import { createCharacter, uid } from '../rules/factory';
import { ABILITIES, CLASSES, SKILLS, SPECIES } from '../rules/srd';
import { fmt, mod } from '../rules/calc';
import type { Ability, Character } from '../types';
import { Modal, NumberInput, Section } from './common';
import { DEFAULT_MODEL } from '../config';

export function SettingsTab() {
  const characters = useStore((s) => s.characters);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const remove = useStore((s) => s.removeCharacter);
  const add = useStore((s) => s.addCharacter);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [creating, setCreating] = useState(false);
  const [io, setIo] = useState<'export' | 'import' | null>(null);
  const [ioText, setIoText] = useState('');
  const [ioError, setIoError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const active = characters.find((c) => c.id === activeId)!;

  return (
    <div className="tab">
      <Section title="Personajes" right={<button className="btn small primary" onClick={() => setCreating(true)}>+ Nuevo</button>}>
        {characters.map((c) => (
          <div key={c.id} className={`char-line ${c.id === activeId ? 'active' : ''}`}>
            <button className="grow link-left" onClick={() => setActive(c.id)}>
              <b>{c.name}</b> <span className="muted small">{c.species} {c.className} {c.level}</span>
            </button>
            <button className="icon-btn" aria-label={`Borrar ${c.name}`} onClick={() => { if (confirm(`¿Borrar a ${c.name}? No se puede deshacer.`)) remove(c.id); }}>🗑️</button>
          </div>
        ))}
        <div className="row mt">
          <button className="btn grow" onClick={() => { setIo('export'); setIoText(JSON.stringify(active, null, 1)); }}>Exportar ficha</button>
          <button className="btn grow" onClick={() => { setIo('import'); setIoText(''); setIoError(''); }}>Importar ficha</button>
        </div>
      </Section>

      <Section title="Inteligencia artificial (opcional)">
        <p className="small">Con una clave de API de Claude, el asistente entiende frases libres y el bloc de notas convierte tus grabaciones en una crónica escrita. Sin clave, todo lo demás funciona sin conexión.</p>
        <label className="field">Clave de API de Anthropic
          <div className="row">
            <input className="grow" type={showKey ? 'text' : 'password'} value={settings.apiKey} placeholder="sk-ant-…" autoComplete="off" onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} />
            <button className="btn small" onClick={() => setShowKey(!showKey)}>{showKey ? 'Ocultar' : 'Ver'}</button>
          </div>
        </label>
        <p className="hint">La clave se guarda solo en este dispositivo y se envía únicamente a api.anthropic.com. Consíguela en console.anthropic.com.</p>
        <label className="field">Modelo
          <input value={settings.model} onChange={(e) => setSettings({ model: e.target.value.trim() || DEFAULT_MODEL })} />
        </label>
        <label className="check"><input type="checkbox" checked={settings.useAiFallback} onChange={(e) => setSettings({ useAiFallback: e.target.checked })} /> Usar Claude cuando el intérprete local no entienda una frase</label>
      </Section>

      <Section title="Voz">
        <label className="field">Idioma del reconocimiento de voz
          <select value={settings.speechLang} onChange={(e) => setSettings({ speechLang: e.target.value })}>
            <option value="es-ES">Español (España)</option>
            <option value="es-MX">Español (México)</option>
            <option value="es-AR">Español (Argentina)</option>
            <option value="ca-ES">Català</option>
            <option value="en-US">English (US)</option>
          </select>
        </label>
      </Section>

      <Section title="Acerca de">
        <p className="small">Compañero de D&D 5e (reglas 2024). Los textos de reglas se basan en el System Reference Document 5.2 de Wizards of the Coast LLC, disponible bajo licencia Creative Commons Attribution 4.0 International. Esta app no está afiliada ni respaldada por Wizards of the Coast.</p>
      </Section>

      {creating && <NewCharacter onClose={() => setCreating(false)} onCreate={(c) => { add(c); setCreating(false); }} />}
      {io && (
        <Modal title={io === 'export' ? 'Exportar ficha' : 'Importar ficha'} onClose={() => setIo(null)}>
          {io === 'export' ? (
            <>
              <p className="small">Copia este texto y guárdalo donde quieras (o pásalo a otro móvil).</p>
              <textarea className="tall mono" readOnly value={ioText} />
              <button className="btn primary full" onClick={() => void navigator.clipboard?.writeText(ioText)}>Copiar</button>
            </>
          ) : (
            <>
              <p className="small">Pega aquí el texto de una ficha exportada.</p>
              <textarea className="tall mono" value={ioText} onChange={(e) => setIoText(e.target.value)} />
              {ioError && <p className="error">{ioError}</p>}
              <button className="btn primary full" onClick={() => {
                try {
                  const c = JSON.parse(ioText) as Character;
                  if (!c.name || !c.abilities || !c.hp) throw new Error('No parece una ficha válida.');
                  add({ ...c, id: uid() });
                  setIo(null);
                } catch (e) {
                  setIoError(e instanceof Error ? e.message : 'Texto no válido');
                }
              }}>Importar</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function NewCharacter({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Character) => void }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Humano');
  const [classId, setClassId] = useState('guerrero');
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [abilities, setAbilities] = useState<Record<Ability, number>>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [skills, setSkills] = useState<string[]>([]);

  const applyStandard = () => {
    // Reparte el array estándar priorizando las salvaciones de la clase y después CON y DES
    const cls = CLASSES.find((c) => c.id === classId)!;
    const order: Ability[] = [...cls.saves, 'con', 'dex', 'wis', 'str', 'cha', 'int'].filter((a, i, arr) => arr.indexOf(a) === i) as Ability[];
    const next = { ...abilities };
    order.forEach((a, i) => { next[a] = STANDARD_ARRAY[i]; });
    setAbilities(next);
  };

  return (
    <Modal title="Nuevo personaje" onClose={onClose}>
      <label className="field">Nombre<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field">Especie
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>{SPECIES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="field">Clase
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>{CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="field">Nivel<NumberInput value={level} min={1} max={20} onChange={(n) => setLevel(Math.max(1, Math.min(20, n)))} /></label>
        <label className="field">Trasfondo<input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="Soldado, Sabio…" /></label>
      </div>
      <div className="row"><h4 className="grow">Características</h4><button className="btn small" onClick={applyStandard}>Array estándar</button></div>
      <p className="hint">Recuerda sumar los aumentos de tu trasfondo (+2/+1 o +1/+1/+1).</p>
      <div className="grid3">
        {ABILITIES.map((a) => (
          <label key={a.id} className="field center">{a.short} <span className="muted">({fmt(mod(abilities[a.id]))})</span>
            <NumberInput value={abilities[a.id]} min={1} max={20} onChange={(n) => setAbilities({ ...abilities, [a.id]: n })} />
          </label>
        ))}
      </div>
      <h4>Habilidades con competencia</h4>
      <div className="chips">
        {SKILLS.map((s) => (
          <button key={s.id} className={`chip toggle ${skills.includes(s.id) ? 'on' : ''}`} onClick={() => setSkills(skills.includes(s.id) ? skills.filter((x) => x !== s.id) : [...skills, s.id])}>{s.name}</button>
        ))}
      </div>
      <button className="btn primary full mt" onClick={() => onCreate(createCharacter({ name, species, classId, level, background, abilities, skills }))}>Crear personaje</button>
      <p className="hint">Se calculan automáticamente PG, salvaciones, dado de golpe, espacios de conjuro y recursos de clase. Después añade armas, conjuros y armadura en Hoja → Editar.</p>
    </Modal>
  );
}
