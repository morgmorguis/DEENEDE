// Mesa del DM: tiradas que pide a los jugadores, sus propias tiradas, tablón de misiones y PNJ, tienda e
// Inspiración heroica. Funciones puras que usa `room.ts` (aplicar comandos y preparar la vista de cada uno).
import type { ItemData } from '../rules/itemTypes';
import type { Command, DmRoll, Npc, NpcAttitude, Quest, QuestStatus, RollAsk, RollRequest, RoomView, Shop, ShopItem } from './protocol';
import type { Room, StoredMember } from './room';

const MAX_REQUESTS = 200;
const MAX_DM_ROLLS = 200;
const MAX_QUESTS = 300;
const MAX_NPCS = 500;
const MAX_SHOP = 120;
const MAX_SESSIONS = 50;
const ABS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const RARITIES = ['mundane', 'common', 'uncommon', 'rare', 'veryRare', 'legendary', 'artifact'];
const TYPES = ['weapon', 'armor', 'potion', 'scroll', 'wondrous', 'ring', 'wand', 'gear', 'treasure', 'other'];
const STATUSES: QuestStatus[] = ['active', 'done', 'failed'];
const ATTITUDES: NpcAttitude[] = ['friendly', 'neutral', 'hostile', 'unknown'];

const id10 = () => Array.from({ length: 10 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const text = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n);
const int = (x: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(x) || 0)));
const okId = (x: unknown) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x);

export type TableResult = { room: Room; error?: string };

/** Completa los campos nuevos en partidas guardadas con versiones anteriores */
export function normalizeTable(r: Room): void {
  r.rollRequests ??= [];
  r.dmRolls ??= [];
  r.quests ??= [];
  r.npcs ??= [];
  r.sessions ??= [];
}

export function cleanAsk(a: unknown): RollAsk | null {
  const x = (a ?? {}) as Record<string, unknown>;
  if ((x.kind === 'save' || x.kind === 'check') && ABS.includes(String(x.ability))) return { kind: x.kind, ability: x.ability as never };
  if (x.kind === 'skill' && typeof x.skill === 'string' && /^[a-zA-Z_-]{2,30}$/.test(x.skill)) return { kind: 'skill', skill: x.skill };
  return null;
}

/** Objeto de la tienda limpio (una unidad: la cantidad la decide quien compra) */
function cleanShopItem(x: unknown): ShopItem | null {
  const s = (x ?? {}) as Partial<ShopItem>;
  const i = (s.item ?? {}) as Partial<ItemData>;
  const name = text(i.name, 80);
  if (!name) return null;
  const item: ItemData = {
    name,
    rarity: (RARITIES.includes(String(i.rarity)) ? i.rarity : 'mundane') as ItemData['rarity'],
    type: (TYPES.includes(String(i.type)) ? i.type : 'other') as ItemData['type'],
    description: text(i.description, 1000),
    value: Math.max(0, Math.min(10_000_000, Number(i.value) || 0)),
    qty: 1,
    ...(i.weight ? { weight: Math.max(0, Math.min(10000, Number(i.weight) || 0)) } : {}),
    ...(i.attunement ? { attunement: true } : {}),
    ...(typeof i.ref === 'string' ? { ref: i.ref.slice(0, 60) } : {}),
    ...(i.mods && typeof i.mods === 'object' ? { mods: i.mods } : {}),
    ...(i.consumable === 'ammo' || i.consumable === 'thrown' || i.consumable === 'item' ? { consumable: i.consumable } : {}),
  };
  const price = Math.round(Math.max(0, Math.min(10_000_000, Number(s.price) || 0)) * 100) / 100;
  const stock = s.stock == null ? null : int(s.stock, 0, 9999);
  return { id: okId(s.id) ? String(s.id) : id10(), item, price, stock };
}

/** Lo que aún tiene que pagar un jugador (cobros que no han llegado a su ficha) */
const pendingCharges = (r: Room, memberId: string) =>
  r.gifts.filter((g) => g.toId === memberId && !g.delivered && g.charge).reduce((s, g) => s + (g.charge ?? 0), 0);

/**
 * Aplica los comandos de la mesa. Devuelve undefined si el comando no es de aquí.
 * `r` ya es una copia que se puede modificar; `room` es la original (para devolverla con un error).
 */
