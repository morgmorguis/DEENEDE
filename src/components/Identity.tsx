// Cabecera de la hoja: selectores de clase, subclase (según la clase), multiclase, especie y linaje.
import { useState } from 'react';
import { useChar, useStore } from '../store';
import { CLASSES, RESOURCE_NAMES } from '../rules/srd';
import { SUBCLASSES, CLASS_PROFS } from '../rules/progression';
import { SPECIES_INFO, applySpecies, findSpecies } from '../rules/species';
import { pruneForClass, pruneSummary, removedBetween } from '../rules/classFit';
import { applyClass, classLevels, meetsReq, reqText, spellSlotsFor } from '../rules/multiclass';
import { BACKGROUNDS, findBackground } from '../rules/origins';
import type { Character } from '../types';
import { Modal } from './common';
import { L, T } from '../i18n';
import { askOk } from './Confirm';

const CUSTOM = '__custom';

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="p-field p-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      <span>{label}</span>
    </label>
  );
}

const classProfs = (id: string) => {
  const p = CLASS_PROFS[id];
  return p ? { armor: p.armor, weapons: L(p.weapons), tools: p.tools ? L(p.tools.name) : undefined } : undefined;
};
const withClass = (c: Character, id: string) => applyClass(c, id, L, (k) => L(RESOURCE_NAMES[k]), classProfs(id));

export function ClassField() {
  const c = useChar();
  const replace = useStore((s) => s.replace);
  const update = useStore((s) => s.update);
  const [custom, setCustom] = useState(!c.classId && !!c.className);
  const [multi, setMulti] = useState(false);
  const extra = classLevels(c).filter((e) => !e.primary);
  const value = custom ? CUSTOM : c.classId;
  const change = async (v: string) => {
    if (v === CUSTOM) { setCustom(true); update((x) => { x.classId = ''; }); return; }
    setCustom(false);
    if (!v) return;
    if (c.classId && c.classId !== v && !(await askOk(T('¿Cambiar de clase? Se pondrán su dado de golpe, salvaciones, competencias, recursos, espacios y rasgos, y se quitarán los rasgos y conjuros de la clase anterior que ya no puedas tener (lo que escribiste a mano y la app no reconoce se conserva).', 'Change class? Its hit die, saves, proficiencies, resources, slots and features will be applied, and features and spells of the old class you can no longer have will be removed (custom entries the app doesn’t recognise are kept).')))) return;
    const r = pruneForClass(withClass(c, v));
    replace(r.next);
    const lines = pruneSummary(removedBetween(c, r.next));
    if (lines.length) useStore.getState().showToast(T('Clase cambiada', 'Class changed'), lines);
  };
  return (
    <div className="p-class">
      <SelectField label={extra.length ? T('Clase principal', 'Main class') : T('Clase', 'Class')} value={value} onChange={change}>
        <option value="">—</option>
        {CLASSES.map((x) => <option key={x.id} value={x.id}>{L(x.name)}</option>)}
        <option value={CUSTOM}>{T('Otra (escribir)…', 'Other (type)…')}</option>
      </SelectField>
      {custom && <input className="p-inline" value={c.className} placeholder={T('Nombre de la clase', 'Class name')} onChange={(e) => update((x) => { x.className = e.target.value; })} />}
      <div className="p-multi">
        {extra.map((e) => <span key={e.cls.id} className="p-multi-chip">＋ {L(e.cls.name)} {e.level}{e.subclass ? ` · ${e.subclass}` : ''}</span>)}
        {c.classId && <button className="p-link" onClick={() => setMulti(true)}>{extra.length ? T('Editar multiclase', 'Edit multiclass') : T('＋ Multiclase', '＋ Multiclass')}</button>}
      </div>
      {multi && <MulticlassModal onClose={() => setMulti(false)} />}
    </div>
  );
}

