// Servidor de partida de «Di en Di»: se ejecuta en el PC del DM (una partida) o en la nube (la principal y las que
// piden los PC). Sirve la app web y mantiene cada partida compartida (party, combate por turnos, log) por WebSocket.
// Guarda todo en archivos JSON junto al ejecutable (o en /datos en la nube).
// En el PC el DM elige al crear la partida: «en casa» (el código lleva la dirección del PC en la Wi-Fi) o «en la nube»
// (el PC se enlaza solo con la nube y los jugadores entran con el código desde cualquier sitio).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { apply, CAMPAIGN_KIND, canEnter, canSeeImage, createRoom, enterError, exportCampaign, importCampaign, join, newCode, normalizeRoom, rid, setOnline, viewFor, type Room } from '../src/party/room';
import { CLOUD_SERVER, type ClientMessage, type Command as ClientCommand, type NetView, type ServerMessage } from '../src/party/protocol';
import { isLanIp, lanAddress, lanCode } from '../src/party/lanCode';
import { RelayHost, RelayHub, resolveCloud, type CloudConfig } from './relay';

const args = process.argv.slice(2);
const argValue = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
// Puerto: el pedido con --port, o el 3000; si está ocupado por otro programa (p. ej. una IA local) se busca otro libre
const FIXED_PORT = argValue('--port') ?? process.env.PORT;
let PORT = Number(FIXED_PORT ?? 3000);
const packaged = !!(process as unknown as { pkg?: unknown }).pkg;
const HOME = packaged ? path.dirname(process.execPath) : process.cwd();
const DATA_FILE = argValue('--data') ?? path.join(HOME, 'di-en-di-partida.json');
const DATA_DIR = path.dirname(DATA_FILE);
// Imágenes que comparte el DM: un archivo por imagen, junto a la partida
const IMG_DIR = path.join(DATA_DIR, 'di-en-di-imagenes');
const MAX_IMAGE = 6 * 1024 * 1024;
// Fichas completas que suben los jugadores cuando el DM pulsa «Sincronizar fichas»: un archivo por jugador
const SHEET_DIR = path.join(DATA_DIR, 'di-en-di-fichas');
const MAX_SHEET = 8 * 1024 * 1024;
// Mismo «kind» que los archivos de copia de la app (src/backup.ts), sin importarlo: arrastraría Capacitor al servidor
const BACKUP_KIND = 'di-en-di-backup';
// En Cloud Run (lo dice K_SERVICE) la dirección pública es la de la petición (https://….run.app) o la de DI_EN_DI_URL
const CLOUD = !!process.env.K_SERVICE;
const PUBLIC_URL = (process.env.DI_EN_DI_URL ?? '').replace(/\/+$/, '');
const DIST = [path.join(__dirname, '..', '..', 'dist'), path.join(__dirname, '..', 'dist'), path.join(process.cwd(), 'dist')].find((p) => fs.existsSync(path.join(p, 'index.html')));

// ---------- Red de casa ----------
// Interfaces de red de mentira (máquinas virtuales, WSL, VPN…): su dirección no le sirve a nadie de la Wi-Fi
const VIRTUAL = /vethernet|virtualbox|vmware|vmnet|hyper-v|wsl|docker|tailscale|zerotier|hamachi|vpn|loopback|bluetooth/i;
// En Docker las IP de dentro del contenedor no le sirven a nadie: DI_EN_DI_IP dice la IP del PC
const FIXED_IP = (process.env.DI_EN_DI_IP ?? '').split(',').map((x) => x.trim()).find(isLanIp);
/** La IP de este PC en la red de casa (192.168.x.x antes que 10.x.x.x y que 172.16-31.x.x), o null */
function lanIp(): string | null {
  if (FIXED_IP) return FIXED_IP;
  if (CLOUD) return null;
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, list]) => (list ?? []).map((i) => ({ name, address: i.address, family: i.family, internal: i.internal })))
    .filter((i) => i.family === 'IPv4' && !i.internal && isLanIp(i.address) && !VIRTUAL.test(i.name));
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return all.sort((x, y) => rank(x.address) - rank(y.address))[0]?.address ?? null;
}
/** Código de 8 letras de una partida en casa (con la dirección del PC dentro) */
const localCode = () => { const ip = lanIp(); return ip ? lanCode(ip, PORT) : null; };