export function applyTable(r: Room, room: Room, me: StoredMember, cmd: Command): TableResult | undefined {
  normalizeTable(r);
  const dm = me.role === 'dm';
  const fail = (error: string): TableResult => ({ room, error });
  const players = () => r.members.filter((m) => m.role === 'player');

  switch (cmd.t) {
    // ---- Jugadores ----
    case 'rollAnswer': {
      const q = r.rollRequests!.find((x) => x.id === cmd.id);
      if (!q || q.closed) return fail('roll-closed');
      if (!q.to.includes(me.id)) return fail('not-allowed');
      if (q.answers.some((a) => a.memberId === me.id)) return fail('roll-answered');
      const natural = cmd.natural == null ? null : int(cmd.natural, 1, 20);
      q.answers.push({
        memberId: me.id, name: me.summary?.name || me.name, total: int(cmd.total, -30, 100), natural,
        ...(cmd.manual ? { manual: true } : {}), ...(cmd.detail ? { detail: text(cmd.detail, 800) } : {}), at: Date.now(),
      });
      // Han respondido todos: se cierra sola
      if (q.to.every((id) => q.answers.some((a) => a.memberId === id))) q.closed = true;
      return { room: r };
    }
    case 'buy': {
      if (me.role !== 'player') return fail('not-allowed');
      const shop = r.shop;
      if (!shop?.open) return fail('shop-closed');
      const it = shop.items.find((x) => x.id === cmd.itemId);
      if (!it) return fail('no-target');
      const qty = int(cmd.qty, 1, 99);
      if (it.stock != null && it.stock < qty) return fail('out-of-stock');
      const cost = Math.round(it.price * qty * 100) / 100;
      const gold = (me.summary?.gold ?? 0) - pendingCharges(r, me.id);
      if (cost > 0 && gold + 1e-9 < cost) return fail('no-money');
      if (it.stock != null) it.stock -= qty;
      r.gifts.push({
        id: id10(), at: Date.now(), toId: me.id, toName: me.summary?.name || me.name,
        items: [{ ...it.item, qty }], ...(cost > 0 ? { charge: cost } : {}), shop: true, note: shop.name, delivered: false,
      });
      return { room: r };
    }
  }

  const dmOnly = ['rollAsk', 'rollClose', 'dmRoll', 'questSave', 'questRemove', 'npcSave', 'npcRemove', 'shopSave'];
  if (!dmOnly.includes(cmd.t)) return undefined;
  if (!dm) return fail('not-allowed');

  switch (cmd.t) {
    case 'rollAsk': {
      const ask = cleanAsk(cmd.ask);
      if (!ask) return fail('bad-roll');
      const to = cmd.to === 'all' ? players().map((m) => m.id) : (Array.isArray(cmd.to) ? cmd.to : []).filter((id) => players().some((m) => m.id === id));
      if (!to.length) return fail('no-target');
      const dc = cmd.dc == null || cmd.dc === 0 ? undefined : int(cmd.dc, 1, 40);
      const note = text(cmd.note, 300);
      r.rollRequests!.push({ id: id10(), at: Date.now(), ask, to, answers: [], ...(dc ? { dc } : {}), ...(cmd.secret ? { secret: true } : {}), ...(note ? { note } : {}) });
      if (r.rollRequests!.length > MAX_REQUESTS) r.rollRequests!.splice(0, r.rollRequests!.length - MAX_REQUESTS);
      return { room: r };
    }
    case 'rollClose': {
      const q = r.rollRequests!.find((x) => x.id === cmd.id);
      if (!q) return fail('no-target');
      q.closed = true;
      return { room: r };
    }
    case 'dmRoll': {
      const label = text(cmd.label, 80);
      r.dmRolls!.push({ id: id10(), at: Date.now(), label: label || 'd20', total: int(cmd.total, -1000, 100000), detail: text(cmd.detail, 400), hidden: !!cmd.hidden });
      if (r.dmRolls!.length > MAX_DM_ROLLS) r.dmRolls!.splice(0, r.dmRolls!.length - MAX_DM_ROLLS);
      return { room: r };
    }
    case 'questSave': {
      const x = (cmd.quest ?? {}) as Partial<Quest>;
      const title = text(x.title, 120);
      if (!title) return fail('empty');
      const prev = okId(x.id) ? r.quests!.find((q) => q.id === x.id) : undefined;
      const now = Date.now();
      const q: Quest = {
        id: prev?.id ?? id10(), title, text: text(x.text, 4000), status: STATUSES.includes(x.status as QuestStatus) ? x.status as QuestStatus : 'active',
        shared: !!x.shared, at: prev?.at ?? now, updatedAt: now,
        ...(text(x.giver, 80) ? { giver: text(x.giver, 80) } : {}), ...(text(x.secret, 4000) ? { secret: text(x.secret, 4000) } : {}),
      };
      r.quests = prev ? r.quests!.map((y) => (y.id === q.id ? q : y)) : [...r.quests!, q].slice(-MAX_QUESTS);
      return { room: r };
    }
    case 'questRemove': {
      r.quests = r.quests!.filter((q) => q.id !== cmd.id);
      return { room: r };
    }
    case 'npcSave': {
      const x = (cmd.npc ?? {}) as Partial<Npc>;
      const name = text(x.name, 80);
      if (!name) return fail('empty');
      const prev = okId(x.id) ? r.npcs!.find((n) => n.id === x.id) : undefined;
      const now = Date.now();
      const imageId = typeof x.imageId === 'string' && r.images.some((im) => im.id === x.imageId) ? x.imageId : undefined;
      const n: Npc = {
        id: prev?.id ?? id10(), name, text: text(x.text, 4000), attitude: ATTITUDES.includes(x.attitude as NpcAttitude) ? x.attitude as NpcAttitude : 'unknown',
        shared: !!x.shared, at: prev?.at ?? now, updatedAt: now,
        ...(text(x.place, 80) ? { place: text(x.place, 80) } : {}), ...(imageId ? { imageId } : {}), ...(text(x.secret, 4000) ? { secret: text(x.secret, 4000) } : {}),
      };
      r.npcs = prev ? r.npcs!.map((y) => (y.id === n.id ? n : y)) : [...r.npcs!, n].slice(-MAX_NPCS);
      return { room: r };
    }
    case 'npcRemove': {
      r.npcs = r.npcs!.filter((n) => n.id !== cmd.id);
      return { room: r };
    }
    case 'shopSave': {
      const s = (cmd.shop ?? {}) as Partial<Shop>;
      const items = (Array.isArray(s.items) ? s.items : []).map(cleanShopItem).filter((x): x is ShopItem => !!x).slice(0, MAX_SHOP);
      r.shop = { open: !!s.open, name: text(s.name, 80) || 'Tienda', items };
      return { room: r };
    }
  }
  return undefined;
}

