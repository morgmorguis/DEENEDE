import { useChar, useStore } from '../store';
import { ABILITIES, CLASSES, DAMAGE_TYPES, MASTERIES, SKILLS, SPECIES, abilityShort } from '../rules/srd';
import { levelUp, uid } from '../rules/factory';
import { fmt, mod } from '../rules/calc';
import type { Ability, Character, DamageType, ProfLevel } from '../types';
import { NumberInput, Section } from './common';

export function Editor({ onDone }: { onDone: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const replace = useStore((s) => s.replace);
  const set = (fn: (x: Character) => void) => update(fn);

  const toggleDef = (key: 'resistances' | 'immunities' | 'vulnerabilities', d: DamageType) =>
    set((x) => { x[key] = x[key].includes(d) ? x[key].filter((y) => y !== d) : [...x[key], d]; });

  return (
    <div className="tab">
      <div className="sheet-title">
        <h1>Editar ficha</h1>
        <button className="btn primary" onClick={onDone}>✓ Hecho</button>
      </div>

      <Section title="Datos básicos">
        <label className="field">Nombre<input value={c.name} onChange={(e) => set((x) => { x.name = e.target.value; })} /></label>
        <div className="grid2">
          <label className="field">Especie
            <input list="species" value={c.species} onChange={(e) => set((x) => { x.species = e.target.value; })} />
            <datalist id="species">{SPECIES.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="field">Clase
            <select value={c.className} onChange={(e) => set((x) => { x.className = e.target.value; })}>
              {CLASSES.map((k) => <option key={k.id} value={k.name}>{k.name}</option>)}
              {!CLASSES.some((k) => k.name === c.className) && <option value={c.className}>{c.className}</option>}
            </select>
          </label>
          <label className="field">Subclase<input value={c.subclass} onChange={(e) => set((x) => { x.subclass = e.target.value; })} /></label>
          <label className="field">Trasfondo<input value={c.background} onChange={(e) => set((x) => { x.background = e.target.value; })} /></label>
        </div>
        <div className="row wrap mt">
          <span>Nivel <b>{c.level}</b></span>
          <button className="btn small" disabled={c.level <= 1} onClick={() => replace(levelUp(c, c.level - 1))}>− Bajar</button>
          <button className="btn small primary" disabled={c.level >= 20} onClick={() => replace(levelUp(c, c.level + 1))}>⬆️ Subir de nivel</button>
        </div>
        <p className="hint">Subir de nivel suma PG medios del dado de golpe + CON, y actualiza espacios de conjuro, recursos y rasgos de clase.</p>
      </Section>

      <Section title="Características">
        <div className="grid3">
          {ABILITIES.map((a) => (
            <label key={a.id} className="field center">
              {a.short} <span className="muted">({fmt(mod(c.abilities[a.id]))})</span>
              <NumberInput value={c.abilities[a.id]} min={1} max={30} onChange={(n) => set((x) => { x.abilities[a.id] = n; })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Combate">
        <div className="grid3">
          <label className="field center">CA base<NumberInput value={c.baseAc} onChange={(n) => set((x) => { x.baseAc = n; })} /></label>
          <label className="field center">Velocidad<NumberInput value={c.speed} onChange={(n) => set((x) => { x.speed = n; })} /></label>
          <label className="field center">PG máx.<NumberInput value={c.hp.max} min={1} onChange={(n) => set((x) => { x.hp.max = n; x.hp.current = Math.min(x.hp.current, n); })} /></label>
          <label className="field center">PG actuales<NumberInput value={c.hp.current} min={0} onChange={(n) => set((x) => { x.hp.current = Math.max(0, n); })} /></label>
          <label className="field center">Dado de golpe
            <select value={c.hitDie} onChange={(e) => set((x) => { x.hitDie = Number(e.target.value); })}>
              {[6, 8, 10, 12].map((d) => <option key={d} value={d}>d{d}</option>)}
            </select>
          </label>
          <label className="field center">Lanzamiento
            <select value={c.spellAbility ?? ''} onChange={(e) => set((x) => { x.spellAbility = (e.target.value || null) as Ability | null; })}>
              <option value="">—</option>
              {ABILITIES.map((a) => <option key={a.id} value={a.id}>{a.short}</option>)}
            </select>
          </label>
        </div>
        <label className="field">Nota de CA (armadura, escudo…)<input value={c.acNote} onChange={(e) => set((x) => { x.acNote = e.target.value; })} /></label>
      </Section>

      <Section title="Competencias">
        <h4>Salvaciones</h4>
        <div className="row wrap">
          {ABILITIES.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={c.saveProf.includes(a.id)} onChange={() => set((x) => { x.saveProf = x.saveProf.includes(a.id) ? x.saveProf.filter((y) => y !== a.id) : [...x.saveProf, a.id]; })} />
              {a.short}
            </label>
          ))}
        </div>
        <h4>Habilidades <span className="hint">(toca: nada → competente → pericia)</span></h4>
        <div className="skills">
          {SKILLS.map((s) => {
            const p = c.skillProf[s.id] ?? 0;
            return (
              <button key={s.id} className="line-btn" onClick={() => set((x) => { x.skillProf[s.id] = ((p + 1) % 3) as ProfLevel; })}>
                <span className={`dot ${p === 2 ? 'exp' : p === 1 ? 'on' : ''}`} />
                <span className="grow">{s.name} ({abilityShort(s.ability)})</span>
                <span className="muted small">{p === 2 ? 'Pericia' : p === 1 ? 'Competente' : ''}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Defensas contra daño">
        {(['resistances', 'immunities', 'vulnerabilities'] as const).map((key) => (
          <div key={key}>
            <h4>{key === 'resistances' ? 'Resistencias' : key === 'immunities' ? 'Inmunidades' : 'Vulnerabilidades'}</h4>
            <div className="chips">
              {DAMAGE_TYPES.map((d) => (
                <button key={d.id} className={`chip toggle ${c[key].includes(d.id) ? 'on' : ''}`} onClick={() => toggleDef(key, d.id)}>{d.name}</button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Ataques" right={<button className="btn small" onClick={() => set((x) => { x.attacks.push({ id: uid(), name: 'Nuevo ataque', ability: 'str', proficient: true, damage: '1d8', damageType: 'cortante', range: '5 pies', extraBonus: 0 }); })}>+ Añadir</button>}>
        {c.attacks.map((a) => (
          <div key={a.id} className="edit-block">
            <div className="row">
              <input className="grow" value={a.name} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.name = e.target.value; })} />
              <button className="icon-btn" aria-label="Borrar ataque" onClick={() => set((x) => { x.attacks = x.attacks.filter((y) => y.id !== a.id); })}>🗑️</button>
            </div>
            <div className="grid3">
              <label className="field">Caract.
                <select value={a.ability} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.ability = e.target.value as Ability; })}>
                  {ABILITIES.map((ab) => <option key={ab.id} value={ab.id}>{ab.short}</option>)}
                </select>
              </label>
              <label className="field">Daño<input value={a.damage} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.damage = e.target.value; })} /></label>
              <label className="field">Tipo
                <select value={a.damageType} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.damageType = e.target.value as DamageType; })}>
                  {DAMAGE_TYPES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="field">Alcance<input value={a.range} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.range = e.target.value; })} /></label>
              <label className="field">Bonus extra<NumberInput value={a.extraBonus} onChange={(n) => set((x) => { x.attacks.find((y) => y.id === a.id)!.extraBonus = n; })} /></label>
              <label className="field">Maestría
                <select value={a.mastery ?? ''} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.mastery = e.target.value || undefined; })}>
                  <option value="">—</option>
                  {MASTERIES.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={a.proficient} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.proficient = e.target.checked; })} /> Competente</label>
            <input placeholder="Notas" value={a.notes ?? ''} onChange={(e) => set((x) => { x.attacks.find((y) => y.id === a.id)!.notes = e.target.value; })} />
          </div>
        ))}
      </Section>

      <Section title="Conjuros conocidos" right={<button className="btn small" onClick={() => set((x) => { x.spells.push({ id: uid(), name: 'Nuevo conjuro', level: 1, prepared: true, castingTime: 'Acción', range: '60 pies', concentration: false }); })}>+ Añadir</button>}>
        {c.spells.map((s) => (
          <div key={s.id} className="edit-block">
            <div className="row">
              <input className="grow" value={s.name} onChange={(e) => set((x) => { x.spells.find((y) => y.id === s.id)!.name = e.target.value; })} />
              <button className="icon-btn" aria-label="Borrar conjuro" onClick={() => set((x) => { x.spells = x.spells.filter((y) => y.id !== s.id); })}>🗑️</button>
            </div>
            <div className="grid3">
              <label className="field">Nivel (0 = truco)<NumberInput value={s.level} min={0} max={9} onChange={(n) => set((x) => { x.spells.find((y) => y.id === s.id)!.level = n; })} /></label>
              <label className="field">Tiempo<input value={s.castingTime} onChange={(e) => set((x) => { x.spells.find((y) => y.id === s.id)!.castingTime = e.target.value; })} /></label>
              <label className="field">Alcance<input value={s.range} onChange={(e) => set((x) => { x.spells.find((y) => y.id === s.id)!.range = e.target.value; })} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={s.concentration} onChange={(e) => set((x) => { x.spells.find((y) => y.id === s.id)!.concentration = e.target.checked; })} /> Concentración</label>
            <textarea placeholder="Qué hace" value={s.notes ?? ''} onChange={(e) => set((x) => { x.spells.find((y) => y.id === s.id)!.notes = e.target.value; })} />
          </div>
        ))}
        <h4>Espacios de conjuro (máximo por nivel)</h4>
        <div className="grid3">
          {Array.from({ length: 9 }, (_, i) => (
            <label key={i} className="field center">Nv {i + 1}
              <NumberInput value={c.slots[i]?.max ?? 0} min={0} max={4} onChange={(n) => set((x) => {
                while (x.slots.length <= i) x.slots.push({ max: 0, used: 0 });
                x.slots[i].max = n;
                x.slots[i].used = Math.min(x.slots[i].used, n);
              })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Recursos de clase" right={<button className="btn small" onClick={() => set((x) => { x.resources.push({ id: uid(), name: 'Nuevo recurso', max: 1, used: 0, recovers: 'long' }); })}>+ Añadir</button>}>
        {c.resources.map((r) => (
          <div key={r.id} className="row wrap edit-row">
            <input className="grow" value={r.name} onChange={(e) => set((x) => { x.resources.find((y) => y.id === r.id)!.name = e.target.value; })} />
            <NumberInput value={r.max} min={0} onChange={(n) => set((x) => { x.resources.find((y) => y.id === r.id)!.max = n; })} />
            <select value={r.recovers} onChange={(e) => set((x) => { x.resources.find((y) => y.id === r.id)!.recovers = e.target.value as 'short' | 'long'; })}>
              <option value="short">Corto</option>
              <option value="long">Largo</option>
            </select>
            <button className="icon-btn" aria-label="Borrar recurso" onClick={() => set((x) => { x.resources = x.resources.filter((y) => y.id !== r.id); })}>🗑️</button>
          </div>
        ))}
      </Section>

      <Section title="Rasgos" right={<button className="btn small" onClick={() => set((x) => { x.features.push({ id: uid(), name: 'Nuevo rasgo', text: '' }); })}>+ Añadir</button>}>
        {c.features.map((f) => (
          <div key={f.id} className="edit-block">
            <div className="row">
              <input className="grow" value={f.name} onChange={(e) => set((x) => { x.features.find((y) => y.id === f.id)!.name = e.target.value; })} />
              <button className="icon-btn" aria-label="Borrar rasgo" onClick={() => set((x) => { x.features = x.features.filter((y) => y.id !== f.id); })}>🗑️</button>
            </div>
            <textarea value={f.text} onChange={(e) => set((x) => { x.features.find((y) => y.id === f.id)!.text = e.target.value; })} />
          </div>
        ))}
      </Section>
      <button className="btn primary full" onClick={onDone}>✓ Hecho</button>
    </div>
  );
}
