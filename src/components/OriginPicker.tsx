// «Origen y habilidades»: elecciones de nivel 1 según trasfondo, clase y especie. Solo muestra lo que
// se puede escoger, avisa cuando dos fuentes dan la misma habilidad (hay que elegir otra) y aplica todo.
import { useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import type { ProfLevel } from '../types';
import { CLASSES, SKILLS, abilityShort } from '../rules/srd';
import { ALL_SKILLS, BACKGROUNDS, CLASS_SKILLS, LEVEL1_PICKS, SPECIES_SKILLS, findBackground } from '../rules/origins';
import { FIGHTING_STYLES } from '../rules/progression';
import { findSpecies } from '../rules/species';
import { uid } from '../rules/factory';
import { Modal } from './common';
import { useConfirm } from './Confirm';
import { L, T } from '../i18n';

const skillName = (id: string) => L(SKILLS.find((s) => s.id === id)!.name);

type Source = 'bg' | 'class' | 'species' | 'skilled';

export function OriginPicker({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const replace = useStore((s) => s.replace);
  const cls = CLASSES.find((x) => x.id === c.classId);
  const classSkills = cls ? CLASS_SKILLS[cls.id] : undefined;
  const speciesId = findSpecies(c.species).species?.id ?? '';
  const speciesSkills = SPECIES_SKILLS[speciesId];
  const pick1 = cls ? LEVEL1_PICKS[cls.id] : undefined;
  const has = (id: string) => (c.skillProf[id] ?? 0) > 0;

  const [bgId, setBgId] = useState(findBackground(c.background)?.id ?? '');
  const bg = BACKGROUNDS.find((x) => x.id === bgId);
  const bgSkills: string[] = useMemo(() => bg?.skills ?? [], [bg]);
  // Estado inicial a partir de lo que ya tiene la ficha
  const [classPicks, setClassPicks] = useState<string[]>(() => (classSkills ? classSkills.list.filter((s) => has(s) && !bgSkills.includes(s)).slice(0, classSkills.count) : []));
  const [speciesPicks, setSpeciesPicks] = useState<string[]>(() => (speciesSkills ? speciesSkills.list.filter((s) => has(s) && !bgSkills.includes(s) && !classPicks.includes(s)).slice(0, speciesSkills.count) : []));
  const [skilledPicks, setSkilledPicks] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>(() => Object.keys(c.skillProf).filter((k) => c.skillProf[k] === 2));
  const [style, setStyle] = useState<string>('');
  const [order, setOrder] = useState<string>('');

  // De dónde sale cada habilidad (para detectar duplicados)
  const sources = useMemo(() => {
    const m = new Map<string, Source[]>();
    const add = (ids: string[], src: Source) => ids.forEach((id) => m.set(id, [...(m.get(id) ?? []), src]));
    add(bgSkills, 'bg'); add(classPicks, 'class'); add(speciesPicks, 'species'); add(skilledPicks, 'skilled');
    return m;
  }, [bgSkills, classPicks, speciesPicks, skilledPicks]);
  const srcLabel = (s: Source) => ({ bg: T('trasfondo', 'background'), class: T('clase', 'class'), species: T('especie', 'species'), skilled: T('dote Habilidoso', 'Skilled feat') }[s]);
  const conflicts = [...sources.entries()].filter(([, v]) => v.length > 1);
  const owned = new Set(sources.keys());

  const needClass = classSkills?.count ?? 0;
  const needSpecies = speciesSkills?.count ?? 0;
  const needSkilled = bg?.skilledFeat ? 3 : 0;
  const isRogue = cls?.id === 'picaro';
  const needStyle = cls?.id === 'guerrero';
  const done = classPicks.length === needClass && speciesPicks.length === needSpecies && skilledPicks.length === needSkilled && !conflicts.length
    && (!isRogue || expertise.filter((e) => owned.has(e)).length >= 2) && (!needStyle || !!style) && (!pick1 || !!order);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : max === 1 ? [id] : list);

  /** Botón de habilidad: deshabilitada si ya la da otra fuente, con el motivo */
  const SkillChip = ({ id, picked, onClick, mine }: { id: string; picked: boolean; onClick: () => void; mine: Source }) => {
    const others = (sources.get(id) ?? []).filter((s) => s !== mine);
    const blocked = !picked && others.length > 0;
    const clash = picked && others.length > 0;
    return (
      <button type="button" className={`skill-chip ${picked ? 'on' : ''} ${clash ? 'clash' : ''}`} disabled={blocked} onClick={onClick}
        title={blocked ? T(`Ya la tienes por ${others.map(srcLabel).join(' y ')}`, `Already granted by ${others.map(srcLabel).join(' and ')}`) : undefined}>
        {picked ? '✓ ' : ''}{skillName(id)}
        <small>{abilityShort(SKILLS.find((s) => s.id === id)!.ability)}{blocked ? ` · ${T('ya por', 'from')} ${others.map(srcLabel).join('/')}` : ''}</small>
      </button>
    );
  };

  const apply = async () => {
    const ok = await useConfirm.getState().open({ title: T('¿Aplicar estas elecciones?', 'Apply these choices?'), text: T('Se sustituyen tus competencias en habilidades por las elegidas aquí.', 'Your skill proficiencies are replaced by the ones chosen here.'), ok: T('Aplicar', 'Apply') });
    if (!ok) return;
    const next = structuredClone(c);
    const prof: Record<string, ProfLevel> = {};
    for (const id of owned) prof[id] = 1;
    for (const id of expertise) if (prof[id]) prof[id] = 2;
    next.skillProf = { ...Object.fromEntries(ALL_SKILLS.map((s) => [s, 0 as ProfLevel])), ...prof };
    if (bg) {
      next.background = L(bg.name);
      if (!next.toolProf.toLowerCase().includes(L(bg.tool).toLowerCase().split(' (')[0])) next.toolProf = [next.toolProf.trim(), L(bg.tool)].filter(Boolean).join('; ');
      if (!next.feats.includes(L(bg.feat))) next.feats = [next.feats.trim(), `${L(bg.feat)} (${T('dote de origen', 'Origin feat')})`].filter(Boolean).join('\n');
    }
    const st = FIGHTING_STYLES.find((x) => x.id === style);
    if (st && !next.features.some((f) => f.name.includes(L(st.name)))) next.features.push({ id: uid(), name: `${T('Estilo de combate', 'Fighting Style')}: ${L(st.name)}`, text: L(st.text) });
    const op = pick1?.options.find((o) => o.id === order);
    if (op && pick1) {
      next.features = next.features.filter((f) => !f.name.startsWith(`${L(pick1.title)}:`));
      next.features.push({ id: uid(), name: `${L(pick1.title)}: ${L(op.name)}`, text: L(op.text) });
      if (op.id === 'protector') { next.armorTraining.heavy = true; if (!/marcial|martial/i.test(next.weaponProf)) next.weaponProf = [next.weaponProf, T('Armas marciales', 'Martial weapons')].filter(Boolean).join('; '); }
      if (op.id === 'warden') { next.armorTraining.medium = true; if (!/marcial|martial/i.test(next.weaponProf)) next.weaponProf = [next.weaponProf, T('Armas marciales', 'Martial weapons')].filter(Boolean).join('; '); }
    }
    replace(next);
    useStore.getState().showToast(T('🎓 Origen aplicado', '🎓 Origin applied'), [...owned].map(skillName));
    onClose();
  };

  return (
    <Modal title={T('Origen y habilidades', 'Origin & skills')} onClose={onClose}>
      <p className="small muted">{T('Solo aparecen las habilidades que puedes escoger. Si dos fuentes te dan la misma, la segunda queda bloqueada y tienes que elegir otra.', 'Only the skills you can pick are shown. If two sources grant the same one, the second is blocked and you must choose another.')}</p>

      <section className="origin-step">
        <h4>1 · {T('Trasfondo', 'Background')}</h4>
        <select value={bgId} onChange={(e) => setBgId(e.target.value)}>
          <option value="">{T('— elige tu trasfondo —', '— choose your background —')}</option>
          {BACKGROUNDS.map((x) => <option key={x.id} value={x.id}>{L(x.name)}</option>)}
        </select>
        {bg && (
          <div className="origin-bg">
            <span>✓ {bg.skills.map(skillName).join(', ')}</span>
            <span>🛠️ {L(bg.tool)}</span>
            <span>🎖️ {T('Dote', 'Feat')}: {L(bg.feat)}</span>
            <span className="muted">{T(`Características: +2 y +1, o +1/+1/+1 entre ${bg.abilities.map(abilityShort).join(', ')}.`, `Abilities: +2 and +1, or +1/+1/+1 among ${bg.abilities.map(abilityShort).join(', ')}.`)}</span>
          </div>
        )}
      </section>

      {classSkills && cls && (
        <section className="origin-step">
          <h4>2 · {L(cls.name)}: {T(`elige ${needClass}`, `choose ${needClass}`)} <span className="count">{classPicks.length}/{needClass}</span></h4>
          <div className="skill-chips">
            {classSkills.list.map((id) => <SkillChip key={id} id={id} mine="class" picked={classPicks.includes(id)} onClick={() => toggle(classPicks, setClassPicks, id, needClass)} />)}
          </div>
        </section>
      )}
      {!cls && <p className="hint">{T('Elige tu clase en la hoja para ver sus habilidades.', 'Pick your class on the sheet to see its skills.')}</p>}

      {speciesSkills && (
        <section className="origin-step">
          <h4>3 · {L(speciesSkills.label)}: {T('elige 1', 'choose 1')} <span className="count">{speciesPicks.length}/{needSpecies}</span></h4>
          <div className="skill-chips">
            {speciesSkills.list.map((id) => <SkillChip key={id} id={id} mine="species" picked={speciesPicks.includes(id)} onClick={() => toggle(speciesPicks, setSpeciesPicks, id, needSpecies)} />)}
          </div>
        </section>
      )}

      {bg?.skilledFeat && (
        <section className="origin-step">
          <h4>{T('Dote Habilidoso: elige 3', 'Skilled feat: choose 3')} <span className="count">{skilledPicks.length}/3</span></h4>
          <div className="skill-chips">
            {ALL_SKILLS.map((id) => <SkillChip key={id} id={id} mine="skilled" picked={skilledPicks.includes(id)} onClick={() => toggle(skilledPicks, setSkilledPicks, id, 3)} />)}
          </div>
        </section>
      )}

      {isRogue && (
        <section className="origin-step">
          <h4>{T('Pericia (pícaro): elige 2 de tus habilidades', 'Expertise (Rogue): choose 2 of your skills')}</h4>
          <div className="skill-chips">
            {[...owned].map((id) => (
              <button key={id} type="button" className={`skill-chip ${expertise.includes(id) ? 'on' : ''}`} onClick={() => toggle(expertise.filter((e) => owned.has(e)), setExpertise, id, 2)}>{expertise.includes(id) ? '★ ' : ''}{skillName(id)}</button>
            ))}
            {!owned.size && <span className="muted small">{T('Primero elige tus habilidades.', 'Choose your skills first.')}</span>}
          </div>
        </section>
      )}

      {needStyle && (
        <section className="origin-step">
          <h4>{T('Estilo de combate (guerrero)', 'Fighting Style (Fighter)')}</h4>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">—</option>
            {FIGHTING_STYLES.map((o) => <option key={o.id} value={o.id}>{L(o.name)} — {L(o.text)}</option>)}
          </select>
        </section>
      )}

      {pick1 && (
        <section className="origin-step">
          <h4>{L(pick1.title)}</h4>
          <div className="lu-options">
            {pick1.options.map((o) => (
              <button key={o.id} type="button" className={`lu-option ${order === o.id ? 'on' : ''}`} onClick={() => setOrder(o.id)}>
                <b>{order === o.id ? '✓ ' : ''}{L(o.name)}</b><span>{L(o.text)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {conflicts.length > 0 && (
        <div className="reminders">
          <b>⚠️ {T('Conflictos', 'Conflicts')}</b>
          {conflicts.map(([id, src]) => <div key={id}>{T(`${skillName(id)} la dan ${src.map(srcLabel).join(' y ')}: quítala de una y elige otra.`, `${skillName(id)} is granted by ${src.map(srcLabel).join(' and ')}: remove it from one and pick another.`)}</div>)}
        </div>
      )}
      <p className="hint">{T(`Total: ${owned.size} habilidades — ${[...owned].map(skillName).join(', ') || '—'}`, `Total: ${owned.size} skills — ${[...owned].map(skillName).join(', ') || '—'}`)}</p>
      <button className="btn primary full" disabled={!done} onClick={() => void apply()}>{done ? T('✓ Aplicar a la ficha', '✓ Apply to the sheet') : T('Completa las elecciones', 'Complete your choices')}</button>
    </Modal>
  );
}
