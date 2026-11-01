// «Di en Di» para Windows (jugadores): sirve la app solo para este PC y la abre en una ventana propia
// (Microsoft Edge en modo aplicación). Las fichas se guardan en el navegador de este PC; no hace falta
// ser el DM ni tener el servidor de partida. Para unirse a una partida se usa la pestaña «Partida».
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

// Puerto fijo: el navegador guarda los datos por dirección, así que debe ser siempre la misma
const PORT = Number(process.env.DI_EN_DI_PORT ?? 47800);
const URL_APP = `http://127.0.0.1:${PORT}/`;
const DIST = [path.join(__dirname, '..', '..', 'dist'), path.join(__dirname, '..', 'dist'), path.join(process.cwd(), 'dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));
const noOpen = process.argv.includes('--no-open');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.gz': 'application/gzip',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function openWindow() {
  if (noOpen) return;
  if (process.platform !== 'win32') { console.log(`Abre ${URL_APP} en tu navegador.`); return; }
  // Ventana sin barras de navegador; si Edge no está, el navegador predeterminado
  exec(`start "" msedge --app=${URL_APP} --window-size=1280,860`, (err) => { if (err) exec(`start "" "${URL_APP}"`); });
}

const server = http.createServer((req, res) => {
  if (!DIST) { res.statusCode = 500; res.end('Falta la app web en esta compilación.'); return; }
  const url = new URL(req.url ?? '/', 'http://x');
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.statusCode = 403; res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

server.on('error', (e: NodeJS.ErrnoException) => {
  // Ya hay otra copia abierta: solo abrimos otra ventana
  if (e.code === 'EADDRINUSE') { openWindow(); setTimeout(() => process.exit(0), 1500); return; }
  console.error(e);
});

// Solo escucha en este PC (127.0.0.1): nadie de la red puede entrar
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  🎲  Di en Di — abierto en una ventana nueva.');
  console.log(`      Si no se abre, entra en ${URL_APP}`);
  console.log('      Deja esta ventana abierta mientras uses la app (puedes minimizarla).\n');
  openWindow();
});
