// OCR sin conexión con Tesseract.js (licencia Apache 2.0). El motor y los idiomas van dentro
// de la app (public/ocr), así que funciona sin internet y sin ninguna API.
import type { Ability } from '../types';
import type { ImportedSheet } from '../ai';
import { emptySheet, parseAttackBonus, parseDamageCell, parseDamageType } from './sheetUtils';
import { findClass, parseSheetText } from './textParse';

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrPage {
  text: string;
  words: OcrWord[];
}

type Progress = (fraction: number) => void;

const asset = (p: string) => new URL(`ocr/${p}`, document.baseURI).href;

/** Reconoce el texto de varias imágenes (canvas o blobs) */
export async function recognizeImages(images: (HTMLCanvasElement | Blob)[], onProgress?: Progress): Promise<OcrPage[]> {
  const { createWorker, OEM } = await import('tesseract.js');
  let done = 0;
  const worker = await createWorker(['spa', 'eng'], OEM.LSTM_ONLY, {
    workerPath: asset('worker.min.js'),
    corePath: asset('tesseract-core-simd-lstm.wasm.js'),
    langPath: asset('lang'),
    gzip: true,
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.((done + m.progress) / images.length);
    },
  });
  const pages: OcrPage[] = [];
  try {
    for (const img of images) {
      const { data } = await worker.recognize(await prepare(img), {}, { text: true, blocks: true });
      const words: OcrWord[] = [];
      for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) {
        if (w.text.trim()) words.push({ text: w.text.trim(), ...w.bbox });
      }
      pages.push({ text: data.text, words });
      done += 1;
      onProgress?.(done / images.length);
    }
  } finally {
    await worker.terminate();
  }
  return pages;
}

/** Prepara la imagen para el OCR: tamaño cómodo para Tesseract (las fotos pequeñas se amplían y las
 *  enormes se reducen), escala de grises y contraste estirado para que el texto destaque del fondo. */
async function prepare(img: HTMLCanvasElement | Blob): Promise<HTMLCanvasElement> {
  const src: CanvasImageSource & { width: number; height: number } = img instanceof Blob ? await createImageBitmap(img) : img;
  const long = Math.max(src.width, src.height);
  const k = long < 2400 ? 2400 / long : long > 3600 ? 3600 / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const im = ctx.getImageData(0, 0, c.width, c.height); const d = im.data;
  // Niveles automáticos: el 1 % más oscuro pasa a negro y el 1 % más claro a blanco
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = g; hist[g]++; }
  const total = d.length / 4; let lo = 0; let hi = 255; let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = g; }
  ctx.putImageData(im, 0, 0);
  return c;
}

// ---------- Interpretar una foto de la hoja oficial por la posición de sus etiquetas ----------

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+-]/g, '');

interface Label { x0: number; y0: number; x1: number; y1: number; h: number }

/** Distancia de edición (para tolerar letras mal leídas: «DIL» por «DEL», «COLPE» por «GOLPE») */
function lev(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return dp[b.length];
}
/** ¿La palabra leída coincide con la de la etiqueta? (empieza igual o con un error si es larga) */
const near = (word: string, label: string) => word.startsWith(label) || (label.length >= 3 && lev(word.slice(0, label.length + 1), label) <= (label.length >= 6 ? 2 : 1) && Math.abs(word.length - label.length) <= 2);

/** Busca una etiqueta (una o varias palabras seguidas) y devuelve su caja */
function findLabel(words: OcrWord[], variants: string[][]): Label | null {
  return findLabels(words, variants)[0] ?? null;
}

/** Todas las apariciones de una etiqueta, en orden de lectura. Primero se buscan coincidencias exactas
 *  y solo si no hay ninguna se aceptan palabras con alguna letra mal leída. */
function findLabels(words: OcrWord[], variants: string[][]): Label[] {
  const scan = (eq: (word: string, label: string) => boolean) => {
    const found: Label[] = [];
    for (const v of variants) {
      for (let i = 0; i < words.length; i++) {
        if (!eq(strip(words[i].text), v[0])) continue;
        let ok = true;
        for (let j = 1; j < v.length; j++) if (!words[i + j] || !eq(strip(words[i + j].text), v[j])) ok = false;
        if (!ok) continue;
        const ws = words.slice(i, i + v.length);
        const box = { x0: Math.min(...ws.map((w) => w.x0)), y0: Math.min(...ws.map((w) => w.y0)), x1: Math.max(...ws.map((w) => w.x1)), y1: Math.max(...ws.map((w) => w.y1)) };
        // Restos de bordes leídos como letras: cajas de 1-3 píxeles de alto no son etiquetas
        if (box.y1 - box.y0 < 5) continue;
        found.push({ ...box, h: Math.max(8, box.y1 - box.y0) });
      }
    }
    return found;
  };
  const exact = scan((w, l) => w.startsWith(l));
  return exact.length ? exact : scan(near);
}

