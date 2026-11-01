// Conexión de la app con el servidor de partida: estado en tiempo real, reconexión automática,
// envío del resumen de tu ficha y aplicación en tu ficha de lo que te hagan en el combate.
import { create } from 'zustand';
import { useStore } from '../store';
import type { Character } from '../types';
import type { ClientMessage, Command, PcSummary, Role, RoomView, ServerMessage } from './protocol';
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
}

type Status = 'off' | 'connecting' | 'online' | 'retrying';

interface PartyState {
  conn: PartyConn | null;
  status: Status;
  error: string | null;
  view: RoomView | null;
  role: Role | null;
  connect: (c: PartyConn) => void;
  leave: () => void;
  send: (cmd: Command) => void;
}

const KEY = 'di-en-di-party';
const loadConn = (): PartyConn | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};
const saveConn = (c: PartyConn | null) => {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
};

/** «192.168.1.20:3000», «http://…» o «https://pc.tail1234.ts.net» → URL del WebSocket */
export function wsUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u) && !/^wss?:\/\//i.test(u)) u = `${/\.ts\.net/i.test(u) ? 'https' : 'http'}://${u}`;
  const url = new URL(u);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

export const ERRORS: Record<string, [string, string]> = {
  'bad-code': ['El código de la partida no es correcto.', 'The game code is wrong.'],
  'not-allowed': ['No puedes hacer eso (no es tu turno o no es tu personaje).', 'You can’t do that (not your turn or not your character).'],
  'no-combat': ['No hay ningún combate en marcha.', 'There’s no combat running.'],
  'no-target': ['Elige a quién.', 'Choose a target.'],
  'nothing-to-undo': ['No hay nada que deshacer.', 'Nothing to undo.'],
  'not-member': ['Vuelve a unirte a la partida.', 'Join the game again.'],
  'not-setup': ['El combate ya ha empezado.', 'The combat has already started.'],
  'not-running': ['Esperad a que todos estén listos.', 'Wait until everyone is ready.'],
  'need-initiative': ['Pon tu iniciativa antes de marcar Listo.', 'Enter your initiative before marking Ready.'],
};
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
    conditions: c.conditions.map(conditionName),
  };
}

let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let attempts = 0;
let unsubSheet: (() => void) | null = null;
let lastSummary = '';

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

  const applySheet = (msg: Extract<ServerMessage, { t: 'sheet' }>) => {
    const st = useStore.getState();
    const c = sharedChar();
    if (!c) return;
    if (st.activeId !== c.id) st.setActive(c.id);
    for (const op of msg.ops) {
      if (op.op === 'damage') st.runCommands(T(`${op.from} me hace ${op.amount} de daño`, `${op.from} deals ${op.amount} damage to me`), [{ type: 'damage', amount: op.amount, damageType: null, critical: false }]);
      if (op.op === 'heal') st.runCommands(T(`${op.from} me cura ${op.amount}`, `${op.from} heals me ${op.amount}`), [{ type: 'heal', amount: op.amount }]);
      if (op.op === 'setHp') {
        st.update((x) => { x.hp.current = Math.max(0, Math.min(x.hp.max, op.hp)); x.hp.temp = Math.max(0, op.temp); if (x.hp.current > 0) { x.dead = false; x.conditions = x.conditions.filter((k) => k !== 'inconsciente'); } });
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
      out({ t: 'hello', code: conn.code, name: conn.name, token: conn.token, dmKey: conn.dmKey });
    };
    sock.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.t === 'welcome') {
        const next = { ...get().conn!, token: msg.token, characterId: get().conn?.characterId ?? useStore.getState().activeId };
        saveConn(next);
        set({ conn: next, role: msg.role, status: 'online', error: null });
        lastSummary = '';
        pushSummary(true);
        unsubSheet?.();
        let t: number | null = null;
        unsubSheet = useStore.subscribe(() => { if (t) clearTimeout(t); t = window.setTimeout(() => pushSummary(), 300); });
      } else if (msg.t === 'state') {
        set({ view: msg.view });
      } else if (msg.t === 'sheet') {
        applySheet(msg);
      } else if (msg.t === 'error') {
        set({ error: errorText(msg.message) });
        if (msg.message === 'bad-code') { get().leave(); set({ error: errorText('bad-code') }); }
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
    connect: (c) => {
      get().leave();
      saveConn(c);
      attempts = 0;
      set({ conn: c, error: null, view: null, role: null });
      open();
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
  };
});

/** Reanuda la conexión guardada al abrir la app, o se une desde un enlace ?join=CÓDIGO / ?dm=CLAVE del servidor */
export function resumeParty() {
  const st = useParty.getState();
  const params = new URLSearchParams(window.location.search);
  const dm = params.get('dm');
  const joinCode = params.get('join');
  if (dm || joinCode) {
    const prev = st.conn;
    const same = prev && (dm ? prev.dmKey === dm : prev.code === joinCode);
    st.connect({ url: window.location.origin, code: joinCode ?? '', name: dm ? 'DM' : prev?.name ?? useStore.getState().active().name, dmKey: dm ?? undefined, token: same ? prev?.token : undefined });
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }
  if (st.conn && st.status === 'off') st.connect(st.conn);
}
