// Protocolo de la partida compartida (modo party): tipos que comparten la app y el servidor.
import type { Coins5, ItemData } from '../rules/itemTypes';

/** viewer: pantalla para la tele (solo mira, sin secretos) */
export type Role = 'dm' | 'player' | 'viewer';
export type CombatantKind = 'pc' | 'npc' | 'monster';

/** Resumen de la ficha de un jugador que ve el resto de la party */
export interface PcSummary {
  name: string;
  species: string;
  className: string;
  level: number;
  hp: number;
  hpMax: number;
  temp: number;
  ac: number;
  speed: number;
  passive: number;
  conditions: string[];
  /** Conjuro en el que se está concentrando */
  concentration?: string | null;
  /** A 0 PG: salvaciones contra la muerte */
  deathSaves?: { success: number; fail: number } | null;
  /** La vida está oculta para quien recibe la vista (el DM no deja ver la vida de los compañeros) */
  hpHidden?: boolean;
  // ---- Para la pantalla «Grupo» del DM (también fuera de combate) ----
  coins?: Partial<Coins5>;
  /** Valor total de las monedas en oro */
  gold?: number;
  exhaustion?: number;
  inspiration?: boolean;
  hitDice?: { left: number; total: number; die: string };
  /** Espacios de conjuro por nivel (y de pacto) */
  slots?: { level: number; left: number; max: number; pact?: boolean }[];
  /** Recursos de clase con usos (Furia, Canalizar divinidad…) */
  resources?: { name: string; left: number; max: number }[];
  /** Objetos destacados (equipados o mágicos) */
  items?: string[];
  dead?: boolean;
}

/** Imagen que el DM sube (mapa, retrato de un PNJ, pista…) y comparte cuando quiere */
export interface SharedImage {
  id: string;
  title: string;
  at: number;
  /** Compartida con los jugadores (si no, solo la ve el DM) */
  shared: boolean;
  /** 'all' o ids de los jugadores que la ven */
  to: 'all' | string[];
  sharedAt?: number;
  w?: number;
  h?: number;
}

/** Ajustes de la mesa que decide el DM */
export interface RoomSettings {
  /** Los jugadores ven la vida exacta de sus compañeros (por defecto no: solo su estado) */
  showPartyHp: boolean;
}

/** Condición o efecto con duración en rondas (null = hasta que se quite) */
export interface TimedCondition { name: string; rounds: number | null }

/** Contador del DM: acciones legendarias (se reinician en su turno), resistencias legendarias… */
export interface Counter { id: string; label: string; max: number; used: number; reset: 'turn' | 'never' }

export interface Member {
  id: string;
  name: string;
  role: Role;
  online: boolean;
  summary?: PcSummary;
}

export interface Combatant {
  id: string;
  name: string;
  kind: CombatantKind;
  /** Jugador dueño (solo personajes jugadores) */
  ownerId?: string;
  initiative: number | null;
  /** Bonificador de iniciativa (monstruos) para que el DM la tire */
  initBonus?: number;
  hp: number | null;
  hpMax: number | null;
  temp: number;
  ac: number | null;
  /** Oculto para los jugadores hasta que el DM lo revele */
  hidden: boolean;
  /** Los jugadores ven la vida exacta (si no, «?» y su estado) */
  showHp: boolean;
  /** Notas privadas del DM */
  notes: string;
  /** Id del monstruo de la biblioteca */
  monster?: string;
  /** Valor de desafío (para calcular la dificultad del encuentro) */
  cr?: string;
  conditions?: TimedCondition[];
  counters?: Counter[];
}

/** setup: cada uno introduce sus datos y marca «Listo»; running: turnos en marcha */
export type Phase = 'setup' | 'running';

export interface Encounter {
  active: boolean;
  phase?: Phase;
  /** Miembros que han pulsado «Listo» durante la preparación */
  ready?: string[];
  round: number;
  turn: number;
  begun: boolean;
  order: Combatant[];
}

/** Personaje que el DM tiene a mano (aliado o enemigo) para meterlo en un combate */
export interface RosterEntry {
  id: string;
  name: string;
  kind: 'npc' | 'monster';
  /** Nivel o VD, texto libre: «5», «VD 1/4» */
  level: string;
  hpMax: number | null;
  ac: number | null;
  initBonus: number;
  notes: string;
  monster?: string;
}

export type LogKind = 'hit' | 'heal' | 'hurt' | 'other' | 'turn' | 'round' | 'start' | 'begin' | 'end' | 'down' | 'undo' | 'add' | 'reveal';

