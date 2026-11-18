// Servidor de partida de «Di en Di»: se ejecuta en el PC del DM. Sirve la app web y mantiene la
// partida compartida (party, combate por turnos, log) por WebSocket. Guarda todo en un archivo
// JSON junto al ejecutable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { apply, CAMPAIGN_KIND, canEnter, canSeeImage, createRoom, enterError, exportCampaign, importCampaign, join, normalizeRoom, rid, setOnline, viewFor, type Room } from '../src/party/room';
import { CLOUD_SERVER, type ClientMessage, type CloudLinkView, type ServerMessage } from '../src/party/protocol';
import { startPublishing, stopPublishing, type PublishState } from './publish';
import { RelayHost, RelayHub, type CloudConfig } from './relay';

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
// Fichas completas que suben los jugadores cuando el DM pulsa «Sincronizar fichas»: un archivo por jugador
const SHEET_DIR = path.join(path.dirname(DATA_FILE), 'di-en-di-fichas');
const MAX_SHEET = 8 * 1024 * 1024;
// Mismo «kind» que los archivos de copia de la app (src/backup.ts), sin importarlo: arrastraría Capacitor al servidor
const BACKUP_KIND = 'di-en-di-backup';
// En Cloud Run (lo dice K_SERVICE) la dirección pública es la de la petición (https://….run.app) o la de DI_EN_DI_URL
const CLOUD = !!process.env.K_SERVICE;
const PUBLIC_URL = (process.env.DI_EN_DI_URL ?? '').replace(/\/+$/, '');
const publicUrl = (req: http.IncomingMessage) => PUBLIC_URL || (CLOUD && req.headers.host ? `https://${req.headers.host}` : '');
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

// ---------- Enlace con la nube ----------
// En la nube: hace de puente hacia las partidas de los PC enlazados (quien entra con su código va a ese PC).
const hub = new RelayHub();
// En el PC: con la clave del DM de la nube guardada, al crear la partida se enlaza con ella y el código sirve desde cualquier sitio.
const CLOUD_FILE = path.join(path.dirname(DATA_FILE), 'di-en-di-nube.json');
function loadCloud(): CloudConfig | null {
  try {
    const j = JSON.parse(fs.readFileSync(CLOUD_FILE, 'utf8')) as Partial<CloudConfig>;
    return typeof j.key === 'string' && j.key ? { url: String(j.url || CLOUD_SERVER), key: j.key } : null;
  } catch { return null; }
}
let cloudCfg = CLOUD ? null : loadCloud();
/** Una petición GET a este mismo servidor (la nube la reenvía: imágenes y fichas guardadas de los jugadores) */
function localGet(p: string): Promise<{ status: number; type: string; body: Buffer }> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 20000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, type: String(res.headers['content-type'] ?? 'application/octet-stream'), body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve({ status: 502, type: 'text/plain', body: Buffer.from('') }));
  });
}
const relay = new RelayHost({
  onPeer: (out) => {
    const peer: Peer = { send: out.send, close: out.close };
    return { message: (d) => handleMessage(peer, d), close: () => handleClose(peer) };
  },
  get: localGet,
  onStatus: (st) => {
    if (st === 'on') console.log(`\n  🌐 Enlazada con la nube: los jugadores entran con el código ${room.code} desde cualquier sitio (${cloudCfg?.url}).`);
    else if (st === 'bad-key') console.log('\n  ⚠️  La nube no acepta la clave del DM guardada: revísala en la pantalla del DM (Partida).');
    else if (st === 'unreachable') console.log('\n  ⚠️  No puedo conectar con la nube; lo sigo intentando. La red local sigue funcionando.');
    // Después: al arrancar (partida abierta y clave guardada) el enlace empieza antes de que exista la lista de conexiones
    setImmediate(broadcast);
  },
});
const cloudView = (): CloudLinkView => ({ linked: !!cloudCfg, url: cloudCfg?.url ?? CLOUD_SERVER, status: relay.status });
// El enlace se mantiene con la partida abierta, mientras haya jugadores conectados por la nube y 10 minutos más
let lingerUntil = 0;
let lingerTimer: NodeJS.Timeout | null = null;
function syncRelay() {
  if (CLOUD) return;
  const open = room.open !== false;
  if (open || relay.peerCount > 0) lingerUntil = Date.now() + 10 * 60000;
  const wanted = open || Date.now() < lingerUntil;
  relay.update({ code: room.code, open, keys: [room.dmKey, ...room.members.map((m) => m.token)] }, wanted);
  if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  if (!open && wanted) lingerTimer = setTimeout(syncRelay, lingerUntil - Date.now() + 1000);
}
relay.setConfig(cloudCfg);

