// Puente con la nube: el servidor del PC del DM se conecta al de la nube (RelayHost) y la nube (RelayHub) le pasa los jugadores que entran con su código.
import { WebSocket } from 'ws';

/** Mensajes del túnel PC ⇄ nube (texto JSON) */
type HostFrame =
  | { t: 'host'; key: string; state: HostState }
  | { t: 'state'; state: HostState }
  | { t: 'out'; id: string; data: string }
  | { t: 'close'; id: string }
  | { t: 'res'; id: string; status: number; type: string; body: string };
type HubFrame =
  | { t: 'hosted' }
  | { t: 'denied' }
  | { t: 'conn'; id: string }
  | { t: 'in'; id: string; data: string }
  | { t: 'gone'; id: string }
  | { t: 'req'; id: string; path: string };

/** Lo que la nube necesita saber de la partida del PC para mandarle a quien entra */
export interface HostState {
  code: string;
  open: boolean;
  /** Clave del DM y tokens de los miembros: quien vuelve a entrar con ellos va a esta partida aunque cambie el código */
  keys: string[];
}

export type RelayStatus = 'off' | 'connecting' | 'on' | 'bad-key' | 'unreachable';

const rid = () => Math.random().toString(36).slice(2, 12);
const sendJson = (ws: WebSocket, msg: HostFrame | HubFrame) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

// ---------- En la nube ----------

interface Host {
  ws: WebSocket;
  state: HostState;
  peers: Map<string, WebSocket>;
  pending: Map<string, (r: { status: number; type: string; body: Buffer }) => void>;
}

export class RelayHub {
  private hosts = new Set<Host>();
  private waiters = new Set<() => void>();

