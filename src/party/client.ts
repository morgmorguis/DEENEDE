// Conexión de la app con el servidor de partida: estado en tiempo real, reconexión automática,
// envío del resumen de tu ficha y aplicación en tu ficha de lo que te hagan en el combate.
import { create } from 'zustand';
import { useStore } from '../store';
import type { Character, Note } from '../types';
import { compressImage, squareThumb } from '../imageUtil';
import { storeSharedImage } from '../sharedImages';
import { Capacitor } from '@capacitor/core';
import { lanAddress } from './lanCode';
import { rollAsk } from './rolls';
import { CLOUD_SERVER, type ClientMessage, type Command, type Gift, type PcSummary, type Role, type RoomView, type ServerMessage } from './protocol';
import { COIN_KEYS, NO_COINS, coinsInGold, coinsText, itemLine, payCoins, valueText } from '../rules/items';
import { placeReceived, wearable } from '../rules/stash';
import { setEquipped } from '../rules/gear';
import { categoryIcon } from '../imageCategories';
import { backupNow, isMyGame, patchGame, scheduleBackup } from './myGames';
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
  'no-server': ['No consigo llegar a la nube. Revisa tu conexión a Internet y vuelve a probar.', 'Can’t reach the cloud. Check your Internet connection and try again.'],
  'lan-unreachable': ['No encuentro la partida. Es una partida «en casa»: conéctate a la misma Wi-Fi que el PC del DM y comprueba que su servidor sigue abierto.', 'Can’t find the game. It’s a “at home” game: join the same Wi-Fi as the DM’s PC and check their server is still open.'],
  'lan-web': ['Es una partida «en casa»: únete desde la app de Di en Di (Android o Windows) conectado a la misma Wi-Fi que el PC del DM.', 'It’s an “at home” game: join from the Di en Di app (Android or Windows) on the same Wi-Fi as the DM’s PC.'],
  'no-lan': ['Este PC no está conectado a ninguna Wi-Fi o red de casa. Conéctalo o crea la partida en la nube.', 'This PC isn’t connected to any Wi-Fi or home network. Connect it or create the game in the cloud.'],
  'game-closed': ['La partida aún no está abierta (o el DM la ha cerrado). Espera a que el DM pulse «Crear partida» y te dé el código.', 'The game isn’t open yet (or the DM closed it). Wait for the DM to press “Create game” and give you the code.'],
  kicked: ['El DM te ha sacado de la partida.', 'The DM removed you from the game.'],
  'unknown-game': ['Esa partida ya no existe. Pide al DM el código de la partida.', 'That game no longer exists. Ask the DM for the game code.'],
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
  'roll-closed': ['El DM ya ha cerrado esa tirada.', 'The DM already closed that roll.'],
  'roll-answered': ['Ya has respondido a esa tirada.', 'You already answered that roll.'],
  'bad-roll': ['Elige qué tirada pides.', 'Choose which roll to ask for.'],
  'shop-closed': ['La tienda está cerrada.', 'The shop is closed.'],
  'out-of-stock': ['No quedan tantos en la tienda.', 'The shop doesn’t have that many left.'],
  'no-money': ['No te llega el dinero (cuentan también las compras que aún no te han cobrado).', 'You can’t afford it (purchases not yet charged also count).'],
  'empty': ['Escribe al menos el nombre.', 'Write at least the name.'],
  'empty-gift': ['Añade monedas u objetos antes de dar.', 'Add coins or items before giving.'],
  'gift-delivered': ['Esa entrega ya ha llegado a la ficha del jugador.', 'That gift has already reached the player’s sheet.'],
};

/** Suma a la ficha las monedas y objetos de una entrega del DM (los objetos iguales se apilan) */
export function applyGift(c: Character, g: Gift, from = g.fromName ?? 'DM'): Character {
  return receiveGift(c, g, from).char;
}

/**
 * Aplica una entrega: monedas, cobro del DM, munición y consumibles a su lista y el resto a «Objetos» (armas y armaduras
 * reconocidas por el nombre, listas para equipar). `lines`: dónde ha ido cada cosa · `wear`: ids de objetos para equipar.
 */
