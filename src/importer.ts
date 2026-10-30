// Prepara fotos, PDF y Word para que Claude lea la ficha, y convierte el resultado en un personaje.
import type { Ability, Attack, Character, DamageType, ProfLevel } from './types';
import type { ImportBlock, ImportedSheet } from './ai';
import { blankCharacter, uid } from './rules/factory';
import { abilityMods, mod, profBonus } from './rules/calc';
import { CLASSES, RESOURCE_NAMES, SKILLS, classById, pactSlotsFor } from './rules/srd';
import { L, T, getLang } from './i18n';
import { translateCharacter } from './rules/glossary';

const MAX_SIDE = 2000;

function canvasToJpegBase64(canvas: HTMLCanvasElement, quality = 0.85) {
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

/** Reduce una imagen y la devuelve como JPEG en base64 */
export async function imageFileToBase64(file: Blob, maxSide = MAX_SIDE, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpegBase64(canvas, quality);
}

const imageBlock = (data: string): ImportBlock => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return { pdfjs, doc };
}

/** Pinta las páginas del PDF (con los valores del formulario) en canvas */
async function renderPdfPages(file: File): Promise<HTMLCanvasElement[]> {
  const { pdfjs, doc } = await loadPdf(file);
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, MAX_SIDE / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

/** Para Claude: imágenes de las páginas y los valores del formulario con su posición */
async function pdfToBlocks(file: File): Promise<ImportBlock[]> {
  const blocks: ImportBlock[] = (await renderPdfPages(file)).map((cv) => imageBlock(canvasToJpegBase64(cv)));
  const { doc } = await loadPdf(file);
  const { readFormFields } = await import('./offline/pdfForm');
  const fields = (await readFormFields(doc)).filter((f) => f.value || f.checked);
  if (fields.length) {
    const lines = fields.map((f) => `page ${f.page} (x=${Math.round(f.cx * 1000) / 10}%, y=${Math.round(f.cy * 1000) / 10}%): ${f.kind === 'check' ? '[X] (checked)' : f.value}`);
    blocks.push({ type: 'text', text: `PDF form field values (positions as % of the page, origin top-left):\n${lines.join('\n')}` });
  }
  return blocks;
}

async function docxToBlocks(file: File): Promise<ImportBlock[]> {
  const mammoth = await import('mammoth');
  const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  if (!res.value.trim()) throw new Error(T('El documento Word no contiene texto.', 'The Word document has no text.'));
  return [{ type: 'text', text: `Character sheet document text:\n"""\n${res.value.slice(0, 60000)}\n"""` }];
}

/** Convierte los archivos elegidos por el usuario en bloques de contenido para Claude */
export async function filesToBlocks(files: File[]): Promise<ImportBlock[]> {
  const blocks: ImportBlock[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) blocks.push(...(await pdfToBlocks(file)));
    else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) blocks.push(...(await docxToBlocks(file)));
    else if (name.endsWith('.doc')) throw new Error(T('Los archivos .doc antiguos no se pueden leer; guárdalo como .docx o PDF.', 'Old .doc files can’t be read; save it as .docx or PDF.'));
    else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/.test(name)) blocks.push(imageBlock(await imageFileToBase64(file)));
    else if (file.type.startsWith('text/') || name.endsWith('.txt')) blocks.push({ type: 'text', text: await file.text() });
    else throw new Error(T(`No sé leer el archivo ${file.name}.`, `I can’t read the file ${file.name}.`));
  }
  return blocks;
}

const DAMAGE_IDS: DamageType[] = ['acido', 'contundente', 'frio', 'fuego', 'fuerza', 'relampago', 'necrotico', 'perforante', 'veneno', 'psiquico', 'radiante', 'cortante', 'trueno'];
const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const clampScore = (n: number) => Math.max(1, Math.min(30, Math.round(n) || 10));

