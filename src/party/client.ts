// Conexión de la app con el servidor de partida: estado en tiempo real, reconexión automática,
// envío del resumen de tu ficha y aplicación en tu ficha de lo que te hagan en el combate.
import { create } from 'zustand';
import { useStore } from '../store';
import type { Character, Note } from '../types';
import { compressImage } from '../imageUtil';
import { storeSharedImage } from '../sharedImages';
import { CLOUD_SERVER, type ClientMessage, type Command, type Gift, type PcSummary, type Role, type RoomView, type ServerMessage } from './protocol';
import { COIN_KEYS, coinsInGold, coinsText, itemLine } from '../rules/items';
import { hitDiceText } from '../rules/multiclass';
import { uid } from '../rules/factory';
import { backupFileName, buildBackup, parseBackup, saveBackupFile } from '../backup';
import { armorClass, maxHp, passivePerception, speed } from '../rules/calc';
import { classById, conditionName } from '../rules/srd';
import { L, T } from '../i18n';

export interface PartyConn {
  url: string;
  code: string;
  name: string;
  token?: string;
  dmKey?: string;
  /** Ficha que se comparte (la activa al unirse) */
  characterId?: string;
  /** Pantalla para la tele: solo mira */
  viewer?: boolean;
}

type Status = 'off' | 'connecting' | 'online' | 'retrying';

interface PartyState {
  conn: PartyConn | null;
  status: Status;
  error: string | null;
  view: RoomView | null;
  role: Role | null;
  /** Momento en que se completó una unión pedida por el usuario (para volver a lo que estaba haciendo) */
  joinedAt: number | null;
  connect: (c: PartyConn) => void;
  leave: () => void;
  send: (cmd: Command) => void;
  /** Jugador: sube su ficha completa al servidor (copia que guarda el DM) */
  uploadSheet: () => boolean;
}

const KEY = 'di-en-di-party';
const loadConn = (): PartyConn | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};
const saveConn = (c: PartyConn | null) => {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
};

/** Servicios que solo funcionan con HTTPS: si se escriben sin «https://» se les pone */
const PUBLIC_HTTPS = /\.ts\.net|ngrok|\.run\.app|\.web\.app|\.firebaseapp\.com/i;

/** «192.168.1.20:3000», «http://…» o «https://pc.tail1234.ts.net» → URL del WebSocket */
export function wsUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u) && !/^wss?:\/\//i.test(u)) u = `${PUBLIC_HTTPS.test(u) ? 'https' : 'http'}://${u}`;
  const url = new URL(u);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

