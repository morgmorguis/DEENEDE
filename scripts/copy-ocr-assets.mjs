// Copia el motor de OCR (Tesseract.js) y los idiomas a public/ocr para que funcione sin internet.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
mkdirSync(join(out, 'lang'), { recursive: true });

const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'lang/spa.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];
for (const [from, to] of files) {
  const src = join(nm, from);
  if (!existsSync(src)) throw new Error(`Falta ${src}: ejecuta npm install`);
  copyFileSync(src, join(out, to));
}
console.log('OCR: archivos copiados a public/ocr');
