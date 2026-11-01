// Protocolo de la partida compartida (modo party): tipos que comparten la app y el servidor.

export type Role = 'dm' | 'player';
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
}

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
  | { t: 'rosterToCombat'; id: string; count: number; hidden: boolean; rollHp?: boolean };

export type ClientMessage =
  | { t: 'hello'; code: string; name: string; token?: string; dmKey?: string }
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
