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
