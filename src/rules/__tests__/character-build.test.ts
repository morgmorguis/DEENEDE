import { describe, expect, it } from 'vitest';
import { createCharacter } from '../factory';
import { spellSuggestions, featureSuggestions } from '../suggest';
import { applySpecies, findSpecies } from '../species';
import { applyLevelUp } from '../levelup';
import { classLevels, spellSlotsFor } from '../multiclass';
import { setLang } from '../../i18n';

const make = (classId: string, level: number, abilities = { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 13 }) =>
  createCharacter({ name: 'X', classId, level, species: 'Humano', background: 'Sabio', abilities, skills: [] });

describe('texto predictivo', () => {
  it('un mago de nivel 1 que escribe «fire» ve Descarga de fuego pero no Bola de fuego', () => {
    setLang('es');
    const w = make('mago', 1);
    const names = spellSuggestions(w, 'fire').map((s) => s.spell.name.en);
    expect(names).toContain('Fire Bolt');
    expect(names).not.toContain('Fireball');
    // A nivel 5 ya puede lanzar conjuros de nivel 3
    expect(spellSuggestions(make('mago', 5), 'fire').map((s) => s.spell.name.en)).toContain('Fireball');
    // Un guerrero no tiene conjuros de mago
    expect(spellSuggestions(make('guerrero', 5), 'fire')).toEqual([]);
    // En español también
    expect(spellSuggestions(w, 'descarga').map((s) => s.spell.name.es)).toContain('Descarga de fuego');
  });
  it('los rasgos sugeridos son los de su clase y nivel', () => {
    const f = make('guerrero', 2);
    const names = featureSuggestions({ ...f, features: [] }, 'oleada').map((x) => x.name);
    expect(names).toContain('Oleada de acción');
    expect(featureSuggestions({ ...make('guerrero', 1), features: [] }, 'oleada')).toEqual([]);
    expect(featureSuggestions({ ...f, features: [] }, 'arco').map((x) => x.name)).toContain('Estilo de combate: Tiro con arco');
  });
});

describe('especies y linajes', () => {
  it('dracónido rojo: resistencia al fuego; alto elfo: Prestidigitación', () => {
    const c = make('mago', 1);
    const d = applySpecies(c, 'draconido', 'red');
    expect(d.species).toBe('Dracónido (Rojo)');
    expect(d.resistances).toContain('fuego');
    const e = applySpecies(d, 'elfo', 'wood');
    expect(e.resistances).not.toContain('fuego');
    expect(e.speed).toBe(35);
    expect(e.spells.some((s) => s.name.startsWith('Artesanía'))).toBe(true);
    expect(findSpecies('Alto elfo').lineage?.id).toBe('high');
  });
});

describe('multiclase', () => {
  it('guerrero 3 que sube en mago: espacios de multiclase y nivel total', () => {
    const f = make('guerrero', 3, { str: 15, dex: 12, con: 14, int: 13, wis: 10, cha: 8 });
    const n = applyLevelUp(f, { classId: 'mago', hpGain: 5 });
    expect(n.level).toBe(4);
    expect(classLevels(n).map((e) => `${e.cls.id} ${e.level}`)).toEqual(['guerrero 3', 'mago 1']);
    expect(n.slots.map((s) => s.max)).toEqual([2]);
    expect(n.features.some((x) => x.name === 'Libro de conjuros')).toBe(true);
    // Paladín 2 + mago 3: nivel de lanzador 1 + 3 = 4
    const p = make('paladin', 2);
    p.multiclass = [{ classId: 'mago', level: 3, subclass: '' }];
    p.level = 5;
    expect(spellSlotsFor(p).slots).toEqual([4, 3]);
  });
});

import { detectConsumables, recoverAfterCombat } from '../consumables';

describe('munición y consumibles', () => {
  it('detecta en el equipo y recupera la mitad de la munición tras el combate', () => {
    const found = detectConsumables('Arco corto, carcaj con 20 flechas, 3 jabalinas, 2 pociones de curación', []);
    expect(found.map((f) => `${f.name} ${f.qty} ${f.kind}`)).toEqual(['Flechas 20 ammo', 'Jabalinas 3 thrown', 'Pociones de curación 2 item']);
    const c = make('explorador', 3);
    c.consumables = found.map((f) => ({ ...f }));
    // En combate: 7 flechas, 2 jabalinas y 1 poción
    c.consumables[0].qty -= 7; c.consumables[0].used = 7;
    c.consumables[1].qty -= 2; c.consumables[1].used = 2;
    c.consumables[2].qty -= 1; c.consumables[2].used = 1;
    const { char, lines } = recoverAfterCombat(c);
    expect(char.consumables.map((x) => x.qty)).toEqual([16, 3, 1]);
    expect(char.consumables.every((x) => x.used === 0)).toBe(true);
    expect(lines.length).toBe(3);
  });
});