  /** Un servidor de PC se conecta por /relay; `checkKey` comprueba que trae la clave del DM de esta nube */
  attach(ws: WebSocket, checkKey: (key: string) => boolean) {
    let host: Host | null = null;
    let alive = true;
    ws.on('pong', () => { alive = true; });
    const ping = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 20000);
    ws.on('message', (raw) => {
      let f: HostFrame;
      try { f = JSON.parse(String(raw)); } catch { return; }
      if (!host) {
        if (f.t !== 'host' || !checkKey(f.key)) { sendJson(ws, { t: 'denied' }); ws.close(); return; }
        host = { ws, state: f.state, peers: new Map(), pending: new Map() };
        this.hosts.add(host);
        sendJson(ws, { t: 'hosted' });
        console.log(`→ 🌐 Partida de un PC enlazada (código ${f.state.code}${f.state.open ? '' : ', cerrada'}).`);
        for (const w of this.waiters) w();
        return;
      }
      if (f.t === 'state') { host.state = f.state; for (const w of this.waiters) w(); }
      else if (f.t === 'out') { const p = host.peers.get(f.id); if (p?.readyState === p?.OPEN) p!.send(f.data); }
      else if (f.t === 'close') { const p = host.peers.get(f.id); host.peers.delete(f.id); p?.close(); }
      else if (f.t === 'res') { const cb = host.pending.get(f.id); host.pending.delete(f.id); cb?.({ status: f.status, type: f.type, body: Buffer.from(f.body, 'base64') }); }
    });
    ws.on('close', () => {
      clearInterval(ping);
      if (!host) return;
      this.hosts.delete(host);
      // Los jugadores se reconectan solos y esperan a que el PC vuelva a enlazarse
      for (const p of host.peers.values()) p.close();
      for (const cb of host.pending.values()) cb({ status: 502, type: 'text/plain', body: Buffer.from('') });
      console.log('→ 🌐 Partida de un PC desenlazada.');
    });
  }

  private find(code: string, token?: string, dmKey?: string): Host | undefined {
    const c = code.trim().toUpperCase();
    for (const h of this.hosts) {
      if ((h.state.open && c && c === h.state.code) || (token && h.state.keys.includes(token)) || (dmKey && h.state.keys.includes(dmKey))) return h;
    }
    return undefined;
  }

  /** ¿El código es de alguna partida enlazada? 'open', 'closed' o null */
  check(code: string): 'open' | 'closed' | null {
    const c = code.trim().toUpperCase();
    for (const h of this.hosts) if (c && h.state.code === c) return h.state.open ? 'open' : 'closed';
    return null;
  }

  hostByToken(token: string): Host | undefined {
    return token ? [...this.hosts].find((h) => h.state.keys.includes(token)) : undefined;
  }

  /**
   * La partida enlazada a la que va quien dice «hola». Si vuelve con su token y su PC se está reenlazando
   * (la nube corta las conexiones cada hora), espera unos segundos.
   */
  route(code: string, token?: string, dmKey?: string, waitMs = 8000): Promise<Host | undefined> {
    const now = this.find(code, token, dmKey);
    if (now || (!token && !dmKey) || waitMs <= 0) return Promise.resolve(now);
    return new Promise((resolve) => {
      const done = (h: Host | undefined) => { clearTimeout(timer); this.waiters.delete(check); resolve(h); };
      const check = () => { const h = this.find(code, token, dmKey); if (h) done(h); };
      const timer = setTimeout(() => done(undefined), waitMs);
      this.waiters.add(check);
    });
  }

  /** Une el socket de un jugador con la partida del PC; devuelve cómo reenviarle lo que mande y cómo cerrar */
  bridge(host: Host, ws: WebSocket): { forward: (data: string) => void; gone: () => void } {
    const id = rid();
    host.peers.set(id, ws);
    sendJson(host.ws, { t: 'conn', id });
    return {
      forward: (data) => sendJson(host.ws, { t: 'in', id, data }),
      gone: () => { if (host.peers.delete(id)) sendJson(host.ws, { t: 'gone', id }); },
    };
  }

  /** Pide al PC una dirección (imágenes, ficha guardada) y devuelve su respuesta */
  get(host: Host, path: string): Promise<{ status: number; type: string; body: Buffer }> {
    return new Promise((resolve) => {
      const id = rid();
      const timer = setTimeout(() => { host.pending.delete(id); resolve({ status: 504, type: 'text/plain', body: Buffer.from('') }); }, 30000);
      host.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      sendJson(host.ws, { t: 'req', id, path });
    });
  }
}

// ---------- En el PC del DM ----------

export interface CloudConfig { url: string; key: string }

/** Un jugador que llega por la nube, visto desde el PC como si fuera un socket normal */
export interface RelayPeer { send: (data: string) => void; close: () => void }

interface HostOptions {
  /** Llega un jugador: devuelve qué hacer con sus mensajes y cuando se va */
  onPeer: (peer: RelayPeer) => { message: (data: string) => void; close: () => void };
  /** Una petición GET reenviada por la nube (se responde como lo haría el servidor del PC) */
  get: (path: string) => Promise<{ status: number; type: string; body: Buffer }>;
  onStatus: (status: RelayStatus) => void;
}