let saveTimer: NodeJS.Timeout | null = null;
// Escritura sin bloquear: en la nube el disco es un depósito de Cloud Storage y cada guardado es una subida
let writing = false;
let writeAgain = false;
const writeRoom = async () => {
  if (writing) { writeAgain = true; return; }
  writing = true;
  try { await fs.promises.writeFile(DATA_FILE, JSON.stringify(room)); } catch (e) { console.error('No se pudo guardar la partida:', e); }
  writing = false;
  if (writeAgain) { writeAgain = false; void writeRoom(); }
};
const save = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void writeRoom(), 400);
  syncRelay();
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
  // Imágenes y ficha guardada de un jugador de una partida de PC enlazada: la nube se las pide a ese PC
  if (req.method === 'GET' && (url.pathname === '/api/sheet' || url.pathname.startsWith('/img/'))) {
    const tok = url.searchParams.get('token') ?? url.searchParams.get('t') ?? '';
    const host = tok && !room.members.some((m) => m.token === tok) ? hub.hostByToken(tok) : undefined;
    if (host) {
      void hub.get(host, `${url.pathname}${url.search}`).then((r) => {
        res.statusCode = r.status;
        res.setHeader('Content-Type', r.type);
        if (r.status === 200 && url.pathname.startsWith('/img/')) res.setHeader('Cache-Control', 'private, max-age=86400');
        res.end(r.body);
      });
      return;
    }
  }
  if (url.pathname === '/api/info') {
    res.setHeader('Content-Type', 'application/json');
    // El código y las direcciones solo para el DM (el servidor puede estar publicado en Internet)
    const isDm = url.searchParams.get('dm') === room.dmKey;
    // «probe»: el propio servidor comprueba que es él quien responde en 127.0.0.1:PUERTO
    const probe = url.searchParams.get('probe') === PROBE ? { probe: PROBE } : {};
    // «check»: la app pregunta si un código es de esta partida (para unirse solo con el código)
    const check = (url.searchParams.get('check') ?? '').trim().toUpperCase().slice(0, 12);
    const pub = publicUrl(req);
    // La dirección real del servicio, para las apps antiguas que no entienden la corta (PROYECTO.web.app)
    const direct = CLOUD && req.headers.host ? `https://${req.headers.host}` : '';
    res.end(JSON.stringify(isDm
      ? { app: 'di-en-di', code: room.code, port: PORT, lan: lanIps().map((ip) => `http://${ip}:${PORT}`), publish: pub ? { mode: 'cloud', url: pub, status: 'on', message: '', ...(direct && direct !== pub ? { direct } : {}) } : publish, ...probe }
      : { app: 'di-en-di', ...probe, ...(check ? checkCode(check) : {}) }));
    return;
  }
  // Fichas guardadas con «Sincronizar fichas»: cada jugador la suya (con su token); el DM, todas en un archivo de copia
  if (url.pathname === '/api/sheet' || url.pathname === '/api/sheets') {
    res.setHeader('Content-Type', 'application/json');
    const readSheet = (id: string): { characters?: unknown[] } | null => {
      try { return JSON.parse(fs.readFileSync(path.join(SHEET_DIR, `${id}.json`), 'utf8')); } catch { return null; }
    };
    if (url.pathname === '/api/sheet') {
      const token = url.searchParams.get('token');
      const m = token ? room.members.find((x) => x.token === token) : undefined;
      const file = m ? readSheet(m.id) : null;
      if (!file) { res.statusCode = 404; res.end('{"error":"no-sheet"}'); return; }
      res.end(JSON.stringify(file));
      return;
    }
    if (url.searchParams.get('dm') !== room.dmKey) { res.statusCode = 403; res.end('{"error":"not-allowed"}'); return; }
    const characters = room.members.filter((m) => m.role === 'player').flatMap((m) => readSheet(m.id)?.characters ?? []);
    res.end(JSON.stringify({ kind: BACKUP_KIND, version: 2, exportedAt: new Date().toISOString(), platform: 'servidor', characters }));
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
  // Enlace del DM: /dm (sin barra final, para que las rutas relativas de la app sigan valiendo)
  if (url.pathname === '/dm/') { res.statusCode = 302; res.setHeader('Location', `/dm${url.search}`); res.end(); return; }
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

/** ¿El código es de esta partida o de una de PC enlazada? (para unirse solo con el código) */
function checkCode(check: string) {
  const linked = hub.check(check);
  const match = canEnter(room, check) || linked === 'open';
  return { match, closed: !match && (enterError(room, check) === 'game-closed' || linked === 'closed') };
}

// ---------- WebSocket ----------

/** Un jugador conectado: un WebSocket de verdad o uno que llega por la nube (server/relay.ts) */
interface Peer { send: (data: string) => void; close: () => void }
const wss = new WebSocketServer({ noServer: true });
// /relay: los servidores de PC que se enlazan con este (con la clave del DM de aquí)
const relayWss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  const target = p === '/ws' ? wss : p === '/relay' ? relayWss : null;
  if (!target) { socket.destroy(); return; }
  target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
});
relayWss.on('connection', (ws) => hub.attach(ws, (k) => !!k && k === room.dmKey));
const clients = new Map<Peer, string>();
const send = (p: Peer, msg: ServerMessage) => p.send(JSON.stringify(msg));