/** Convierte lo leído por Claude en una ficha de la app. Si se pasa `base`, conserva su id, notas y retrato. */
export function sheetToCharacter(s: ImportedSheet, base?: Character): Character {
  const c = blankCharacter();
  if (base) {
    c.id = base.id;
    c.notes = base.notes;
    c.noteFolders = base.noteFolders;
    c.portrait = base.portrait;
  }
  const cls = (s.classId ? CLASSES.find((x) => x.id === s.classId) : undefined) ?? classById(s.className);
  c.name = s.name.trim() || T('Aventurero', 'Adventurer');
  c.species = s.species;
  c.classId = cls?.id ?? '';
  c.className = s.className || (cls ? L(cls.name) : '');
  c.subclass = s.subclass;
  c.background = s.background;
  c.level = Math.max(1, Math.min(20, s.level || 1));
  c.xp = Math.max(0, s.xp || 0);
  c.alignment = s.alignment;
  c.size = s.size;
  for (const a of ABILITIES) c.abilities[a] = clampScore(s.abilities[a]);
  c.saveProf = ABILITIES.filter((a) => s.saveProficiencies.includes(a));
  if (c.saveProf.length === 0 && cls) c.saveProf = [...cls.saves];
  for (const sk of s.skills) if (SKILLS.some((x) => x.id === sk.skill)) c.skillProf[sk.skill] = (sk.expertise ? 2 : 1) as ProfLevel;

  // La hoja indica la CA total; si marca escudo, la base es 2 menos
  c.shield = s.shield;
  c.baseAc = Math.max(1, (s.armorClass || 10) - (s.shield ? 2 : 0));
  c.acNote = '';
  c.speed = s.speed || 30;
  c.hp.max = Math.max(1, s.hpMax || 1);
  c.hp.current = Math.max(0, Math.min(c.hp.max, s.hpCurrent ?? c.hp.max));
  c.hp.temp = Math.max(0, s.hpTemp || 0);
  c.hitDie = s.hitDie && [6, 8, 10, 12].includes(s.hitDie) ? s.hitDie : cls?.hitDie ?? 8;
  c.hitDiceSpent = Math.max(0, Math.min(c.level, s.hitDiceSpent || 0));
  c.heroicInspiration = s.heroicInspiration;

  // Ataques: elegimos la característica que mejor explica el bonificador escrito
  const mods = abilityMods(c);
  const pb = profBonus(c.level);
  c.attacks = s.attacks.filter((a) => a.name.trim()).map((a): Attack => {
    const candidates: Ability[] = ['str', 'dex', 'int', 'wis', 'cha'];
    let ability: Ability = mods.dex > mods.str ? 'dex' : 'str';
    let extra = 0;
    if (a.attackBonus != null) {
      ability = candidates.reduce((best, x) => (Math.abs(mods[x] + pb - a.attackBonus!) < Math.abs(mods[best] + pb - a.attackBonus!) ? x : best), ability);
      extra = a.attackBonus - (mods[ability] + pb);
    }
    // El daño escrito suele incluir el modificador ("1d6+4"): nos quedamos con los dados
    const dice = (a.damage.match(/\d*d\d+(?:\s*\+\s*\d*d\d+)*/i)?.[0]?.replace(/\s/g, '') ?? (a.damage || '1')).toLowerCase();
    return {
      id: uid(),
      name: a.name.trim(),
      ability,
      proficient: true,
      damage: dice.startsWith('d') ? `1${dice}` : dice,
      damageType: DAMAGE_IDS.includes(a.damageType as DamageType) ? (a.damageType as DamageType) : 'cortante',
      range: a.range,
      extraBonus: extra,
      notes: a.notes,
    };
  });

  c.spellAbility = ABILITIES.includes(s.spellcastingAbility as Ability) ? (s.spellcastingAbility as Ability) : cls?.spellAbility ?? null;
  if (cls?.caster === 'pact') {
    const pact = pactSlotsFor(c.level);
    c.pactSlots = { ...pact, max: s.spellSlots.find((n) => n > 0) ?? pact.max, used: 0 };
  } else {
    const slots = s.spellSlots.slice(0, 9).map((n) => Math.max(0, Math.round(n) || 0));
    while (slots.length && slots[slots.length - 1] === 0) slots.pop();
    c.slots = slots.map((n, i) => ({ max: n, used: Math.min(n, s.spellSlotsUsed?.[i] ?? 0) }));
  }
  c.spells = s.spells.filter((x) => x.name.trim()).map((x) => ({ id: uid(), name: x.name.trim(), level: Math.max(0, Math.min(9, x.level || 0)), prepared: true, castingTime: x.castingTime, range: x.range, concentration: x.concentration, ritual: x.ritual, material: x.material, notes: x.notes }));
  c.features = s.classFeatures.filter((x) => x.name.trim() || x.text.trim()).map((x) => ({ id: uid(), name: x.name, text: x.text }));
  c.speciesTraits = s.speciesTraits;
  c.feats = s.feats;
  c.armorTraining = { ...s.armorTraining };
  c.weaponProf = s.weaponProficiencies;
  c.toolProf = s.toolProficiencies;
  c.languages = s.languages;
  c.inventory = s.equipment;
  c.attunement = [0, 1, 2].map((i) => s.attunement[i] ?? '');
  c.coins = { cp: s.coins.cp || 0, sp: s.coins.sp || 0, ep: s.coins.ep || 0, gp: s.coins.gp || 0, pp: s.coins.pp || 0 };
  c.appearance = s.appearance;
  c.backstory = s.backstory;
  if (cls) {
    c.resources = cls.resources(c.level, abilityMods(c)).map((r) => ({ id: uid(), key: r.key, name: L(RESOURCE_NAMES[r.key]), max: r.max, used: 0, recovers: r.recovers }));
  }
  // Rasgos de clase conocidos sin descripción: usamos la de la app
  if (cls) {
    const known = cls.features(c.level);
    c.features = c.features.map((f) => {
      const k = known.find((x) => [x.name.es, x.name.en].some((n) => n.toLowerCase() === f.name.trim().toLowerCase()));
      return k && !f.text.trim() ? { ...f, text: L(k.text) } : f;
    });
  }
  // Los términos (equipo, idiomas, conjuros, rasgos…) se traducen al idioma de la app
  return translateCharacter(c, getLang());
}