/** La dirección de verdad del servidor (la corta, PROYECTO.web.app, la publica en /servidor.json) */
export async function resolveCloud(url: string): Promise<string> {
  const base = (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/\/+$/, '');
  try {
    const r = await fetch(`${base}/servidor.json`, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    const j = (await r.json()) as { url?: unknown };
    if (typeof j.url === 'string' && /^https:\/\//i.test(j.url)) return j.url.replace(/\/+$/, '');
  } catch { /* no es una dirección corta */ }
  return base;
}

export class RelayHost {
  private cfg: CloudConfig | null = null;
  private state: HostState | null = null;
  private wanted = false;
  private ws: WebSocket | null = null;
  private retry: NodeJS.Timeout | null = null;
  private attempts = 0;
  private starting = false;
  private peers = new Map<string, { message: (data: string) => void; close: () => void }>();
  status: RelayStatus = 'off';

  private opts: HostOptions;

  constructor(opts: HostOptions) { this.opts = opts; }

  get peerCount() { return this.peers.size; }

  private setStatus(s: RelayStatus) {
    if (s === this.status) return;
    this.status = s;
    this.opts.onStatus(s);
  }

  setConfig(cfg: CloudConfig | null) {
    this.cfg = cfg;
    this.disconnect();
    this.attempts = 0;
    this.sync();
  }

  /** Estado de la partida y si hace falta el enlace (partida abierta o jugadores conectados por la nube) */
  update(state: HostState, wanted: boolean) {
    const changed = JSON.stringify(state) !== JSON.stringify(this.state);
    this.state = state;
    this.wanted = wanted;
    if (changed && this.ws?.readyState === WebSocket.OPEN && this.status === 'on') sendJson(this.ws, { t: 'state', state });
    this.sync();
  }

  private sync() {
    const want = !!this.cfg && !!this.state && this.wanted;
    if (want && !this.ws && !this.retry && !this.starting && this.status !== 'bad-key') void this.connect();
    if (!want && (this.ws || this.retry)) this.disconnect();
    if (!want && this.status !== 'bad-key') this.setStatus('off');
  }

  private disconnect() {
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.dropPeers();
    this.setStatus('off');
  }

  private dropPeers() {
    for (const p of this.peers.values()) p.close();
    this.peers.clear();
  }

  private async connect() {
    const cfg = this.cfg;
    if (!cfg) return;
    this.setStatus('connecting');
    this.starting = true;
    const base = await resolveCloud(cfg.url);
    this.starting = false;
    if (this.cfg !== cfg || !this.wanted) { this.sync(); return; }
    const ws = new WebSocket(`${base.replace(/^http/i, 'ws')}/relay`);
    this.ws = ws;
    let alive = true;
    ws.on('pong', () => { alive = true; });
    const ping = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 25000);
    ws.on('open', () => sendJson(ws, { t: 'host', key: cfg.key, state: this.state! }));
    ws.on('message', (raw) => {
      let f: HubFrame;
      try { f = JSON.parse(String(raw)); } catch { return; }
      if (f.t === 'hosted') {
        this.attempts = 0;
        this.setStatus('on');
        // Por si la partida ha cambiado mientras se enlazaba
        if (this.state) sendJson(ws, { t: 'state', state: this.state });
      } else if (f.t === 'denied') {
        this.setStatus('bad-key');
      } else if (f.t === 'conn') {
        const id = f.id;
        this.peers.set(id, this.opts.onPeer({
          send: (data) => { if (this.ws === ws) sendJson(ws, { t: 'out', id, data }); },
          close: () => { if (this.peers.delete(id) && this.ws === ws) sendJson(ws, { t: 'close', id }); },
        }));
      } else if (f.t === 'in') {
        this.peers.get(f.id)?.message(f.data);
      } else if (f.t === 'gone') {
        const p = this.peers.get(f.id);
        this.peers.delete(f.id);
        p?.close();
      } else if (f.t === 'req') {
        const id = f.id;
        void this.opts.get(f.path).then((r) => sendJson(ws, { t: 'res', id, status: r.status, type: r.type, body: r.body.toString('base64') }));
      }
    });
    ws.on('error', () => { /* lo trata 'close' */ });
    ws.on('close', () => {
      clearInterval(ping);
      if (this.ws !== ws) return;
      this.ws = null;
      this.dropPeers();
      if (this.status === 'bad-key') return;
      // La nube corta cada conexión al cabo de una hora (y puede tardar en arrancar): se vuelve a enlazar
      this.setStatus(this.status === 'on' ? 'connecting' : 'unreachable');
      this.attempts += 1;
      this.retry = setTimeout(() => { this.retry = null; this.sync(); }, Math.min(30000, 1000 * 2 ** Math.min(this.attempts, 5)));
    });
  }
}