/** Números dentro de una zona; limpia restos de bordes como "17)" o "(3)" */
const numbersIn = (words: OcrWord[], x0: number, x1: number, y0: number, y1: number) =>
  words.filter((w) => (w.x0 + w.x1) / 2 >= x0 && (w.x0 + w.x1) / 2 <= x1 && (w.y0 + w.y1) / 2 >= y0 && (w.y0 + w.y1) / 2 <= y1)
    .map((w) => {
      const raw = w.text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[−–]/g, '-');
      // Dos números de recuadros vecinos pegados («1217»): nos quedamos con el primero
      const fused = raw.match(/^[^\d+-]{0,2}(\d{2})(\d{2})[^\d]{0,2}$/);
      if (fused && Number(fused[1]) >= 3 && Number(fused[1]) <= 30) return { w, t: fused[1] };
      const m = raw.match(/^[^\d+-]{0,2}([-+]?)(\d{1,3})[^\d]{0,2}$/);
      if (!m) return null;
      // "181)" suele ser "18" con el borde del recuadro pegado
      const digits = Number(m[2]) > 30 && m[2].length === 3 ? m[2].slice(0, 2) : m[2];
      return { w, t: `${m[1]}${digits}` };
    })
    .filter((x): x is { w: OcrWord; t: string } => x !== null);

/** El texto escrito justo encima de una etiqueta: solo la línea más cercana, de izquierda a derecha */
const textAbove = (words: OcrWord[], l: Label, width: number) => {
  const cand = words.filter((w) => w.y1 <= l.y0 + l.h * 0.3 && w.y1 >= l.y0 - l.h * 3 && w.x0 >= l.x0 - l.h && w.x0 <= l.x0 + width && w.y1 - w.y0 >= 5);
  if (!cand.length) return '';
  const mid = (w: OcrWord) => (w.y0 + w.y1) / 2;
  const nearest = Math.max(...cand.map(mid));
  return cand.filter((w) => nearest - mid(w) < l.h * 0.9).sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' ').trim();
};

const ABILITY_LABELS: [Ability, string[][]][] = [
  ['str', [['fuerza'], ['strength']]], ['dex', [['destreza'], ['dexterity']]], ['con', [['constitucion'], ['constitution']]],
  ['int', [['inteligencia'], ['intelligence']]], ['wis', [['sabiduria'], ['wisdom']]], ['cha', [['carisma'], ['charisma']]],
];

