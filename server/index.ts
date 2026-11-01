// Servidor de partida de «Di en Di»: se ejecuta en el PC del DM. Sirve la app web y mantiene la
// partida compartida (party, combate por turnos, log) por WebSocket. Guarda todo en un archivo
// JSON junto al ejecutable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import { apply, createRoom, join, normalizeRoom, setOnline, viewFor, type Room } from '../src/party/room';
import type { ClientMessage, ServerMessage } from '../src/party/protocol';

const args = process.argv.slice(2);
const argValue = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const PORT = Number(argValue('--port') ?? process.env.PORT ?? 3000);
const packaged = !!(process as unknown as { pkg?: unknown }).pkg;
const HOME = packaged ? path.dirname(process.execPath) : process.cwd();
const DATA_FILE = argValue('--data') ?? path.join(HOME, 'di-en-di-partida.json');
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
  if (url.pathname === '/api/info') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ app: 'di-en-di', code: room.code, players: room.members.filter((m) => m.role === 'player').length }));
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
      const j = join(room, msg.name ?? '', msg.token, msg.dmKey);
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
    const r = apply(room, id, msg.cmd);
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

const lanIps = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i!.address);

server.listen(PORT, () => {
  const dmUrl = `http://localhost:${PORT}/?dm=${room.dmKey}`;
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  🎲  Servidor de partida de «Di en Di»\n${line}`);
  console.log(`  Código de la partida:  ${room.code}`);
  console.log(`  Pantalla del DM (solo en este PC, no la compartas):\n    ${dmUrl}`);
  console.log(`  Clave del DM (para entrar como DM desde el móvil o la tablet): ${room.dmKey}`);
  console.log('\n  Jugadores en tu misma Wi-Fi: en la app, «Partida» → dirección:');
  for (const ip of lanIps()) console.log(`    http://${ip}:${PORT}`);
  console.log('\n  Jugadores a distancia (Tailscale Funnel), en otra ventana:');
  console.log(`    tailscale funnel ${PORT}`);
  console.log('    y comparte la dirección https://….ts.net que te muestre.');
  console.log(`\n  Partida guardada en: ${DATA_FILE}`);
  console.log(`${line}\n  Deja esta ventana abierta mientras jugáis. Ctrl+C para cerrar.\n`);
  if (process.platform === 'win32' && !args.includes('--no-open')) exec(`start "" "${dmUrl}"`);
});

const shutdown = () => {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(room)); } catch { /* sin acceso al disco */ }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
