// Copia la guía ilustrada (docs/guia) a public/guia para abrirla dentro de la app (Ajustes → Manual).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'docs', 'guia');
const out = join(root, 'public', 'guia');
if (!existsSync(join(src, 'index.html'))) process.exit(0);
mkdirSync(join(out, 'img'), { recursive: true });
for (const f of readdirSync(join(src, 'img'))) copyFileSync(join(src, 'img', f), join(out, 'img', f));
// La guía se publica sin cabecera propia: aquí se le añade para que sea una página completa
const body = readFileSync(join(src, 'index.html'), 'utf8');
writeFileSync(join(out, 'index.html'), `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('Guía: copiada a public/guia');
