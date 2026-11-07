// Servidor de partida de «Di en Di»: se ejecuta en el PC del DM. Sirve la app web y mantiene la
// partida compartida (party, combate por turnos, log) por WebSocket. Guarda todo en un archivo
// JSON junto al ejecutable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import { apply, CAMPAIGN_KIND, canSeeImage, createRoom, exportCampaign, importCampaign, join, normalizeRoom, rid, setOnline, viewFor, type Room } from '../src/party/room';
import type { ClientMessage, ServerMessage } from '../src/party/protocol';
import { startPublishing, stopPublishing, type PublishState } from './publish';

const args = process.argv.slice(2);
const argValue = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
// Puerto: el pedido con --port, o el 3000; si está ocupado por otro programa (p. ej. una IA local) se busca otro libre
const FIXED_PORT = argValue('--port') ?? process.env.PORT;
let PORT = Number(FIXED_PORT ?? 3000);
const packaged = !!(process as unknown as { pkg?: unknown }).pkg;
const HOME = packaged ? path.dirname(process.execPath) : process.cwd();
const DATA_FILE = argValue('--data') ?? path.join(HOME, 'di-en-di-partida.json');
// Imágenes que comparte el DM: un archivo por imagen, junto a la partida
const IMG_DIR = path.join(path.dirname(DATA_FILE), 'di-en-di-imagenes');
const MAX_IMAGE = 6 * 1024 * 1024;
const DIST = [path.join(__dirname, '..', '..', 'dist'), path.join(__dirname, '..', 'dist'), path.join(process.cwd(), 'dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));

// ---------- Partida guardada ----------

function load(): Room {
  try {
    const r = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Room;
    r.members.forEach((m) => { m.online = false; });
    return normalizeRoom(r);
  } catch {
    return createRoom();
  }
}
let room = load();
let saveTimer: NodeJS.Timeout | null = null;
const save = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(room)); } catch (e) { console.error('No se pudo guardar la partida:', e); }
  }, 400);
};
save();

