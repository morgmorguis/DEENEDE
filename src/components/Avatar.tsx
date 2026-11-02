// Editor de personaje: cara, cuerpo, pelo, ropaje de su clase y fondo, cada uno con sus colores.
// Dibuja al personaje de cuerpo entero estilo fantasía oscura de los 90; en la hoja se pone el busto.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useChar, useStore } from '../store';
import type { Physical } from '../types';
import {
  BACKDROPS, BEARDS, BODIES, CLASS_IDS, CLOTH_COLORS, EYE_COLORS, FACES, HAIR_COLORS, HAIRS, SKINS,
  defaultLook, outfitsFor, portraitDataUrl, randomLook, renderPortrait, type AvatarLook,
} from '../rules/avatar';
import { findSpecies } from '../rules/species';
import { classById } from '../rules/srd';
import { L, T, type Tr } from '../i18n';

const EMPTY_PHYS: Physical = { age: '', height: '', weight: '', eyes: '', hair: '', skin: '' };

/** Lista de opciones con flechas para pasar una a una y botones con su nombre */
function Picker({ label, names, value, onPick }: { label: string; names: Tr[]; value: number; onPick: (i: number) => void }) {
  const n = names.length;
  return (
    <div className="av-row">
      <div className="av-stepper">
        <span className="av-label">{label}</span>
        <button className="btn small" onClick={() => onPick((value - 1 + n) % n)} aria-label={T('Anterior', 'Previous')}>◀</button>
        <b className="av-current">{L(names[value % n])} <span className="muted small">{(value % n) + 1}/{n}</span></b>
        <button className="btn small" onClick={() => onPick((value + 1) % n)} aria-label={T('Siguiente', 'Next')}>▶</button>
      </div>
      <div className="av-chips">
        {names.map((nm, i) => <button key={i} className={`chip toggle ${i === value % n ? 'on' : ''}`} onClick={() => onPick(i)}>{L(nm)}</button>)}
      </div>
    </div>
  );
}