export function receiveGift(c: Character, g: Gift, from = g.fromName ?? 'DM'): { char: Character; lines: string[]; wear: string[] } {
  const next = structuredClone(c);
  const lines: string[] = [];
  const wear: string[] = [];
  for (const k of COIN_KEYS) next.coins[k] = (next.coins[k] ?? 0) + Math.max(0, Math.round(g.coins?.[k] ?? 0));
  if (g.charge && g.charge > 0) {
    const paid = payCoins({ ...NO_COINS, ...next.coins }, g.charge);
    next.coins = paid.coins;
    lines.push(paid.short > 0
      ? T(`💸 Pagas ${valueText(g.charge - paid.short)} de ${valueText(g.charge)}: no te llega (faltan ${valueText(paid.short)})`, `💸 You pay ${valueText(g.charge - paid.short)} of ${valueText(g.charge)}: not enough (${valueText(paid.short)} short)`)
      : T(`💸 Pagas ${valueText(g.charge)}`, `💸 You pay ${valueText(g.charge)}`));
  }
  if (g.inspiration) {
    lines.push(next.heroicInspiration
      ? T('✨ Ya tenías Inspiración heroica: según las reglas puedes dársela a otro personaje del grupo.', '✨ You already had Heroic Inspiration: by the rules you can give it to another character in the party.')
      : T('✨ Ganas Inspiración heroica: puedes repetir una tirada de dado.', '✨ You gain Heroic Inspiration: you can reroll a die.'));
    next.heroicInspiration = true;
  }
  next.consumables = next.consumables ?? [];
  for (const raw of g.items ?? []) {
    const p = placeReceived(raw);
    if (p.where === 'consumable') {
      const same = next.consumables.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
      if (same) same.qty += p.qty;
      else next.consumables.push({ id: uid(), name: p.name, qty: p.qty, kind: p.kind, used: 0, ...(p.description ? { description: p.description } : {}) });
      lines.push(T(`${p.kind === 'ammo' ? '🏹' : p.kind === 'thrown' ? '🗡️' : '🧪'} ${p.qty} × ${p.name} → Munición y consumibles`, `${p.kind === 'ammo' ? '🏹' : p.kind === 'thrown' ? '🗡️' : '🧪'} ${p.qty} × ${p.name} → Ammo & consumables`));
      continue;
    }
    const it = p.item;
    const same = next.items.find((x) => x.name === it.name && x.rarity === it.rarity && x.description === it.description && x.value === it.value);
    if (same) { same.qty += it.qty; continue; }
    const id = uid();
    next.items.push({ ...it, id, from, at: g.at, gift: g.id });
    if (wearable(it)) wear.push(id);
  }
  next.giftsReceived = [...next.giftsReceived, g.id].slice(-500);
  return { char: next, lines, wear };
}

