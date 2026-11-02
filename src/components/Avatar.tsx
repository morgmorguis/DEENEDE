// Editor de personaje: aspecto físico, ropa, peinado y detalles. Dibuja un retrato pixel art que se
// puede poner en la hoja con un toque.
import { useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import type { Physical } from '../types';
import { avatarDataUrl, defaultLook, randomLook, EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, SKINS, type AvatarLook } from '../rules/avatar';
import { findSpecies } from '../rules/species';
import { T } from '../i18n';

type Opt<K extends keyof AvatarLook> = { v: AvatarLook[K]; es: string; en: string };
const HAIR: Opt<'hair'>[] = [
  { v: 'bald', es: 'Calvo', en: 'Bald' }, { v: 'short', es: 'Corto', en: 'Short' }, { v: 'long', es: 'Largo', en: 'Long' }, { v: 'ponytail', es: 'Coleta', en: 'Ponytail' },
  { v: 'bun', es: 'Moño', en: 'Bun' }, { v: 'mohawk', es: 'Cresta', en: 'Mohawk' }, { v: 'braids', es: 'Trenzas', en: 'Braids' }, { v: 'curly', es: 'Rizado', en: 'Curly' },
];
const BEARD: Opt<'beard'>[] = [{ v: 'none', es: 'Sin barba', en: 'None' }, { v: 'stubble', es: 'De tres días', en: 'Stubble' }, { v: 'short', es: 'Corta', en: 'Short' }, { v: 'long', es: 'Larga', en: 'Long' }];
const OUTFIT: Opt<'outfit'>[] = [{ v: 'tunic', es: 'Túnica', en: 'Tunic' }, { v: 'robe', es: 'Toga de mago', en: 'Robe' }, { v: 'leather', es: 'Cuero', en: 'Leather' }, { v: 'plate', es: 'Placas', en: 'Plate' }, { v: 'cloak', es: 'Capa', en: 'Cloak' }];
const HEAD: Opt<'headgear'>[] = [{ v: 'none', es: 'Nada', en: 'None' }, { v: 'hood', es: 'Capucha', en: 'Hood' }, { v: 'wizard', es: 'Sombrero de mago', en: 'Wizard hat' }, { v: 'helmet', es: 'Yelmo', en: 'Helmet' }, { v: 'circlet', es: 'Diadema', en: 'Circlet' }];
const FEATURE: Opt<'feature'>[] = [{ v: 'none', es: 'Nada', en: 'None' }, { v: 'scar', es: 'Cicatriz', en: 'Scar' }, { v: 'eyepatch', es: 'Parche', en: 'Eyepatch' }, { v: 'warpaint', es: 'Pintura de guerra', en: 'War paint' }, { v: 'freckles', es: 'Pecas', en: 'Freckles' }];
const BACKDROP: Opt<'backdrop'>[] = [{ v: 'night', es: 'Noche', en: 'Night' }, { v: 'forest', es: 'Bosque', en: 'Forest' }, { v: 'dungeon', es: 'Mazmorra', en: 'Dungeon' }, { v: 'sunset', es: 'Atardecer', en: 'Sunset' }, { v: 'tavern', es: 'Taberna', en: 'Tavern' }];

const EMPTY_PHYS: Physical = { age: '', height: '', weight: '', eyes: '', hair: '', skin: '' };

function Chips<K extends keyof AvatarLook>({ label, opts, value, onPick }: { label: string; opts: Opt<K>[]; value: AvatarLook[K]; onPick: (v: AvatarLook[K]) => void }) {
  return (
    <div className="av-row">
      <span className="av-label">{label}</span>
      <div className="av-chips">
        {opts.map((o) => <button key={String(o.v)} className={`chip toggle ${o.v === value ? 'on' : ''}`} onClick={() => onPick(o.v)}>{T(o.es, o.en)}</button>)}
      </div>
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="av-row">
      <span className="av-label">{label}</span>
      <div className="av-swatches">
        {colors.map((c) => <button key={c} className={`av-swatch ${c === value ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />)}
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`chip toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>{on ? '✓ ' : ''}{label}</button>;
}

export function AvatarTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const showToast = useStore((s) => s.showToast);
  const found = findSpecies(c.species);
  const speciesId = found.species?.id;
  const lineageId = c.lineage ?? found.lineage?.id;
  const look = c.look ?? defaultLook(speciesId, lineageId);
  const phys = c.physical ?? EMPTY_PHYS;
  const [big, setBig] = useState(false);
  const preview = useMemo(() => avatarDataUrl(look, 8), [look]);

  const setLook = (patch: Partial<AvatarLook>) => update((ch) => { ch.look = { ...(ch.look ?? look), ...patch }; });
  const setPhys = (k: keyof Physical, v: string) => update((ch) => { ch.physical = { ...(ch.physical ?? EMPTY_PHYS), [k]: v }; });
  const usePortrait = () => {
    update((ch) => { ch.portrait = avatarDataUrl(look, 10); ch.look = look; });
    showToast(T('Retrato puesto en la hoja', 'Portrait set on the sheet'), [T('Lo verás arriba y en el recuadro «Aspecto».', 'You’ll see it at the top and in the “Appearance” box.')]);
  };

  return (
    <div className="avatar-tab">
      <div className="card av-head">
        <button className={`av-preview ${big ? 'big' : ''}`} onClick={() => setBig(!big)} aria-label={T('Ampliar retrato', 'Zoom portrait')}>
          <img src={preview} alt={T('Retrato pixel del personaje', 'Pixel portrait of the character')} />
        </button>
        <div className="av-actions">
          <h2>{c.name || T('Tu personaje', 'Your character')}</h2>
          <p className="muted small">{[c.species, c.className].filter(Boolean).join(' · ') || T('Elige especie y clase en la hoja', 'Pick species and class on the sheet')}</p>
          <button className="btn primary" onClick={usePortrait}>🖼️ {T('Usar como retrato', 'Use as portrait')}</button>
          <div className="av-actions-row">
            <button className="btn small" onClick={() => update((ch) => { ch.look = randomLook(speciesId, lineageId); })}>🎲 {T('Aleatorio', 'Random')}</button>
            <button className="btn small" onClick={() => update((ch) => { ch.look = defaultLook(speciesId, lineageId); })}>↺ {T('Según especie', 'From species')}</button>
          </div>
        </div>
      </div>

      <section className="card">
        <h3>{T('Rasgos', 'Features')}</h3>
        <Swatches label={T('Piel / escamas', 'Skin / scales')} colors={SKINS} value={look.skin} onPick={(v) => setLook({ skin: v })} />
        <Swatches label={T('Ojos', 'Eyes')} colors={EYE_COLORS} value={look.eyes} onPick={(v) => setLook({ eyes: v })} />
        <div className="av-row">
          <span className="av-label">{T('Especie', 'Species')}</span>
          <div className="av-chips">
            <Toggle label={T('Orejas puntiagudas', 'Pointy ears')} on={look.ears === 'pointy'} onChange={(v) => setLook({ ears: v ? 'pointy' : 'round' })} />
            <Toggle label={T('Cuernos', 'Horns')} on={look.horns} onChange={(v) => setLook({ horns: v })} />
            <Toggle label={T('Colmillos', 'Tusks')} on={look.tusks} onChange={(v) => setLook({ tusks: v })} />
            <Toggle label={T('Hocico', 'Snout')} on={look.snout} onChange={(v) => setLook({ snout: v })} />
            <Toggle label={T('Aureola', 'Halo')} on={look.halo} onChange={(v) => setLook({ halo: v })} />
          </div>
        </div>
        <Chips label={T('Detalle', 'Detail')} opts={FEATURE} value={look.feature} onPick={(v) => setLook({ feature: v })} />
      </section>

      <section className="card">
        <h3>{T('Peinado', 'Hair')}</h3>
        <Chips label={T('Estilo', 'Style')} opts={HAIR} value={look.hair} onPick={(v) => setLook({ hair: v })} />
        <Swatches label={T('Color', 'Colour')} colors={HAIR_COLORS} value={look.hairColor} onPick={(v) => setLook({ hairColor: v })} />
        <Chips label={T('Barba', 'Beard')} opts={BEARD} value={look.beard} onPick={(v) => setLook({ beard: v })} />
      </section>

      <section className="card">
        <h3>{T('Ropa', 'Clothes')}</h3>
        <Chips label={T('Atuendo', 'Outfit')} opts={OUTFIT} value={look.outfit} onPick={(v) => setLook({ outfit: v })} />
        <Swatches label={T('Color', 'Colour')} colors={OUTFIT_COLORS} value={look.outfitColor} onPick={(v) => setLook({ outfitColor: v })} />
        <Chips label={T('Cabeza', 'Head')} opts={HEAD} value={look.headgear} onPick={(v) => setLook({ headgear: v })} />
        <Chips label={T('Fondo', 'Backdrop')} opts={BACKDROP} value={look.backdrop} onPick={(v) => setLook({ backdrop: v })} />
      </section>

      <section className="card">
        <h3>{T('Descripción', 'Description')}</h3>
        <div className="av-phys">
          {([
            ['age', T('Edad', 'Age'), '27'], ['height', T('Altura', 'Height'), '1,75 m'], ['weight', T('Peso', 'Weight'), '70 kg'],
            ['eyes', T('Ojos', 'Eyes'), T('verdes', 'green')], ['hair', T('Pelo', 'Hair'), T('castaño', 'brown')], ['skin', T('Piel', 'Skin'), T('morena', 'tanned')],
          ] as [keyof Physical, string, string][]).map(([k, label, ph]) => (
            <label key={k} className="field"><span>{label}</span><input value={phys[k]} placeholder={ph} onChange={(e) => setPhys(k, e.target.value)} /></label>
          ))}
        </div>
        <label className="field"><span>{T('Cómo es, cómo viste, qué llama la atención', 'What they look like, how they dress, what stands out')}</span>
          <textarea rows={4} value={c.appearance} onChange={(e) => update((ch) => { ch.appearance = e.target.value; })} placeholder={T('Una cicatriz le cruza la ceja; siempre lleva la capa remendada de su madre…', 'A scar crosses one eyebrow; always wears their mother’s patched cloak…')} />
        </label>
        <p className="hint">{T('Esto aparece en la hoja, en el recuadro «Aspecto».', 'This shows on the sheet, in the “Appearance” box.')}</p>
      </section>
    </div>
  );
}