// ---------- Partidas ----------
// La principal es la de siempre (DATA_FILE). En la nube, además, las que se crean desde la app («Crear partida»):
// cada una en su carpeta de di-en-di-partidas/ y se borran tras EXPIRE_DAYS días sin uso (el DM guarda una copia en su
// dispositivo y puede restaurarla con la misma clave).
const MULTI = CLOUD || args.includes('--multi');
const GAMES_DIR = path.join(DATA_DIR, 'di-en-di-partidas');
const DAY = 24 * 3600 * 1000;
const EXPIRE_DAYS = Number(process.env.DI_EN_DI_DIAS ?? 5);
const MAX_GAMES = 300;
const NEW_PER_DAY = 10;

/** Un jugador conectado: un WebSocket de verdad o uno que llega por la nube (server/relay.ts) */
interface Peer { send: (data: string) => void; close: () => void }

interface Game {
  id: string;
  room: Room;
  file: string;
  imgDir: string;
  sheetDir: string;
  /** Creada desde la app: caduca tras días sin uso */
  extra: boolean;
  usedAt: number;
  clients: Map<Peer, string>;
  saveTimer: NodeJS.Timeout | null;
  writing: boolean;
  writeAgain: boolean;
}

function readRoom(file: string): { room: Room; usedAt: number } | null {
  try {
    const r = JSON.parse(fs.readFileSync(file, 'utf8')) as Room & { usedAt?: number };
    const usedAt = Number(r.usedAt) || Date.now();
    delete r.usedAt;
    r.members.forEach((m) => { m.online = false; });
    return { room: normalizeRoom(r), usedAt };
  } catch {
    return null;
  }
}

function makeGame(id: string, file: string, imgDir: string, sheetDir: string, extra: boolean, room: Room, usedAt = Date.now()): Game {
  return { id, room, file, imgDir, sheetDir, extra, usedAt, clients: new Map(), saveTimer: null, writing: false, writeAgain: false };
}
const extraGame = (id: string, room: Room, usedAt?: number) => {
  const dir = path.join(GAMES_DIR, id);
  return makeGame(id, path.join(dir, 'partida.json'), path.join(dir, 'imagenes'), path.join(dir, 'fichas'), true, room, usedAt);
};

const main = makeGame('principal', DATA_FILE, IMG_DIR, SHEET_DIR, false, readRoom(DATA_FILE)?.room ?? createRoom());
const games = new Map<string, Game>([[main.id, main]]);
if (MULTI) {
  try {
    for (const id of fs.readdirSync(GAMES_DIR)) {
      if (!/^[a-z0-9]{6,20}$/.test(id)) continue;
      const loaded = readRoom(path.join(GAMES_DIR, id, 'partida.json'));
      if (loaded) games.set(id, extraGame(id, loaded.room, loaded.usedAt));
    }
  } catch { /* aún no hay partidas creadas desde la app */ }
}
const allGames = () => [...games.values()];
const findGame = (code: string, token?: string, dmKey?: string) => allGames().find((g) => canEnter(g.room, code, token, dmKey));
const gameByDm = (key: string | null | undefined) => (key ? allGames().find((g) => g.room.dmKey === key) : undefined);
const gameByToken = (tok: string | null | undefined) => (tok ? allGames().find((g) => g.room.members.some((m) => m.token === tok)) : undefined);
/** Error al entrar con un código que no abre ninguna partida */
const enterErrorAll = (code: string) => {
  const c = code.trim().toUpperCase();
  const g = allGames().find((x) => x.room.code === c);
  return g ? enterError(g.room, c) : 'bad-code';
};
/** Que dos partidas no compartan código */
function uniqueCode(g: Game) {
  while (allGames().some((o) => o !== g && o.room.code === g.room.code)) g.room.code = newCode(g.room.code);
}
const touch = (g: Game) => { g.usedAt = Date.now(); };