// ---------- HTTP: app web + información ----------

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204; res.end(); return;
  }
  if (url.pathname === '/api/info') {
    res.setHeader('Content-Type', 'application/json');
    // El código y las direcciones solo para el DM (el servidor puede estar publicado en Internet)
    const isDm = url.searchParams.get('dm') === room.dmKey;
    // «probe»: el propio servidor comprueba que es él quien responde en 127.0.0.1:PUERTO
    const probe = url.searchParams.get('probe') === PROBE ? { probe: PROBE } : {};
    res.end(JSON.stringify(isDm
      ? { app: 'di-en-di', code: room.code, port: PORT, lan: lanIps().map((ip) => `http://${ip}:${PORT}`), publish, ...probe }
      : { app: 'di-en-di', ...probe }));
    return;
  }
  // Copia de la campaña (solo el DM): todo lo que ha creado, con las imágenes dentro
  if (url.pathname === '/api/export' || url.pathname === '/api/import') {
    res.setHeader('Content-Type', 'application/json');
    if (url.searchParams.get('dm') !== room.dmKey) { res.statusCode = 403; res.end('{"error":"not-allowed"}'); return; }
    if (url.pathname === '/api/export') {
      const data = exportCampaign(room);
      for (const im of data.images) {
        try { im.data = fs.readFileSync(path.join(IMG_DIR, `${im.id}.jpg`)).toString('base64'); } catch { /* sin archivo */ }
      }
      res.end(JSON.stringify({ kind: CAMPAIGN_KIND, version: 1, exportedAt: new Date().toISOString(), room: data }));
      return;
    }
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"post"}'); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > 300 * 1024 * 1024) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const data = body?.room ?? body;
        let imgs = 0;
        for (const im of Array.isArray(data?.images) ? data.images : []) {
          const id = String(im?.id ?? '').replace(/[^a-z0-9]/g, '');
          if (!id || typeof im.data !== 'string') continue;
          fs.mkdirSync(IMG_DIR, { recursive: true });
          fs.writeFileSync(path.join(IMG_DIR, `${id}.jpg`), Buffer.from(im.data, 'base64'));
          imgs++;
        }
        room = importCampaign(room, data);
        save();
        broadcast();
        console.log(`→ Copia de la campaña restaurada (${imgs} imagen(es)).`);
        res.end(JSON.stringify({ ok: true, images: imgs }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }
  // /img/<id>.jpg?t=<token del miembro>: solo quien puede verla
  const im = url.pathname.match(/^\/img\/([a-z0-9]{6,20})\.jpg$/);
  if (im) {
    const member = room.members.find((m) => m.token === url.searchParams.get('t'));
    const meta = room.images.find((x) => x.id === im[1]);
    const file = path.join(IMG_DIR, `${im[1]}.jpg`);
    if (!member || !meta || !canSeeImage(room, member, meta) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (!DIST) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Servidor de Di en Di funcionando. (La app web no está incluida en esta compilación.)');
    return;
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.statusCode = 403; res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

// ---------- WebSocket ----------

const wss = new WebSocketServer({ server, path: '/ws' });
// ws reenvía los errores del servidor HTTP (p. ej. puerto ocupado): se tratan abajo
wss.on('error', () => { /* lo gestiona server.on('error') */ });
const clients = new Map<WebSocket, string>();
const send = (ws: WebSocket, msg: ServerMessage) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

function broadcast() {
  for (const [ws, id] of clients) {
    const view = viewFor(room, id);
    if (view) send(ws, { t: 'state', view });
  }
}

wss.on('connection', (ws) => {
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const ping = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, 20000);

  ws.on('message', (data) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (msg.t === 'hello') {
      if (msg.code.trim().toUpperCase() !== room.code && msg.dmKey !== room.dmKey) {
        send(ws, { t: 'error', message: 'bad-code' });
        return;
      }
      const j = join(room, msg.name ?? '', msg.token, msg.dmKey, !!msg.viewer);
      room = j.room;
      clients.set(ws, j.member.id);
      send(ws, { t: 'welcome', id: j.member.id, token: j.member.token, role: j.member.role });
      console.log(`→ ${j.member.role === 'dm' ? 'DM' : 'Jugador'} conectado: ${j.member.name}`);
      save();
      broadcast();
      return;
    }
    const id = clients.get(ws);
    if (!id || msg.t !== 'cmd') return;
    const cmd = msg.cmd;
    // Imagen nueva del DM: se guarda en disco y a la partida solo van sus datos
    if (cmd.t === 'imageAdd') {
      const me = room.members.find((m) => m.id === id);
      const b64 = String(cmd.data ?? '').replace(/^data:image\/jpeg;base64,/, '');
      if (me?.role !== 'dm' || !b64 || b64.length > MAX_IMAGE * 1.4) { send(ws, { t: 'error', message: 'bad-image' }); return; }
      const imgId = rid(12);
      try {
        fs.mkdirSync(IMG_DIR, { recursive: true });
        fs.writeFileSync(path.join(IMG_DIR, `${imgId}.jpg`), Buffer.from(b64, 'base64'));
      } catch (e) { console.error('No se pudo guardar la imagen:', e); send(ws, { t: 'error', message: 'bad-image' }); return; }
      cmd.id = imgId;
      delete cmd.data;
    }
    if (cmd.t === 'imageRemove' && room.members.find((m) => m.id === id)?.role === 'dm') {
      try { fs.rmSync(path.join(IMG_DIR, `${cmd.id.replace(/[^a-z0-9]/g, '')}.jpg`), { force: true }); } catch { /* ya no está */ }
    }
    const r = apply(room, id, cmd);
    if (r.error) { send(ws, { t: 'error', message: r.error }); return; }
    room = r.room;
    for (const eff of r.effects) for (const [w, mid] of clients) if (mid === eff.to) send(w, { t: 'sheet', ops: eff.ops });
    save();
    broadcast();
  });

  ws.on('close', () => {
    clearInterval(ping);
    const id = clients.get(ws);
    clients.delete(ws);
    if (id && ![...clients.values()].includes(id)) {
      room = setOnline(room, id, false);
      save();
      broadcast();
    }
  });
});

// ---------- Arranque ----------

let publish: PublishState = { mode: 'no', url: null, status: 'off', message: '' };

function lanIpsList() { return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i!.address); }
const lanIps = lanIpsList;