export function SubclassField() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const options = SUBCLASSES[c.classId] ?? [];
  const known = options.find((o) => [o.name.es, o.name.en].includes(c.subclass));
  const [custom, setCustom] = useState(!!c.subclass && !known);
  if (!options.length) {
    return (
      <label className="p-field">
        <input value={c.subclass} onChange={(e) => update((x) => { x.subclass = e.target.value; })} />
        <span>{T('Subclase', 'Subclass')}</span>
      </label>
    );
  }
  return (
    <div>
      <SelectField label={T('Subclase', 'Subclass')} value={custom ? CUSTOM : known?.id ?? ''} onChange={(v) => {
        if (v === CUSTOM) { setCustom(true); return; }
        setCustom(false);
        const o = options.find((x) => x.id === v);
        update((x) => { x.subclass = o ? L(o.name) : ''; });
      }}>
        <option value="">{c.level < 3 ? T('— (se elige a nivel 3)', '— (chosen at level 3)') : '—'}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{L(o.name)}</option>)}
        <option value={CUSTOM}>{T('Otra (escribir)…', 'Other (type)…')}</option>
      </SelectField>
      {custom && <input className="p-inline" value={c.subclass} placeholder={T('Nombre de la subclase', 'Subclass name')} onChange={(e) => update((x) => { x.subclass = e.target.value; })} />}
    </div>
  );
}

export function SpeciesField() {
  const c = useChar();
  const replace = useStore((s) => s.replace);
  const update = useStore((s) => s.update);
  const found = findSpecies(c.species);
  const sp = SPECIES_INFO.find((x) => x.id === (c.lineage ? found.species?.id : found.species?.id));
  const lineage = sp?.lineages?.find((l) => l.id === c.lineage) ?? found.lineage;
  const [custom, setCustom] = useState(!!c.species && !sp);
  const choose = (speciesId: string, lineageId?: string) => {
    const next = applySpecies(c, speciesId, lineageId);
    next.lineage = lineageId;
    replace(next);
  };
  return (
    <div className="p-species">
      <SelectField label={T('Especie', 'Species')} value={custom ? CUSTOM : sp?.id ?? ''} onChange={(v) => {
        if (v === CUSTOM) { setCustom(true); return; }
        setCustom(false);
        if (v) choose(v);
      }}>
        <option value="">—</option>
        {SPECIES_INFO.map((x) => <option key={x.id} value={x.id}>{L(x.name)}</option>)}
        <option value={CUSTOM}>{T('Otra (escribir)…', 'Other (type)…')}</option>
      </SelectField>
      {custom && <input className="p-inline" value={c.species} placeholder={T('Especie', 'Species')} onChange={(e) => update((x) => { x.species = e.target.value; })} />}
      {!custom && sp?.lineages && (
        <SelectField label={sp.lineageLabel ? L(sp.lineageLabel) : T('Linaje', 'Lineage')} value={lineage?.id ?? ''} onChange={(v) => choose(sp.id, v || undefined)}>
          <option value="">{T('— elige —', '— choose —')}</option>
          {sp.lineages.map((l) => <option key={l.id} value={l.id}>{L(l.name)}</option>)}
        </SelectField>
      )}
    </div>
  );
}