function broadcast() {
  for (const [p, id] of clients) {
    const view = viewFor(room, id);
    if (view) send(p, { t: 'state', view: view.you.role === 'dm' && !CLOUD ? { ...view, cloud: cloudView() } : view });
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
  const peer: Peer = { send: (d) => { if (ws.readyState === ws.OPEN) ws.send(d); }, close: () => ws.close() };
  // Quien entra con el código (o el token) de una partida de PC enlazada va a ese PC: aquí solo se hace de puente
  let bridge: { forward: (data: string) => void; gone: () => void } | null = null;
  let waiting: string[] | null = null;

  ws.on('message', (raw) => {
    const data = String(raw);
    if (bridge) { bridge.forward(data); return; }
    if (waiting) { waiting.push(data); return; }
    if (!clients.has(peer)) {
      let msg: ClientMessage | null = null;
      try { msg = JSON.parse(data); } catch { /* lo descarta handleMessage */ }
      if (msg?.t === 'hello' && !canEnter(room, msg.code ?? '', msg.token, msg.dmKey)) {
        const queue = [data];
        waiting = queue;
        void hub.route(msg.code ?? '', msg.token, msg.dmKey, CLOUD ? 8000 : 0).then((host) => {
          waiting = null;
          if (host && ws.readyState === ws.OPEN) {
            const b = hub.bridge(host, ws);
            bridge = b;
            queue.forEach((d) => b.forward(d));
          } else if (hub.check(msg.code ?? '') === 'closed') send(peer, { t: 'error', message: 'game-closed' });
          else queue.forEach((d) => handleMessage(peer, d));
        });
        return;
      }
    }
    handleMessage(peer, data);
  });

  ws.on('close', () => {
    clearInterval(ping);
    bridge?.gone();
    handleClose(peer);
  });
});

function handleClose(peer: Peer) {
  const id = clients.get(peer);
  clients.delete(peer);
  if (id && ![...clients.values()].includes(id)) {
    room = setOnline(room, id, false);
    save();
    broadcast();
  }
}

