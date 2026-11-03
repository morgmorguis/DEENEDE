import { describe, expect, it } from 'vitest';
import { looksLikeOfficial2024, mapOfficial2024, type FormField } from '../pdfForm';
import { parseSheetText } from '../textParse';

// Campos en las posiciones de la hoja oficial 2024 (puntos sobre 603×774)
const tf = (page: number, x: number, y: number, value: string): FormField => ({ page, cx: x / 603, cy: y / 774, name: 'text_x', kind: 'text', value, checked: false });
const cb = (page: number, x: number, y: number, checked = true): FormField => ({ page, cx: x / 603, cy: y / 774, name: 'checkbox_x', kind: 'check', value: '', checked });

describe('PDF rellenable de la hoja oficial 2024', () => {
  const fields: FormField[] = [
    tf(1, 138, 23, 'Morg Parkside'), tf(1, 276, 37, '3'), tf(1, 338, 43, '15'), tf(1, 194, 44, 'Pícaro'),
    tf(1, 84, 45, 'Criminal'), tf(1, 403, 57, '17'), tf(1, 460, 64, '20'), tf(1, 512, 42, 'D8'),
    tf(1, 43, 222, '-2'), tf(1, 74, 228, '7'), tf(1, 43, 341, '+4'), tf(1, 74, 346, '18'),
    tf(1, 280, 207, 'Daga'), tf(1, 358, 207, 'D20+6'), tf(1, 421, 207, 'D4+4 perforante'),
    cb(1, 21, 383), cb(1, 21, 431), cb(1, 127, 555), cb(1, 62, 648),
    tf(2, 500, 358, 'Común, Élfico'), tf(2, 534, 714, '30'), tf(2, 187, 90, '2'), cb(2, 202, 90),
    tf(2, 96, 188, 'Proyectil mágico'), tf(2, 27, 188, '1'), cb(2, 242, 188, false),
    // Relleno para que parezca la hoja completa
    ...Array.from({ length: 40 }, () => cb(1, 127, 207, false)),
  ];
  it('reconoce la plantilla y mapea los campos', () => {
    expect(looksLikeOfficial2024(fields)).toBe(true);
    const s = mapOfficial2024(fields);
    expect(s).toMatchObject({ name: 'Morg Parkside', level: 3, armorClass: 15, className: 'Pícaro', classId: 'picaro', background: 'Criminal', hpCurrent: 17, hpMax: 20, hitDie: 8 });
    expect(s.abilities.str).toBe(7);
    expect(s.abilities.dex).toBe(18);
    expect(s.saveProficiencies).toEqual(['dex']);
    expect(s.skills.map((x) => x.skill).sort()).toEqual(['engano', 'sigilo']);
    expect(s.armorTraining.light).toBe(true);
    expect(s.attacks[0]).toMatchObject({ name: 'Daga', attackBonus: 6, damage: '1d4+4', damageType: 'perforante' });
    expect(s.languages).toBe('Común, Élfico');
    expect(s.coins.gp).toBe(30);
    expect(s.spellSlots[0]).toBe(2);
    expect(s.spellSlotsUsed?.[0]).toBe(1);
    expect(s.spells[0]).toMatchObject({ name: 'Proyectil mágico', level: 1, concentration: false });
  });
});

describe('texto libre', () => {
  it('ficha en español con etiquetas', () => {
    const s = parseSheetText(`Nombre: Thalia Brisaluna
Clase: Maga  Nivel 3
Especie: Elfa
Trasfondo: Sabia
FUE 8  DES 14  CON 13  INT 17  SAB 12  CAR 10
CA 12   PG 17   Velocidad 30
Salvaciones: INT, SAB
Habilidades: Arcanos, Historia, Investigación (pericia)
Idiomas: Común, Élfico, Dracónico
Equipo: Bastón, libro de conjuros, 10 po`);
    expect(s).toMatchObject({ name: 'Thalia Brisaluna', classId: 'mago', level: 3, species: 'Elfa', background: 'Sabia', armorClass: 12, hpMax: 17, speed: 30 });
    expect(s.abilities).toEqual({ str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 });
    expect(s.saveProficiencies.sort()).toEqual(['int', 'wis']);
    expect(s.skills).toEqual(expect.arrayContaining([{ skill: 'arcanos', expertise: false }, { skill: 'investigacion', expertise: true }]));
    expect(s.languages).toBe('Común, Élfico, Dracónico');
  });
  it('English sheet', () => {
    const s = parseSheetText(`Character name: Brom
Fighter 5
Strength 16 (+3) Dexterity 12 Constitution 15 Intelligence 10 Wisdom 11 Charisma 8
Armor Class 18  Hit Points 44  Speed 25
Skills: Athletics, Perception`);
    expect(s).toMatchObject({ name: 'Brom', classId: 'guerrero', level: 5, armorClass: 18, hpMax: 44, speed: 25 });
    expect(s.abilities.str).toBe(16);
    expect(s.abilities.cha).toBe(8);
    expect(s.skills.map((x) => x.skill).sort()).toEqual(['atletismo', 'percepcion']);
  });
});

import { mapByFieldNames } from '../pdfForm';
import { setLang } from '../../i18n';