// ---------- Enlace con la nube ----------
// En la nube: hace de puente hacia las partidas de los PC enlazados (quien entra con su código va a ese PC).
const hub = new RelayHub();
// En el PC, partida «en la nube»: el PC pide a la nube una entrada (una clave) y la guarda en di-en-di-nube.json. Todo
// automático: si la nube ya no la acepta (caducó tras días sin usarse) pide otra. El DM y los jugadores no ven nada de esto.
const CLOUD_FILE = path.join(DATA_DIR, 'di-en-di-nube.json');
const CLOUD_URL = argValue('--nube') ?? process.env.DI_EN_DI_NUBE ?? CLOUD_SERVER;
function loadCloud(): CloudConfig | null {
  try {
    const j = JSON.parse(fs.readFileSync(CLOUD_FILE, 'utf8')) as Partial<CloudConfig>;
    return typeof j.key === 'string' && j.key ? { url: CLOUD_URL, key: j.key } : null;
  } catch { return null; }
}
let cloudCfg: CloudConfig | null = CLOUD ? null : loadCloud();
function saveCloud(cfg: CloudConfig | null) {
  cloudCfg = cfg;
  try {
    if (cfg) fs.writeFileSync(CLOUD_FILE, JSON.stringify(cfg));
    else fs.rmSync(CLOUD_FILE, { force: true });
  } catch (e) { console.error('No se pudo guardar el enlace con la nube:', e); }
  relay.setConfig(cfg);
}
/** La partida del PC se juega en la nube ahora mismo (abierta y no «en casa») */
const cloudMode = () => !CLOUD && main.room.open !== false && main.room.mode !== 'local';
/** Pide a la nube una entrada para este PC; si falla, lo reintenta mientras la partida siga en la nube */
let autoLinking = false;
let linkFailed = false;
let linkRetry: NodeJS.Timeout | null = null;
async function autoLink() {
  if (CLOUD || autoLinking || cloudCfg || !cloudMode()) return;
  autoLinking = true;
  if (linkRetry) { clearTimeout(linkRetry); linkRetry = null; }
  broadcast(main);
  try {
    const base = await resolveCloud(CLOUD_URL);
    const r = await fetch(`${base}/api/new`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'pc' }), signal: AbortSignal.timeout(15000) });
    const j = await r.json() as { dmKey?: string; error?: string };
    if (!r.ok || !j.dmKey) throw new Error(j.error ?? String(r.status));
    linkFailed = false;
    autoLinking = false;
    saveCloud({ url: CLOUD_URL, key: j.dmKey });
    syncRelay();
  } catch (e) {
    autoLinking = false;
    if (!linkFailed) console.log(`\n  ⚠️  No consigo conectar con la nube (${String(e)}). Lo sigo intentando: comprueba la conexión a Internet de este PC.`);
    linkFailed = true;
    linkRetry = setTimeout(() => { linkRetry = null; void autoLink(); }, 20000);
  }
  broadcast(main);
}

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
    if (st === 'on' && cloudMode()) console.log(`→ 🌍 Partida en la nube lista: los jugadores entran con el código ${main.room.code} desde cualquier sitio.`);
    // La entrada que pidió el PC ha caducado (o la nube se ha reinstalado): se pide otra, sin molestar al DM
    else if (st === 'bad-key') { saveCloud(null); void autoLink(); }
    // Después: al arrancar (partida abierta y clave guardada) el enlace empieza antes de que exista la lista de conexiones
    setImmediate(() => broadcast(main));
  },
});
/** Cómo llegan los jugadores a la partida del PC (solo lo ve el DM) */
const netView = (): NetView => {
  const ip = lanIp();
  let cloud: NetView['cloud'] = 'off';
  if (cloudMode()) {
    if (relay.status === 'on') cloud = 'on';
    else if (relay.status === 'unreachable' || (linkFailed && !autoLinking)) cloud = 'unreachable';
    else cloud = 'connecting';
  }
  return { lan: ip ? `http://${ip}:${PORT}` : null, cloud };
};
// El enlace se mantiene con la partida en la nube abierta, mientras haya jugadores conectados por la nube y 10 minutos más
let lingerUntil = 0;
let lingerTimer: NodeJS.Timeout | null = null;
function syncRelay() {
  if (CLOUD) return;
  const room = main.room;
  const open = cloudMode();
  if (open || relay.peerCount > 0) lingerUntil = Date.now() + 10 * 60000;
  const wanted = open || Date.now() < lingerUntil;
  relay.update({ code: room.code, open, keys: [room.dmKey, ...room.members.map((m) => m.token)] }, wanted);
  if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  if (!open && wanted) lingerTimer = setTimeout(syncRelay, lingerUntil - Date.now() + 1000);
  if (open && !cloudCfg) void autoLink();
}
relay.setConfig(cloudCfg);

// Escritura sin bloquear: en la nube el disco es un depósito de Cloud Storage y cada guardado es una subida
const writeGame = async (g: Game) => {
  if (g.writing) { g.writeAgain = true; return; }
  g.writing = true;
  try {
    if (g.extra) await fs.promises.mkdir(path.dirname(g.file), { recursive: true });
    await fs.promises.writeFile(g.file, JSON.stringify(g.extra ? { ...g.room, usedAt: g.usedAt } : g.room));
  } catch (e) { console.error('No se pudo guardar la partida:', e); }
  g.writing = false;
  if (g.writeAgain) { g.writeAgain = false; void writeGame(g); }
};
const save = (g: Game) => {
  if (g.saveTimer) clearTimeout(g.saveTimer);
  g.saveTimer = setTimeout(() => void writeGame(g), 400);
  if (g === main) syncRelay();
};
save(main);

