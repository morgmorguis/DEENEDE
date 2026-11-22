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
  /** Cara del personaje (JPEG cuadrado pequeño, data URL) para la lista de la party */
  face?: string;
}

/** Categoría de una imagen compartida (para ordenarlas en «Compartido conmigo») */
export const IMAGE_CATEGORIES = ['map', 'character', 'place', 'clue', 'item', 'other'] as const;
export type ImageCategory = typeof IMAGE_CATEGORIES[number];
export const isImageCategory = (x: unknown): x is ImageCategory => (IMAGE_CATEGORIES as readonly unknown[]).includes(x);

/** Imagen que el DM sube (mapa, retrato de un PNJ, pista…) y comparte cuando quiere */
export interface SharedImage {
  id: string;
  title: string;
  /** Mapas, personajes, lugares… (sin ella, «otros») */
  category?: ImageCategory;
  at: number;
  /** Compartida con los jugadores (si no, solo la ve el DM) */
  shared: boolean;
  /** 'all' o ids de los jugadores que la ven */
  to: 'all' | string[];
  sharedAt?: number;
  w?: number;
  h?: number;
}

/** Crónica o nota escrita que el DM comparte (p. ej. el resumen narrativo de un combate o una carta para un jugador).
 *  `to`: 'all' (o sin `to`, partidas antiguas) para todo el grupo, o los ids de los jugadores que la reciben */
export interface Chronicle { id: string; title: string; text: string; at: number; to?: 'all' | string[] }

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
  /** Cuándo guardó el servidor la ficha completa de este jugador (botón «Sincronizar fichas») */
  sheetAt?: number;
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
  /** Color que elige el DM para distinguir enemigos (también lo ven los jugadores) */
  color?: string;
  /** Ronda en la que ya usó su reacción */
  reactionRound?: number;
  /** Lo que lleva encima (monedas y objetos): solo lo ve el DM; al terminar el combate pasa al botín */
  loot?: CarriedLoot;
}

/** Monedas y objetos que lleva un enemigo */
export interface CarriedLoot { coins?: Partial<Coins5>; items?: ItemData[] }

/** Botín que quedó de un combate terminado (lo que llevaban los enemigos), para que el DM lo reparta */
export interface LootDrop extends CarriedLoot {
  id: string;
  at: number;
  /** Quién lo llevaba */
  from: string;
  /** Cayó en el combate (si no, huyó o se quedó sin derrotar) */
  defeated: boolean;
  /** Título del combate */
  combat?: string;
}

/**
 * prep: el DM prepara el combate a solas (los jugadores aún no ven nada) ·
 * setup: lanzado; antesala donde cada jugador acepta, revisa su estado y marca «Listo» · running: turnos en marcha
 */
export type Phase = 'prep' | 'setup' | 'running';

/** Fondos de combate que hay (public/fondos/<estilo>/combate-01…15) */
export const COMBAT_SCENES = 15;

/** Escena de combate al azar, distinta de la anterior si se puede */
export function pickCombatScene(prev?: number | null): number {
  const n = Math.floor(Math.random() * (COMBAT_SCENES - 1));
  return prev == null ? Math.floor(Math.random() * COMBAT_SCENES) : (prev + 1 + n) % COMBAT_SCENES;
}

export interface Encounter {
  active: boolean;
  phase?: Phase;
  /** Fondo de combate que ven todos (lo elige el servidor al empezar) */
  scene?: number;
  /** Miembros que han pulsado «Listo» durante la preparación */
  ready?: string[];
  /** Jugadores que han aceptado el aviso de «¡Comienza un encuentro!» */
  accepted?: string[];
  /** Nombre del encuentro que ven todos en el aviso («Taberna Malandra») */
  title?: string;
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
  /** Ataques y equipo personalizados (texto libre) */
  attacks?: string;
  equipment?: string;
  color?: string;
}

/** Enemigo dentro de un encuentro preparado */
export interface EncounterEntry {
  id: string;
  name: string;
  kind: 'npc' | 'monster';
  count: number;
  hidden: boolean;
  hpMax: number | null;
  ac: number | null;
  initBonus: number;
  cr?: string;
  monster?: string;
  color?: string;
  notes?: string;
  /** Lo que lleva cada uno de ellos */
  loot?: CarriedLoot;
}