/** Clases adicionales: clase, nivel y subclase. El nivel total es la suma. */
function MulticlassModal({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const replace = useStore((s) => s.replace);
  const primary = CLASSES.find((x) => x.id === c.classId)!;
  const extraSum = (c.multiclass ?? []).reduce((s, m) => s + m.level, 0);
  const [mainLevel, setMainLevel] = useState(Math.max(1, c.level - extraSum));
  const [rows, setRows] = useState(c.multiclass ?? []);
  const total = mainLevel + rows.reduce((s, m) => s + (m.level || 0), 0);
  const free = CLASSES.filter((x) => x.id !== c.classId && !rows.some((r) => r.classId === x.id));
  const save = () => {
    const next = structuredClone(c);
    next.multiclass = rows.filter((r) => r.classId && r.level > 0);
    next.level = Math.min(20, total);
    const { slots, pact } = spellSlotsFor(next);
    next.slots = slots.map((n, i) => ({ max: n, used: Math.min(n, c.slots[i]?.used ?? 0) }));
    next.pactSlots = pact ? { ...pact, used: Math.min(c.pactSlots?.used ?? 0, pact.max) } : null;
    const mods = Object.fromEntries((['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => [a, Math.floor((next.abilities[a] - 10) / 2)])) as Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>;
    const defs = classLevels(next).flatMap((e) => e.cls.resources(e.level, mods));
    next.resources = [
      ...defs.map((r) => { const old = c.resources.find((x) => x.key === r.key); return { id: old?.id ?? Math.random().toString(36).slice(2, 10), key: r.key, name: L(RESOURCE_NAMES[r.key]), max: r.max, used: Math.min(r.max, old?.used ?? 0), recovers: r.recovers }; }),
      ...c.resources.filter((x) => !x.key),
    ];
    const r = pruneForClass(next);
    replace(r.next);
    const lines = pruneSummary(removedBetween(c, r.next));
    if (lines.length) useStore.getState().showToast(T('Multiclase actualizada', 'Multiclass updated'), lines);
    onClose();
  };
  return (
    <Modal title={T('Multiclase', 'Multiclass')} onClose={onClose}>
      <p className="small muted">{T('Para subir de nivel en otra clase usa «Subir de nivel» y elige la clase. Aquí puedes ajustar una ficha ya hecha.', 'To level up in another class, use “Level up” and pick the class. Here you can adjust an existing sheet.')}</p>
      <div className="mc-row">
        <b className="grow">{L(primary.name)} <span className="muted small">({T('principal', 'main')})</span></b>
        <input type="number" min={1} max={20} value={mainLevel} onChange={(e) => setMainLevel(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
      </div>
      {rows.map((r, i) => {
        const subs = SUBCLASSES[r.classId] ?? [];
        return (
          <div key={i} className="mc-row">
            <select value={r.classId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, classId: e.target.value, subclass: '' } : x)))}>
              {[CLASSES.find((x) => x.id === r.classId), ...free].filter(Boolean).map((x) => <option key={x!.id} value={x!.id}>{L(x!.name)}</option>)}
            </select>
            <input type="number" min={1} max={19} value={r.level} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, level: Math.max(1, Math.min(19, Number(e.target.value) || 1)) } : x)))} />
            <select value={subs.find((o) => [o.name.es, o.name.en].includes(r.subclass))?.id ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, subclass: subs.find((o) => o.id === e.target.value) ? L(subs.find((o) => o.id === e.target.value)!.name) : '' } : x)))}>
              <option value="">{T('Subclase —', 'Subclass —')}</option>
              {subs.map((o) => <option key={o.id} value={o.id}>{L(o.name)}</option>)}
            </select>
            <button className="icon-btn" aria-label={T('Quitar', 'Remove')} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
            {!meetsReq(c, r.classId) && <span className="mc-warn">⚠️ {T(`Requisito: ${reqText(r.classId)}`, `Requirement: ${reqText(r.classId)}`)}</span>}
          </div>
        );
      })}
      {free.length > 0 && <button className="btn small" onClick={() => setRows([...rows, { classId: free[0].id, level: 1, subclass: '' }])}>＋ {T('Añadir clase', 'Add class')}</button>}
      <p className={total > 20 ? 'error' : 'hint'}>{T(`Nivel total: ${total}`, `Total level: ${total}`)}{total > 20 ? T(' (máximo 20)', ' (max 20)') : ''}</p>
      <p className="hint">{T('Los espacios de conjuro se recalculan con la tabla de multiclase (niveles completos de lanzadores, la mitad de paladín y explorador; la magia de pacto va aparte).', 'Spell slots are recalculated with the multiclass table (full caster levels, half of Paladin and Ranger; Pact Magic is separate).')}</p>
      <button className="btn primary full" disabled={total > 20} onClick={save}>{T('Guardar', 'Save')}</button>
    </Modal>
  );
}

export function BackgroundField() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const known = findBackground(c.background);
  const [custom, setCustom] = useState(!!c.background && !known);
  return (
    <div>
      <SelectField label={T('Trasfondo', 'Background')} value={custom ? CUSTOM : known?.id ?? ''} onChange={(v) => {
        if (v === CUSTOM) { setCustom(true); return; }
        setCustom(false);
        const b = BACKGROUNDS.find((x) => x.id === v);
        update((x) => { x.background = b ? L(b.name) : ''; });
      }}>
        <option value="">—</option>
        {BACKGROUNDS.map((x) => <option key={x.id} value={x.id}>{L(x.name)}</option>)}
        <option value={CUSTOM}>{T('Otro (escribir)…', 'Other (type)…')}</option>
      </SelectField>
      {custom && <input className="p-inline" value={c.background} placeholder={T('Trasfondo', 'Background')} onChange={(e) => update((x) => { x.background = e.target.value; })} />}
    </div>
  );
}
