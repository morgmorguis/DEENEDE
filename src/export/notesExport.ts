// Exporta el diario (notas, crónicas e imágenes del DM) a Markdown o a un PDF propio, por carpetas y en orden de fecha.
import type { Character, Note, NoteFolder } from '../types';
import { DEFAULT_FOLDERS } from '../rules/srd';
import { L, T, locale } from '../i18n';
import { stripDataUrl } from '../sharedImages';
import { pdfSafe } from './sheetPdf';

const folderName = (f?: NoteFolder | null) => {
  if (!f) return T('Sin categoría', 'No category');
  const d = f.key ? DEFAULT_FOLDERS.find((x) => x.key === f.key) : undefined;
  return d ? L(d.name) : f.name;
};
const dateText = (at: number) => new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

/** Notas agrupadas por carpeta (en el orden de las carpetas; las sin carpeta al final) y de la más antigua a la más reciente */
export function groupNotes(notes: Note[], folders: NoteFolder[]): { folder: NoteFolder | null; notes: Note[] }[] {
  const byDate = [...notes].sort((a, b) => a.createdAt - b.createdAt);
  const groups = folders.map((f) => ({ folder: f as NoteFolder | null, notes: byDate.filter((n) => n.folderId === f.id) }));
  const known = new Set(folders.map((f) => f.id));
  groups.push({ folder: null, notes: byDate.filter((n) => !n.folderId || !known.has(n.folderId)) });
  return groups.filter((g) => g.notes.length);
}

/** Diario en Markdown */
export function notesMarkdown(c: Character, notes: Note[], title?: string): string {
  const out = [`# ${title ?? T(`Diario de ${c.name}`, `${c.name}’s journal`)}`, '', `_${T('Exportado de Di en Di el', 'Exported from Di en Di on')} ${dateText(Date.now())}_`, ''];
  for (const g of groupNotes(notes, c.noteFolders)) {
    out.push(`## ${folderName(g.folder)}`, '');
    for (const n of g.notes) {
      out.push(`### ${n.title || T('Sin título', 'Untitled')}`, `_${dateText(n.createdAt)}_`, '');
      if (n.image) out.push(`![${n.title}](data:image/jpeg;base64,${stripDataUrl(n.image)})`, '');
      if (n.body.trim()) out.push(n.body.trim(), '');
    }
  }
  return `${out.join('\n').trim()}\n`;
}

/** Diario en PDF (A4), con las imágenes que compartió el DM */
export async function notesPdf(c: Character, notes: Note[], title?: string): Promise<Uint8Array> {
  const pdf = await import('pdf-lib');
  const doc = await pdf.PDFDocument.create();
  const font = await doc.embedFont(pdf.StandardFonts.TimesRoman);
  const bold = await doc.embedFont(pdf.StandardFonts.TimesRomanBold);
  const ital = await doc.embedFont(pdf.StandardFonts.TimesRomanItalic);
  const W = 595, H = 842, M = 56, LW = W - 2 * M;
  const ink = pdf.rgb(0.13, 0.1, 0.08);
  const accent = pdf.rgb(0.55, 0.12, 0.1);
  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const ensure = (h: number) => { if (y - h < M) newPage(); };
  const wrap = (text: string, f: typeof font, size: number) => {
    const lines: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      let cur = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) <= LW || !cur) cur = next; else { lines.push(cur); cur = w; }
      }
      lines.push(cur);
    }
    return lines;
  };
  const write = (text: string, f: typeof font, size: number, color = ink, gap = 0.35) => {
    for (const l of wrap(text, f, size)) {
      ensure(size * 1.3);
      page.drawText(l, { x: M, y: y - size, size, font: f, color });
      y -= size * 1.3;
    }
    y -= size * gap;
  };
  write(title ?? T(`Diario de ${c.name}`, `${c.name}’s journal`), bold, 22, accent, 0.2);
  write(`${T('Exportado de Di en Di el', 'Exported from Di en Di on')} ${dateText(Date.now())}`, ital, 10, ink, 1.2);
  for (const g of groupNotes(notes, c.noteFolders)) {
    ensure(60);
    y -= 6;
    write(folderName(g.folder).toUpperCase(), bold, 13, accent, 0.2);
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.8, color: accent });
    y -= 10;
    for (const n of g.notes) {
      ensure(40);
      write(n.title || T('Sin título', 'Untitled'), bold, 12, ink, 0.1);
      write(dateText(n.createdAt), ital, 9, ink, 0.6);
      if (n.image) {
        try {
          const img = await doc.embedJpg(Uint8Array.from(atob(stripDataUrl(n.image)), (ch) => ch.charCodeAt(0)));
          const scale = Math.min(LW / img.width, 260 / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          ensure(h + 8);
          page.drawImage(img, { x: M, y: y - h, width: w, height: h });
          y -= h + 8;
        } catch { /* imagen dañada: se omite */ }
      }
      if (n.body.trim()) write(n.body.trim(), font, 10.5, ink, 0.9);
      else y -= 6;
    }
  }
  doc.setTitle(pdfSafe(title ?? c.name));
  doc.setCreator('Di en Di');
  return doc.save();
}

/** Nombre de archivo seguro: «diario-thalia-2026-11-17.md» */
export const exportFileName = (base: string, name: string, ext: string) =>
  `${base}-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'personaje'}-${new Date().toISOString().slice(0, 10)}.${ext}`;
