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

describe('imágenes compartidas en el diario', () => {
  it('la imagen de una nota se exporta igual venga como data URL o en base64', () => {
    const c = sampleCharacter();
    const b64 = '/9j/4AAQSkZJRgABAQ==';
    c.notes = [
      { id: 'a', createdAt: 1, title: 'Mapa', body: '', kind: 'note', folderId: null, image: `data:image/jpeg;base64,${b64}`, imageKey: 'compartido/img:x', ref: 'img:x' },
      { id: 'b', createdAt: 2, title: 'Retrato', body: '', kind: 'note', folderId: null, image: b64 },
    ];
    const md = notesMarkdown(c, c.notes);
    expect(md).toContain(`![Mapa](data:image/jpeg;base64,${b64})`);
    expect(md).toContain(`![Retrato](data:image/jpeg;base64,${b64})`);
    expect(md).not.toContain('base64,data:');
  });

  it('la carpeta de lo compartido se llama «Compartido conmigo»', () => {
    const c = sampleCharacter();
    expect(c.noteFolders.find((f) => f.key === 'shared')?.name).toBe('Compartido conmigo');
  });
});