function handleMessage(ws: Peer, data: string) {
    let msg: ClientMessage;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.t === 'hello') {
      if (!canEnter(room, msg.code ?? '', msg.token, msg.dmKey)) {
        send(ws, { t: 'error', message: enterError(room, msg.code ?? '') });
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
    // Enlace con la nube (solo el DM, en un servidor de PC): se guarda junto a la partida
    if (cmd.t === 'cloudLink') {
      if (CLOUD || room.members.find((m) => m.id === id)?.role !== 'dm') { send(ws, { t: 'error', message: 'not-allowed' }); return; }
      const key = String(cmd.key ?? '').trim();
      cloudCfg = key ? { url: String(cmd.url ?? '').trim() || CLOUD_SERVER, key } : null;
      try {
        if (cloudCfg) fs.writeFileSync(CLOUD_FILE, JSON.stringify(cloudCfg));
        else fs.rmSync(CLOUD_FILE, { force: true });
      } catch (e) { console.error('No se pudo guardar el enlace con la nube:', e); }
      console.log(cloudCfg ? `→ 🌐 Clave de la nube guardada (${cloudCfg.url}).` : '→ Enlace con la nube quitado.');
      relay.setConfig(cloudCfg);
      save();
      broadcast();
      return;
    }
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
    // Ficha completa de un jugador: se guarda en disco y a la partida solo va la hora
    if (cmd.t === 'sheetUpload') {
      const data = String(cmd.data ?? '');
      let ok = room.members.find((m) => m.id === id)?.role === 'player' && data.length > 0 && data.length <= MAX_SHEET;
      if (ok) {
        try { const j = JSON.parse(data); ok = j?.kind === BACKUP_KIND && Array.isArray(j.characters) && j.characters.length > 0; } catch { ok = false; }
      }
      if (!ok) { send(ws, { t: 'error', message: 'bad-sheet' }); return; }
      try {
        fs.mkdirSync(SHEET_DIR, { recursive: true });
        fs.writeFileSync(path.join(SHEET_DIR, `${id}.json`), data);
      } catch (e) { console.error('No se pudo guardar la ficha:', e); send(ws, { t: 'error', message: 'bad-sheet' }); return; }
      delete cmd.data;
    }
    if (cmd.t === 'imageRemove' && room.members.find((m) => m.id === id)?.role === 'dm') {
      try { fs.rmSync(path.join(IMG_DIR, `${cmd.id.replace(/[^a-z0-9]/g, '')}.jpg`), { force: true }); } catch { /* ya no está */ }
    }
    const r = apply(room, id, cmd);
    if (r.error) { send(ws, { t: 'error', message: r.error }); return; }
    room = r.room;
    for (const eff of r.effects) for (const [w, mid] of clients) if (mid === eff.to) send(w, { t: 'sheet', ops: eff.ops });
    // Sesión nueva o partida cerrada: a quien ya no está en la partida se le avisa y se le desconecta
    for (const [w, mid] of clients) {
      if (room.members.some((m) => m.id === mid)) continue;
      send(w, { t: 'error', message: room.open === false ? 'game-closed' : 'session-reset' });
      clients.delete(w);
      w.close();
    }
    if (cmd.t === 'newSession') console.log(`→ Sesión nueva. Código de la partida: ${room.code}`);
    else if (cmd.t === 'openGame') console.log(`→ 🎲 Partida creada. Código para los jugadores: ${room.code}`);
    else if (cmd.t === 'closeGame') console.log('→ Partida cerrada: nadie nuevo puede unirse con el código.');
    else if (cmd.t === 'newCode') console.log(`→ Código nuevo de la partida: ${room.code}`);
    save();
    broadcast();
}

// ---------- Arranque ----------

let publish: PublishState = { mode: 'no', url: null, status: 'off', message: '' };

function lanIpsList() { return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i!.address); }
// En Docker las IP de dentro del contenedor no le sirven a nadie: DI_EN_DI_IP dice la IP del PC (o varias, separadas por comas)
const IN_DOCKER = fs.existsSync('/.dockerenv');
const FIXED_IPS = (process.env.DI_EN_DI_IP ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const lanIps = () => (FIXED_IPS.length ? FIXED_IPS : IN_DOCKER || CLOUD ? [] : lanIpsList());

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
  const dmUrl = CLOUD ? `${PUBLIC_URL || 'https://<dirección del servicio>'}/dm?dm=${room.dmKey}` : `http://localhost:${PORT}/dm?dm=${room.dmKey}`;
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  🎲  Servidor de partida de «Di en Di»  (puerto ${PORT})\n${line}`);
  console.log(room.open === false
    ? '  Partida sin abrir: prepárala en la pantalla del DM y pulsa «🎲 Crear partida» para tener el código.'
    : `  Código de la partida:  ${room.code}`);
  if (!CLOUD) console.log(cloudCfg
    ? `  🌐 Enlazada con la nube (${cloudCfg.url}): al crear la partida, el código sirve desde cualquier sitio.`
    : '  🌐 Sin enlace con la nube: el código solo sirve en tu red. Pon la clave de la nube en la pantalla del DM (Partida).');
  console.log(`  Pantalla del DM (${CLOUD ? 'no la compartas' : 'solo en este PC, no la compartas'}):\n    ${dmUrl}`);
  console.log(`  Clave del DM (para entrar como DM desde el móvil o la tablet): ${room.dmKey}`);
  console.log('\n  Jugadores en tu misma Wi-Fi: en la app, «Partida» → dirección:');
  for (const ip of lanIps()) console.log(`    http://${ip}:${PORT}`);
  if (CLOUD) console.log('    (en la nube no hay red local: usa la dirección pública del servicio)');
  else if (!lanIps().length && IN_DOCKER) console.log(`    http://<IP de este PC>:${PORT}   (en Docker: ponla en DI_EN_DI_IP para verla aquí)`);
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
  if (saveTimer) clearTimeout(saveTimer);
  // Espera a que acabe la escritura en curso para que no pise a esta última
  const flush = async () => {
    while (writing) await new Promise((r) => setTimeout(r, 50));
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(room)); } catch { /* sin acceso al disco */ }
  };
  void flush().then(() => stopPublishing()).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 9000);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