export interface LogEvent {
  id: string;
  at: number;
  round: number;
  kind: LogKind;
  actorId?: string;
  actor?: string;
  targetId?: string;
  target?: string;
  amount?: number;
  roll?: number | null;
  text?: string;
  /** Deshecho con «Deshacer último turno» (se muestra tachado) */
  undone?: boolean;
  /** Vida que le queda al objetivo después (solo la ve el DM si es un monstruo) */
  after?: string;
  /** En «cae»: jugador dueño del personaje que dio el golpe final (para su kill count) */
  ownerId?: string;
}

/** Oro u objetos que el DM da a un jugador (queda en el registro del DM) */
export interface Gift {
  id: string;
  at: number;
  /** Miembro que lo recibe */
  toId: string;
  /** Nombre del personaje (o del jugador) cuando se dio */
  toName: string;
  /** Si lo da otro jugador (intercambio); sin esto, lo da el DM */
  fromId?: string;
  fromName?: string;
  coins?: Partial<Coins5>;
  items?: ItemData[];
  note?: string;
  /** Ya ha llegado a la ficha del jugador */
  delivered: boolean;
  deliveredAt?: number;
}

/** Estado visible de la vida: lo que ven los jugadores de los monstruos */
export type HpState = 'unhurt' | 'hurt' | 'bloodied' | 'down' | 'unknown';

export interface CombatantView extends Omit<Combatant, 'notes'> {
  state: HpState;
  notes?: string;
}

export interface RoomView {
  code: string;
  you: { id: string; role: Role; name: string };
  members: Member[];
  encounter: {
    active: boolean; phase: Phase; round: number; begun: boolean; order: CombatantView[]; currentId: string | null; hiddenTurn: boolean;
    /** Ids de miembros listos y de quienes hace falta que lo estén */
    ready: string[];
    needed: string[];
  };
  /** Lista de personajes del DM (vacía para los jugadores) */
  roster: RosterEntry[];
  log: LogEvent[];
  /** Entregas de oro y objetos: el DM ve todas; cada jugador, las suyas */
  gifts: Gift[];
  settings: RoomSettings;
  /** Imágenes: el DM ve todas; cada jugador, las compartidas con él */
  images: SharedImage[];
  canUndo: boolean;
  /** Puedes pasar turno (DM o el dueño del turno actual) */
  canEndTurn: boolean;
}

// ---------- Mensajes ----------

export type ActKind = 'hit' | 'heal' | 'hurt' | 'other';

export type Command =
  | { t: 'summary'; summary: PcSummary }
  | { t: 'setInitiative'; id: string; value: number | null }
  | { t: 'act'; actorId: string; kind: ActKind; targetId?: string; amount?: number; roll?: number | null; text?: string }
  | { t: 'nextTurn' }
  | { t: 'undo' }
  | { t: 'ready'; value: boolean }
  /** El jugador confirma que las entregas ya están en su ficha */
  | { t: 'giftAck'; ids: string[] }
  /** El DM da a un jugador; un jugador da de lo suyo a un compañero */
  | { t: 'give'; toId: string; coins?: Partial<Coins5>; items?: ItemData[]; note?: string }
  // Solo el DM
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'add'; combatants: Partial<Combatant>[] }
  | { t: 'update'; id: string; patch: Partial<Combatant> }
  | { t: 'remove'; id: string }
  | { t: 'reorder'; ids: string[] }
  | { t: 'sort' }
  | { t: 'begin' }
  | { t: 'rosterSave'; entry: RosterEntry }
  | { t: 'rosterRemove'; id: string }
  | { t: 'rosterToCombat'; id: string; count: number; hidden: boolean; rollHp?: boolean }
  | { t: 'roomSettings'; patch: Partial<RoomSettings> }
  /** El cliente manda `data` (JPEG en base64); el servidor la guarda en disco y la sustituye por `id` */
  | { t: 'imageAdd'; title: string; data?: string; id?: string; w?: number; h?: number }
  | { t: 'imageShare'; id: string; to: 'all' | string[] }
  | { t: 'imageUnshare'; id: string }
  | { t: 'imageRemove'; id: string }
  | { t: 'imageRename'; id: string; title: string }
  /** Anula una entrega que aún no ha llegado */
  | { t: 'giftCancel'; id: string };

export type ClientMessage =
  | { t: 'hello'; code: string; name: string; token?: string; dmKey?: string; viewer?: boolean }
  | { t: 'cmd'; cmd: Command };

/** Lo que el servidor pide aplicar en la ficha del jugador (daño con sus resistencias, curación o restaurar al deshacer) */
export type SheetOp =
  | { op: 'damage'; amount: number; from: string }
  | { op: 'heal'; amount: number; from: string }
  | { op: 'setHp'; hp: number; temp: number };

export type ServerMessage =
  | { t: 'welcome'; id: string; token: string; role: Role }
  | { t: 'state'; view: RoomView }
  | { t: 'sheet'; ops: SheetOp[] }
  | { t: 'error'; message: string };
