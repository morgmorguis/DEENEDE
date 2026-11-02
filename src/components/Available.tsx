// Lista de lo que tu personaje puede añadir sin tener que escribirlo: conjuros de las listas de sus
// clases y de un nivel que pueda lanzar (más los de su especie), o rasgos de sus clases, subclase,
// especie y dotes. Se añaden con un toque.
import { useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import { spellSuggestions, featureSuggestions } from '../rules/suggest';
import { findSpell } from '../rules/spells';
import { uid } from '../rules/factory';
import { L, T } from '../i18n';
import { Modal } from './common';
import { speciesSpellNames, spellCounts, spellLimits } from '../rules/spellLimits';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const RECHARGE: Record<string, string> = { short: '⛺', long: '🌙', slot: '✨', atwill: '♾️' };

export function AvailablePicker({ kind, onClose }: { kind: 'spell' | 'feature'; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<number | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [future, setFuture] = useState(false);

  // Se calcula sin lo que ya tiene para poder marcarlo como «ya la tienes»
  const spells = useMemo(() => (kind === 'spell' ? spellSuggestions({ ...c, spells: [] }, '', 0, true, future) : []), [c, kind, future]);
  const feats = useMemo(() => (kind === 'feature' ? featureSuggestions({ ...c, features: [] }, '', 0, true) : []), [c, kind]);
  const knownSpells = new Set(c.spells.map((s) => findSpell(s.name)?.name.en ?? s.name));
  const knownFeats = new Set(c.features.map((f) => fold(f.name)));
  const k = fold(q);

  if (kind === 'spell') {
    const lim = spellLimits(c);
    const cnt = spellCounts(c);
    const speciesNames = speciesSpellNames(c);
    const full = (lv: number, en: string) => !speciesNames.has(en) && (lv === 0 ? cnt.cantrips >= lim.cantrips : cnt.prepared >= lim.prepared);
    const levels = [...new Set(spells.map((x) => x.spell.level))].sort((a, b) => a - b);
    const list = spells.filter((x) => (level === 'all' || x.spell.level === level) && (!k || [x.spell.name.es, x.spell.name.en].some((n) => fold(n).includes(k))));
    const add = (en: string) => {
      const info = spells.find((x) => x.spell.name.en === en)!.spell;
      update((ch) => { ch.spells.push({ id: uid(), name: L(info.name), level: info.level, prepared: true, castingTime: L(info.time), range: L(info.range), concentration: info.concentration, ritual: info.ritual, components: info.components, material: info.components.includes('M') }); });
    };
    return (
      <Modal title={T('Conjuros disponibles', 'Available spells')} onClose={onClose}>
        <p className="small muted">{T('Los de la lista de tus clases que puedes lanzar a tu nivel, más los que te da tu especie (aunque los hayas quitado de la hoja). Toca uno para leerlo y «+ Añadir» para ponerlo en la hoja.', 'Spells from your classes’ lists you can cast at your level, plus those your species grants. Tap one to read it and “+ Add” to put it on your sheet.')}</p>
        <div className="spell-counter">
          <span className={cnt.cantrips >= lim.cantrips ? 'full' : ''}>{T('Trucos', 'Cantrips')} <b>{cnt.cantrips}/{lim.cantrips}</b></span>
          <span className={cnt.prepared >= lim.prepared ? 'full' : ''}>{T('Preparados', 'Prepared')} <b>{cnt.prepared}/{lim.prepared}</b></span>
          {lim.parts.length > 1 && <span className="muted">{lim.parts.join(' · ')}</span>}
        </div>
        <input className="avail-search" value={q} placeholder={T('Filtrar por nombre…', 'Filter by name…')} onChange={(e) => setQ(e.target.value)} />
        <label className="check avail-future"><input type="checkbox" checked={future} onChange={(e) => { setFuture(e.target.checked); setLevel('all'); }} /> {T('Ver también los que conseguirás al subir de nivel', 'Also show the ones you’ll get when you level up')}</label>
        {levels.length > 1 && (
          <div className="av-chips avail-levels">
            <button className={`chip toggle ${level === 'all' ? 'on' : ''}`} onClick={() => setLevel('all')}>{T('Todos', 'All')}</button>
            {levels.map((lv) => <button key={lv} className={`chip toggle ${level === lv ? 'on' : ''}`} onClick={() => setLevel(lv)}>{lv === 0 ? T('Trucos', 'Cantrips') : T(`Nivel ${lv}`, `Level ${lv}`)}</button>)}
          </div>
        )}
        <div className="avail-list">
          {list.map(({ spell, why, unlock }) => {
            const have = knownSpells.has(spell.name.en) || knownSpells.has(L(spell.name));
            const isOpen = open === spell.name.en;
            return (
              <div key={spell.name.en} className={`avail-item ${have ? 'have' : ''} ${unlock ? 'locked' : ''}`}>
                <button className="avail-main" onClick={() => setOpen(isOpen ? null : spell.name.en)}>
                  <b>{L(spell.name)}</b>
                  <span className="muted small">{spell.level ? T(`Nivel ${spell.level}`, `Level ${spell.level}`) : T('Truco', 'Cantrip')} · {L(spell.time)} · {L(spell.range)} · {spell.components}{spell.concentration ? ' · C' : ''}{spell.ritual ? ' · R' : ''} · <i>{why}</i></span>
                  {isOpen && <span className="avail-text">{L(spell.text)}</span>}
                </button>
                {unlock ? <span className="avail-lock">🔒 {T(`${why} nivel ${unlock}`, `${why} level ${unlock}`)}</span> : have ? <span className="avail-have">✓ {T('Ya lo tienes', 'Already known')}</span> : full(spell.level, spell.name.en) ? <span className="avail-lock" title={T('Has llegado al máximo; quita otro para añadir este', 'You’re at the limit; remove another to add this one')}>{spell.level === 0 ? T('Máx. trucos', 'Max cantrips') : T('Máx. preparados', 'Max prepared')}</span> : <button className="btn small primary" onClick={() => add(spell.name.en)}>+ {T('Añadir', 'Add')}</button>}
              </div>
            );
          })}
          {!list.length && <p className="hint">{spells.length ? T('Nada coincide con el filtro.', 'Nothing matches the filter.') : T('Tu clase y tu especie no te dan conjuros de la base de la app a este nivel. Puedes escribirlos a mano con «+».', 'Your class and species give you no spells from the app’s database at this level. You can type them by hand with “+”.')}</p>}
        </div>
        <button className="btn full" onClick={onClose}>{T('Hecho', 'Done')}</button>
      </Modal>
    );
  }

  const list = feats.filter((x) => !k || fold(x.name).includes(k) || fold(x.why).includes(k));
  const groups = [...new Set(list.map((x) => x.why))];
  const add = (name: string) => {
    const f = feats.find((x) => x.name === name)!;
    update((ch) => { ch.features.push({ id: uid(), name: f.name, text: f.text, recharge: f.recharge }); });
  };
  return (
    <Modal title={T('Rasgos disponibles', 'Available features')} onClose={onClose}>
      <p className="small muted">{T('Rasgos de tus clases hasta tu nivel, opciones que puedes elegir (estilos, invocaciones…), subclases, rasgos de especie y dotes. Toca uno para leerlo.', 'Features from your classes up to your level, options you can choose (styles, invocations…), subclasses, species traits and feats. Tap one to read it.')}</p>
      <input className="avail-search" value={q} placeholder={T('Filtrar…', 'Filter…')} onChange={(e) => setQ(e.target.value)} />
      <div className="avail-list">
        {groups.map((g) => (
          <div key={g}>
            <h4 className="avail-group">{g}</h4>
            {list.filter((x) => x.why === g).map((f) => {
              const have = knownFeats.has(fold(f.name));
              const isOpen = open === f.name;
              return (
                <div key={f.name} className={`avail-item ${have ? 'have' : ''}`}>
                  <button className="avail-main" onClick={() => setOpen(isOpen ? null : f.name)}>
                    <b>{f.name} {f.recharge ? RECHARGE[f.recharge] : ''}</b>
                    <span className={isOpen ? 'avail-text' : 'muted small avail-snippet'}>{f.text}</span>
                  </button>
                  {have ? <span className="avail-have">✓ {T('Ya lo tienes', 'Already have it')}</span> : <button className="btn small primary" onClick={() => add(f.name)}>+ {T('Añadir', 'Add')}</button>}
                </div>
              );
            })}
          </div>
        ))}
        {!list.length && <p className="hint">{feats.length ? T('Nada coincide con el filtro.', 'Nothing matches the filter.') : T('Elige tu clase y especie en la hoja para ver sus rasgos.', 'Pick your class and species on the sheet to see their features.')}</p>}
      </div>
      <button className="btn full" onClick={onClose}>{T('Hecho', 'Done')}</button>
    </Modal>
  );
}