/** Resumen rápido para la vista previa */
export const sheetSummary = (c: Character) => ({
  mods: ABILITIES.map((a) => `${a.toUpperCase()} ${c.abilities[a]} (${mod(c.abilities[a]) >= 0 ? '+' : ''}${mod(c.abilities[a])})`),
  skills: Object.values(c.skillProf).filter(Boolean).length,
});

// ---------- Importación sin IA ----------

export type OfflineMethod = 'pdf-form' | 'ocr' | 'text';

/**
 * Lee la ficha sin ninguna API: formularios PDF por posición, Word/texto con un intérprete
 * de etiquetas y fotos o PDF escaneados con OCR (Tesseract.js) dentro del propio móvil.
 */
export async function importOffline(files: File[], pasted: string, onProgress?: (msg: string, fraction?: number) => void): Promise<{ sheet: ImportedSheet; method: OfflineMethod }> {
  const { emptySheet } = await import('./offline/sheetUtils');
  const { parseSheetText } = await import('./offline/textParse');
  let sheet = emptySheet();
  let method: OfflineMethod = 'text';
  const images: (HTMLCanvasElement | Blob)[] = [];
  const texts: string[] = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      onProgress?.(T('Leyendo el PDF…', 'Reading the PDF…'));
      const { doc } = await loadPdf(file);
      const form = await import('./offline/pdfForm');
      const fields = await form.readFormFields(doc);
      const filled = fields.filter((f) => f.value || f.checked);
      if (filled.length && form.looksLikeOfficial2024(fields)) {
        sheet = form.mapOfficial2024(fields);
        method = 'pdf-form';
        continue;
      }
      const byName = filled.length ? form.mapByFieldNames(fields) : null;
      if (byName) {
        sheet = byName;
        method = 'pdf-form';
        continue;
      }
      // PDF escaneado o sin campos: lo pasamos por OCR
      images.push(...(await renderPdfPages(file)));
    } else if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
      const mammoth = await import('mammoth');
      texts.push((await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value);
    } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/.test(name)) {
      images.push(file);
    } else if (file.type.startsWith('text/') || name.endsWith('.txt')) {
      texts.push(await file.text());
    } else if (name.endsWith('.doc')) {
      throw new Error(T('Los archivos .doc antiguos no se pueden leer; guárdalo como .docx o PDF.', 'Old .doc files can’t be read; save it as .docx or PDF.'));
    }
  }

  if (images.length) {
    onProgress?.(T('Reconociendo el texto (OCR)… puede tardar un poco', 'Recognizing text (OCR)… this can take a while'), 0);
    const ocr = await import('./offline/ocr');
    const pages = await ocr.recognizeImages(images, (f) => onProgress?.(T('Reconociendo el texto (OCR)…', 'Recognizing text (OCR)…'), f));
    const fromOcr = ocr.parseOcrPages(pages);
    sheet = method === 'pdf-form' ? sheet : fromOcr;
    if (method !== 'pdf-form') method = 'ocr';
    sheet.warnings.push(T('Leído con OCR: revisa los números y marca a mano las competencias (las casillas no se pueden leer en fotos).', 'Read with OCR: check the numbers and tick proficiencies by hand (checkboxes can’t be read from photos).'));
  }
  if (pasted.trim()) texts.push(pasted);
  if (texts.length) sheet = parseSheetText(texts.join('\n'), sheet);
  if (!sheet.name && !sheet.classId && Object.values(sheet.abilities).every((v) => v === 10)) {
    throw new Error(T('No he encontrado datos de personaje. Prueba con una foto más nítida y recta, o rellena la hoja a mano.', 'I couldn’t find character data. Try a sharper, straighter photo, or fill in the sheet by hand.'));
  }
  return { sheet, method };
}