describe('fichas escritas a mano (texto o Word)', () => {
  it('ficha en español con armas, rasgos, subclase entre paréntesis y monedas', () => {
    setLang('es');
    const s = parseSheetText(`Nombre: Aldric Martillo de Hierro
Clase: Guerrero 5 (Campeón)
Especie: Enano
Trasfondo: Soldado
Alineamiento: Legal bueno
Nivel 5   PX 6500
Fuerza 16 (+3)  Destreza 12 (+1)  Constitución 15 (+2)
Inteligencia 10 (+0)  Sabiduría 13 (+1)  Carisma 8 (-1)
Clase de armadura: 18
Puntos de golpe: 44/44
Dados de golpe: 5d10
Velocidad: 25 pies
Salvaciones: Fuerza, Constitución
Habilidades: Atletismo +6, Intimidación +2, Percepción +4, Supervivencia +4
Armas:
Hacha de batalla +6, 1d8+3 cortante
Ballesta ligera +4, 1d8+1 perforante, 80/320
Rasgos: Estilo de combate (Defensa), Tomar aliento, Oleada de acción, Crítico mejorado, Ataque extra
Idiomas: Común, Enano
Equipo: Cota de mallas, escudo, hacha de batalla, ballesta ligera y 20 virotes, mochila de explorador
Monedas: 15 po, 8 pp
`);
    expect(s.name).toBe('Aldric Martillo de Hierro');
    expect(s.classId).toBe('guerrero');
    expect(s.className).toBe('Guerrero');
    expect(s.subclass).toBe('Campeón');
    expect(s.level).toBe(5);
    expect(s.hitDie).toBe(10);
    expect(s.saveProficiencies).toEqual(['str', 'con']);
    expect(s.skills.map((x) => x.skill)).toEqual(['atletismo', 'intimidacion', 'percepcion', 'supervivencia']);
    expect(s.attacks).toEqual([
      { name: 'Hacha de batalla', attackBonus: 6, damage: '1d8+3', damageType: 'cortante', range: '', notes: '' },
      { name: 'Ballesta ligera', attackBonus: 4, damage: '1d8+1', damageType: 'perforante', range: '80/320', notes: '80/320' },
    ]);
    expect(s.classFeatures.map((f) => f.name)).toContain('Oleada de acción');
    expect(s.coins).toMatchObject({ gp: 15, sp: 8 });
  });
  it('ficha en inglés sin etiquetas: nombre, especie, subclase, salvaciones, habilidades, conjuros y espacios', () => {
    setLang('es');
    const s = parseSheetText(`Elara Moonwhisper
Level 4 Wood Elf Druid (Circle of the Moon)
STR 10 (+0) DEX 14 (+2) CON 14 (+2) INT 12 (+1) WIS 17 (+3) CHA 8 (-1)
Armor Class 13  Hit Points 31  Speed 35 ft.
Saving Throws Int +3, Wis +5
Skills Medicine +5, Nature +3, Perception +5, Survival +5
Cantrips: Druidcraft, Produce Flame, Elementalism
1st level (4 slots): Cure Wounds, Healing Word, Entangle, Faerie Fire
2nd level (3 slots): Moonbeam, Pass without Trace
Features: Wild Shape, Wild Companion, Circle of the Moon
Languages: Common, Elvish, Druidic, Sylvan
Equipment: Leather armor, wooden shield, quarterstaff, herbalism kit
Gold: 25 gp
`);
    expect(s.name).toBe('Elara Moonwhisper');
    expect(s.species).toBe('Wood Elf');
    expect(s.subclass).toBe('Circle of the Moon');
    expect(s.saveProficiencies).toEqual(['int', 'wis']);
    expect(s.skills).toHaveLength(4);
    expect(s.spells.find((x) => x.name === 'Elementalismo')?.level).toBe(0);
    expect(s.spells.find((x) => x.name === 'Rayo de luna')?.level).toBe(2);
    expect(s.spellSlots.slice(0, 2)).toEqual([4, 3]);
    expect(s.coins.gp).toBe(25);
  });
  it('«Ficha de Thalia» da el nombre', () => {
    expect(parseSheetText('Ficha de Thalia\n\nClase: Maga nivel 3. FUE 8 DES 14 CON 13 INT 17 SAB 12 CAR 10. CA 12, PG 17.').name).toBe('Thalia');
  });
});

describe('PDF rellenable de 2014 (por nombre de campo)', () => {
  const f = (name: string, value: string): FormField => ({ page: 1, cx: 0, cy: 0, name, kind: 'text', value, checked: false });
  it('deduce competencias de los bonificadores y lee la clase y la subclase', () => {
    const s = mapByFieldNames([f('CharacterName', 'Nyx'), f('ClassLevel', 'Rogue 3 (Thief)'), f('STR', '8'), f('DEX', '16'), f('CON', '12'), f('INT', '10'), f('WIS', '14'), f('CHA', '10'),
      f('ProfBonus', '+2'), f('Stealth ', '+7'), f('Perception ', '+4'), f('Athletics', '-1'), f('ST Dexterity', '+5'), f('ST Strength', '-1'), f('Spells 1014', 'Mage Hand')])!;
    expect(s.classId).toBe('picaro');
    expect(s.subclass).toBe('Thief');
    expect(s.level).toBe(3);
    expect(s.skills).toEqual([{ skill: 'percepcion', expertise: false }, { skill: 'sigilo', expertise: true }]);
    expect(s.saveProficiencies).toEqual(['dex']);
    expect(s.spells[0]?.name).toBe('Mano de mago');
  });
});