// En Windows otro programa puede escuchar solo en 127.0.0.1 en el mismo puerto y «tapar» a este servidor
// (el túnel de Tailscale va a 127.0.0.1). Antes de publicar comprobamos que quien responde somos nosotros.
const PROBE = rid(16);
function answersHere(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: `/api/info?probe=${PROBE}`, timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body).probe === PROBE); } catch { resolve(false); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}
let shadowed = false;

// Si el puerto está ocupado: con --port avisamos; si no, probamos los siguientes (3001, 3002…)
let tries = 0;
server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code !== 'EADDRINUSE') { console.error(e); return; }
  if (!FIXED_PORT && tries < 30) {
    console.log(`  El puerto ${PORT} lo usa otro programa; pruebo con el ${PORT + 1}…`);
    tries++;
    PORT += 1;
    setTimeout(() => server.listen(PORT), 100);
    return;
  }
  console.error(`\n  ⚠️  El puerto ${PORT} lo está usando otro programa. Cierra ese programa o abre el servidor con otro puerto, por ejemplo:\n     "Di en Di - Servidor.exe" --port ${PORT + 100}\n`);
  // Dejamos la ventana abierta un rato para que se pueda leer el aviso
  setTimeout(() => process.exit(1), 60000);
});

server.on('listening', async () => {
  // ¿Otro programa responde en 127.0.0.1 con este mismo puerto? Entonces buscamos otro (o no publicamos)
  if (!(await answersHere(PORT))) {
    if (!FIXED_PORT && tries < 30) {
      console.log(`  En 127.0.0.1:${PORT} responde otro programa; pruebo con el ${PORT + 1}…`);
      tries++;
      server.close(() => { PORT += 1; server.listen(PORT); });
      return;
    }
    shadowed = true;
    console.log(`\n  ⚠️  En 127.0.0.1:${PORT} responde otro programa: no publico en Internet para no exponerlo. Abre el servidor con otro puerto (--port ${PORT + 100}).`);
  }
  const dmUrl = `http://localhost:${PORT}/?dm=${room.dmKey}`;
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  🎲  Servidor de partida de «Di en Di»  (puerto ${PORT})\n${line}`);
  console.log(`  Código de la partida:  ${room.code}`);
  console.log(`  Pantalla del DM (solo en este PC, no la compartas):\n    ${dmUrl}`);
  console.log(`  Clave del DM (para entrar como DM desde el móvil o la tablet): ${room.dmKey}`);
  console.log('\n  Jugadores en tu misma Wi-Fi: en la app, «Partida» → dirección:');
  for (const ip of lanIps()) console.log(`    http://${ip}:${PORT}`);
  console.log(`\n  Partida guardada en: ${DATA_FILE}`);
  console.log(`${line}\n  Deja esta ventana abierta mientras jugáis. Ctrl+C para cerrar.\n`);
  if (process.platform === 'win32' && !args.includes('--no-open')) exec(`start "" "${dmUrl}"`);
  // Publicar en Internet (Tailscale Funnel / ngrok) sin tocar la red local
  if (args.includes('--no-publish') || shadowed) return;
  void startPublishing(PORT, HOME, (st) => {
    publish = st;
    if (st.status === 'on' && st.url) console.log(`\n  🌍 Jugadores a distancia: ${st.url}\n     (o directamente ${st.url}/?join=${room.code})\n     ${st.message}`);
    else if (st.status === 'error') console.log(`\n  ⚠️  ${st.message}\n     La red local sigue funcionando.`);
    else if (st.status === 'off') console.log(`\n  ℹ️  ${st.message}`);
    broadcast();
  });
});
server.listen(PORT);

let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(room)); } catch { /* sin acceso al disco */ }
  void stopPublishing().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 9000);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
