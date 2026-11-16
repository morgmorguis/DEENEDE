// Genera docs/MAPA.md: una línea por archivo de código con su tamaño, para qué sirve (el comentario de la
// primera línea) y lo que exporta. Sirve a los agentes (Codex, Claude Code) para encontrar dónde tocar sin
// abrir archivos enteros. Se regenera solo en cada `npm run build` (y a mano con `npm run mapa`).
// La salida no lleva fechas: si el código no cambia, el archivo tampoco.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'server', 'scripts'];
const EXT = /\.(ts|tsx|mjs|cjs|py)$/;
const SKIP = /(__tests__|node_modules|__pycache__|\/build\/|\/salida\/|vite-env\.d\.ts$)/;
const BIG = 40 * 1024;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = relative(root, p).replaceAll('\\', '/');
    if (SKIP.test(rel + (statSync(p).isDirectory() ? '/' : ''))) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (EXT.test(name)) out.push(rel);
  }
  return out;
}

function describe(text) {
  // Primer bloque de comentarios del archivo (// o #), unido en una frase y recortado
  const lines = [];
  for (const raw of text.split('\n').slice(0, 8)) {
    const l = raw.trim();
    if (l.startsWith('#!')) continue;
    const m = l.match(/^(?:\/\/\/?|#)\s?(.*)$/);
    if (!m) break;
    lines.push(m[1]);
  }
  const s = lines.join(' ').replace(/\s+/g, ' ').trim();
  return s.length > 160 ? s.slice(0, 157).replace(/\s\S*$/, '') + '…' : s;
}

function exportsOf(text) {
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  if (/^export\s+default\s+function\s*\(/m.test(text)) names.add('default');
  const list = [...names];
  return list.length > 12 ? list.slice(0, 12).join(', ') + `… (+${list.length - 12})` : list.join(', ');
}

const tests = [];
const rows = {};
for (const d of DIRS) {
  for (const f of walk(join(root, d))) {
    const text = readFileSync(join(root, f), 'utf8');
    const kb = Math.max(1, Math.round(Buffer.byteLength(text) / 1024));
    const big = Buffer.byteLength(text) > BIG ? ' ⚠️' : '';
    const desc = describe(text);
    const ex = /\.(ts|tsx)$/.test(f) ? exportsOf(text) : '';
    const folder = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
    (rows[folder] ??= []).push(`- \`${f.slice(folder.length + 1)}\` ${kb} KB${big}${desc ? ` — ${desc}` : ''}${ex ? ` · exporta: ${ex}` : ''}`);
  }
}
for (const d of ['src']) {
  const find = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? readdirSync(p).filter((t) => t.endsWith('.test.ts')).map((t) => relative(root, join(p, t)).replaceAll('\\', '/')) : find(p);
    return [];
  });
  tests.push(...find(join(root, d)).sort());
}

let md = `# Mapa del código de Di en Di

GENERADO por \`scripts/mapa.mjs\` (se actualiza solo con \`npm run build\`, o con \`npm run mapa\`): no lo edites a mano.
Una línea por archivo: tamaño, para qué sirve (su primer comentario) y qué exporta. ⚠️ = más de 40 KB: busca con
\`rg -n\` y lee solo el trozo que necesites.
`;
for (const folder of Object.keys(rows).sort()) md += `\n## ${folder}/\n\n${rows[folder].join('\n')}\n`;
md += `\n## Tests\n\n${tests.map((t) => `- \`${t}\``).join('\n')}\n`;

const out = join(root, 'docs', 'MAPA.md');
let old = '';
try { old = readFileSync(out, 'utf8'); } catch { /* no existía */ }
if (old !== md) { writeFileSync(out, md); console.log('Mapa del código: docs/MAPA.md actualizado'); }
