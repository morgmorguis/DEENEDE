// Lógica de la partida compartida. Funciones puras: el servidor guarda una `Room`, le aplica los
// comandos de cada cliente y envía a cada uno solo lo que puede ver (los jugadores nunca reciben
// monstruos ocultos, vida exacta de monstruos ni notas del DM).
import type { ItemMods } from '../rules/itemTypes';
import type {
  CarriedLoot, Combatant, CombatantView, Command, Encounter, EncounterEntry, Chronicle, GameMode, Gift, HpState, LootDrop, PreparedEncounter, RoomSettings, SharedImage, LogEvent, Member, Phase, Role, RosterEntry, RoomView, SheetOp,
} from './protocol';
import { COMBAT_SCENES, isImageCategory, pickCombatScene } from './protocol';

export interface StoredMember extends Member { token: string }

interface Snapshot { encounter: Encounter; logLen: number }

export interface Room {
  code: string;
  /** Se puede entrar con el código. Una partida nueva empieza cerrada: el DM la prepara y la abre con `openGame` */
  open?: boolean;
  /** Dónde se juega: en casa (misma Wi-Fi que el PC del DM, código con su dirección) o en la nube (desde cualquier sitio) */
  mode?: GameMode;
  dmKey: string;
  members: StoredMember[];
  encounter: Encounter;
  log: LogEvent[];
  /** Estado al empezar cada turno (para deshacer) */
  snapshots: Snapshot[];
  /** Se ha hecho algo en el turno actual */
  acted: boolean;
  /** Personajes que el DM tiene preparados (nunca se envían a los jugadores) */
  roster: RosterEntry[];
  /** Registro de oro y objetos dados por el DM */
  gifts: Gift[];
  settings: RoomSettings;
  /** Imágenes del DM (solo los datos: los archivos los guarda el servidor) */
  images: SharedImage[];
  chronicles: Chronicle[];
  /** Encuentros preparados del DM */
  encounters: PreparedEncounter[];
  /** Cuándo pidió el DM sincronizar las fichas */
  syncRequest?: number;
  /** Botín de los combates terminados que el DM aún no ha repartido */
  loot: LootDrop[];
}

export interface Effect { to: string; ops: SheetOp[] }
export interface Result { room: Room; effects: Effect[]; error?: string }

const MAX_LOG = 3000;
const MAX_SNAPSHOTS = 40;
const MAX_GIFTS = 2000;
const COIN_KEYS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
const RARITIES = ['mundane', 'common', 'uncommon', 'rare', 'veryRare', 'legendary', 'artifact'];
const TYPES = ['weapon', 'armor', 'potion', 'scroll', 'wondrous', 'ring', 'wand', 'gear', 'treasure', 'other'];
const num = (x: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));

const ABS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const int = (x: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(x) || 0)));
const short = (x: unknown, n: number) => String(x ?? '').slice(0, n);