export function parseOcrPages(pages: OcrPage[]): ImportedSheet {
  const s = emptySheet();
  for (const { words } of pages) {
    // Cabecera: el valor está escrito encima de cada etiqueta
    const nameL = findLabel(words, [['nombre', 'del', 'personaje'], ['character', 'name']]);
    if (nameL && !s.name) s.name = textAbove(words.filter((w) => w.text.length > 1), nameL, nameL.h * 22).replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '');
    for (const classL of findLabels(words, [['clase'], ['class']])) {
      const v = textAbove(words, classL, classL.h * 10);
      const id = findClass(v);
      // Nos quedamos solo con las palabras que nombran la clase (no con números o restos de otros recuadros)
      if (id && !s.classId) { s.classId = id; s.className = v.split(/\s+/).filter((t) => findClass(t)).join(' ') || v; }
    }
    const hdL = findLabel(words, [['dados', 'de', 'golpe'], ['dados', 'de'], ['hit', 'dice']]);
    if (hdL && !s.hitDie) {
      const d = words.find((w) => /^\d*d(6|8|10|12)$/i.test(w.text) && w.y0 >= hdL.y1 - hdL.h && w.y0 <= hdL.y1 + hdL.h * 6 && w.x1 >= hdL.x0 - hdL.h * 2 && w.x0 <= hdL.x1 + hdL.h * 2);
      if (d) s.hitDie = Number(d.text.match(/d(\d+)/i)![1]);
    }
    for (const [key, variants] of [['background', [['trasfondo'], ['background']]], ['species', [['especie'], ['species']]], ['subclass', [['subclase'], ['subclass']]]] as const) {
      const l = findLabel(words, variants as unknown as string[][]);
      if (l && !s[key]) s[key] = textAbove(words, l, l.h * 10);
    }
    const lvlL = findLabel(words, [['nivel'], ['level']]);
    if (lvlL) {
      const n = numbersIn(words, lvlL.x0 - lvlL.h * 2, lvlL.x1 + lvlL.h * 2, lvlL.y0 - lvlL.h * 4, lvlL.y0);
      if (n.length) s.level = Math.min(20, Math.max(1, Number(n[n.length - 1].t)));
    }
    const acL = findLabel(words, [['armadura'], ['armor', 'class'], ['class', 'de', 'armadura']]);
    if (acL && !s.armorClass) {
      const n = numbersIn(words, acL.x0 - acL.h * 2, acL.x1 + acL.h * 2, acL.y1, acL.y1 + acL.h * 5);
      if (n.length) s.armorClass = Number(n[0].t);
    }
    const hpL = findLabel(words, [['puntos', 'de', 'golpe'], ['hit', 'points']]);
    if (hpL && !s.hpMax) {
      const n = numbersIn(words, hpL.x0 - hpL.h, hpL.x1 + hpL.h, hpL.y1, hpL.y1 + hpL.h * 9);
      if (n.length) s.hpMax = Math.max(...n.map((x) => Number(x.t)));
    }
    const spdL = findLabel(words, [['velocidad'], ['speed']]);
    if (spdL) {
      const n = numbersIn(words, spdL.x0 - spdL.h * 2, spdL.x1 + spdL.h * 2, spdL.y1, spdL.y1 + spdL.h * 4);
      if (n.length) s.speed = Number(n[0].t);
    }
    // Características: modificador (con signo) y puntuación debajo del nombre
    for (const [a, variants] of ABILITY_LABELS) {
      const l = findLabel(words, variants);
      if (!l || s.abilities[a] !== 10) continue;
      const nums = numbersIn(words, l.x0 - l.h * 3, l.x1 + l.h * 4, l.y1, l.y1 + l.h * 6);
      const values = nums.map((x) => Number(x.t));
      // El modificador puede leerse sin signo ("(3)"): buscamos una pareja puntuación/modificador coherente
      const pair = [...values].sort((a, b) => b - a).find((v) => v >= 3 && v <= 30 && values.some((m) => m !== v && Math.abs(m) === Math.abs(Math.floor((v - 10) / 2))));
      const signed = nums.find((x) => /^[-+]/.test(x.t));
      const plain = values.filter((v) => v >= 3 && v <= 30);
      const score = pair ?? (plain.length === 1 ? plain[0] : undefined) ?? (signed ? Number(signed.t) * 2 + 10 : undefined);
      if (score) s.abilities[a] = score;
    }
  }
  if (!s.attacks.length) {
    for (const { words } of pages) {
      // Solo las filas de la tabla de armas (debajo de su título), para no confundir el dado de golpe con un arma
      const head = findLabel(words, [['armas', 'y', 'trucos'], ['weapons', '&'], ['weapons', 'and'], ['ataques'], ['attacks']]);
      const area = head ? words.filter((w) => w.y0 > head.y1 && w.y0 < head.y1 + head.h * 40 && w.x1 > head.x0 - head.h * 25) : words;
      s.attacks.push(...parseWeaponRows(area));
    }
  }
  // Lo que no se haya encontrado por posición se busca en el texto corrido
  return parseSheetText(pages.map((p) => p.text).join('\n'), s);
}

/** Tabla de armas: filas con una tirada de daño ("D6+4") y, a su izquierda, el nombre */
function parseWeaponRows(words: OcrWord[]): ImportedSheet['attacks'] {
  const dice = words.filter((w) => /^\d*d(4|6|8|10|12)([+-]\d+)?/i.test(w.text) && !/^\d*d20/i.test(w.text));
  const out: ImportedSheet['attacks'] = [];
  for (const d of dice) {
    const h = Math.max(10, d.y1 - d.y0);
    const row = words.filter((w) => Math.abs((w.y0 + w.y1) / 2 - (d.y0 + d.y1) / 2) < h * 0.8);
    const name = row.filter((w) => w.x1 < d.x0 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(w.text) && !/^d20/i.test(w.text))// El nombre es la palabra más cercana por la izquierda (las de más a la izquierda son otras columnas)
      .sort((a, b) => b.x1 - a.x1)[0];
    if (!name || out.some((o) => o.name === name.text)) continue;
    const bonusWord = row.find((w) => /^(?:d20)?[+-]\d{1,2}$/i.test(w.text) && w.x1 <= d.x0);
    const after = row.filter((w) => w.x0 > d.x1).sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' ');
    out.push({
      name: name.text,
      attackBonus: bonusWord ? parseAttackBonus(bonusWord.text) : null,
      damage: parseDamageCell(d.text),
      damageType: parseDamageType(`${d.text} ${after}`),
      range: '',
      notes: '',
    });
  }
  return out;
}