/** Borra las partidas creadas desde la app que llevan EXPIRE_DAYS días sin uso (y sin nadie dentro ni un PC enlazado) */
function sweep() {
  const limit = Date.now() - EXPIRE_DAYS * DAY;
  for (const g of allGames()) {
    if (!g.extra) continue;
    if (g.clients.size || hub.hasKey(g.room.dmKey)) { touch(g); continue; }
    if (g.usedAt > limit) continue;
    games.delete(g.id);
    fs.promises.rm(path.dirname(g.file), { recursive: true, force: true }).catch(() => undefined);
    console.log(`→ 🗑️  Partida ${g.id} borrada tras ${EXPIRE_DAYS} días sin uso.`);
  }
}
if (MULTI) { sweep(); setInterval(sweep, 3600 * 1000).unref(); }

// Crear partidas desde la app: un límite por conexión y día para que nadie llene la nube
const created = new Map<string, number[]>();
const clientIp = (req: http.IncomingMessage) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';

// ---------- HTTP: app web + información ----------

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

/** Lee el cuerpo JSON de una petición (con un tope de tamaño) */
function readJson(req: http.IncomingMessage, max: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > max) { req.destroy(); reject(new Error('too-big')); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/** Guarda las imágenes de una copia de campaña en la carpeta de la partida */
function writeCampaignImages(g: Game, data: { images?: unknown }): number {
  let imgs = 0;
  for (const im of Array.isArray(data?.images) ? data.images as { id?: unknown; data?: unknown }[] : []) {
    const id = String(im?.id ?? '').replace(/[^a-z0-9]/g, '');
    if (!id || typeof im.data !== 'string') continue;
    fs.mkdirSync(g.imgDir, { recursive: true });
    fs.writeFileSync(path.join(g.imgDir, `${id}.jpg`), Buffer.from(im.data, 'base64'));
    imgs++;
  }
  return imgs;
}

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
    const host = tok && !gameByToken(tok) ? hub.hostByToken(tok) : undefined;
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
  // Crear una partida en la nube desde la app (sin clave): devuelve la clave del DM. Con `dmKey` y `campaign`
  // restaura una que caducó (la copia que guardó el DM en su dispositivo), con la misma clave.
  if (url.pathname === '/api/new') {
    res.setHeader('Content-Type', 'application/json');
    if (!MULTI) { res.statusCode = 404; res.end('{"error":"no-multi"}'); return; }
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"post"}'); return; }
    void readJson(req, 300 * 1024 * 1024).then((body) => {
      const b = (body ?? {}) as { dmKey?: unknown; campaign?: unknown; title?: unknown; purpose?: unknown };
      // Las partidas se crean solo desde el servidor del PC del DM (no desde la app)
      if (b.purpose !== 'pc') { res.statusCode = 403; res.end('{"error":"pc-only"}'); return; }
      const ip = clientIp(req);
      const today = (created.get(ip) ?? []).filter((t) => t > Date.now() - DAY);
      const extras = allGames().filter((g) => g.extra).length;
      const wantKey = typeof b.dmKey === 'string' && /^[a-z0-9]{8,24}$/.test(b.dmKey) ? b.dmKey : '';
      const existing = gameByDm(wantKey);
      // Restaurar una que aún existe: no hace falta crear nada
      if (existing) { touch(existing); res.end(JSON.stringify({ dmKey: existing.room.dmKey, code: existing.room.code, existed: true })); return; }
      if (today.length >= NEW_PER_DAY) { res.statusCode = 429; res.end('{"error":"too-many"}'); return; }
      if (extras >= MAX_GAMES) { res.statusCode = 503; res.end('{"error":"full"}'); return; }
      let id = rid(10);
      while (games.has(id)) id = rid(10);
      const room = createRoom();
      if (wantKey) room.dmKey = wantKey;
      // Abierta desde el principio: el DM ya tiene el código para los jugadores
      room.open = true;
      const g = extraGame(id, room);
      games.set(id, g);
      uniqueCode(g);
      const camp = b.campaign as { room?: unknown } | undefined;
      if (camp && typeof camp === 'object') {
        const data = (camp.room ?? camp) as Parameters<typeof importCampaign>[1];
        writeCampaignImages(g, data as { images?: unknown });
        g.room = importCampaign(g.room, data);
      }
      created.set(ip, [...today, Date.now()]);
      save(g);
      console.log(`→ 🎲 Partida nueva creada desde la app (${id}${camp ? ', restaurada de una copia' : ''}). Partidas: ${games.size}.`);
      res.end(JSON.stringify({ dmKey: g.room.dmKey, code: g.room.code, restored: !!camp }));
    }).catch((e) => { res.statusCode = 400; res.end(JSON.stringify({ error: String(e) })); });
    return;
  }
  if (url.pathname === '/api/info') {
    res.setHeader('Content-Type', 'application/json');
    // El código y las direcciones solo para el DM (el servidor puede estar publicado en Internet)
    const dmGame = gameByDm(url.searchParams.get('dm'));
    // «probe»: el propio servidor comprueba que es él quien responde en 127.0.0.1:PUERTO
    const probe = url.searchParams.get('probe') === PROBE ? { probe: PROBE } : {};
    // «check»: la app pregunta si un código es de esta partida (para unirse solo con el código)
    const check = (url.searchParams.get('check') ?? '').trim().toUpperCase().slice(0, 12);
    res.end(JSON.stringify(dmGame
      ? { app: 'di-en-di', code: dmGame.room.code, port: PORT, multi: MULTI, ...probe }
      : { app: 'di-en-di', multi: MULTI, ...probe, ...(check ? checkCode(check) : {}), ...(url.searchParams.has('dm') ? { known: false } : {}) }));
    return;
  }
  // Fichas guardadas con «Sincronizar fichas»: cada jugador la suya (con su token); el DM, todas en un archivo de copia
  if (url.pathname === '/api/sheet' || url.pathname === '/api/sheets') {
    res.setHeader('Content-Type', 'application/json');
    const readSheet = (g: Game, id: string): { characters?: unknown[] } | null => {
      try { return JSON.parse(fs.readFileSync(path.join(g.sheetDir, `${id}.json`), 'utf8')); } catch { return null; }
    };
    if (url.pathname === '/api/sheet') {
      const token = url.searchParams.get('token');
      const g = gameByToken(token);
      const m = g?.room.members.find((x) => x.token === token);
      const file = g && m ? readSheet(g, m.id) : null;
      if (!file) { res.statusCode = 404; res.end('{"error":"no-sheet"}'); return; }
      res.end(JSON.stringify(file));
      return;
    }
    const g = gameByDm(url.searchParams.get('dm'));
    if (!g) { res.statusCode = 403; res.end('{"error":"not-allowed"}'); return; }
    const characters = g.room.members.filter((m) => m.role === 'player').flatMap((m) => readSheet(g, m.id)?.characters ?? []);
    res.end(JSON.stringify({ kind: BACKUP_KIND, version: 2, exportedAt: new Date().toISOString(), platform: 'servidor', characters }));
    return;
  }
  // Copia de la campaña (solo el DM): todo lo que ha creado, con las imágenes dentro
  if (url.pathname === '/api/export' || url.pathname === '/api/import') {
    res.setHeader('Content-Type', 'application/json');
    const g = gameByDm(url.searchParams.get('dm'));
    if (!g) { res.statusCode = 403; res.end('{"error":"not-allowed"}'); return; }
    if (url.pathname === '/api/export') {
      const data = exportCampaign(g.room);
      for (const im of data.images) {
        try { im.data = fs.readFileSync(path.join(g.imgDir, `${im.id}.jpg`)).toString('base64'); } catch { /* sin archivo */ }
      }
      res.end(JSON.stringify({ kind: CAMPAIGN_KIND, version: 1, exportedAt: new Date().toISOString(), room: data }));
      return;
    }
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"post"}'); return; }
    void readJson(req, 300 * 1024 * 1024).then((body) => {
      const data = ((body as { room?: unknown })?.room ?? body) as Parameters<typeof importCampaign>[1];
      const imgs = writeCampaignImages(g, data as { images?: unknown });
      g.room = importCampaign(g.room, data);
      touch(g);
      save(g);
      broadcast(g);
      console.log(`→ Copia de la campaña restaurada (${imgs} imagen(es)).`);
      res.end(JSON.stringify({ ok: true, images: imgs }));
    }).catch((e) => { res.statusCode = 400; res.end(JSON.stringify({ error: String(e) })); });
    return;
  }
  // /img/<id>.jpg?t=<token del miembro>: solo quien puede verla
  const im = url.pathname.match(/^\/img\/([a-z0-9]{6,20})\.jpg$/);
  if (im) {
    const g = gameByToken(url.searchParams.get('t'));
    const member = g?.room.members.find((m) => m.token === url.searchParams.get('t'));
    const meta = g?.room.images.find((x) => x.id === im[1]);
    const file = g ? path.join(g.imgDir, `${im[1]}.jpg`) : '';
    if (!g || !member || !meta || !canSeeImage(g.room, member, meta) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
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

/** ¿El código es de alguna partida de aquí o de una de PC enlazada? (para unirse solo con el código) */
function checkCode(check: string) {
  const linked = hub.check(check);
  const match = !!findGame(check) || linked === 'open';
  return { match, closed: !match && (enterErrorAll(check) === 'game-closed' || linked === 'closed') };
}

// ---------- WebSocket ----------

const wss = new WebSocketServer({ noServer: true });
// /relay: los servidores de PC que se enlazan con este (con la clave del DM de una partida de aquí)
const relayWss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  const target = p === '/ws' ? wss : p === '/relay' ? relayWss : null;
  if (!target) { socket.destroy(); return; }
  target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
});
relayWss.on('connection', (ws) => hub.attach(ws, (k) => { const g = gameByDm(k); if (g) touch(g); return !!g; }));
/** A qué partida va cada conexión */
const peerGame = new Map<Peer, Game>();
const send = (p: Peer, msg: ServerMessage) => p.send(JSON.stringify(msg));

