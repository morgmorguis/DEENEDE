import { describe, expect, it } from 'vitest';
import { buildXlsx, crc32 } from '../xlsx';
import { characterMarkdown, characterRows, dmMarkdown, lootPerEnemyRows, lootPerGroupRows, lootValue, mdTable } from '../dmExport';
import { readXlsx, rowsToEncounters } from '../../party/encounterImport';
import { encountersRows } from '../../party/encounterImport';
import type { PreparedEncounter } from '../../party/protocol';
import { sampleCharacter } from '../../rules/factory';
import { setLang } from '../../i18n';

setLang('es');

const tavern: PreparedEncounter = {
  id: 'e1', name: 'Taberna Malandra', notes: '', entries: [
    { id: 'a', name: 'Matón', kind: 'monster', count: 3, hidden: false, hpMax: 32, ac: 11, initBonus: 0, cr: '1/2', loot: { coins: { gp: 2, sp: 5 }, items: [{ name: 'Garrote', rarity: 'mundane', type: 'weapon', description: '', value: 0.1, qty: 1 }] } },
    { id: 'b', name: 'Ladrón', kind: 'monster', count: 2, hidden: true, hpMax: 9, ac: 12, initBonus: 2, loot: { coins: { gp: 3 } } },
    { id: 'c', name: 'Tabernero', kind: 'npc', count: 1, hidden: false, hpMax: 16, ac: 12, initBonus: 1 },
  ],
};

describe('excel del dm', () => {
  it('crc32 conocido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('el .xlsx que escribimos se vuelve a leer igual, con acentos y caracteres raros', async () => {
    const bytes = buildXlsx([{ name: 'Hoja: rara/1', rows: [['Nombre', 'PG'], ['Señor <oscuro> & "cía"', 45], [null, 3]] }, { name: 'Otra', rows: [['x']] }]);
    const sheets = await readXlsx(bytes.slice().buffer);
    expect(sheets.map((s) => s.name)).toEqual(['Hoja  rara 1', 'Otra']);
    expect(sheets[0].rows).toEqual([['Nombre', 'PG'], ['Señor <oscuro> & "cía"', '45'], ['', '3']]);
  });

  it('los encuentros exportados a Excel se vuelven a importar', async () => {
    const bytes = buildXlsx([{ name: 'Encuentros', rows: encountersRows([tavern], 'es') }]);
    const [sheet] = await readXlsx(bytes.slice().buffer);
    const back = rowsToEncounters(sheet.rows, 'x');
    expect(back).toHaveLength(1);
    expect(back[0].name).toBe('Taberna Malandra');
    expect(back[0].entries.map((e) => [e.name, e.count, e.hidden, e.loot?.coins?.gp ?? 0])).toEqual([['Matón', 3, false, 2], ['Ladrón', 2, true, 3], ['Tabernero', 1, false, 0]]);
  });

  it('tesoro de cada enemigo y de cada grupo', () => {
    expect(lootValue(tavern.entries[0].loot)).toBe(2.6);
    const per = lootPerEnemyRows([tavern]);
    expect(per).toHaveLength(3); // cabecera + 2 que llevan algo
    expect(per[1]).toEqual(['Taberna Malandra', 'Matón', 3, '2 po, 5 pp', 'Garrote', 2.6, 7.8]);
    const group = lootPerGroupRows([tavern]);
    expect(group[1].slice(0, 3)).toEqual(['Taberna Malandra', 6, 5]);
    expect(group[1][4]).toBe('3 × Garrote');
    expect(group[1][5]).toBe(13.8);
  });

  it('markdown: tablas sin columnas vacías y escapando «|»', () => {
    expect(mdTable([['A', 'B', 'C'], ['x|y', '', 1]])).toBe('| A | C |\n| --- | --- |\n| x\\|y | 1 |\n');
    const md = dmMarkdown({ roster: [], encounters: [tavern], loot: [], gifts: [], log: [] }, () => '');
    expect(md).toContain('### Taberna Malandra');
    expect(md).toContain('## Tesoro por grupo');
  });

  it('ficha de personaje en filas y en markdown', () => {
    const c = sampleCharacter();
    c.name = 'Grubnak';
    const rows = characterRows(c);
    expect(rows[0]).toEqual(['Campo', 'Valor', 'Extra']);
    expect(rows.some((r) => r[0] === 'Nombre' && r[1] === 'Grubnak')).toBe(true);
    const md = characterMarkdown(c);
    expect(md.startsWith('# Grubnak')).toBe(true);
    expect(md).toContain('## Características');
  });
});
