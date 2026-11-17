import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { sampleCharacter } from '../../rules/factory';
import { buildSheetPdf, pdfSafe, sheetFields } from '../sheetPdf';

describe('exportar la ficha a la hoja oficial', () => {
  it('saca los datos de la ficha: cabecera, características, habilidades, ataques y monedas', () => {
    const c = sampleCharacter();
    c.coins = { cp: 1, sp: 0, ep: 0, gp: 12, pp: 0 };
    const f = sheetFields(c);
    expect(f.name).toBe(c.name);
    expect(f.level).toBe(String(c.level));
    expect(f.abilities.str.mod).toMatch(/^[+-]\d+$/);
    expect(Object.keys(f.skills)).toHaveLength(18);
    expect(f.attacks.length).toBe(c.attacks.length);
    expect(f.coins).toMatchObject({ cp: '1', gp: '12', sp: '' });
  });

  it('solo pasa trucos y conjuros preparados, ordenados por nivel', () => {
    const c = sampleCharacter();
    c.spells = [
      { id: '1', name: 'Bola de fuego', level: 3, prepared: true, castingTime: '1 acción', range: '150 pies', concentration: false, components: 'V, S, M' },
      { id: '2', name: 'No preparado', level: 1, prepared: false, castingTime: '', range: '', concentration: false },
      { id: '3', name: 'Luz', level: 0, prepared: false, castingTime: '1 acción', range: 'Toque', concentration: false },
    ];
    expect(sheetFields(c).spells.map((s) => [s.name, s.m])).toEqual([['Luz', false], ['Bola de fuego', true]]);
  });

  it('quita lo que la fuente del PDF no puede escribir sin perder las tildes', () => {
    expect(pdfSafe('Daño ⚔️ cortante × 2 — «Ñu»')).toBe('Daño  cortante x 2 — «Ñu»');
  });

  it('rellena una plantilla de dos páginas aunque haya emojis y textos larguísimos', async () => {
    const tpl = await PDFDocument.create();
    tpl.addPage([603, 774]);
    tpl.addPage([603, 774]);
    const c = sampleCharacter();
    c.backstory = '🐉 '.concat('Historia muy larga. '.repeat(400));
    c.name = 'Thalia ✨ la Valiente';
    const out = await buildSheetPdf(c, (await tpl.save()).buffer as ArrayBuffer);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe(c.name);
  });
});
