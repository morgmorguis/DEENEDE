import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encounterTemplateCsv, mergeLoot, parseDelimited, parseItems, readXlsx, rowsToEncounters, splitLoot } from '../encounterImport';

/** ZIP sin comprimir (método 0), suficiente para probar la lectura de .xlsx */
function zipStored(files: Record<string, string>, deflate = false): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name);
    const data = deflate ? new Uint8Array(deflateRawSync(enc.encode(text))) : enc.encode(text);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    if (deflate) local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, n.length, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    if (deflate) c.setUint16(10, 8, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out.buffer;
}

describe('importar encuentros', () => {
  it('lee CSV con «;», comillas y cabeceras en español, y rellena con la biblioteca de monstruos', () => {
    const csv = '\uFEFFLugar;Nombre;Cantidad;PG;CA;Oculto;Oro;PP;Objetos;Notas\r\n'
      + 'Taberna Malandra;Matón;3;32;11;;2;5;"Garrote; 2x Daga";\r\n'
      + 'Taberna Malandra;Goblin;2;;;sí;;;;"Huye, si puede"\r\n'
      + 'Cripta;Esqueleto;4;13;14;;;;;\r\n';
    const list = rowsToEncounters(parseDelimited(csv), 'archivo');
    expect(list.map((e) => e.name)).toEqual(['Taberna Malandra', 'Cripta']);
    const [maton, goblin] = list[0].entries;
    expect(maton).toMatchObject({ name: 'Matón', count: 3, hpMax: 32, ac: 11, hidden: false, kind: 'monster' });
    // «PP» con cabeceras en español es plata
    expect(maton.loot!.coins).toEqual({ gp: 2, sp: 5 });
    expect(maton.loot!.items!.map((i) => [i.name, i.qty])).toEqual([['Garrote', 1], ['Daga', 2]]);
    expect(goblin).toMatchObject({ hidden: true, monster: 'goblin', notes: 'Huye, si puede' });
    expect(goblin.hpMax).toBeGreaterThan(0);
    expect(goblin.ac).toBeGreaterThan(0);
  });

  it('sin columna «Lugar» todo va a un encuentro con el nombre del archivo; acepta texto pegado de Excel (tabuladores)', () => {
    const list = rowsToEncounters(parseDelimited('Name\tCount\tType\tHP\nBandit Captain\t1\tenemy\t65\nGuard\t2\tally\t11\n'), 'Camino');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Camino');
    expect(list[0].entries.map((x) => x.kind)).toEqual(['monster', 'npc']);
  });

  it('la plantilla se vuelve a importar igual', () => {
    const list = rowsToEncounters(parseDelimited(encounterTemplateCsv('es')), 'x');
    expect(list.map((e) => e.name)).toEqual(['Taberna Malandra', 'Cripta olvidada']);
    expect(list[0].entries[1]).toMatchObject({ name: 'Ladrón de bolsas', count: 2, hidden: true, loot: { coins: { gp: 3 } } });
    expect(list[0].entries[2].kind).toBe('npc');
  });

  it('lee .xlsx con varias pestañas: cada pestaña es un lugar', async () => {
    const sheet = (rows: string) => `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;
    const buf = zipStored({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Taberna Malandra" sheetId="1" r:id="rId1"/><sheet name="Puerto" sheetId="2" r:id="rId2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst><si><t>Nombre</t></si><si><t>Cantidad</t></si><si><t>Matón &amp; cía</t></si><si><r><t>Pira</t></r><r><t>ta</t></r></si></sst>',
      'xl/worksheets/sheet1.xml': sheet('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3</v></c></row>'),
      'xl/worksheets/sheet2.xml': sheet('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>PG</t></is></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2"><v>20</v></c></row>'),
    });
    const sheets = await readXlsx(buf);
    expect(sheets.map((s) => s.name)).toEqual(['Taberna Malandra', 'Puerto']);
    expect(sheets[1].rows[0]).toEqual(['Nombre', '', 'PG']);
    const list = sheets.flatMap((s) => rowsToEncounters(s.rows, s.name));
    expect(list[0].entries[0]).toMatchObject({ name: 'Matón & cía', count: 3 });
    expect(list[1].entries[0]).toMatchObject({ name: 'Pirata', hpMax: 20 });
  });

  it('lee .xlsx comprimido (como los guarda Excel)', async () => {
    const buf = zipStored({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Nombre</t></is></c><c r="B1" t="inlineStr"><is><t>Oro</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Orco</t></is></c><c r="B2"><v>12</v></c></row></sheetData></worksheet>',
    }, true);
    const [sheet] = await readXlsx(buf);
    expect(rowsToEncounters(sheet.rows, 'x')[0].entries[0]).toMatchObject({ name: 'Orco', loot: { coins: { gp: 12 } } });
  });

  it('objetos con cantidades en distintos formatos', () => {
    expect(parseItems('Llave x3, 2 Antorchas | Mapa').map((i) => `${i.qty}·${i.name}`)).toEqual(['3·Llave', '2·Antorchas', '1·Mapa']);
  });
});

describe('repartir botín', () => {
  const daga = { name: 'Daga', rarity: 'mundane' as const, type: 'weapon' as const, description: '', value: 2, qty: 3 };
  it('reparte monedas a partes iguales y lo que sobra uno a uno; los objetos, por turnos', () => {
    const parts = splitLoot({ coins: { gp: 10, sp: 5 }, items: [daga] }, 3);
    expect(parts.map((p) => p.coins.gp)).toEqual([4, 3, 3]);
    expect(parts.map((p) => p.coins.sp)).toEqual([1, 2, 2]);
    expect(parts.map((p) => p.items.map((i) => i.qty))).toEqual([[1], [1], [1]]);
    const total = parts.reduce((s, p) => s + p.coins.gp * 10 + p.coins.sp, 0);
    expect(total).toBe(105);
  });
  it('junta botines', () => {
    const m = mergeLoot([{ coins: { gp: 2 }, items: [daga] }, { coins: { gp: 3, cp: 7 }, items: [{ ...daga, qty: 1 }] }]);
    expect(m.coins).toMatchObject({ gp: 5, cp: 7 });
    expect(m.items).toEqual([{ ...daga, qty: 4 }]);
  });
});
