import { useChar, useStore } from '../store';
import { CLASSES, DAMAGE_TYPES, classById, resourceName } from '../rules/srd';
import { levelUp, uid } from '../rules/factory';
import type { Character, DamageType } from '../types';
import { NumberInput, Section } from './common';
import { L, T } from '../i18n';

/** Opciones de la ficha que no caben en el diseño de papel: clase y nivel, CA base, defensas y recursos */
export function Editor({ onDone }: { onDone: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const replace = useStore((s) => s.replace);
  const set = (fn: (x: Character) => void) => update(fn);
  const cls = classById(c.classId || c.className);

  const toggleDef = (key: 'resistances' | 'immunities' | 'vulnerabilities', d: DamageType) =>
    set((x) => { x[key] = x[key].includes(d) ? x[key].filter((y) => y !== d) : [...x[key], d]; });

  return (
    <div className="tab">
      <div className="sheet-title">
        <h1>{T('Más opciones', 'More options')}</h1>
        <button className="btn primary" onClick={onDone}>✓ {T('Hecho', 'Done')}</button>
      </div>

      <Section title={T('Clase y nivel', 'Class and level')}>
        <label className="field">{T('Clase (para reglas automáticas)', 'Class (for automatic rules)')}
          <select value={cls?.id ?? ''} onChange={(e) => set((x) => {
            const k = CLASSES.find((y) => y.id === e.target.value);
            x.classId = k?.id ?? '';
            if (k) x.className = L(k.name);
          })}>
            <option value="">{T('Personalizada', 'Custom')}</option>
            {CLASSES.map((k) => <option key={k.id} value={k.id}>{L(k.name)}</option>)}
          </select>
        </label>
        <div className="row wrap mt">
          <span>{T('Nivel', 'Level')} <b>{c.level}</b></span>
          <button className="btn small" disabled={c.level <= 1} onClick={() => replace(levelUp(c, c.level - 1))}>− {T('Bajar', 'Down')}</button>
          <button className="btn small primary" disabled={c.level >= 20} onClick={() => replace(levelUp(c, c.level + 1))}>⬆️ {T('Subir de nivel', 'Level up')}</button>
        </div>
        <p className="hint">{T('Subir de nivel suma PG medios del dado de golpe + CON, y actualiza espacios de conjuro, recursos y rasgos de clase. Cambiar el número de nivel directamente en la hoja no recalcula nada.', 'Levelling up adds average hit die HP + CON, and updates spell slots, resources and class features. Changing the level number directly on the sheet doesn’t recalculate anything.')}</p>
      </Section>

      <Section title={T('Combate', 'Combat')}>
        <div className="grid3">
          <label className="field center">{T('CA base', 'Base AC')}<NumberInput value={c.baseAc} onChange={(n) => set((x) => { x.baseAc = n; })} /></label>
          <label className="field center">{T('Velocidad', 'Speed')}<NumberInput value={c.speed} onChange={(n) => set((x) => { x.speed = n; })} /></label>
          <label className="field center">{T('Dado de golpe', 'Hit die')}
            <select value={c.hitDie} onChange={(e) => set((x) => { x.hitDie = Number(e.target.value); })}>
              {[6, 8, 10, 12].map((d) => <option key={d} value={d}>d{d}</option>)}
            </select>
          </label>
        </div>
        <label className="field">{T('Nota de CA (armadura…)', 'AC note (armor…)')}<input value={c.acNote} onChange={(e) => set((x) => { x.acNote = e.target.value; })} /></label>
        <p className="hint">{T('La CA base no incluye el escudo: márcalo en la hoja y se suma +2.', 'Base AC doesn’t include a shield: tick it on the sheet and +2 is added.')}</p>
      </Section>

      <Section title={T('Defensas contra daño', 'Damage defenses')}>
        {(['resistances', 'immunities', 'vulnerabilities'] as const).map((key) => (
          <div key={key}>
            <h4>{{ resistances: T('Resistencias', 'Resistances'), immunities: T('Inmunidades', 'Immunities'), vulnerabilities: T('Vulnerabilidades', 'Vulnerabilities') }[key]}</h4>
            <div className="chips">
              {DAMAGE_TYPES.map((d) => (
                <button key={d.id} className={`chip toggle ${c[key].includes(d.id) ? 'on' : ''}`} onClick={() => toggleDef(key, d.id)}>{L(d.name)}</button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title={T('Recursos de clase', 'Class resources')} right={<button className="btn small" onClick={() => set((x) => { x.resources.push({ id: uid(), name: T('Nuevo recurso', 'New resource'), max: 1, used: 0, recovers: 'long' }); })}>+ {T('Añadir', 'Add')}</button>}>
        {c.resources.map((r) => (
          <div key={r.id} className="row wrap edit-row">
            <input className="grow" value={resourceName(r)} onChange={(e) => set((x) => { const y = x.resources.find((z) => z.id === r.id)!; y.name = e.target.value; delete y.key; })} />
            <NumberInput value={r.max} min={0} ariaLabel={T('Máximo', 'Maximum')} onChange={(n) => set((x) => { x.resources.find((y) => y.id === r.id)!.max = n; })} />
            <select value={r.recovers} onChange={(e) => set((x) => { x.resources.find((y) => y.id === r.id)!.recovers = e.target.value as 'short' | 'long'; })}>
              <option value="short">{T('Corto', 'Short')}</option>
              <option value="long">{T('Largo', 'Long')}</option>
            </select>
            <button className="icon-btn" aria-label={T('Borrar recurso', 'Delete resource')} onClick={() => set((x) => { x.resources = x.resources.filter((y) => y.id !== r.id); })}>🗑️</button>
          </div>
        ))}
      </Section>
      <button className="btn primary full" onClick={onDone}>✓ {T('Hecho', 'Done')}</button>
    </div>
  );
}
