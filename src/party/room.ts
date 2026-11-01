// Lógica de la partida compartida. Funciones puras: el servidor guarda una `Room`, le aplica los
// comandos de cada cliente y envía a cada uno solo lo que puede ver (los jugadores nunca reciben
// monstruos ocultos, vida exacta de monstruos ni notas del DM).
import type {
  Combatant, CombatantView, Command, Encounter, HpState, LogEvent, Member, Role, RoomView, SheetOp,
} from './protocol';

export interface StoredMember extends Member { token: string }

interface Snapshot { encounter: Encounter; logLen: number }

export interface Room {
  code: string;
  dmKey: string;
  members: StoredMember[];
  encounter: Encounter;
  log: LogEvent[];
  /** Estado al empezar cada turno (para deshacer) */
  snapshots: Snapshot[];
  /** Se ha hecho algo en el turno actual */
  acted: boolean;
}

export interface Effect { to: string; ops: SheetOp[] }
export interface Result { room: Room; effects: Effect[]; error?: string }

const MAX_LOG = 3000;
const MAX_SNAPSHOTS = 40;

export const rid = (n = 8) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export function createRoom(): Room {
  return { code: code6(), dmKey: rid(12), members: [], encounter: { active: false, round: 1, turn: 0, begun: false, order: [] }, log: [], snapshots: [], acted: false };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export function hpState(c: Pick<Combatant, 'hp' | 'hpMax'>): HpState {
  if (c.hp == null || c.hpMax == null) return 'unknown';
  if (c.hp <= 0) return 'down';
  if (c.hp <= Math.floor(c.hpMax / 2)) return 'bloodied';
  if (c.hp < c.hpMax) return 'hurt';
  return 'unhurt';
}

// ---------- Unirse ----------

export function join(room: Room, name: string, token?: string, dmKey?: string): { room: Room; member: StoredMember } {
  const r = clone(room);
  let m = token ? r.members.find((x) => x.token === token) : undefined;
  const role: Role = dmKey && dmKey === r.dmKey ? 'dm' : m?.role ?? 'player';
  if (!m) {
    m = { id: rid(), token: rid(16), name: name.trim() || (role === 'dm' ? 'DM' : 'Jugador'), role, online: true };
    r.members.push(m);
  } else {
    m.online = true;
    m.role = role;
    if (name.trim()) m.name = name.trim();
  }
  return { room: r, member: m };
}

export function setOnline(room: Room, memberId: string, online: boolean): Room {
  const r = clone(room);
  const m = r.members.find((x) => x.id === memberId);
  if (m) m.online = online;
  return r;
}

// ---------- Comandos ----------

const current = (e: Encounter) => e.order[e.turn];
const snap = (r: Room): Snapshot => ({ encounter: clone(r.encounter), logLen: r.log.length });

function pushLog(r: Room, ev: Omit<LogEvent, 'id' | 'at' | 'round'>) {
  r.log.push({ id: rid(), at: Date.now(), round: r.encounter.round, ...ev });
  if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);
}

const describeHp = (c: Combatant) => (c.hpMax != null && c.hp != null ? `${c.hp}/${c.hpMax}${c.temp ? ` +${c.temp}` : ''}` : c.hp != null ? `${c.hp}` : '?');

function applyHp(c: Combatant, kind: 'hit' | 'heal' | 'hurt', amount: number) {
  if (kind === 'heal') {
    if (c.hp != null) c.hp = c.hpMax != null ? Math.min(c.hpMax, c.hp + amount) : c.hp + amount;
    return;
  }
  const absorbed = Math.min(c.temp, amount);
  c.temp -= absorbed;
  const rest = amount - absorbed;
  if (c.hp != null) c.hp = Math.max(0, c.hp - rest);
}

function sortOrder(e: Encounter) {
  const cur = current(e)?.id;
  e.order = [...e.order].sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
  if (!e.begun) e.turn = 0;
  else e.turn = Math.max(0, e.order.findIndex((x) => x.id === cur));
}

function newCombatant(p: Partial<Combatant>): Combatant {
  return {
    id: p.id ?? rid(),
    name: p.name?.trim() || 'Monstruo',
    kind: p.kind ?? 'monster',
    ownerId: p.ownerId,
    initiative: p.initiative ?? null,
    initBonus: p.initBonus,
    hp: p.hp ?? p.hpMax ?? null,
    hpMax: p.hpMax ?? null,
    temp: p.temp ?? 0,
    ac: p.ac ?? null,
    hidden: p.hidden ?? false,
    showHp: p.showHp ?? (p.kind !== 'monster'),
    notes: p.notes ?? '',
    monster: p.monster,
  };
}

/** Personaje jugador a partir del resumen de su ficha */
function pcFrom(m: StoredMember, prev?: Combatant): Combatant {
  const s = m.summary!;
  return {
    ...(prev ?? newCombatant({ kind: 'pc', ownerId: m.id })),
    kind: 'pc',
    ownerId: m.id,
    name: s.name,
    hp: s.hp,
    hpMax: s.hpMax,
    temp: s.temp,
    ac: s.ac,
    hidden: false,
    showHp: true,
  };
}