/** Combate que el DM prepara antes de jugarlo, o lista de enemigos posibles de un lugar («Taberna Malandra») */
export interface PreparedEncounter { id: string; name: string; notes: string; entries: EncounterEntry[] }

export type LogKind = 'hit' | 'miss' | 'heal' | 'hurt' | 'other' | 'narrative' | 'turn' | 'round' | 'start' | 'begin' | 'end' | 'down' | 'undo' | 'add' | 'reveal';

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
  /** En «entra»: llegó oculto (los jugadores no lo ven hasta que se revele) */
  secret?: boolean;
  /** Vida que le queda al objetivo después (solo la ve el DM si es un monstruo) */
  after?: string;
  /** En «cae»: jugador dueño del personaje que dio el golpe final (para su kill count) */
  ownerId?: string;
  action?: string;
  weapon?: string;
  spell?: string;
  crit?: boolean;
  reaction?: boolean;
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
  /** El DM cobra al jugador (en po): se le resta de sus monedas al llegar */
  charge?: number;
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
  /** La partida está abierta: se puede entrar con el código (cerrada mientras el DM prepara la sesión) */
  open: boolean;
  you: { id: string; role: Role; name: string };
  members: Member[];
  encounter: {
    active: boolean; phase: Phase; round: number; begun: boolean; order: CombatantView[]; currentId: string | null; hiddenTurn: boolean;
    /** Fondo de combate común (0…COMBAT_SCENES-1); null fuera de combate */
    scene: number | null;
    /** Ids de miembros listos y de quienes hace falta que lo estén */
    ready: string[];
    needed: string[];
    /** Jugadores que han aceptado el aviso del encuentro */
    accepted: string[];
    /** Nombre del encuentro (o null) */
    title: string | null;
  };
  /** Botín de los combates terminados, pendiente de repartir (solo el DM) */
  loot: LootDrop[];
  /** Lista de personajes del DM (vacía para los jugadores) */
  roster: RosterEntry[];
  /** Encuentros preparados del DM (vacío para los jugadores) */
  encounters: PreparedEncounter[];
  log: LogEvent[];
  /** Entregas de oro y objetos: el DM ve todas; cada jugador, las suyas */
  gifts: Gift[];
  settings: RoomSettings;
  /** Imágenes: el DM ve todas; cada jugador, las compartidas con él */
  images: SharedImage[];
  /** Crónicas compartidas por el DM (todos las ven) */
  chronicles: Chronicle[];
  /** Cuándo pidió el DM sincronizar las fichas (cada jugador sube la suya si aún no lo ha hecho desde entonces) */
  syncRequest: number | null;
  canUndo: boolean;
  /** Puedes pasar turno (DM o el dueño del turno actual) */
  canEndTurn: boolean;
  /** Solo el DM en un servidor de PC: el enlace con la nube para que el código sirva desde cualquier sitio */
  cloud?: CloudLinkView;
}

/** Servidor de partida de la nube: con él basta el código para unirse */
export const CLOUD_SERVER = 'https://di-en-di.web.app';

export interface CloudLinkView {
  /** Hay clave de la nube guardada en el PC */
  linked: boolean;
  url: string;
  /** off: sin enlazar ahora (partida cerrada) · on: los jugadores entran con el código desde la nube */
  status: 'off' | 'connecting' | 'on' | 'bad-key' | 'unreachable';
}

// ---------- Mensajes ----------

/** hit: impacto con daño · miss: falla · heal: cura · hurt: daño recibido · other: otra acción sin números */
export type ActKind = 'hit' | 'miss' | 'heal' | 'hurt' | 'other';