/** Dirección http(s) del servidor (para imágenes, información…) a partir de lo que escribió el usuario */
export function httpBase(input?: string): string {
  const u = (input ?? '').trim();
  if (/^https?:\/\//i.test(u)) return u.replace(/\/+$/, '');
  if (/^wss?:\/\//i.test(u)) return u.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/+$/, '');
  if (u) return `${PUBLIC_HTTPS.test(u) ? 'https' : 'http'}://${u.replace(/\/+$/, '')}`;
  return window.location.origin;
}

export const ERRORS: Record<string, [string, string]> = {
  'bad-code': ['El código de la partida no es correcto (el DM puede haberlo cambiado: pídele el nuevo).', 'The game code is wrong (the DM may have changed it: ask for the new one).'],
  'no-server': ['No encuentro ningún servidor de partida. Revisa la conexión a Internet o, si el DM usa su propio servidor, escribe su dirección en «Otro servidor».', 'Can’t find any game server. Check your Internet connection or, if the DM runs their own server, enter its address under “Other server”.'],
  'game-closed': ['La partida aún no está abierta (o el DM la ha cerrado). Espera a que el DM pulse «Crear partida» y te dé el código.', 'The game isn’t open yet (or the DM closed it). Wait for the DM to press “Create game” and give you the code.'],
  'session-reset': ['El DM ha empezado una sesión nueva. Pídele el código nuevo para volver a unirte.', 'The DM started a new session. Ask for the new code to join again.'],
  'not-allowed': ['No puedes hacer eso (no es tu turno o no es tu personaje).', 'You can’t do that (not your turn or not your character).'],
  'no-combat': ['No hay ningún combate en marcha.', 'There’s no combat running.'],
  'no-target': ['Elige a quién.', 'Choose a target.'],
  'nothing-to-undo': ['No hay nada que deshacer.', 'Nothing to undo.'],
  'not-member': ['Vuelve a unirte a la partida.', 'Join the game again.'],
  'not-setup': ['El combate ya ha empezado.', 'The combat has already started.'],
  'not-running': ['Esperad a que todos estén listos.', 'Wait until everyone is ready.'],
  'need-initiative': ['Pon tu iniciativa antes de marcar Listo.', 'Enter your initiative before marking Ready.'],
  'not-your-turn': ['No es tu turno: espera a que te toque (fuera de tu turno solo puedes usar una reacción).', 'It’s not your turn: wait until it is (off-turn you can only use a reaction).'],
  'reaction-used': ['Ya has usado tu reacción en esta ronda.', 'You’ve already used your reaction this round.'],
  'bad-sheet': ['No se ha podido guardar tu ficha en el servidor.', 'Your sheet couldn’t be saved on the server.'],
  'bad-image': ['No se ha podido subir la imagen (¿es demasiado grande?).', 'The image couldn’t be uploaded (is it too large?).'],
  'empty-gift': ['Añade monedas u objetos antes de dar.', 'Add coins or items before giving.'],
  'gift-delivered': ['Esa entrega ya ha llegado a la ficha del jugador.', 'That gift has already reached the player’s sheet.'],
};

/** Suma a la ficha las monedas y objetos de una entrega del DM (los objetos iguales se apilan) */
export function applyGift(c: Character, g: Gift, from = g.fromName ?? 'DM'): Character {
  const next = structuredClone(c);
  for (const k of COIN_KEYS) next.coins[k] = (next.coins[k] ?? 0) + Math.max(0, Math.round(g.coins?.[k] ?? 0));
  for (const it of g.items ?? []) {
    const same = next.items.find((x) => x.name === it.name && x.rarity === it.rarity && x.description === it.description && x.value === it.value);
    if (same) same.qty += it.qty;
    else next.items.push({ ...it, id: uid(), from, at: g.at, gift: g.id });
  }
  next.giftsReceived = [...next.giftsReceived, g.id].slice(-500);
  return next;
}

/** Líneas para el aviso: «50 po», «2 × Poción de curación» */
export const giftLines = (g: Pick<Gift, 'coins' | 'items' | 'note'>) => [
  ...(g.coins && coinsText(g.coins) ? [`💰 ${coinsText(g.coins)}`] : []),
  ...(g.items ?? []).map((i) => `🎁 ${itemLine(i)}`),
  ...(g.note ? [`✉️ ${g.note}`] : []),
];
const errorText = (code: string) => (ERRORS[code] ? T(...ERRORS[code]) : code);

export function summaryOf(c: Character): PcSummary {
  const cls = classById(c.classId);
  return {
    name: c.name,
    species: c.species,
    className: cls ? L(cls.name) : c.className,
    level: c.level,
    hp: c.hp.current,
    hpMax: maxHp(c),
    temp: c.hp.temp,
    ac: armorClass(c).value,
    speed: speed(c).value,
    passive: passivePerception(c),
    conditions: [...c.conditions.map(conditionName), ...c.effects.map((e) => e.name)],
    concentration: c.concentratingOn,
    deathSaves: c.hp.current === 0 && !c.dead ? c.deathSaves : null,
    coins: { ...c.coins },
    gold: Math.round(coinsInGold(c.coins) * 100) / 100,
    exhaustion: c.exhaustion,
    inspiration: c.heroicInspiration,
    hitDice: { left: Math.max(0, c.level - c.hitDiceSpent), total: c.level, die: hitDiceText(c) },
    slots: [
      ...c.slots.map((s, i) => ({ level: i + 1, left: Math.max(0, s.max - s.used), max: s.max })).filter((s) => s.max > 0),
      ...(c.pactSlots && c.pactSlots.max > 0 ? [{ level: c.pactSlots.level, left: Math.max(0, c.pactSlots.max - c.pactSlots.used), max: c.pactSlots.max, pact: true }] : []),
    ],
    resources: c.resources.filter((r) => r.max > 0).map((r) => ({ name: r.name, left: Math.max(0, r.max - r.used), max: r.max })).slice(0, 8),
    items: (c.items ?? []).filter((i) => i.qty > 0 && (i.equipped || i.rarity !== 'mundane')).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.name}${i.equipped ? ' 🛡️' : ''}`).slice(0, 12),
    dead: c.dead,
  };
}

let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let attempts = 0;
let unsubSheet: (() => void) | null = null;
let lastSummary = '';
/** Última petición de sincronizar a la que ya se ha respondido */
let syncedFor = 0;
/** La conexión en curso la ha pedido el usuario (no es una reconexión automática) */
let freshJoin = false;
/** Entregas ya sumadas en esta sesión (por si llega otro estado antes de confirmar) */
const applying = new Set<string>();
/** Imágenes y crónicas del DM que se están guardando en el diario */
const pendingShared = new Set<string>();

/**
 * Guarda notas en el diario de una ficha, en la carpeta «🤝 Compartido conmigo» (la crea si no está). Cada nota lleva
 * `ref` (lo que se compartió) y no se guarda dos veces. Quedan en el dispositivo aunque se acabe la partida.
 */
export function addSharedNotes(charId: string | undefined, notes: Note[]) {
  const st = useStore.getState();
  const c = st.characters.find((x) => x.id === charId) ?? st.active();
  if (!c || !notes.length) return;
  const next = structuredClone(c);
  let folder = next.noteFolders.find((f) => f.key === 'shared');
  if (!folder) { folder = { id: uid(), key: 'shared', name: T('Compartido conmigo', 'Shared with me') }; next.noteFolders.push(folder); }
  let added = 0;
  for (const n of notes) if (!n.ref || !next.notes.some((x) => x.ref === n.ref)) { next.notes.unshift({ ...n, folderId: folder.id }); added++; }
  if (added) st.replace(next);
}

export const useParty = create<PartyState>((set, get) => {
  const out = (msg: ClientMessage) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

  const sharedChar = (): Character | undefined => {
    const s = useStore.getState();
    const id = get().conn?.characterId;
    return s.characters.find((c) => c.id === id) ?? s.active();
  };

  const pushSummary = (force = false) => {
    if (get().role !== 'player') return;
    const c = sharedChar();
    if (!c) return;
    const sum = summaryOf(c);
    const k = JSON.stringify(sum);
    if (!force && k === lastSummary) return;
    lastSummary = k;
    out({ t: 'cmd', cmd: { t: 'summary', summary: sum } });
  };

  /** Kill count: las bajas en las que tu personaje dio el golpe final (y se quitan si se deshace el turno) */
  const reconcileKills = (view: RoomView) => {
    if (view.you.role !== 'player') return;
    const c = sharedChar();
    if (!c) return;
    const downs = view.log.filter((ev) => ev.kind === 'down' && ev.ownerId === view.you.id);
    const undone = new Set(downs.filter((d) => d.undone).map((d) => d.id));
    const have = new Set(c.kills.map((k) => k.ref).filter(Boolean));
    const add = downs.filter((d) => !d.undone && !have.has(d.id));
    const drop = c.kills.some((k) => k.ref && undone.has(k.ref));
    if (!add.length && !drop) return;
    const st = useStore.getState();
    st.replace({
      ...c,
      kills: [
        ...c.kills.filter((k) => !(k.ref && undone.has(k.ref))),
        ...add.map((d) => ({ id: `k-${d.id}`, name: d.target ?? '?', at: d.at, source: 'party' as const, ref: d.id })),
      ],
    });
    const fresh = add.filter((d) => Date.now() - d.at < 60000);
    if (fresh.length) st.showToast(T(`☠️ ¡Golpe final! +${fresh.length} en tu kill count`, `☠️ Final blow! +${fresh.length} to your kill count`), fresh.map((d) => d.target ?? ''));
  };

  const uploadSheet = () => {
    const c = sharedChar();
    if (!c || get().role !== 'player' || ws?.readyState !== WebSocket.OPEN) return false;
    out({ t: 'cmd', cmd: { t: 'sheetUpload', data: JSON.stringify(buildBackup([c], { log: useStore.getState().log })) } });
    return true;
  };

  /** El DM ha pedido sincronizar: se sube la ficha una vez por petición */
  const reconcileSync = (view: RoomView) => {
    if (view.you.role !== 'player' || !view.syncRequest || syncedFor === view.syncRequest) return;
    const me = view.members.find((m) => m.id === view.you.id);
    if ((me?.sheetAt ?? 0) >= view.syncRequest) return;
    if (!uploadSheet()) return;
    syncedFor = view.syncRequest;
    useStore.getState().showToast(T('☁️ El DM ha guardado tu ficha en el servidor', '☁️ The DM saved your sheet on the server'), []);
  };

  /** Entregas del DM: se suman a la ficha compartida una sola vez y se confirma al servidor */
  const reconcileGifts = (view: RoomView) => {
    if (view.you.role !== 'player') return;
    const pending = (view.gifts ?? []).filter((g) => g.toId === view.you.id && !g.delivered);
    if (!pending.length) return;
    const st = useStore.getState();
    const seen = new Set(st.characters.flatMap((c) => c.giftsReceived ?? []));
    const fresh = pending.filter((g) => !seen.has(g.id) && !applying.has(g.id));
    const c = sharedChar();
    if (fresh.length && c) {
      let next = c;
      for (const g of fresh) { applying.add(g.id); next = applyGift(next, g); }
      st.replace(next);
      // Lo que te dan queda apuntado en «Compartido conmigo»
      addSharedNotes(c.id, fresh.map((g) => ({ id: uid(), createdAt: g.at, title: `🎁 ${g.fromName ? T(`De ${g.fromName}`, `From ${g.fromName}`) : T('Del DM', 'From the DM')}: ${[g.coins ? coinsText(g.coins) : '', ...(g.items ?? []).map(itemLine)].filter(Boolean).join(', ').slice(0, 90)}`, body: giftLines(g).join('\n'), kind: 'note' as const, ref: `gift:${g.id}` })));
      const who = [...new Set(fresh.map((g) => g.fromName ?? 'DM'))].join(', ');
      const dmOnly = fresh.every((g) => !g.fromName);
      if (st.activeId === c.id) st.pushLog({ role: 'app', text: dmOnly ? T('🎁 Entrega del DM', '🎁 Gift from the DM') : T(`🎁 Te dan: ${who}`, `🎁 Given by: ${who}`), details: fresh.flatMap((g) => giftLines(g)) });
      st.showToast(dmOnly ? T(`🎁 El DM te da algo${c.id !== st.activeId ? ` (${c.name})` : ''}`, `🎁 The DM gives you something${c.id !== st.activeId ? ` (${c.name})` : ''}`) : T(`🎁 ${who} te da algo`, `🎁 ${who} gives you something`), fresh.flatMap((g) => giftLines(g)));
    }
    const ack = pending.filter((g) => seen.has(g.id) || applying.has(g.id)).map((g) => g.id);
    if (ack.length) out({ t: 'cmd', cmd: { t: 'giftAck', ids: ack } });
  };

  /** Imágenes y crónicas que comparte el DM: se guardan en el diario de la ficha, en «Compartido» */
  const reconcileShared = (view: RoomView) => {
    if (view.you.role !== 'player') return;
    const c0 = sharedChar();
    if (!c0) return;
    const have = new Set(c0.notes.map((n) => n.ref).filter(Boolean));
    const chron = (view.chronicles ?? []).filter((x) => !have.has(`chr:${x.id}`) && !pendingShared.has(`chr:${x.id}`));
    const imgs = (view.images ?? []).filter((x) => x.shared && !have.has(`img:${x.id}`) && !pendingShared.has(`img:${x.id}`));
    if (!chron.length && !imgs.length) return;
    const save = (notes: Note[]) => addSharedNotes(c0.id, notes);
    if (chron.length) {
      chron.forEach((x) => pendingShared.add(`chr:${x.id}`));
      save(chron.map((x) => ({ id: uid(), createdAt: x.at, title: `📖 ${x.title}`, body: x.text, kind: 'story', ref: `chr:${x.id}` })));
      useStore.getState().showToast(T('📖 El DM comparte una crónica', '📖 The DM shares a chronicle'), [...chron.map((x) => x.title), T('Guardada en tu diario → 🤝 Compartido conmigo.', 'Saved in your journal → 🤝 Shared with me.')]);
    }
    const conn = get().conn;
    for (const im of imgs) {
      pendingShared.add(`img:${im.id}`);
      void fetch(`${httpBase(conn?.url)}/img/${im.id}.jpg?t=${encodeURIComponent(conn?.token ?? '')}`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(async (b) => {
          // La imagen entera, tal cual, en el dispositivo (IndexedDB); en el diario, una miniatura. Si no hay
          // IndexedDB, la nota lleva la imagen algo reducida.
          const ref = `img:${im.id}`;
          const key = await storeSharedImage(ref, b).catch(() => null);
          const { data } = key ? await compressImage(b, 480, 0.7) : await compressImage(b, 1200, 0.78);
          save([{ id: uid(), createdAt: im.sharedAt ?? im.at, title: `🖼️ ${im.title}`, body: '', kind: 'note', image: data, ...(key ? { imageKey: key } : {}), ref }]);
        })
        .catch(() => pendingShared.delete(`img:${im.id}`));
    }
  };

  const applySheet = (msg: Extract<ServerMessage, { t: 'sheet' }>) => {
    const st = useStore.getState();
    const c = sharedChar();
    if (!c) return;
    if (st.activeId !== c.id) st.setActive(c.id);
    for (const op of msg.ops) {
      if (op.op === 'damage') st.runCommands(T(`${op.from} me hace ${op.amount} de daño`, `${op.from} deals ${op.amount} damage to me`), [{ type: 'damage', amount: op.amount, damageType: null, critical: false }]);
      if (op.op === 'heal') st.runCommands(T(`${op.from} me cura ${op.amount}`, `${op.from} heals me ${op.amount}`), [{ type: 'heal', amount: op.amount }]);
      if (op.op === 'setHp') {
        st.update((x) => { x.hp.current = Math.max(0, Math.min(maxHp(x), op.hp)); x.hp.temp = Math.max(0, op.temp); if (x.hp.current > 0) { x.dead = false; x.conditions = x.conditions.filter((k) => k !== 'inconsciente'); } });
        st.showToast(T('↩️ El último turno se ha deshecho', '↩️ The last turn was undone'), [T(`Tu vida vuelve a ${op.hp}${op.temp ? ` (+${op.temp} temp.)` : ''}.`, `Your HP goes back to ${op.hp}${op.temp ? ` (+${op.temp} temp)` : ''}.`)]);
      }
    }
    pushSummary(true);
  };

  const open = () => {
    const conn = get().conn;
    if (!conn) return;
    let url: string;
    try { url = wsUrl(conn.url); } catch { set({ status: 'off', error: T('La dirección no es válida.', 'The address isn’t valid.') }); return; }
    set({ status: attempts ? 'retrying' : 'connecting' });
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => {
      attempts = 0;
      out({ t: 'hello', code: conn.code, name: conn.name, token: conn.token, dmKey: conn.dmKey, viewer: conn.viewer });
    };
    sock.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.t === 'welcome') {
        const next = { ...get().conn!, token: msg.token, characterId: get().conn?.characterId ?? useStore.getState().activeId };
        saveConn(next);
        rememberServer(next.url);
        set({ conn: next, role: msg.role, status: 'online', error: null, ...(freshJoin ? { joinedAt: Date.now() } : {}) });
        freshJoin = false;
        lastSummary = '';
        pushSummary(true);
        unsubSheet?.();
        let t: number | null = null;
        unsubSheet = useStore.subscribe(() => { if (t) clearTimeout(t); t = window.setTimeout(() => pushSummary(), 300); });
      } else if (msg.t === 'state') {
        set({ view: msg.view });
        reconcileKills(msg.view);
        reconcileGifts(msg.view);
        reconcileShared(msg.view);
        reconcileSync(msg.view);
      } else if (msg.t === 'sheet') {
        applySheet(msg);
      } else if (msg.t === 'error') {
        // Estaba dentro y el DM ha cerrado la partida (no es que intente entrar en una cerrada)
        const kicked = msg.message === 'game-closed' && get().status === 'online';
        set({ error: kicked ? T('El DM ha cerrado la partida. Cuando vuelva a crearla, pídele el código nuevo.', 'The DM closed the game. When they create it again, ask for the new code.') : errorText(msg.message) });
        if (msg.message === 'bad-code' || msg.message === 'game-closed' || msg.message === 'session-reset') { const e = get().error; get().leave(); set({ error: e }); }
        const keep = T('Lo que te han compartido sigue en tu diario → 🤝 Compartido conmigo. Tu ficha sigue igual.', 'What was shared with you stays in your journal → 🤝 Shared with me. Your sheet stays the same.');
        if (msg.message === 'session-reset') useStore.getState().showToast(T('🔁 Sesión nueva', '🔁 New session'), [errorText('session-reset'), keep]);
        if (kicked) useStore.getState().showToast(T('🔒 El DM ha cerrado la partida', '🔒 The DM closed the game'), [keep]);
      }
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      if (!get().conn) return;
      // Reintento con espera creciente (2, 4, 8… hasta 30 s)
      attempts += 1;
      set({ status: 'retrying' });
      retryTimer = window.setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(attempts, 5)));
    };
    sock.onerror = () => {
      if (attempts === 0) set({ error: T('No se puede conectar con el servidor. Revisa la dirección y que el servidor esté abierto en el PC.', 'Can’t reach the server. Check the address and that the server is running on the PC.') });
    };
  };

  return {
    conn: loadConn(),
    status: 'off',
    error: null,
    view: null,
    role: null,
    joinedAt: null,
    connect: (c) => {
      get().leave();
      saveConn(c);
      attempts = 0;
      freshJoin = true;
      set({ conn: c, error: null, view: null, role: null, status: 'connecting' });
      // Una dirección corta (p. ej. https://di-en-di.web.app) dice cuál es el servidor de verdad
      void resolveServer(c.url).then((real) => {
        if (get().conn !== c) return; // ha salido o se ha conectado a otra mientras tanto
        if (real && real !== c.url) {
          const next = { ...c, url: real };
          saveConn(next);
          set({ conn: next });
        }
        open();
      });
    },
    leave: () => {
      if (retryTimer) clearTimeout(retryTimer);
      unsubSheet?.();
      unsubSheet = null;
      const s = ws;
      ws = null;
      s?.close();
      saveConn(null);
      set({ conn: null, status: 'off', view: null, role: null });
    },
    send: (cmd) => {
      if (ws?.readyState !== WebSocket.OPEN) { set({ error: T('Sin conexión con la partida; reintentando…', 'Not connected to the game; retrying…') }); return; }
      set({ error: null });
      out({ t: 'cmd', cmd });
    },
    uploadSheet,
  };
});

/**
 * Dirección corta: Firebase Hosting (o un dominio propio) no deja pasar el WebSocket de la partida, así que
 * publica /servidor.json con la dirección del servidor real ({ "url": "https://….run.app" }). Null si no hay.
 */
export async function resolveServer(input: string): Promise<string | null> {
  let base: string;
  try { base = httpBase(input); } catch { return null; }
  // En la red local no hace falta preguntar
  if (!/^https:\/\//i.test(base)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${base}/servidor.json`, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { url?: unknown };
    return typeof j.url === 'string' && /^https:\/\//i.test(j.url) ? j.url.replace(/\/+$/, '') : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Servidor de partida por defecto (el de la nube): con él basta el código para unirse */
export const DEFAULT_SERVER = CLOUD_SERVER;
const LAST_SERVER = 'di-en-di-last-server';
export const lastServer = (): string | null => { try { return localStorage.getItem(LAST_SERVER); } catch { return null; } };
export const rememberServer = (url: string) => { try { localStorage.setItem(LAST_SERVER, url); } catch { /* sin almacenamiento */ } };

type Probe = { url: string; match: boolean | null; closed?: boolean } | null;

/** Pregunta a un servidor si el código es de su partida (null si no responde o no es de Di en Di) */
async function probeServer(input: string, code: string): Promise<Probe> {
  let base: string;
  try { base = httpBase(input); } catch { return null; }
  const real = (await resolveServer(base)) ?? base;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(`${real}/api/info?check=${encodeURIComponent(code)}`, { signal: ctl.signal, cache: 'no-store' });
    const j = (await r.json()) as { app?: string; match?: boolean; closed?: boolean };
    if (j.app !== 'di-en-di') return null;
    // Los servidores antiguos no saben comprobar el código (match ausente)
    return { url: real, match: typeof j.match === 'boolean' ? j.match : null, closed: !!j.closed };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca el servidor de una partida a partir de solo su código: la dirección de esta página (si la sirve un
 * servidor), el último servidor usado y el de la nube. Devuelve la dirección o el motivo del fallo.
 */
export async function findServer(code: string, extra?: string): Promise<{ url: string } | { error: 'bad-code' | 'game-closed' | 'no-server' }> {
  // La dirección de esta página solo si es web (en la app de Android no responde nadie y se descarta sola)
  const here = /^https?:$/.test(window.location.protocol) ? window.location.origin : null;
  const list = [extra, here, lastServer(), DEFAULT_SERVER].filter((x): x is string => !!x?.trim());
  const seen = new Set<string>();
  const unique = list.filter((u) => { const k = (() => { try { return httpBase(u); } catch { return u; } })(); if (seen.has(k)) return false; seen.add(k); return true; });
  const results = await Promise.all(unique.map((u) => probeServer(u, code)));
  const hit = results.find((x) => x?.match === true) ?? results.find((x) => x?.match === null);
  if (hit) return { url: hit.url };
  if (results.some((x) => x?.closed)) return { error: 'game-closed' };
  return { error: results.some((x) => x) ? 'bad-code' : 'no-server' };
}

/** Jugador: la ficha que guardó el servidor la última vez que se sincronizó (o null si no hay) */
export async function fetchSavedSheet(): Promise<Character[] | null> {
  const conn = useParty.getState().conn;
  if (!conn?.token) return null;
  const r = await fetch(`${httpBase(conn.url)}/api/sheet?token=${encodeURIComponent(conn.token)}`);
  if (!r.ok) return null;
  const chars = parseBackup(await r.text()).characters;
  return chars.length ? chars : null;
}

/** DM: descarga todas las fichas guardadas en un archivo de copia (se importa en Ajustes → Copia de seguridad) */
export async function downloadAllSheets(): Promise<number> {
  const conn = useParty.getState().conn;
  if (!conn?.dmKey) return 0;
  const r = await fetch(`${httpBase(conn.url)}/api/sheets?dm=${encodeURIComponent(conn.dmKey)}`);
  if (!r.ok) throw new Error(String(r.status));
  const text = await r.text();
  const n = parseBackup(text).characters.length;
  if (n) await saveBackupFile(text, backupFileName(T('fichas-de-la-partida', 'party-sheets')));
  return n;
}

/** Reanuda la conexión guardada al abrir la app, o se une desde un enlace ?join=CÓDIGO / ?dm=CLAVE del servidor */
export function resumeParty() {
  const st = useParty.getState();
  const params = new URLSearchParams(window.location.search);
  const dm = params.get('dm');
  const viewCode = params.get('view');
  const joinCode = params.get('join') ?? viewCode;
  if (dm || joinCode) {
    const prev = st.conn;
    const same = prev && (dm ? prev.dmKey === dm : prev.code === joinCode);
    st.connect({ url: window.location.origin, code: joinCode ?? '', name: dm ? 'DM' : viewCode ? 'Pantalla' : prev?.name ?? useStore.getState().active().name, dmKey: dm ?? undefined, viewer: !!viewCode, token: same && !!prev?.viewer === !!viewCode ? prev?.token : undefined });
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }
  if (st.conn && st.status === 'off') { st.connect(st.conn); freshJoin = false; }
}