/** Muestras de color más un selector libre */
function Colors({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="av-row">
      <span className="av-label">{label}</span>
      <div className="av-swatches">
        {colors.map((c) => <button key={c} className={`av-swatch ${c === value ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />)}
        <label className={`av-swatch av-custom ${colors.includes(value) ? '' : 'on'}`} style={{ background: colors.includes(value) ? undefined : value }} title={T('Otro color', 'Other colour')}>
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label={T('Otro color', 'Other colour')} />
        </label>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`chip toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>{on ? '✓ ' : ''}{label}</button>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card"><h3>{title}</h3>{children}</section>;
}

export function AvatarTab() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const showToast = useStore((s) => s.showToast);
  const found = findSpecies(c.species);
  const speciesId = found.species?.id;
  const lineageId = c.lineage ?? found.lineage?.id;
  const classId = c.classId || 'guerrero';
  const look: AvatarLook = c.look?.v === 2 ? c.look : defaultLook(speciesId, lineageId, classId);
  const phys = c.physical ?? EMPTY_PHYS;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (canvas.current) renderPortrait(look, canvas.current, 2).catch(() => undefined);
  }, [look]);

  const setLook = (patch: Partial<AvatarLook>) => update((ch) => { ch.look = { ...(ch.look?.v === 2 ? ch.look : look), ...patch }; });
  const setPhys = (k: keyof Physical, v: string) => update((ch) => { ch.physical = { ...(ch.physical ?? EMPTY_PHYS), [k]: v }; });
  const applyPortrait = async () => {
    setBusy(true);
    try {
      const { full, thumb } = await portraitDataUrl(look);
      update((ch) => { ch.portrait = full; ch.portraitThumb = thumb; ch.look = look; });
      showToast(T('Retrato puesto en la hoja', 'Portrait set on the sheet'), [T('Lo verás arriba y en el recuadro «Aspecto».', 'You’ll see it at the top and in the “Appearance” box.')]);
    } finally { setBusy(false); }
  };
  const outfits = outfitsFor(look.outfitClass);
  const clsName = (id: string) => (classById(id) ? L(classById(id)!.name) : id);

  return (
    <div className="avatar-tab">
      <div className="card av-head">
        <canvas ref={canvas} className="av-canvas" aria-label={T('Retrato del personaje', 'Character portrait')} />
        <div className="av-actions">
          <h2>{c.name || T('Tu personaje', 'Your character')}</h2>
          <p className="muted small">{[c.species, c.className].filter(Boolean).join(' · ') || T('Elige especie y clase en la hoja', 'Pick species and class on the sheet')}</p>
          <button className="btn primary" disabled={busy} onClick={() => void applyPortrait()}>🖼️ {T('Usar como retrato', 'Use as portrait')}</button>
          <div className="av-actions-row">
            <button className="btn small" onClick={() => update((ch) => { ch.look = randomLook(look); })}>🎲 {T('Aleatorio', 'Random')}</button>
            <button className="btn small" onClick={() => update((ch) => { ch.look = defaultLook(speciesId, lineageId, classId); })}>↺ {T('Según especie y clase', 'From species & class')}</button>
          </div>
          <p className="hint">{T('En la hoja se pone solo el busto; aquí ves el cuerpo entero.', 'The sheet gets only the bust; here you see the full body.')}</p>
        </div>
      </div>

      <Section title={T('Cara', 'Face')}>
        <Picker label={T('Rostro', 'Face')} names={FACES.map((f) => f.name)} value={look.face} onPick={(i) => setLook({ face: i })} />
        <Colors label={T('Ojos', 'Eyes')} colors={EYE_COLORS} value={look.eyes} onPick={(v) => setLook({ eyes: v })} />
        <div className="av-row">
          <span className="av-label">{T('Rasgos de especie', 'Species features')}</span>
          <div className="av-chips">
            <Toggle label={T('Orejas puntiagudas', 'Pointy ears')} on={look.ears === 'pointy'} onChange={(v) => setLook({ ears: v ? 'pointy' : 'round' })} />
            <Toggle label={T('Cuernos', 'Horns')} on={look.horns} onChange={(v) => setLook({ horns: v })} />
            <Toggle label={T('Colmillos', 'Tusks')} on={look.tusks} onChange={(v) => setLook({ tusks: v })} />
            <Toggle label={T('Cabeza de dragón', 'Dragon head')} on={look.snout} onChange={(v) => setLook({ snout: v })} />
            <Toggle label={T('Aureola', 'Halo')} on={look.halo} onChange={(v) => setLook({ halo: v })} />
          </div>
        </div>
      </Section>

      <Section title={T('Cuerpo', 'Body')}>
        <Picker label={T('Complexión', 'Build')} names={BODIES.map((b) => b.name)} value={look.body} onPick={(i) => setLook({ body: i })} />
        <Colors label={T('Piel o escamas', 'Skin or scales')} colors={SKINS} value={look.skin} onPick={(v) => setLook({ skin: v })} />
      </Section>

      <Section title={T('Pelo', 'Hair')}>
        <Picker label={T('Peinado', 'Hairstyle')} names={HAIRS} value={look.hair} onPick={(i) => setLook({ hair: i })} />
        <Picker label={T('Barba', 'Beard')} names={BEARDS} value={look.beard} onPick={(i) => setLook({ beard: i })} />
        <Colors label={T('Color', 'Colour')} colors={HAIR_COLORS} value={look.hairColor} onPick={(v) => setLook({ hairColor: v })} />
      </Section>

      <Section title={T('Ropaje', 'Outfit')}>
        <label className="field"><span>{T('Ropajes de la clase', 'Outfits of the class')}</span>
          <select value={look.outfitClass} onChange={(e) => setLook({ outfitClass: e.target.value })}>
            {CLASS_IDS.map((id) => <option key={id} value={id}>{clsName(id)}{id === c.classId ? ` (${T('tu clase', 'your class')})` : ''}</option>)}
          </select>
        </label>
        <Picker label={T('Ropaje', 'Outfit')} names={outfits.map((x) => x.name)} value={look.outfit} onPick={(i) => setLook({ outfit: i })} />
        <div className="av-chips"><Toggle label={T('Sin tocado (quitar casco, capucha o sombrero)', 'No headgear (remove helm, hood or hat)')} on={look.noHat} onChange={(v) => setLook({ noHat: v })} /></div>
        <Colors label={T('Color principal', 'Main colour')} colors={CLOTH_COLORS} value={look.main} onPick={(v) => setLook({ main: v })} />
        <Colors label={T('Capa, pantalón y capucha', 'Cape, trousers and hood')} colors={CLOTH_COLORS} value={look.second} onPick={(v) => setLook({ second: v })} />
        <Colors label={T('Detalles y magia', 'Trim and magic')} colors={CLOTH_COLORS} value={look.accent} onPick={(v) => setLook({ accent: v })} />
      </Section>

      <Section title={T('Fondo', 'Backdrop')}>
        <Picker label={T('Escena', 'Scene')} names={BACKDROPS} value={look.backdrop} onPick={(i) => setLook({ backdrop: i })} />
      </Section>

      <Section title={T('Descripción', 'Description')}>
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
      </Section>
    </div>
  );
}