function broadcast(g: Game) {
  for (const [p, id] of g.clients) {
    const view = viewFor(g.room, id);
    if (view) send(p, { t: 'state', view: view.you.role === 'dm' && !CLOUD && g === main ? { ...view, net: netView() } : view });
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
    if (!peerGame.has(peer)) {
      let msg: ClientMessage | null = null;
      try { msg = JSON.parse(data); } catch { /* lo descarta handleMessage */ }
      if (msg?.t === 'hello' && !findGame(msg.code ?? '', msg.token, msg.dmKey)) {
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
  const g = peerGame.get(peer);
  peerGame.delete(peer);
  if (!g) return;
  const id = g.clients.get(peer);
  g.clients.delete(peer);
  if (id && ![...g.clients.values()].includes(id)) {
    g.room = setOnline(g.room, id, false);
    touch(g);
    save(g);
    broadcast(g);
  }
}

function handleMessage(ws: Peer, data: string) {
  let msg: ClientMessage;
  try { msg = JSON.parse(data); } catch { return; }
  if (msg.t === 'hello') {
    const g = findGame(msg.code ?? '', msg.token, msg.dmKey);
    if (!g) {
      send(ws, { t: 'error', message: msg.dmKey && !msg.code ? 'unknown-game' : enterErrorAll(msg.code ?? '') });
      return;
    }
    const j = join(g.room, msg.name ?? '', msg.token, msg.dmKey, !!msg.viewer);
    g.room = j.room;
    g.clients.set(ws, j.member.id);
    peerGame.set(ws, g);
    touch(g);
    send(ws, { t: 'welcome', id: j.member.id, token: j.member.token, role: j.member.role });
    console.log(`→ ${j.member.role === 'dm' ? 'DM' : 'Jugador'} conectado: ${j.member.name}${g.extra ? ` (partida ${g.id})` : ''}`);
    save(g);
    broadcast(g);
    return;
  }
  const g = peerGame.get(ws);
  const id = g?.clients.get(ws);
  if (!g || !id || msg.t !== 'cmd') return;
  const room = g.room;
  const cmd = msg.cmd;
  touch(g);
  // Partida en casa: hace falta que el PC esté en una red de casa (su dirección va dentro del código)
  if (cmd.t === 'openGame' && cmd.mode === 'local' && (CLOUD || g !== main || !lanIp())) { send(ws, { t: 'error', message: 'no-lan' }); return; }
  // Imagen nueva del DM: se guarda en disco y a la partida solo van sus datos
  if (cmd.t === 'imageAdd') {
    const me = room.members.find((m) => m.id === id);
    const b64 = String(cmd.data ?? '').replace(/^data:image\/jpeg;base64,/, '');
    if (me?.role !== 'dm' || !b64 || b64.length > MAX_IMAGE * 1.4) { send(ws, { t: 'error', message: 'bad-image' }); return; }
    const imgId = rid(12);
    try {
      fs.mkdirSync(g.imgDir, { recursive: true });
      fs.writeFileSync(path.join(g.imgDir, `${imgId}.jpg`), Buffer.from(b64, 'base64'));
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
      fs.mkdirSync(g.sheetDir, { recursive: true });
      fs.writeFileSync(path.join(g.sheetDir, `${id}.json`), data);
    } catch (e) { console.error('No se pudo guardar la ficha:', e); send(ws, { t: 'error', message: 'bad-sheet' }); return; }
    delete cmd.data;
  }
  if (cmd.t === 'imageRemove' && room.members.find((m) => m.id === id)?.role === 'dm') {
    try { fs.rmSync(path.join(g.imgDir, `${cmd.id.replace(/[^a-z0-9]/g, '')}.jpg`), { force: true }); } catch { /* ya no está */ }
  }
  // Cerrar la partida: antes de sacar a los jugadores se guardan sus fichas
  if (cmd.t === 'closeGame' && room.members.find((m) => m.id === id)?.role === 'dm') { closeGame(g, id); return; }
  commit(g, id, cmd, ws);
}

/** Aplica un comando a la partida, avisa y desconecta a quien ya no está, y guarda */
function commit(g: Game, id: string, cmd: ClientCommand, ws?: Peer) {
  const room = g.room;
  const r = apply(room, id, cmd);
  if (r.error) { if (ws) send(ws, { t: 'error', message: r.error }); return; }
  g.room = r.room;
  if (g.room.code !== room.code) {
    // En casa, el código lleva la dirección del PC en la Wi-Fi
    if (g === main && g.room.mode === 'local') g.room.code = localCode() ?? g.room.code;
    else uniqueCode(g);
  }
  for (const eff of r.effects) for (const [w, mid] of g.clients) if (mid === eff.to) send(w, { t: 'sheet', ops: eff.ops });
  // Sesión nueva o partida cerrada: a quien ya no está en la partida se le avisa y se le desconecta
  for (const [w, mid] of g.clients) {
    if (g.room.members.some((m) => m.id === mid)) continue;
    send(w, { t: 'error', message: cmd.t === 'kick' ? 'kicked' : g.room.open === false ? 'game-closed' : 'session-reset' });
    g.clients.delete(w);
    peerGame.delete(w);
    w.close();
  }
  const tag = g.extra ? ` (partida ${g.id})` : '';
  if (cmd.t === 'newSession') console.log(`→ Sesión nueva. Código de la partida: ${g.room.code}${tag}`);
  else if (cmd.t === 'openGame') {
    const local = g === main && g.room.mode === 'local';
    console.log(`→ 🎲 Partida${g === main && !CLOUD ? (local ? ' 🏠 en casa' : ' 🌍 en la nube') : ''} creada. Código para los jugadores: ${g.room.code}${tag}`);
    if (local) console.log('   Los jugadores tienen que estar en la misma Wi-Fi que este PC. Si no la encuentran, permite «Di en Di - Servidor»\n   en las redes privadas del Firewall de Windows.');
  }
  else if (cmd.t === 'closeGame') console.log(`→ 🔒 Partida cerrada: los jugadores han salido y nadie puede unirse con el código.${tag}`);
  else if (cmd.t === 'newCode') console.log(`→ Código nuevo de la partida: ${g.room.code}${tag}`);
  save(g);
  broadcast(g);
}

/**
 * Cerrar la partida. Primero nadie nuevo entra y se pide la ficha a cada jugador conectado: la manda (se guarda en
 * este servidor) y de paso recoge en su dispositivo lo pendiente (entregas, crónicas, imágenes). Cuando han
 * contestado todos (o a los 8 s), salen todos de la partida y sus fichas quedan juntas en un archivo de copia.
 */
const closingGames = new Set<Game>();
function closeGame(g: Game, dmId: string) {
  if (closingGames.has(g)) return;
  const online = () => g.room.members.filter((m) => m.role === 'player' && [...g.clients.values()].includes(m.id));
  if (!online().length) { finishClose(g, dmId); return; }
  g.room = { ...apply(g.room, dmId, { t: 'syncSheets' }).room, open: false };
  const req = g.room.syncRequest ?? Date.now();
  closingGames.add(g);
  console.log(`→ Cerrando la partida: guardando las fichas de los jugadores…${g.extra ? ` (partida ${g.id})` : ''}`);
  save(g);
  broadcast(g);
  const t0 = Date.now();
  const tick = () => {
    if (g.room.open !== false) { closingGames.delete(g); return; } // el DM la ha vuelto a abrir
    const left = online().filter((m) => (m.sheetAt ?? 0) < req);
    if ((left.length && Date.now() - t0 < 8000) || Date.now() - t0 < 1000) { setTimeout(tick, 250); return; }
    closingGames.delete(g);
    if (left.length) console.log(`   Sin ficha nueva de: ${left.map((m) => m.summary?.name ?? m.name).join(', ')}`);
    finishClose(g, dmId);
  };
  setTimeout(tick, 250);
}

function finishClose(g: Game, dmId: string) {
  const players = g.room.members.filter((m) => m.role === 'player');
  if (!CLOUD && players.length) {
    // Las fichas de los jugadores, juntas en un archivo de copia en di-en-di-fichas (se carga en la app como cualquier copia)
    const sheets = players.map((m) => path.join(g.sheetDir, `${m.id}.json`)).filter((f) => fs.existsSync(f));
    const characters = sheets.flatMap((f) => {
      try { return (JSON.parse(fs.readFileSync(f, 'utf8')).characters ?? []) as unknown[]; } catch { return []; }
    });
    if (characters.length) {
      const d = new Date();
      const two = (n: number) => String(n).padStart(2, '0');
      const file = path.join(g.sheetDir, `partida cerrada ${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}h${two(d.getMinutes())}.json`);
      try {
        fs.writeFileSync(file, JSON.stringify({ kind: BACKUP_KIND, version: 2, exportedAt: d.toISOString(), platform: 'servidor', characters }));
        // Ya están en el archivo de la sesión: las copias sueltas de quien sale sobran
        for (const f of sheets) fs.rmSync(f, { force: true });
        console.log(`   💾 Fichas de los jugadores guardadas en ${file}`);
      } catch (e) { console.error('No se pudieron guardar las fichas de los jugadores:', e); }
    }
  }
  commit(g, dmId, { t: 'closeGame' });
}

// ---------- Arranque ----------

// En Windows otro programa puede escuchar solo en 127.0.0.1 en el mismo puerto y «tapar» a este servidor
// Al arrancar comprobamos que quien responde en 127.0.0.1 somos nosotros.
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
  // ¿Otro programa responde en 127.0.0.1 con este mismo puerto? Entonces buscamos otro
  if (!(await answersHere(PORT))) {
    if (!FIXED_PORT && tries < 30) {
      console.log(`  En 127.0.0.1:${PORT} responde otro programa; pruebo con el ${PORT + 1}…`);
      tries++;
      server.close(() => { PORT += 1; server.listen(PORT); });
      return;
    }
    console.log(`\n  ⚠️  En 127.0.0.1:${PORT} responde otro programa. Abre el servidor con otro puerto (--port ${PORT + 10}).`);
  }
  const room = main.room;
  // Partida en casa abierta pero el PC ha cambiado de dirección (o de puerto): necesita un código nuevo
  if (!CLOUD && room.open !== false && room.mode === 'local') {
    const ip = lanIp();
    if (lanAddress(room.code) !== (ip ? `http://${ip}:${PORT}` : null)) {
      const c = localCode();
      if (c) room.code = c; else room.open = false;
      save(main);
    }
  }
  syncRelay();
  const dmUrl = CLOUD ? `${PUBLIC_URL || 'https://<dirección del servicio>'}/dm?dm=${room.dmKey}` : `http://localhost:${PORT}/dm?dm=${room.dmKey}`;
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  🎲  Servidor de partida de «Di en Di»\n${line}`);
  if (CLOUD) {
    console.log(`  Código de la partida principal: ${room.code}`);
    console.log(`  Pantalla del DM (no la compartas):\n    ${dmUrl}`);
    if (MULTI) console.log(`  Partidas de los PC: ${games.size - 1} (se borran tras ${EXPIRE_DAYS} días sin uso).`);
  } else {
    console.log(room.open === false
      ? '  En la pantalla del DM pulsa «🎲 Crear partida» y elige 🏠 En casa o 🌍 En la nube.\n  Luego da el código a los jugadores: lo escriben en su app y ya está.'
      : `  Partida ${room.mode === 'local' ? '🏠 en casa' : '🌍 en la nube'} abierta. Código para los jugadores: ${room.code}`);
    console.log(`\n  La pantalla del DM se abre sola en el navegador. Si no, entra en:\n    ${dmUrl}`);
  }
  console.log(`\n  Partida guardada en: ${DATA_FILE}`);
  console.log(`${line}\n  Deja esta ventana abierta mientras jugáis. Ctrl+C para cerrar.\n`);
  if (process.platform === 'win32' && !args.includes('--no-open')) exec(`start "" "${dmUrl}"`);
});
server.listen(PORT);

let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  // Espera a que acabe la escritura en curso de cada partida para que no pise a esta última
  const flush = async () => {
    for (const g of allGames()) {
      if (g.saveTimer) clearTimeout(g.saveTimer);
      while (g.writing) await new Promise((r) => setTimeout(r, 50));
      try {
        if (g.extra) fs.mkdirSync(path.dirname(g.file), { recursive: true });
        fs.writeFileSync(g.file, JSON.stringify(g.extra ? { ...g.room, usedAt: g.usedAt } : g.room));
      } catch { /* sin acceso al disco */ }
    }
  };
  void flush().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 9000);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
