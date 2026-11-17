import { describe, expect, it } from 'vitest';
import { buildBackup, mergeCharacters, newerThanApp, parseBackup } from '../backup';
import { sampleCharacter } from '../rules/factory';

describe('copia de seguridad', () => {
  it('exporta y recupera fichas con sus notas', () => {
    const a = sampleCharacter();
    a.notes.push({ id: 'n1', createdAt: 1, title: 'Bram', body: 'posadero', kind: 'note', folderId: a.noteFolders[0].id });
    a.hp.current = 7;
    const { characters, exportedAt } = parseBackup(JSON.stringify(buildBackup([a])));
    expect(exportedAt).toBeTruthy();
    expect(characters[0].notes[0].title).toBe('Bram');
    expect(characters[0].hp.current).toBe(7);
  });
  it('acepta una ficha suelta y rechaza basura', () => {
    expect(parseBackup(JSON.stringify(sampleCharacter())).characters).toHaveLength(1);
    expect(() => parseBackup('{"x":1}')).toThrow();
    expect(() => parseBackup('no json')).toThrow();
  });
  it('fusiona por id o reemplaza', () => {
    const a = sampleCharacter();
    const b = sampleCharacter();
    const a2 = { ...a, level: 5 };
    const merged = mergeCharacters([a, b], [a2], 'merge');
    expect(merged.map((c) => c.level)).toEqual([5, b.level]);
    expect(mergeCharacters([a, b], [a2], 'replace')).toHaveLength(1);
  });
});

describe('archivo de guardado multiplataforma', () => {
  it('lleva notas, historial, plantillas y botines y se recupera igual', async () => {
    const { sampleCharacter } = await import('../rules/factory');
    const a = sampleCharacter();
    a.notes = [{ id: 'n1', title: 'Pista', body: 'El posadero miente', kind: 'note', createdAt: 1, folderId: a.noteFolders[0]?.id ?? null }];
    const file = buildBackup([a], {
      log: { [a.id]: [{ id: 'l1', at: 1, role: 'user', text: 'tiro sigilo', undo: a }], otro: [] },
      customItems: [{ name: 'Espada lunar', rarity: 'rare', type: 'weapon', description: '', value: 4000, qty: 1 }],
      lootBundles: [{ id: 'b1', name: 'Cofre', coins: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 }, items: [], note: '' }],
    });
    expect(file.version).toBe(2);
    expect(Object.keys(file.log!)).toEqual([a.id]);
    expect(file.log![a.id][0].undo).toBeUndefined();
    const back = parseBackup(JSON.stringify(file));
    expect(back.characters[0].notes[0].body).toBe('El posadero miente');
    expect(back.extras.customItems?.[0].name).toBe('Espada lunar');
    expect(back.extras.lootBundles?.[0].coins.gp).toBe(50);
    expect(back.extras.log?.[a.id]).toHaveLength(1);
  });

  it('abre copias de versiones antiguas aunque falten campos', () => {
    // Una ficha de las primeras versiones: sin objetos, carpetas, consumibles, multiclase…
    const old = { kind: 'di-en-di-backup', version: 1, exportedAt: '2026-10-01T10:00:00Z', characters: [
      { id: 'viejo', name: 'Gorlak', abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, hp: { max: 20, current: 12, temp: 0 }, level: 2,
        notes: [{ id: 'n', createdAt: 1, title: 'Pista', body: 'el molino', kind: 'note' }] },
    ] };
    const { characters, appVersion } = parseBackup(JSON.stringify(old));
    const c = characters[0];
    expect(appVersion).toBeUndefined();
    expect(c.name).toBe('Gorlak');
    expect(c.hp.current).toBe(12);
    expect(Array.isArray(c.items)).toBe(true);
    expect(Array.isArray(c.consumables)).toBe(true);
    expect(c.noteFolders.length).toBeGreaterThan(0);
    expect(c.notes[0].body).toBe('el molino');
  });

  it('abre copias de versiones más nuevas: ignora lo que no conoce y avisa', () => {
    const a = sampleCharacter();
    const future = { ...buildBackup([a]), version: 7, appVersion: '9.1.0', algoNuevo: { x: 1 }, characters: [{ ...a, campoDelFuturo: [1, 2, 3] }] };
    const r = parseBackup(JSON.stringify(future));
    expect(r.characters[0].name).toBe(a.name);
    expect(r.appVersion).toBe('9.1.0');
    expect(newerThanApp(r.appVersion, '0.25.0')).toBe(true);
    expect(newerThanApp('0.25.0', '0.25.0')).toBe(false);
    expect(newerThanApp('0.9.9', '0.25.0')).toBe(false);
  });
});
