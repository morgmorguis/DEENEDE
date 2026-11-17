import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { sampleCharacter } from '../../rules/factory';
import { exportFileName, groupNotes, notesMarkdown, notesPdf } from '../notesExport';

describe('exportar las notas', () => {
  const setup = () => {
    const c = sampleCharacter();
    const f = c.noteFolders;
    c.notes = [
      { id: '2', createdAt: 2000, title: 'Bram', body: 'Posadero del Grifo, nos debe 20 po', kind: 'note', folderId: f[0].id },
      { id: '1', createdAt: 1000, title: 'El molino', body: 'Hay algo en el sótano 🐀', kind: 'note', folderId: f[1].id },
      { id: '3', createdAt: 3000, title: 'Suelta', body: 'Sin carpeta', kind: 'note', folderId: null },
    ];
    return c;
  };

  it('agrupa por carpeta, en orden de fecha, y deja al final las que no tienen carpeta', () => {
    const c = setup();
    const g = groupNotes(c.notes, c.noteFolders);
    expect(g.map((x) => x.notes.map((n) => n.title))).toEqual([['Bram'], ['El molino'], ['Suelta']]);
    expect(g[2].folder).toBeNull();
  });

  it('Markdown con título, carpetas y notas', () => {
    const md = notesMarkdown(setup(), setup().notes);
    expect(md).toMatch(/^# /);
    expect(md).toContain('### Bram');
    expect(md).toContain('Posadero del Grifo');
    expect(md).toContain('## ');
  });

  it('PDF legible aunque haya emojis', async () => {
    const c = setup();
    const doc = await PDFDocument.load(await notesPdf(c, c.notes));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('nombre de archivo sin tildes ni espacios', () => {
    expect(exportFileName('diario', 'Brakka Pielpétrea', 'md')).toMatch(/^diario-brakka-pielpetrea-\d{4}-\d{2}-\d{2}\.md$/);
  });
});