/** Al crear la partida (o empezar sesión nueva) se apunta cuándo empieza la sesión, para el resumen */
export function markSession(r: Room, at = Date.now()): void {
  normalizeTable(r);
  r.sessions = [...r.sessions!, at].slice(-MAX_SESSIONS);
}

/** Lo de la mesa que ve cada uno */
export function tableView(room: Room, me: Pick<StoredMember, 'id' | 'role'>): Pick<RoomView, 'rollRequests' | 'dmRolls' | 'quests' | 'npcs' | 'shop' | 'sessions'> {
  const dm = me.role === 'dm';
  const reqs = room.rollRequests ?? [];
  const rollRequests: RollRequest[] = dm
    ? reqs.slice(-60)
    : reqs
      .filter((q) => !q.secret || (q.to.includes(me.id) && !q.closed && !q.answers.some((a) => a.memberId === me.id)))
      .map((q) => (q.secret ? { ...q, answers: [] } : q))
      .slice(-60);
  const dmRolls: DmRoll[] = (room.dmRolls ?? []).filter((x) => dm || !x.hidden).slice(-60);
  const strip = <X extends { secret?: string }>(x: X): X => { const { secret: _s, ...rest } = x; void _s; return rest as X; };
  return {
    rollRequests,
    dmRolls,
    quests: dm ? room.quests ?? [] : (room.quests ?? []).filter((q) => q.shared).map(strip),
    npcs: dm ? room.npcs ?? [] : (room.npcs ?? []).filter((n) => n.shared).map(strip),
    shop: dm ? room.shop ?? null : room.shop?.open && me.role === 'player' ? room.shop : null,
    sessions: dm ? room.sessions ?? [] : [],
  };
}

/** Retrato de un PNJ que los jugadores ya conocen: pueden descargar esa imagen aunque no se haya compartido */
export const isKnownNpcPortrait = (room: Room, imageId: string) => (room.npcs ?? []).some((n) => n.shared && n.imageId === imageId);
