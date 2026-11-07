// Importa las imágenes de IA al estilo «Retro»: recorta, reduce a resolución de pixel art con paleta limitada
// y las deja en public/design/retro con los nombres que usa la app.
// Uso: node scripts/retro/import-ai-art.cjs <carpeta> [--sin-pixelar] [--colores 48]
//   ocaso/bosque/cumbres/abismo/mar/mazmorra/ciudadela/cripta → 320×320 (fondos)
//   fx-combat / fx-levelup → 270×480 (ilustraciones de las transiciones)
//   icon → icon-512/192/64.png
// Necesita ImageMagick («magick» en Windows, «convert» en Linux).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) { console.error('Uso: node scripts/retro/import-ai-art.cjs <carpeta> [--sin-pixelar] [--colores 48]'); process.exit(1); }
const noPixel = args.includes('--sin-pixelar');
const ci = args.indexOf('--colores');
const colors = ci >= 0 ? Number(args[ci + 1]) : 48;
const out = path.join(__dirname, '../../public/design/retro');
fs.mkdirSync(out, { recursive: true });

const magick = (() => { for (const cmd of ['magick', 'convert']) { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return cmd; } catch { /* siguiente */ } } console.error('Falta ImageMagick: https://imagemagick.org'); process.exit(1); })();

const SIZES = { ocaso: [320, 320], bosque: [320, 320], cumbres: [320, 320], abismo: [320, 320], mar: [320, 320], mazmorra: [320, 320], ciudadela: [320, 320], cripta: [320, 320], 'fx-combat': [270, 480], 'fx-levelup': [270, 480], icon: [64, 64] };
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
let n = 0;
for (const [name, [w, h]] of Object.entries(SIZES)) {
  const file = files.find((f) => f.toLowerCase().replace(/\.[^.]+$/, '').replace(/_\d+_?$/, '') === name) ?? files.find((f) => f.toLowerCase().startsWith(name));
  if (!file) continue;
  const src = path.join(dir, file);
  // Escenas y transiciones: recorte centrado, pixelado (reducción + paleta) o tamaño grande sin pixelar
  const scale = noPixel ? 4 : 1;
  const target = name === 'icon' ? path.join(out, 'icon-512.png') : path.join(out, `${name}.png`);
  const ops = [src, '-resize', `${w * scale}x${h * scale}^`, '-gravity', 'center', '-extent', `${w * scale}x${h * scale}`];
  if (!noPixel) ops.push('-dither', 'FloydSteinberg', '-colors', String(colors));
  if (name === 'icon') ops.push('-filter', 'point', '-resize', '512x512');
  ops.push('-depth', '8', target);
  execFileSync(magick, ops);
  if (name === 'icon') for (const s of [64, 192]) execFileSync(magick, [target, '-filter', 'point', '-resize', `${s}x${s}`, path.join(out, `icon-${s}.png`)]);
  console.log(`✓ ${file} → ${path.relative(process.cwd(), target)}`);
  n++;
}
console.log(n ? `${n} imagen(es) importadas. Compila la app (npm run build) para verlas.` : 'No he encontrado imágenes con los nombres esperados (ocaso.png, bosque.png…).');