/** Líneas para el aviso: «50 po», «2 × Poción de curación» */
export const giftLines = (g: Pick<Gift, 'coins' | 'items' | 'note' | 'charge' | 'inspiration'>) => [
  ...(g.inspiration ? [T('✨ Inspiración heroica', '✨ Heroic Inspiration')] : []),
  ...(g.coins && coinsText(g.coins) ? [`💰 ${coinsText(g.coins)}`] : []),
  ...(g.charge ? [T(`💸 Cobra ${valueText(g.charge)}`, `💸 Charges ${valueText(g.charge)}`)] : []),
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
/** Tiradas secretas ya respondidas desde este dispositivo */
const secretAnswered = new Set<string>();
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

  let face: { src: string; face: string } | null = null;
  let facing = '';
  const pushSummary = (force = false) => {
    if (get().role !== 'player') return;
    const c = sharedChar();
    if (!c) return;
    const sum = summaryOf(c);
    // La cara (miniatura del retrato) se hace una vez por retrato y se manda en cuanto está lista
    const src = c.portraitThumb ?? c.portrait ?? '';
    if (src && face?.src !== src && facing !== src) {
      facing = src;
      void squareThumb(src).then((f) => { face = { src, face: f }; }).catch(() => { face = { src, face: '' }; }).finally(() => { facing = ''; pushSummary(); });
    }
    if (src && face?.src === src && face.face) sum.face = face.face;
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
    if (view.open) useStore.getState().showToast(T('☁️ El DM ha guardado tu ficha en el servidor', '☁️ The DM saved your sheet on the server'), []);
  };

  /** Tiradas secretas que pide el DM: las tira la app sola, sin enseñar nada, y manda el resultado */
  const reconcileSecretRolls = (view: RoomView) => {
    if (view.you.role !== 'player') return;
    const c = sharedChar();
    if (!c) return;
    for (const q of view.rollRequests ?? []) {
      if (!q.secret || q.closed || !q.to.includes(view.you.id) || secretAnswered.has(q.id)) continue;
      secretAnswered.add(q.id);
      const r = rollAsk(c, q.ask);
      out({ t: 'cmd', cmd: { t: 'rollAnswer', id: q.id, total: r.total, natural: r.natural, detail: r.lines.join('\n') } });
    }
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
      const placed: string[] = [];
      const wear: string[] = [];
      for (const g of fresh) { applying.add(g.id); const r = receiveGift(next, g); next = r.char; placed.push(...r.lines); wear.push(...r.wear); }
      st.replace(next);
      // Lo que te dan queda apuntado en «Compartido conmigo»
      addSharedNotes(c.id, fresh.map((g) => ({ id: uid(), createdAt: g.at, title: `${g.shop ? '🏪' : g.inspiration && !g.items?.length && !g.coins ? '✨' : '🎁'} ${g.shop ? T(`Compra en ${g.note ?? 'la tienda'}`, `Bought at ${g.note ?? 'the shop'}`) : g.fromName ? T(`De ${g.fromName}`, `From ${g.fromName}`) : T('Del DM', 'From the DM')}: ${[g.inspiration ? T('Inspiración heroica', 'Heroic Inspiration') : '', g.coins ? coinsText(g.coins) : '', ...(g.items ?? []).map(itemLine), g.charge ? `💸 −${valueText(g.charge)}` : ''].filter(Boolean).join(', ').slice(0, 90)}`, body: giftLines(g).join('\n'), kind: 'note' as const, ref: `gift:${g.id}`, sharedTo: 'me' as const })));
      const who = [...new Set(fresh.map((g) => g.fromName ?? 'DM'))].join(', ');
      const dmOnly = fresh.every((g) => !g.fromName);
      if (st.activeId === c.id) st.pushLog({ role: 'app', text: dmOnly ? T('🎁 Entrega del DM', '🎁 Gift from the DM') : T(`🎁 Te dan: ${who}`, `🎁 Given by: ${who}`), details: fresh.flatMap((g) => giftLines(g)) });
      // Armas, armaduras y escudos: botón para equiparlos ya (pone la CA o crea su fila de Armas)
      const actions = wear.slice(0, 3).map((id) => {
        const it = next.items.find((x) => x.id === id)!;
        return { label: `🛡️ ${T('Equipar', 'Equip')} ${it.name}`, run: () => { const s2 = useStore.getState(); const cur = s2.characters.find((x) => x.id === c.id); if (!cur) return; const ch = structuredClone(cur); setEquipped(ch, id, true); s2.replace(ch); } };
      });
      const onlyInsp = fresh.every((g) => g.inspiration && !g.items?.length && !g.coins && !g.charge);
      const shopping = fresh.every((g) => g.shop);
      st.showToast(onlyInsp ? T('✨ El DM te da Inspiración heroica', '✨ The DM gives you Heroic Inspiration') : shopping ? T('🏪 Tu compra ha llegado', '🏪 Your purchase arrived') : dmOnly ? (fresh.every((g) => !g.items?.length && !g.coins) ? T('💸 El DM te cobra', '💸 The DM charges you') : T(`🎁 El DM te da algo${c.id !== st.activeId ? ` (${c.name})` : ''}`, `🎁 The DM gives you something${c.id !== st.activeId ? ` (${c.name})` : ''}`)) : T(`🎁 ${who} te da algo`, `🎁 ${who} gives you something`), [...fresh.flatMap((g) => giftLines({ ...g, charge: undefined })), ...placed], actions);
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
    // Si el DM cambia la categoría de una imagen ya guardada, la nota del diario la sigue
    const moved = (view.images ?? []).filter((im) => im.category && c0.notes.some((n) => n.ref === `img:${im.id}` && n.category !== im.category));
    if (moved.length) {
      const st = useStore.getState();
      const cur = st.characters.find((x) => x.id === c0.id);
      if (cur) {
        const next = structuredClone(cur);
        for (const im of moved) for (const n of next.notes) if (n.ref === `img:${im.id}`) { n.category = im.category; n.title = `${categoryIcon[im.category!]} ${n.title.replace(/^\S+\s/, '')}`; }
        st.replace(next);
      }
    }
    const chron = (view.chronicles ?? []).filter((x) => !have.has(`chr:${x.id}`) && !pendingShared.has(`chr:${x.id}`));
    const imgs = (view.images ?? []).filter((x) => x.shared && !have.has(`img:${x.id}`) && !pendingShared.has(`img:${x.id}`));
    if (!chron.length && !imgs.length) return;
    const save = (notes: Note[]) => addSharedNotes(c0.id, notes);
    if (chron.length) {
      chron.forEach((x) => pendingShared.add(`chr:${x.id}`));
      save(chron.map((x) => ({ id: uid(), createdAt: x.at, title: `${Array.isArray(x.to) ? '✉️' : '📖'} ${x.title}`, body: x.text, kind: 'story', ref: `chr:${x.id}`, sharedTo: Array.isArray(x.to) ? 'me' : 'all' })));
      // El resumen de la sesión anterior sale en grande (RecapNotifier): sin aviso pequeño
      if (!chron.every((x) => x.recap)) useStore.getState().showToast(chron.some((x) => Array.isArray(x.to)) ? T('✉️ El DM te ha escrito', '✉️ The DM wrote to you') : T('📖 El DM comparte una crónica', '📖 The DM shares a chronicle'), [...chron.map((x) => x.title), T('Guardada en tu diario → 🤝 Compartido conmigo.', 'Saved in your journal → 🤝 Shared with me.')]);
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
          const category = im.category ?? 'other';
          save([{ id: uid(), createdAt: im.sharedAt ?? im.at, title: `${categoryIcon[category]} ${im.title}`, body: '', kind: 'note', image: data, ...(key ? { imageKey: key } : {}), ref, sharedTo: im.to === 'all' ? 'all' : 'me', category }]);
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
        // El DM en una partida que creó desde esta app: copia en el dispositivo por si la nube la borra
        const cc = get().conn;
        if (msg.view.you.role === 'dm' && cc?.dmKey) { scheduleBackup(cc.url, cc.dmKey); patchGame(cc.dmKey, { code: msg.view.code }); }
        reconcileKills(msg.view);
        reconcileGifts(msg.view);
        reconcileShared(msg.view);
        reconcileSync(msg.view);
        reconcileSecretRolls(msg.view);
      } else if (msg.t === 'sheet') {
        applySheet(msg);
      } else if (msg.t === 'error') {
        // Estaba dentro y el DM ha cerrado la partida (no es que intente entrar en una cerrada)
        const kicked = msg.message === 'game-closed' && get().status === 'online';
        set({ error: kicked ? T('El DM ha cerrado la partida. Tu ficha está guardada en este dispositivo. Cuando vuelva a crearla, pídele el código nuevo.', 'The DM closed the game. Your sheet is saved on this device. When they create it again, ask for the new code.') : errorText(msg.message) });
        if (msg.message === 'bad-code' || msg.message === 'game-closed' || msg.message === 'session-reset' || msg.message === 'kicked' || msg.message === 'unknown-game') { const e = get().error; get().leave(); set({ error: e }); }
        const keep = T('Lo que te han compartido sigue en tu diario → 🤝 Compartido conmigo. Tu ficha sigue igual.', 'What was shared with you stays in your journal → 🤝 Shared with me. Your sheet stays the same.');
        if (msg.message === 'session-reset') useStore.getState().showToast(T('🔁 Sesión nueva', '🔁 New session'), [errorText('session-reset'), keep]);
        if (msg.message === 'kicked') useStore.getState().showToast(T('👋 Fuera de la partida', '👋 Out of the game'), [errorText('kicked'), keep]);
        if (kicked) useStore.getState().showToast(T('🔒 El DM ha cerrado la partida', '🔒 The DM closed the game'), [T('Tu ficha está guardada en este dispositivo y el DM tiene una copia.', 'Your sheet is saved on this device and the DM has a copy.'), keep]);
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
      const was = get().conn;
      if (was?.dmKey && get().status === 'online' && isMyGame(was.dmKey)) void backupNow(was.url, was.dmKey);
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

export type FindError = 'bad-code' | 'game-closed' | 'no-server' | 'lan-unreachable' | 'lan-web';

/**
 * Busca la partida a partir de solo su código. Partida en casa (8 letras): el código lleva la dirección del PC del DM
 * en la Wi-Fi. Partida en la nube (6 letras): el servidor de la nube (y el de esta página, si la sirve uno).
 */
export async function findServer(code: string): Promise<{ url: string } | { error: FindError }> {
  const lan = lanAddress(code);
  if (lan) {
    // Una página https (la web de la nube) no puede abrir direcciones http de la Wi-Fi: hace falta la app
    if (window.location.protocol === 'https:' && !Capacitor.isNativePlatform()) return { error: 'lan-web' };
    const r = await probeServer(lan, code);
    if (!r) return { error: 'lan-unreachable' };
    if (r.match === false) return { error: r.closed ? 'game-closed' : 'bad-code' };
    return { url: r.url };
  }
  // La dirección de esta página solo si es web (en la app de Android no responde nadie y se descarta sola)
  const here = /^https?:$/.test(window.location.protocol) ? window.location.origin : null;
  const list = [here, DEFAULT_SERVER].filter((x): x is string => !!x?.trim());
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