/** Efectos al equipar: solo campos conocidos y números acotados */
export function cleanMods(m: unknown): ItemMods | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const x = m as Record<string, unknown>;
  const out: ItemMods = {};
  const a = x.armor as Record<string, unknown> | undefined;
  if (a && typeof a === 'object') {
    const kind = ['light', 'medium', 'heavy'].includes(String(a.kind)) ? (a.kind as 'light' | 'medium' | 'heavy') : 'light';
    out.armor = { base: int(a.base, 0, 30), kind, dexMax: a.dexMax == null ? null : int(a.dexMax, 0, 10), ...(a.str ? { str: int(a.str, 0, 30) } : {}), ...(a.stealthDis ? { stealthDis: true } : {}) };
  }
  for (const k of ['shield', 'ac', 'acNoArmor', 'saves', 'checks', 'speed', 'attack', 'damage'] as const) { const v = int(x[k], -60, 60); if (v) out[k] = v; }
  for (const k of ['abilitySet', 'abilityBonus'] as const) {
    const src = x[k] as Record<string, unknown> | undefined;
    if (!src || typeof src !== 'object') continue;
    const r: Partial<Record<(typeof ABS)[number], number>> = {};
    for (const ab of ABS) { const v = int(src[ab], -30, 30); if (v) r[ab] = v; }
    if (Object.keys(r).length) out[k] = r;
  }
  const w = x.weapon as Record<string, unknown> | undefined;
  if (w && typeof w === 'object' && /^\d*d\d+([+-]\d+)?$/.test(String(w.dice))) {
    out.weapon = { dice: short(w.dice, 12), type: short(w.type, 20), ...(w.finesse ? { finesse: true } : {}), ...(w.ranged ? { ranged: true } : {}), ...(w.range ? { range: short(w.range, 20) } : {}), ...(w.mastery ? { mastery: short(w.mastery, 20) } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Limpia lo que manda el DM: monedas enteras y positivas, objetos con nombre y campos acotados */
export function cleanGift(cmd: Extract<Command, { t: 'give' }>, dm = true): Pick<Gift, 'coins' | 'items' | 'note' | 'charge'> | null {
  const clean = cleanLoot(cmd);
  // Cobro: solo el DM (lo que vale lo que da, o lo que el jugador le paga); en po, con céntimos de cobre
  const charge = dm ? Math.round(Math.max(0, Math.min(10_000_000, Number(cmd.charge) || 0)) * 100) / 100 : 0;
  if (!clean && !charge) return null;
  const note = String(cmd.note ?? '').trim().slice(0, 500);
  return { ...(clean ?? {}), ...(charge ? { charge } : {}), ...(note ? { note } : {}) };
}

/** Monedas y objetos limpios (null si no hay nada) */
export function cleanLoot(x: CarriedLoot | undefined | null): CarriedLoot | null {
  if (!x || typeof x !== 'object') return null;
  const coins: Gift['coins'] = {};
  for (const k of COIN_KEYS) { const v = num(x.coins?.[k], 10_000_000); if (v) coins[k] = v; }
  const items = (Array.isArray(x.items) ? x.items : []).slice(0, 50).map((i) => ({
    name: String(i.name ?? '').trim().slice(0, 120),
    rarity: RARITIES.includes(i.rarity) ? i.rarity : 'common',
    type: TYPES.includes(i.type) ? i.type : 'other',
    description: String(i.description ?? '').slice(0, 4000),
    value: Math.max(0, Math.min(10_000_000, Number(i.value) || 0)),
    weight: Math.max(0, Math.min(10_000, Number(i.weight) || 0)),
    attunement: !!i.attunement,
    qty: Math.max(1, num(i.qty, 9999)),
    ...(i.ref ? { ref: String(i.ref).slice(0, 60) } : {}),
    ...(cleanMods(i.mods) ? { mods: cleanMods(i.mods) } : {}),
    ...(i.consumable === 'ammo' || i.consumable === 'thrown' || i.consumable === 'item' ? { consumable: i.consumable } : {}),
  })).filter((i) => i.name);
  if (!Object.keys(coins).length && !items.length) return null;
  return { ...(Object.keys(coins).length ? { coins } : {}), ...(items.length ? { items } : {}) };
}

export const rid = (n = 8) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
/** Código distinto del anterior */
export const newCode = (prev: string) => { let c = code6(); while (c === prev) c = code6(); return c; };

/** Por qué no puede entrar con ese código: la partida está cerrada o el código no es el suyo */
export const enterError = (room: Pick<Room, 'code' | 'open'>, code: string): 'game-closed' | 'bad-code' =>
  room.open === false && code.trim().toUpperCase() === room.code ? 'game-closed' : 'bad-code';

/** ¿Puede entrar? Con el código (si la partida está abierta), con la clave del DM o con el token de alguien que ya está en la partida (aunque el código haya cambiado) */
export function canEnter(room: Pick<Room, 'code' | 'dmKey' | 'members' | 'open'>, code: string, token?: string, dmKey?: string): boolean {
  return (room.open !== false && code.trim().toUpperCase() === room.code) || (!!dmKey && dmKey === room.dmKey) || (!!token && room.members.some((m) => m.token === token));
}

export function createRoom(): Room {
  return { code: code6(), open: false, dmKey: rid(12), members: [], encounter: { active: false, round: 1, turn: 0, begun: false, order: [] }, log: [], snapshots: [], acted: false, roster: [], gifts: [], settings: { showPartyHp: false }, images: [], chronicles: [], encounters: [], loot: [] };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const d20 = () => 1 + Math.floor(Math.random() * 20);

/** Completa partidas guardadas con versiones anteriores */
export function normalizeRoom(room: Room): Room {
  const r = room;
  r.roster ??= [];
  r.gifts ??= [];
  r.images ??= [];
  r.chronicles ??= [];
  r.encounters ??= [];
  r.loot ??= [];
  // Partidas guardadas antes de «Crear partida»: siguen abiertas como estaban
  r.open ??= true;
  r.settings = { ...{ showPartyHp: false }, ...(r.settings ?? {}) };
  r.encounter.phase ??= 'running';
  r.encounter.ready ??= [];
  r.encounter.accepted ??= [];
  return r;
}
const phaseOf = (e: Encounter): Phase => e.phase ?? 'running';

/** Quién tiene que pulsar «Listo»: los jugadores conectados con personaje en el combate (el DM ya lo lanzó) */
export function neededReady(r: Room): string[] {
  const pcs = new Set(r.encounter.order.filter((c) => c.kind === 'pc' && c.ownerId).map((c) => c.ownerId!));
  return r.members.filter((m) => m.online && m.role === 'player' && pcs.has(m.id)).map((m) => m.id);
}

/** Empieza los turnos: orden por iniciativa y primer turno */
function begin(r: Room) {
  const e = r.encounter;
  e.phase = 'running';
  e.ready = [];
  e.begun = false;
  // Los monstruos sin iniciativa la tiran ahora
  for (const c of e.order) if (c.kind !== 'pc' && c.initiative == null) c.initiative = d20() + (c.initBonus ?? 0);
  e.turn = 0;
  e.round = 1;
  sortOrder(e);
  pushLog(r, { kind: 'begin' });
  if (e.order[0]) pushLog(r, { kind: 'turn', actorId: e.order[0].id, actor: e.order[0].name });
  r.snapshots = [snap(r)];
  r.acted = false;
}

function checkBegin(r: Room) {
  const e = r.encounter;
  if (!e.active || phaseOf(e) !== 'setup') return;
  const need = neededReady(r);
  const ready = e.ready ?? [];
  if (need.length && need.every((id) => ready.includes(id))) begin(r);
}

export function hpState(c: Pick<Combatant, 'hp' | 'hpMax'>): HpState {
  if (c.hp == null || c.hpMax == null) return 'unknown';
  if (c.hp <= 0) return 'down';
  if (c.hp <= Math.floor(c.hpMax / 2)) return 'bloodied';
  if (c.hp < c.hpMax) return 'hurt';
  return 'unhurt';
}

// ---------- Unirse ----------

export function join(room: Room, name: string, token?: string, dmKey?: string, viewer = false): { room: Room; member: StoredMember } {
  const r = clone(room);
  let m = token ? r.members.find((x) => x.token === token) : undefined;
  const role: Role = dmKey && dmKey === r.dmKey ? 'dm' : viewer ? 'viewer' : m?.role === 'dm' ? 'player' : m?.role ?? 'player';
  if (!m) {
    m = { id: rid(), token: rid(16), name: name.trim() || (role === 'dm' ? 'DM' : role === 'viewer' ? 'Pantalla' : 'Jugador'), role, online: true };
    r.members.push(m);
  } else {
    m.online = true;
    m.role = role;
    if (name.trim()) m.name = name.trim();
  }
  return { room: r, member: m };
}

export function setOnline(room: Room, memberId: string, online: boolean): Room {
  const r = normalizeRoom(clone(room));
  const m = r.members.find((x) => x.id === memberId);
  if (m) m.online = online;
  checkBegin(r);
  return r;
}

// ---------- Comandos ----------

const current = (e: Encounter) => e.order[e.turn];
const snap = (r: Room): Snapshot => ({ encounter: clone(r.encounter), logLen: r.log.length });

function pushLog(r: Room, ev: Omit<LogEvent, 'id' | 'at' | 'round'>) {
  r.log.push({ id: rid(), at: Date.now(), round: r.encounter.round, ...ev });
  if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);
}

/** «Entra en el combate» (durante la preparación no se anota: se anota al lanzarlo) */
function logAdd(r: Room, c: Combatant) {
  if (r.encounter.active && phaseOf(r.encounter) === 'prep') return;
  pushLog(r, { kind: 'add', targetId: c.id, target: c.name, ...(c.hidden ? { secret: true } : {}) });
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
    cr: p.cr,
    conditions: p.conditions ?? [],
    counters: p.counters ?? [],
    ...(p.color ? { color: p.color } : {}),
    ...(cleanLoot(p.loot) ? { loot: cleanLoot(p.loot)! } : {}),
  };
}

/** Nombres numerados que siguen a los que ya hay («Matón 3», «Matón 4»…) */
function numberedNames(order: Combatant[], name: string, n: number): string[] {
  const same = (c: Combatant) => c.name === name || (c.name.startsWith(`${name} `) && /^\d+$/.test(c.name.slice(name.length + 1)));
  const taken = order.filter(same).map((c) => (c.name === name ? 1 : Number(c.name.slice(name.length + 1))));
  if (n === 1 && !taken.length) return [name];
  // Si ya había uno sin número, pasa a ser el 1
  for (const c of order) if (c.name === name) c.name = `${name} 1`;
  const start = taken.length ? Math.max(...taken) + 1 : 1;
  return Array.from({ length: n }, (_, i) => `${name} ${start + i}`);
}

/** Criaturas de una entrada de encuentro */
function fromEntry(order: Combatant[], x: EncounterEntry, count: number, hidden: boolean): Combatant[] {
  return numberedNames(order, x.name, count).map((name) => newCombatant({
    name, kind: x.kind, hpMax: x.hpMax, hp: x.hpMax, ac: x.ac, initBonus: x.initBonus,
    initiative: d20() + x.initBonus, hidden, showHp: x.kind === 'npc', notes: x.notes ?? '', monster: x.monster, cr: x.cr, color: x.color, loot: x.loot,
  }));
}

/** Lanza el combate: entran los personajes de los jugadores y les llega el aviso */
function launch(r: Room) {
  const e = r.encounter;
  const keep = e.order.filter((c) => c.kind !== 'pc');
  const pcs = r.members.filter((m) => m.role === 'player' && m.summary).map((m) => ({ ...pcFrom(m, e.order.find((c) => c.ownerId === m.id)), initiative: null }));
  r.encounter = { active: true, phase: 'setup', ready: [], accepted: [], round: 1, turn: 0, begun: false, scene: pickCombatScene(e.scene), ...(e.title ? { title: e.title } : {}), order: [...pcs, ...keep] };
  pushLog(r, { kind: 'start', ...(e.title ? { text: e.title } : {}) });
  // Los enemigos preparados entran ahora en el registro (los ocultos, en secreto)
  for (const c of keep) pushLog(r, { kind: 'add', targetId: c.id, target: c.name, ...(c.hidden ? { secret: true } : {}) });
  r.snapshots = [snap(r)];
  r.acted = false;
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
  const r = normalizeRoom(clone(room));
  const me = r.members.find((m) => m.id === memberId);
  if (!me) return { room, effects: [], error: 'not-member' };
  const dm = me.role === 'dm';
  const e = r.encounter;
  const effects: Effect[] = [];
  if (me.role === 'viewer') return { room, effects: [], error: 'not-allowed' };
  const deny = (): Result => ({ room, effects: [], error: 'not-allowed' });
  const ownsPc = (id: string) => e.order.some((c) => c.id === id && c.kind === 'pc' && c.ownerId === me.id);
  const running = e.active && phaseOf(e) === 'running';

  switch (cmd.t) {
    case 'summary': {
      me.summary = cmd.summary;
      // La cara: solo una miniatura JPEG pequeña (no una foto entera en cada vista)
      const f = me.summary?.face;
      if (f !== undefined && (typeof f !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(f) || f.length > 24_000)) delete me.summary.face;
      if (!me.name || me.name === 'Jugador') me.name = cmd.summary.name;
      const i = e.order.findIndex((c) => c.kind === 'pc' && c.ownerId === me.id);
      if (i >= 0) e.order[i] = pcFrom(me, e.order[i]);
      // Quien llega con el combate lanzado (antesala o en marcha) entra en él
      else if (e.active && phaseOf(e) !== 'prep' && me.role === 'player') e.order.push({ ...pcFrom(me), initiative: null });
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

    case 'ready': {
      if (!e.active || phaseOf(e) !== 'setup') return { room, effects: [], error: 'not-setup' };
      const pc = e.order.find((c) => c.kind === 'pc' && c.ownerId === me.id);
      if (!dm && !pc) return deny();
      if (cmd.value && pc && pc.initiative == null && !dm) return { room, effects: [], error: 'need-initiative' };
      const set = new Set(e.ready ?? []);
      if (cmd.value) set.add(me.id); else set.delete(me.id);
      e.ready = [...set];
      if (cmd.value && !dm && !(e.accepted ?? []).includes(me.id)) e.accepted = [...(e.accepted ?? []), me.id];
      checkBegin(r);
      return { room: r, effects };
    }

    case 'accept': {
      if (!e.active || phaseOf(e) === 'prep') return { room, effects: [], error: 'no-combat' };
      if (me.role !== 'player') return deny();
      if (!(e.accepted ?? []).includes(me.id)) e.accepted = [...(e.accepted ?? []), me.id];
      return { room: r, effects };
    }

    case 'act': {
      if (!e.active) return { room, effects: [], error: 'no-combat' };
      if (!running) return { room, effects: [], error: 'not-running' };
      const actor = e.order.find((c) => c.id === cmd.actorId);
      if (!actor) return deny();
      if (!dm && !ownsPc(actor.id)) return deny();
      // Los jugadores solo actúan en su turno; fuera de él, una reacción por ronda
      const theirTurn = current(e)?.id === actor.id;
      if (!dm && !theirTurn) {
        if (!cmd.reaction) return { room, effects: [], error: 'not-your-turn' };
        if (actor.reactionRound === e.round) return { room, effects: [], error: 'reaction-used' };
      }
      if (cmd.reaction) actor.reactionRound = e.round;
      const targetId = cmd.kind === 'hurt' ? actor.id : cmd.targetId;
      const target = targetId ? e.order.find((c) => c.id === targetId) : undefined;
      if (!dm && target?.hidden) return deny();
      const amount = Math.max(0, Math.round(cmd.amount ?? 0));
      const extra = {
        ...(cmd.action ? { action: String(cmd.action).slice(0, 40) } : {}),
        ...(cmd.weapon ? { weapon: String(cmd.weapon).slice(0, 80) } : {}),
        ...(cmd.spell ? { spell: String(cmd.spell).slice(0, 80) } : {}),
        ...(cmd.crit ? { crit: true } : {}),
        ...(cmd.reaction ? { reaction: true } : {}),
      };
      if (cmd.kind === 'other' || cmd.kind === 'miss') {
        pushLog(r, { kind: cmd.kind, actorId: actor.id, actor: actor.name, text: (cmd.text ?? '').slice(0, 500), roll: cmd.roll ?? null, targetId: target?.id, target: target?.name, ...extra });
      } else {
        if (!target) return { room, effects: [], error: 'no-target' };
        const wasUp = (target.hp ?? 1) > 0;
        applyHp(target, cmd.kind, amount);
        if (target.kind === 'pc' && target.ownerId) {
          effects.push({ to: target.ownerId, ops: [cmd.kind === 'heal' ? { op: 'heal', amount, from: actor.name } : { op: 'damage', amount, from: actor.name }] });
        }
        pushLog(r, { kind: cmd.kind, actorId: actor.id, actor: actor.name, targetId: target.id, target: target.name, amount, roll: cmd.roll ?? null, after: describeHp(target), ...(cmd.text ? { text: String(cmd.text).slice(0, 300) } : {}), ...extra });
        // Quién dio el golpe final (solo cuenta como baja si no es un personaje jugador)
        if (wasUp && target.hp === 0) pushLog(r, { kind: 'down', targetId: target.id, target: target.name, ...(cmd.kind === 'hit' ? { actorId: actor.id, actor: actor.name, ownerId: actor.kind === 'pc' ? actor.ownerId : undefined } : {}) });
      }
      r.acted = true;
      return { room: r, effects };
    }

    case 'nextTurn': {
      if (!e.active || !e.order.length) return { room, effects: [], error: 'no-combat' };
      if (!running) return { room, effects: [], error: 'not-running' };
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
      // Termina el turno del actual: bajan las duraciones de sus condiciones
      if (cur) {
        for (const cond of cur.conditions ?? []) if (cond.rounds != null) cond.rounds -= 1;
        const gone = (cur.conditions ?? []).filter((x) => x.rounds != null && x.rounds <= 0);
        cur.conditions = (cur.conditions ?? []).filter((x) => x.rounds == null || x.rounds > 0);
        for (const g of gone) pushLog(r, { kind: 'other', actorId: cur.id, actor: cur.name, text: `⌛ ${g.name}` });
      }
      e.turn = next;
      e.begun = true;
      // Empieza el turno del siguiente: se reinician sus acciones legendarias
      for (const ct of current(e).counters ?? []) if (ct.reset === 'turn') ct.used = 0;
      pushLog(r, { kind: 'turn', actorId: current(e).id, actor: current(e).name });
      r.acted = false;
      r.snapshots.push(snap(r));
      if (r.snapshots.length > MAX_SNAPSHOTS) r.snapshots.shift();
      return { room: r, effects };
    }

    case 'give': {
      // El DM da a cualquier jugador; un jugador puede dar de lo suyo a otro jugador (intercambio)
      if (me.role !== 'dm' && me.role !== 'player') return deny();
      const to = r.members.find((m) => m.id === cmd.toId && m.role === 'player');
      if (!to || to.id === me.id) return { room, effects: [], error: 'no-target' };
      const clean = cleanGift(cmd, dm);
      if (!clean) return { room, effects: [], error: 'empty-gift' };
      const from = dm ? {} : { fromId: me.id, fromName: me.summary?.name || me.name };
      r.gifts.push({ id: rid(10), at: Date.now(), toId: to.id, toName: to.summary?.name || to.name, ...from, ...clean, delivered: false });
      if (r.gifts.length > MAX_GIFTS) r.gifts.splice(0, r.gifts.length - MAX_GIFTS);
      return { room: r, effects };
    }

    case 'giftAck': {
      const ids = new Set(cmd.ids);
      for (const g of r.gifts) if (ids.has(g.id) && g.toId === me.id && !g.delivered) { g.delivered = true; g.deliveredAt = Date.now(); }
      return { room: r, effects };
    }

    case 'undo': {
      if (!running || !r.snapshots.length) return { room, effects: [], error: 'nothing-to-undo' };
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

  if (cmd.t === 'sheetUpload') {
    // El archivo lo guarda el servidor; aquí solo se apunta cuándo
    if (me.role !== 'player') return deny();
    me.sheetAt = Date.now();
    return { room: r, effects };
  }

  // ---- Comandos del DM ----
  if (!dm) return deny();
  switch (cmd.t) {
    case 'syncSheets': {
      r.syncRequest = Date.now();
      return { room: r, effects };
    }
    case 'start': {
      // Apps antiguas: lanza directamente (entran los jugadores; el resto lo añade el DM)
      if (e.active && phaseOf(e) !== 'prep') return { room, effects: [], error: 'combat-active' };
      launch(r);
      return { room: r, effects };
    }
    case 'prepare': {
      if (e.active) return { room, effects: [], error: 'combat-active' };
      const title = String(cmd.title ?? '').trim().slice(0, 80);
      // Los aliados que ya estaban preparados se quedan
      r.encounter = { active: true, phase: 'prep', ready: [], accepted: [], round: 1, turn: 0, begun: false, scene: e.scene, ...(title ? { title } : {}), order: e.order.filter((c) => c.kind !== 'pc') };
      return { room: r, effects };
    }
    case 'encounterTitle': {
      const title = String(cmd.title ?? '').trim().slice(0, 80);
      if (title) e.title = title; else delete e.title;
      return { room: r, effects };
    }
    case 'launch': {
      if (!e.active || phaseOf(e) !== 'prep') return { room, effects: [], error: 'not-prep' };
      launch(r);
      return { room: r, effects };
    }
    case 'entryToCombat': {
      const enc = r.encounters.find((x) => x.id === cmd.encounterId);
      const x = enc?.entries.find((y) => y.id === cmd.entryId);
      if (!x) return deny();
      const n = Math.max(1, Math.min(20, Math.round(cmd.count) || 1));
      for (const c of fromEntry(e.order, x, n, cmd.hidden ?? x.hidden)) { e.order.push(c); logAdd(r, c); }
      if (!e.begun) { sortOrder(e); r.snapshots = [snap(r)]; }
      return { room: r, effects };
    }
    case 'newCode': {
      r.code = newCode(r.code);
      return { room: r, effects };
    }
    case 'newSession':
    case 'openGame': {
      // Al abrir la partida, el combate que el DM esté preparando a solas se conserva
      const keepPrep = cmd.t === 'openGame' && e.active && phaseOf(e) === 'prep';
      r.code = newCode(r.code);
      r.open = true;
      if (cmd.t === 'openGame' && (cmd.mode === 'local' || cmd.mode === 'cloud')) r.mode = cmd.mode;
      if (!keepPrep) {
        // Sin combate (sin pasar al botín: era una sesión anterior); los aliados preparados se quedan
        r.encounter = { active: false, phase: 'running', ready: [], accepted: [], round: 1, turn: 0, begun: false, scene: e.scene, order: e.order.filter((c) => c.kind === 'npc') };
        r.snapshots = [];
        r.acted = false;
      }
      delete r.syncRequest;
      if (cmd.removePlayers) {
        const gone = new Set(r.members.filter((m) => m.role !== 'dm').map((m) => m.id));
        r.members = r.members.filter((m) => m.role === 'dm');
        if (keepPrep) r.encounter.order = r.encounter.order.filter((c) => !(c.kind === 'pc' && c.ownerId && gone.has(c.ownerId)));
      }
      if (cmd.clearLog) r.log = [];
      return { room: r, effects };
    }
    case 'closeGame': {
      r.open = false;
      if (cmd.removePlayers) r.members = r.members.filter((m) => m.role === 'dm');
      return { room: r, effects };
    }
    case 'kick': {
      // Saca a un jugador (o una pantalla) de la partida: su personaje sale del combate. Si la partida sigue abierta,
      // puede volver a entrar con el código, como alguien nuevo
      const who = r.members.find((m) => m.id === cmd.id);
      if (!who || who.role === 'dm') return { room, effects: [], error: 'no-target' };
      r.members = r.members.filter((m) => m.id !== who.id);
      const cur = current(e)?.id;
      e.order = e.order.filter((c) => !(c.kind === 'pc' && c.ownerId === who.id));
      e.turn = Math.max(0, e.order.findIndex((x) => x.id === cur));
      e.ready = (e.ready ?? []).filter((x) => x !== who.id);
      e.accepted = (e.accepted ?? []).filter((x) => x !== who.id);
      return { room: r, effects };
    }
    case 'lootDone': {
      const ids = new Set(cmd.ids);
      r.loot = r.loot.filter((x) => !ids.has(x.id));
      return { room: r, effects };
    }
    case 'begin': {
      if (!e.active || phaseOf(e) !== 'setup') return { room, effects: [], error: 'not-setup' };
      begin(r);
      return { room: r, effects };
    }
    case 'rosterSave': {
      const entry = { ...cmd.entry, id: cmd.entry.id || rid(), name: cmd.entry.name.trim() || 'PNJ' };
      const i = r.roster.findIndex((x) => x.id === entry.id);
      if (i >= 0) r.roster[i] = entry; else r.roster.push(entry);
      return { room: r, effects };
    }
    case 'imageAdd': {
      if (!cmd.id || !/^[a-z0-9]{6,20}$/.test(cmd.id)) return { room, effects: [], error: 'bad-image' };
      r.images.push({ id: cmd.id, title: String(cmd.title ?? '').trim().slice(0, 80) || 'Imagen', at: Date.now(), shared: false, to: 'all', w: cmd.w, h: cmd.h, ...(isImageCategory(cmd.category) ? { category: cmd.category } : {}) });
      if (r.images.length > 300) r.images.splice(0, r.images.length - 300);
      return { room: r, effects };
    }
    case 'chronicleShare': {
      const text = String(cmd.text ?? '').trim().slice(0, 20000);
      if (!text) return { room, effects: [], error: 'empty' };
      // Para todo el grupo o solo para algunos jugadores (lo privado no sale en el registro, que lo ven todos)
      const to = Array.isArray(cmd.to) ? cmd.to.filter((id) => r.members.some((m) => m.id === id && m.role === 'player')) : 'all';
      if (Array.isArray(to) && !to.length) return { room, effects: [], error: 'no-target' };
      r.chronicles.push({ id: rid(10), title: String(cmd.title ?? '').trim().slice(0, 120) || 'Crónica', text, at: Date.now(), to });
      if (r.chronicles.length > 200) r.chronicles.splice(0, r.chronicles.length - 200);
      if (to === 'all') pushLog(r, { kind: 'narrative', text: String(cmd.title ?? '').slice(0, 120) });
      return { room: r, effects };
    }
    case 'chronicleRemove': {
      r.chronicles = r.chronicles.filter((x) => x.id !== cmd.id);
      return { room: r, effects };
    }
    case 'imageShare': {
      const img = r.images.find((x) => x.id === cmd.id);
      if (!img) return deny();
      img.shared = true;
      img.to = cmd.to === 'all' ? 'all' : cmd.to.filter((id) => r.members.some((m) => m.id === id && m.role === 'player'));
      img.sharedAt = Date.now();
      return { room: r, effects };
    }
    case 'imageUnshare': {
      const img = r.images.find((x) => x.id === cmd.id);
      if (!img) return deny();
      img.shared = false;
      return { room: r, effects };
    }
    case 'imageCategory': {
      const img = r.images.find((x) => x.id === cmd.id);
      if (!img || !isImageCategory(cmd.category)) return deny();
      img.category = cmd.category;
      return { room: r, effects };
    }
    case 'imageRename': {
      const img = r.images.find((x) => x.id === cmd.id);
      if (!img) return deny();
      img.title = String(cmd.title ?? '').trim().slice(0, 80) || img.title;
      return { room: r, effects };
    }
    case 'imageRemove': {
      r.images = r.images.filter((x) => x.id !== cmd.id);
      return { room: r, effects };
    }
    case 'roomSettings': {
      if (typeof cmd.patch.showPartyHp === 'boolean') r.settings.showPartyHp = cmd.patch.showPartyHp;
      return { room: r, effects };
    }
    case 'giftCancel': {
      const g = r.gifts.find((x) => x.id === cmd.id);
      if (!g || g.delivered) return { room, effects: [], error: 'gift-delivered' };
      r.gifts = r.gifts.filter((x) => x.id !== cmd.id);
      return { room: r, effects };
    }
    case 'rosterRemove': {
      r.roster = r.roster.filter((x) => x.id !== cmd.id);
      return { room: r, effects };
    }
    case 'encounterSave': {
      const enc = cmd.encounter;
      const clean: PreparedEncounter = {
        id: enc.id || rid(), name: String(enc.name ?? '').trim().slice(0, 80) || 'Encuentro', notes: String(enc.notes ?? '').slice(0, 2000),
        entries: (enc.entries ?? []).slice(0, 80).map((x) => {
          const loot = cleanLoot(x.loot);
          const { loot: _l, ...rest } = x;
          void _l;
          return { ...rest, id: x.id || rid(), name: String(x.name ?? '').trim().slice(0, 60) || 'Enemigo', count: Math.max(1, Math.min(20, Math.round(x.count) || 1)), hidden: !!x.hidden, initBonus: Math.round(Number(x.initBonus) || 0), ...(loot ? { loot } : {}) };
        }),
      };
      const i = r.encounters.findIndex((x) => x.id === clean.id);
      if (i >= 0) r.encounters[i] = clean; else r.encounters.push(clean);
      return { room: r, effects };
    }
    case 'encounterRemove': {
      r.encounters = r.encounters.filter((x) => x.id !== cmd.id);
      return { room: r, effects };
    }
    case 'encounterLoad': {
      const enc = r.encounters.find((x) => x.id === cmd.id);
      if (!enc) return deny();
      for (const x of enc.entries) {
        for (const c of fromEntry(e.order, x, x.count, x.hidden)) { e.order.push(c); logAdd(r, c); }
      }
      if (!e.begun) { sortOrder(e); r.snapshots = [snap(r)]; }
      return { room: r, effects };
    }
    case 'rosterToCombat': {
      const entry = r.roster.find((x) => x.id === cmd.id);
      if (!entry) return deny();
      const n = Math.max(1, Math.min(20, cmd.count));
      const names = numberedNames(e.order, entry.name, n);
      for (let i = 1; i <= n; i++) {
        const c = newCombatant({
          name: names[i - 1], kind: entry.kind, hpMax: entry.hpMax, hp: entry.hpMax, ac: entry.ac,
          initBonus: entry.initBonus, initiative: d20() + entry.initBonus, hidden: cmd.hidden, showHp: entry.kind === 'npc', monster: entry.monster, color: entry.color,
          notes: [entry.notes, entry.attacks && `⚔️ ${entry.attacks}`, entry.equipment && `🎒 ${entry.equipment}`].filter(Boolean).join('\n'),
          cr: entry.level.match(/(?:VD|CR)\s*([\d/]+)/i)?.[1],
        });
        e.order.push(c);
        logAdd(r, c);
      }
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
    case 'end': {
      const wasPrep = e.active && phaseOf(e) === 'prep';
      const wasActive = e.active;
      e.active = false;
      e.phase = 'running';
      e.ready = [];
      e.accepted = [];
      if (wasActive && !wasPrep) {
        pushLog(r, { kind: 'end' });
        // Lo que llevaban los enemigos queda como botín para que el DM lo reparta
        for (const c of e.order) {
          if (c.kind !== 'monster' || !c.loot) continue;
          r.loot.push({ id: rid(10), at: Date.now(), from: c.name, defeated: c.hp === 0, ...(e.title ? { combat: e.title } : {}), ...c.loot });
        }
        if (r.loot.length > 300) r.loot.splice(0, r.loot.length - 300);
      }
      delete e.title;
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
        logAdd(r, c);
      }
      if (!e.begun) r.snapshots = [snap(r)];
      return { room: r, effects };
    }
    case 'update': {
      const c = e.order.find((x) => x.id === cmd.id);
      if (!c) return deny();
      const wasHidden = c.hidden;
      Object.assign(c, cmd.patch, { id: c.id });
      if ('loot' in cmd.patch) { const l = cleanLoot(cmd.patch.loot); if (l) c.loot = l; else delete c.loot; }
      if (wasHidden && !c.hidden && phaseOf(e) !== 'prep') pushLog(r, { kind: 'reveal', targetId: c.id, target: c.name });
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

/** ¿Puede este miembro ver la imagen? DM todas; jugadores las compartidas con ellos; la tele las compartidas con todos */
/** Quién ve una crónica o nota del DM: el DM, todos si es para el grupo y, si es privada, solo sus destinatarios */
export function canSeeChronicle(me: Pick<Member, 'id' | 'role'>, ch: Chronicle): boolean {
  if (me.role === 'dm') return true;
  if (!ch.to || ch.to === 'all') return true;
  return me.role === 'player' && ch.to.includes(me.id);
}

export function canSeeImage(_room: Room, me: Pick<Member, 'id' | 'role'>, im: SharedImage): boolean {
  void _room;
  if (me.role === 'dm') return true;
  if (!im.shared) return false;
  if (im.to === 'all') return true;
  return me.role === 'player' && im.to.includes(me.id);
}

/**
 * Criaturas que los jugadores no deben conocer: las ocultas ahora y las que entraron ocultas y nunca se
 * revelaron (aunque el combate ya haya terminado y no estén en el orden).
 */
export function secretIds(log: LogEvent[], order: { id: string; hidden?: boolean }[] = []): Set<string> {
  const ids = new Set(order.filter((c) => c.hidden).map((c) => c.id));
  for (const ev of log) {
    if (ev.kind === 'add' && ev.secret && ev.targetId) ids.add(ev.targetId);
    if (ev.kind === 'reveal' && ev.targetId && !order.some((c) => c.id === ev.targetId && c.hidden)) ids.delete(ev.targetId);
  }
  return ids;
}

export function viewFor(raw: Room, memberId: string): RoomView | null {
  const room = normalizeRoom(clone(raw));
  const me = room.members.find((m) => m.id === memberId);
  if (!me) return null;
  const dm = me.role === 'dm';
  const e = room.encounter;
  // Mientras el DM prepara el combate, para los demás no hay combate
  const prep = e.active && phaseOf(e) === 'prep';
  const cur = prep ? undefined : current(e);
  const hiddenIds = secretIds(room.log, e.order);
  const order: CombatantView[] = e.order
    .filter((c) => dm || (!c.hidden && !prep))
    .map((c) => {
      const state = hpState(c);
      if (dm) return { ...c, state };
      const { notes: _notes, loot: _loot, ...rest } = c;
      void _notes; void _loot;
      // Personajes de otros jugadores: su vida solo si el DM lo permite (si no, su estado: herido, ensangrentado…)
      const secret = (c.kind !== 'pc' && !c.showHp) || (c.kind === 'pc' && c.ownerId !== me.id && !room.settings.showPartyHp);
      // De los enemigos solo se sabe qué son (y si han caído), salvo que el DM muestre su vida
      const enemyState: HpState = c.kind === 'monster' && !c.showHp ? (state === 'down' ? 'down' : 'unknown') : state;
      return { ...rest, hp: secret ? null : c.hp, hpMax: secret ? null : c.hpMax, temp: secret ? 0 : c.temp, ac: c.kind === 'pc' ? c.ac : null, initBonus: undefined, monster: undefined, cr: undefined, counters: undefined, state: enemyState };
    });
  const log = room.log
    .filter((ev) => dm || ((!ev.actorId || !hiddenIds.has(ev.actorId)) && (!ev.targetId || !hiddenIds.has(ev.targetId))))
    .map((ev) => {
      if (dm) return ev;
      const tgt = ev.targetId ? e.order.find((c) => c.id === ev.targetId) : undefined;
      const secret = tgt && ((tgt.kind !== 'pc' && !tgt.showHp) || (tgt.kind === 'pc' && tgt.ownerId !== me.id && !room.settings.showPartyHp));
      return secret || (!tgt && ev.after) ? { ...ev, after: undefined } : ev;
    })
    .slice(-400);
  const { target, owner } = e.active && phaseOf(e) === 'running' && room.snapshots.length ? undoTarget(room) : {};
  return {
    code: room.code,
    open: room.open !== false,
    ...(room.mode ? { mode: room.mode } : {}),
    you: { id: me.id, role: me.role, name: me.name },
    members: room.members.map(({ token: _t, ...m }) => {
      void _t;
      if (dm || m.id === me.id || !m.summary) return m;
      // Oro, objetos, espacios y recursos de los demás son privados (solo el DM los ve en «Grupo»)
      const { coins: _c, gold: _g, items: _i, slots: _s, resources: _r, hitDice: _h, ...pub } = m.summary;
      void _c; void _g; void _i; void _s; void _r; void _h;
      if (room.settings.showPartyHp) return { ...m, summary: pub };
      return { ...m, summary: { ...pub, hp: 0, hpMax: 0, temp: 0, deathSaves: pub.deathSaves ? { success: 0, fail: 0 } : null, hpHidden: true } };
    }),
    settings: room.settings,
    images: room.images.filter((im) => canSeeImage(room, me, im)),
    chronicles: room.chronicles.filter((ch) => canSeeChronicle(me, ch)),
    roster: dm ? room.roster : [],
    encounters: dm ? room.encounters : [],
    encounter: {
      active: e.active && (dm || !prep),
      phase: !dm && prep ? 'running' : phaseOf(e),
      ready: e.ready ?? [],
      accepted: e.accepted ?? [],
      title: e.active && (dm || !prep) ? e.title ?? null : null,
      needed: neededReady(room),
      round: e.round,
      begun: e.begun,
      order,
      // En la antesala aún no es el turno de nadie
      currentId: cur && phaseOf(e) === 'running' && (dm || !cur.hidden) ? cur.id : null,
      hiddenTurn: !!cur && phaseOf(e) === 'running' && cur.hidden && !dm,
      scene: e.active && !prep ? (e.scene ?? 0) % COMBAT_SCENES : null,
    },
    loot: dm ? room.loot : [],
    log,
    gifts: dm ? room.gifts : me.role === 'player' ? room.gifts.filter((g) => g.toId === me.id || g.fromId === me.id) : [],
    syncRequest: room.syncRequest ?? null,
    canUndo: !!target && (dm || owner === me.id),
    canEndTurn: e.active && phaseOf(e) === 'running' && !!cur && (dm || cur.ownerId === me.id),
  };
}

// ---------- Copia de la campaña del DM ----------

export const CAMPAIGN_KIND = 'di-en-di-campaña';

/** Todo lo que el DM ha creado en el servidor (sin códigos ni claves: se conservan los de la partida actual) */
export interface CampaignData {
  roster: RosterEntry[];
  encounters: PreparedEncounter[];
  gifts: Gift[];
  log: LogEvent[];
  chronicles: Chronicle[];
  settings: RoomSettings;
  /** Datos de las imágenes; `data` es el JPEG en base64 (lo añade el servidor al exportar) */
  images: (SharedImage & { data?: string })[];
}

export function exportCampaign(room: Room): CampaignData {
  const r = normalizeRoom(clone(room));
  return { roster: r.roster, encounters: r.encounters, gifts: r.gifts, log: r.log, chronicles: r.chronicles, settings: r.settings, images: r.images };
}

const arr = <X,>(x: unknown): X[] => (Array.isArray(x) ? (x as X[]) : []);
/** Junta por id: lo de la copia sustituye a lo que tenga el mismo id; lo demás se añade */
const mergeById = <X extends { id: string }>(cur: X[], inc: X[]) => {
  const ids = new Set(inc.map((x) => x.id));
  return [...cur.filter((x) => !ids.has(x.id)), ...inc];
};

/**
 * Restaura una copia de la campaña en la partida: mantiene código, clave, jugadores y combate en marcha;
 * suma personajes preparados, encuentros, entregas, registro, crónicas e imágenes (sin duplicar).
 */
export function importCampaign(room: Room, data: Partial<CampaignData>): Room {
  const r = normalizeRoom(clone(room));
  const ok = <X extends { id: string }>(x: unknown): X[] => arr<X>(x).filter((y) => y && typeof y === 'object' && typeof y.id === 'string');
  r.roster = mergeById(r.roster, ok<RosterEntry>(data.roster));
  r.encounters = mergeById(r.encounters, ok<PreparedEncounter>(data.encounters));
  r.gifts = mergeById(r.gifts, ok<Gift>(data.gifts));
  r.chronicles = mergeById(r.chronicles, ok<Chronicle>(data.chronicles)).sort((a, b) => a.at - b.at).slice(-200);
  r.images = mergeById(r.images, ok<SharedImage & { data?: string }>(data.images).map(({ data: _d, ...im }) => { void _d; return im; }));
  const known = new Set(r.log.map((e) => e.id));
  const newLog = ok<LogEvent>(data.log).filter((e) => !known.has(e.id));
  if (newLog.length) {
    r.log = [...r.log, ...newLog].sort((a, b) => a.at - b.at).slice(-MAX_LOG);
    // El registro ha cambiado de longitud: lo que se podía deshacer ya no cuadra
    r.snapshots = [snap(r)];
  }
  if (data.settings && typeof data.settings === 'object') r.settings = { ...r.settings, ...data.settings };
  return r;
}
