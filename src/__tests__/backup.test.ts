import { describe, expect, it } from 'vitest';
import { buildBackup, mergeCharacters, parseBackup } from '../backup';
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
