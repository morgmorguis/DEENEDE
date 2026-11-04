import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { blankCharacter } from '../factory';
import { checkBonus, initiativeBonus, rollContext, rollD20, saveBonus, saveProficient, skillBonus } from '../calc';
import { ruleMods } from '../bonuses';
import type { Character } from '../../types';

beforeAll(() => setLang('es'));

function pc(patch: Partial<Character>): Character {
  const c = blankCharacter();
  return { ...c, abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 16, cha: 14 }, ...patch };
}

describe('bonificadores de las reglas 2024', () => {
  it('clérigo Taumaturgo: Religión = INT + competencia + SAB', () => {
    const c = pc({ classId: 'clerigo', level: 3, skillProf: { religion: 1 }, features: [{ id: 'a', name: 'Orden divina: Taumaturgo', text: '' }] });
    expect(skillBonus(c, 'religion')).toBe(0 + 2 + 3);
    expect(skillBonus(c, 'arcanos')).toBe(0 + 3);
    expect(skillBonus(c, 'historia')).toBe(0);
    // El protector no suma
    const p = { ...c, features: [{ id: 'a', name: 'Orden divina: Protector', text: '' }] };
    expect(skillBonus(p, 'religion')).toBe(2);
    // Mínimo +1 con SAB baja
    expect(skillBonus({ ...c, abilities: { ...c.abilities, wis: 8 } }, 'religion')).toBe(3);
  });

  it('se puede desactivar una regla y añadir un bonificador propio con característica', () => {
    const c = pc({ classId: 'clerigo', level: 1, skillProf: { religion: 1 }, features: [{ id: 'a', name: 'Orden divina: Taumaturgo', text: '' }] });
    expect(skillBonus({ ...c, rulesOff: ['thaumaturge'] }, 'religion')).toBe(2);
    const manual = { ...c, rulesOff: ['thaumaturge'], bonusAdj: { 'skill:religion': { flat: 1, ability: 'wis' as const } } };
    expect(skillBonus(manual, 'religion')).toBe(2 + 1 + 3);
  });

  it('druida Mago: Arcanos y Naturaleza + SAB', () => {
    const c = pc({ classId: 'druida', level: 1, features: [{ id: 'a', name: 'Orden primigenia: Mago', text: '' }] });
    expect(skillBonus(c, 'naturaleza')).toBe(3);
    expect(skillBonus(c, 'religion')).toBe(0);
  });

  it('bardo 2 Aprendiz de todo solo en habilidades sin competencia', () => {
    const c = pc({ classId: 'bardo', level: 5, skillProf: { persuasion: 1 } });
    expect(skillBonus(c, 'atletismo')).toBe(0 + 1); // PB 3 → +1
    expect(skillBonus(c, 'persuasion')).toBe(2 + 3);
    expect(initiativeBonus(c)).toBe(2);
    expect(checkBonus(c, 'str')).toBe(0);
  });

  it('paladín 6: Aura de protección a todas las salvaciones', () => {
    const c = pc({ classId: 'paladin', level: 6, saveProf: ['wis', 'cha'] });
    expect(saveBonus(c, 'wis')).toBe(3 + 3 + 2);
    expect(saveBonus(c, 'str')).toBe(0 + 2);
  });

  it('monje 14 y pícaro 15 dan competencia en salvaciones', () => {
    const m = pc({ classId: 'monje', level: 14, saveProf: ['str', 'dex'] });
    expect(saveProficient(m, 'int')).toBe(true);
    expect(saveBonus(m, 'int')).toBe(0 + 5);
    const r = pc({ classId: 'picaro', level: 15, saveProf: ['dex', 'int'] });
    expect(saveProficient(r, 'cha')).toBe(true);
    expect(saveProficient(r, 'con')).toBe(false);
  });

  it('iniciativa: Alerta, Acechador en la penumbra y ventaja del bárbaro 7 y del Campeón', () => {
    expect(initiativeBonus(pc({ classId: 'mago', level: 1, feats: 'Alerta' }))).toBe(2 + 2);
    expect(initiativeBonus(pc({ classId: 'explorador', level: 3, subclass: 'Acechador en la penumbra' }))).toBe(2 + 3);
    expect(rollContext(pc({ classId: 'barbaro', level: 7 }), { kind: 'initiative' }).advantage.length).toBe(1);
    expect(rollContext(pc({ classId: 'guerrero', level: 3, subclass: 'Campeón' }), { kind: 'check', ability: 'str', skill: 'atletismo' }).advantage.length).toBe(1);
    expect(rollContext(pc({ classId: 'barbaro', level: 2 }), { kind: 'save', ability: 'dex' }).advantage.length).toBe(1);
  });

  it('especies: gnomo con ventaja en salvaciones mentales y mediano repite los 1', () => {
    const g = pc({ classId: 'mago', level: 1, species: 'Gnomo' });
    expect(rollContext(g, { kind: 'save', ability: 'int' }).advantage.length).toBe(1);
    expect(rollContext(g, { kind: 'save', ability: 'str' }).advantage.length).toBe(0);
    const h = pc({ classId: 'mago', level: 1, species: 'Mediano' });
    expect(ruleMods(h, { kind: 'attack' }).some((r) => r.rerollOnes)).toBe(true);
  });

  it('Talento fiable: con competencia el d20 nunca baja de 10', () => {
    const r = pc({ classId: 'picaro', level: 7, skillProf: { sigilo: 1 } });
    for (let i = 0; i < 200; i++) expect(rollD20(r, { kind: 'check', ability: 'dex', skill: 'sigilo' }, 0, 'Sigilo').natural).toBeGreaterThanOrEqual(10);
  });

  it('Errante feérico suma SAB a las pruebas de Carisma', () => {
    const c = pc({ classId: 'explorador', level: 3, subclass: 'Errante feérico' });
    expect(skillBonus(c, 'persuasion')).toBe(2 + 3);
    expect(checkBonus(c, 'cha')).toBe(2 + 3);
  });
});

describe('especie en femenino', () => {
  it('reconoce Enana, Alta elfa y Mediana', async () => {
    const { findSpecies } = await import('../species');
    expect(findSpecies('Enana').species?.id).toBe('enano');
    expect(findSpecies('Alta elfa').lineage?.id).toBe('high');
    expect(findSpecies('Mediana').species?.id).toBe('mediano');
    expect(findSpecies('Tiefling').species?.id).toBe('tiefling');
    const d = pc({ classId: 'clerigo', level: 1, species: 'Enana' });
    expect(ruleMods(d, { kind: 'save', ability: 'con' }).some((r) => r.id === 'dwarven_resilience')).toBe(true);
  });
});