export function apply(room: Room, memberId: string, cmd: Command): Result {
  const r = clone(room);
  const me = r.members.find((m) => m.id === memberId);
  if (!me) return { room, effects: [], error: 'not-member' };
  const dm = me.role === 'dm';
  const e = r.encounter;
  const effects: Effect[] = [];
  const deny = (): Result => ({ room, effects: [], error: 'not-allowed' });
  const ownsPc = (id: string) => e.order.some((c) => c.id === id && c.kind === 'pc' && c.ownerId === me.id);

  switch (cmd.t) {
    case 'summary': {
      me.summary = cmd.summary;
      if (!me.name || me.name === 'Jugador') me.name = cmd.summary.name;
      const i = e.order.findIndex((c) => c.kind === 'pc' && c.ownerId === me.id);
      if (i >= 0) e.order[i] = pcFrom(me, e.order[i]);
      return { room: r, effects };
    }

    case 'setInitiative': {
      const c = e.order.find((x) => x.id === cmd.id);
      if (!c || (!dm && !ownsPc(cmd.id))) return deny();
      c.initiative = cmd.value;
      if (!e.begun) sortOrder(e);
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }

    case 'act': {
      if (!e.active) return { room, effects: [], error: 'no-combat' };
      const actor = e.order.find((c) => c.id === cmd.actorId);
      if (!actor) return deny();
      if (!dm && !ownsPc(actor.id)) return deny();
      const targetId = cmd.kind === 'hurt' ? actor.id : cmd.targetId;
      const target = targetId ? e.order.find((c) => c.id === targetId) : undefined;
      if (!dm && target?.hidden) return deny();
      const amount = Math.max(0, Math.round(cmd.amount ?? 0));
      if (cmd.kind === 'other') {
        pushLog(r, { kind: 'other', actorId: actor.id, actor: actor.name, text: (cmd.text ?? '').slice(0, 500), roll: cmd.roll ?? null, targetId: target?.id, target: target?.name });
      } else {
        if (!target) return { room, effects: [], error: 'no-target' };
        const wasUp = (target.hp ?? 1) > 0;
        applyHp(target, cmd.kind, amount);
        if (target.kind === 'pc' && target.ownerId) {
          effects.push({ to: target.ownerId, ops: [cmd.kind === 'heal' ? { op: 'heal', amount, from: actor.name } : { op: 'damage', amount, from: actor.name }] });
        }
        pushLog(r, { kind: cmd.kind, actorId: actor.id, actor: actor.name, targetId: target.id, target: target.name, amount, roll: cmd.roll ?? null, after: describeHp(target) });
        if (wasUp && target.hp === 0) pushLog(r, { kind: 'down', targetId: target.id, target: target.name });
      }
      r.acted = true;
      return { room: r, effects };
    }

    case 'nextTurn': {
      if (!e.active || !e.order.length) return { room, effects: [], error: 'no-combat' };
      const cur = current(e);
      if (!dm && !(cur && cur.ownerId === me.id)) return deny();
      // Pasa al siguiente que siga en pie (los monstruos derrotados no juegan)
      let next = e.turn;
      for (let step = 0; step < e.order.length; step++) {
        next += 1;
        if (next >= e.order.length) {
          next = 0;
          e.round += 1;
          pushLog(r, { kind: 'round' });
        }
        const c = e.order[next];
        if (!(c.kind === 'monster' && c.hp === 0)) break;
      }
      e.turn = next;
      e.begun = true;
      pushLog(r, { kind: 'turn', actorId: current(e).id, actor: current(e).name });
      r.acted = false;
      r.snapshots.push(snap(r));
      if (r.snapshots.length > MAX_SNAPSHOTS) r.snapshots.shift();
      return { room: r, effects };
    }

    case 'undo': {
      if (!e.active || !r.snapshots.length) return { room, effects: [], error: 'nothing-to-undo' };
      const { target, owner } = undoTarget(r);
      if (!target) return { room, effects: [], error: 'nothing-to-undo' };
      if (!dm && owner !== me.id) return deny();
      if (!r.acted) r.snapshots.pop();
      const before = e.order;
      const restored = clone(target.encounter);
      for (let i = target.logLen; i < r.log.length; i++) if (r.log[i].kind !== 'undo') r.log[i].undone = true;
      r.encounter = restored;
      r.acted = false;
      // Las fichas de los jugadores vuelven a la vida que tenían
      for (const c of restored.order) {
        if (c.kind !== 'pc' || !c.ownerId) continue;
        const old = before.find((x) => x.id === c.id);
        if (old && (old.hp !== c.hp || old.temp !== c.temp) && c.hp != null) effects.push({ to: c.ownerId, ops: [{ op: 'setHp', hp: c.hp, temp: c.temp }] });
      }
      pushLog(r, { kind: 'undo', actorId: me.id, actor: me.name });
      return { room: r, effects };
    }
  }

  // ---- Comandos del DM ----
  if (!dm) return deny();
  switch (cmd.t) {
    case 'start': {
      // Entran los personajes de los jugadores; el resto lo añade el DM
      const keep = e.order.filter((c) => c.kind !== 'pc');
      const pcs = r.members.filter((m) => m.role === 'player' && m.summary).map((m) => pcFrom(m, e.order.find((c) => c.ownerId === m.id)));
      r.encounter = { active: true, round: 1, turn: 0, begun: false, order: [...pcs.map((c) => ({ ...c, initiative: null })), ...keep] };
      pushLog(r, { kind: 'start' });
      r.snapshots = [snap(r)];
      r.acted = false;
      return { room: r, effects };
    }
    case 'end': {
      e.active = false;
      pushLog(r, { kind: 'end' });
      // Los monstruos se quitan; los PNJ aliados se quedan para el próximo combate
      e.order = e.order.filter((c) => c.kind !== 'monster');
      e.turn = 0;
      e.round = 1;
      e.begun = false;
      r.snapshots = [];
      return { room: r, effects };
    }
    case 'add': {
      for (const p of cmd.combatants) {
        const c = newCombatant(p);
        e.order.push(c);
        pushLog(r, { kind: 'add', targetId: c.id, target: c.name });
      }
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
    case 'update': {
      const c = e.order.find((x) => x.id === cmd.id);
      if (!c) return deny();
      const wasHidden = c.hidden;
      Object.assign(c, cmd.patch, { id: c.id });
      if (wasHidden && !c.hidden) pushLog(r, { kind: 'reveal', targetId: c.id, target: c.name });
      if (c.kind === 'pc' && c.ownerId && ('hp' in cmd.patch || 'temp' in cmd.patch) && c.hp != null) effects.push({ to: c.ownerId, ops: [{ op: 'setHp', hp: c.hp, temp: c.temp }] });
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
    case 'remove': {
      const cur = current(e)?.id;
      e.order = e.order.filter((x) => x.id !== cmd.id);
      e.turn = Math.max(0, e.order.findIndex((x) => x.id === cur));
      return { room: r, effects };
    }
    case 'reorder': {
      const cur = current(e)?.id;
      const byId = new Map(e.order.map((c) => [c.id, c]));
      const ordered = cmd.ids.map((id) => byId.get(id)).filter((c): c is Combatant => !!c);
      e.order = [...ordered, ...e.order.filter((c) => !cmd.ids.includes(c.id))];
      e.turn = e.begun ? Math.max(0, e.order.findIndex((x) => x.id === cur)) : 0;
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
    case 'sort': {
      sortOrder(e);
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
  }
  return deny();
}

/** Qué deshace «Deshacer último turno»: lo hecho en el turno actual o, si no se ha hecho nada, el turno anterior */
function undoTarget(r: Room): { target?: Snapshot; owner?: string } {
  const s = r.snapshots;
  if (r.acted) {
    const t = s[s.length - 1];
    return { target: t, owner: t ? current(t.encounter)?.ownerId : undefined };
  }
  if (s.length < 2) return {};
  const t = s[s.length - 2];
  return { target: t, owner: current(t.encounter)?.ownerId };
}

// ---------- Vista de cada cliente ----------

export function viewFor(room: Room, memberId: string): RoomView | null {
  const me = room.members.find((m) => m.id === memberId);
  if (!me) return null;
  const dm = me.role === 'dm';
  const e = room.encounter;
  const cur = current(e);
  const hiddenIds = new Set(e.order.filter((c) => c.hidden).map((c) => c.id));
  const order: CombatantView[] = e.order
    .filter((c) => dm || !c.hidden)
    .map((c) => {
      const state = hpState(c);
      if (dm) return { ...c, state };
      const { notes: _notes, ...rest } = c;
      void _notes;
      const secret = c.kind !== 'pc' && !c.showHp;
      return { ...rest, hp: secret ? null : c.hp, hpMax: secret ? null : c.hpMax, temp: secret ? 0 : c.temp, ac: c.kind === 'pc' ? c.ac : null, initBonus: undefined, monster: undefined, state };
    });
  const log = room.log
    .filter((ev) => dm || ((!ev.actorId || !hiddenIds.has(ev.actorId)) && (!ev.targetId || !hiddenIds.has(ev.targetId))))
    .map((ev) => {
      if (dm) return ev;
      const tgt = ev.targetId ? e.order.find((c) => c.id === ev.targetId) : undefined;
      const secret = tgt && tgt.kind !== 'pc' && !tgt.showHp;
      return secret || (!tgt && ev.after) ? { ...ev, after: undefined } : ev;
    })
    .slice(-400);
  const { target, owner } = e.active && room.snapshots.length ? undoTarget(room) : {};
  return {
    code: room.code,
    you: { id: me.id, role: me.role, name: me.name },
    members: room.members.map(({ token: _t, ...m }) => { void _t; return m; }),
    encounter: {
      active: e.active,
      round: e.round,
      begun: e.begun,
      order,
      currentId: cur && (dm || !cur.hidden) ? cur.id : null,
      hiddenTurn: !!cur && cur.hidden && !dm,
    },
    log,
    canUndo: !!target && (dm || owner === me.id),
    canEndTurn: e.active && !!cur && (dm || cur.ownerId === me.id),
  };
}