export type Command =
  | { t: 'summary'; summary: PcSummary }
  | { t: 'setInitiative'; id: string; value: number | null }
  | {
    t: 'act'; actorId: string; kind: ActKind; targetId?: string; amount?: number; roll?: number | null; text?: string;
    /** Acción de las reglas 2024 (ids de ACTIONS: atacar, magia, correr, esconderse…) */
    action?: string;
    /** Con qué: arma o conjuro */
    weapon?: string;
    spell?: string;
    crit?: boolean;
    /** Es una reacción (fuera de su turno: ataque de oportunidad, Escudo…) */
    reaction?: boolean;
  }
  | { t: 'nextTurn' }
  | { t: 'undo' }
  | { t: 'ready'; value: boolean }
  /** El jugador acepta el aviso de «¡Comienza un encuentro!» y pasa a la antesala */
  | { t: 'accept' }
  /** El jugador confirma que las entregas ya están en su ficha */
  | { t: 'giftAck'; ids: string[] }
  /** El DM da a un jugador; un jugador da de lo suyo a un compañero */
  | { t: 'give'; toId: string; coins?: Partial<Coins5>; items?: ItemData[]; note?: string; charge?: number }
  /** El jugador sube su ficha completa (copia de seguridad en JSON); el servidor la guarda en disco y quita `data` */
  | { t: 'sheetUpload'; data?: string }
  // Solo el DM
  /** Pide a todos los jugadores que suban su ficha completa al servidor */
  | { t: 'syncSheets' }
  /** Lanza el combate de golpe (apps antiguas): preparar + lanzar */
  | { t: 'start' }
  /** Empieza a preparar un combate (los jugadores no lo ven hasta lanzarlo) */
  | { t: 'prepare'; title?: string }
  /** Cambia el nombre del encuentro en preparación */
  | { t: 'encounterTitle'; title: string }
  /** Lanza el combate preparado: a los jugadores les llega el aviso y pasan a la antesala */
  | { t: 'launch' }
  /** Termina el combate (o descarta la preparación) */
  | { t: 'end' }
  /** Mete en el combate unos cuantos de un enemigo de una lista de encuentro */
  | { t: 'entryToCombat'; encounterId: string; entryId: string; count: number; hidden?: boolean }
  /** Quita del botín pendiente (ya repartido o descartado) */
  | { t: 'lootDone'; ids: string[] }
  /** Código de partida nuevo: los que ya están dentro siguen; los nuevos necesitan el código nuevo */
  | { t: 'newCode' }
  /**
   * Sesión nueva: código nuevo y sin combate. Se conservan lugares, personajes preparados, imágenes, crónicas y entregas;
   * opcionalmente se echa a los jugadores (vuelven a unirse con el código nuevo) y se borra el registro de combates.
   */
  | { t: 'newSession'; removePlayers: boolean; clearLog: boolean }
  /**
   * Crear (abrir) la partida: el DM ha preparado la sesión a solas y ahora genera un código nuevo con el que se unen
   * los jugadores. Como en `newSession`, puede sacar a los jugadores anteriores y borrar el registro.
   */
  | { t: 'openGame'; removePlayers?: boolean; clearLog?: boolean }
  /** Cerrar la partida: nadie nuevo puede unirse con el código (los de dentro siguen, salvo que se les saque) */
  | { t: 'closeGame'; removePlayers?: boolean }
  /** Echa a un jugador o una pantalla de la partida (puede volver con el código si la partida está abierta) */
  | { t: 'kick'; id: string }
  /** Servidor del PC: guarda la clave del DM de la nube (url vacía = la de siempre) o la quita (key vacía) */
  | { t: 'cloudLink'; url: string; key: string }
  | { t: 'add'; combatants: Partial<Combatant>[] }
  | { t: 'update'; id: string; patch: Partial<Combatant> }
  | { t: 'remove'; id: string }
  | { t: 'reorder'; ids: string[] }
  | { t: 'sort' }
  | { t: 'begin' }
  | { t: 'rosterSave'; entry: RosterEntry }
  | { t: 'rosterRemove'; id: string }
  | { t: 'rosterToCombat'; id: string; count: number; hidden: boolean; rollHp?: boolean }
  | { t: 'encounterSave'; encounter: PreparedEncounter }
  | { t: 'encounterRemove'; id: string }
  /** Mete en el combate (o lo deja preparado si aún no ha empezado) a todos los del encuentro */
  | { t: 'encounterLoad'; id: string }
  | { t: 'roomSettings'; patch: Partial<RoomSettings> }
  /** El cliente manda `data` (JPEG en base64); el servidor la guarda en disco y la sustituye por `id` */
  | { t: 'imageAdd'; title: string; data?: string; id?: string; w?: number; h?: number; category?: ImageCategory }
  | { t: 'imageCategory'; id: string; category: ImageCategory }
  | { t: 'imageShare'; id: string; to: 'all' | string[] }
  | { t: 'imageUnshare'; id: string }
  | { t: 'imageRemove'; id: string }
  | { t: 'imageRename'; id: string; title: string }
  | { t: 'chronicleShare'; title: string; text: string; to?: 'all' | string[] }
  | { t: 'chronicleRemove'; id: string }
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
