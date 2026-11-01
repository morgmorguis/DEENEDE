import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, InitEntry, LogEntry, Note, NoteFolder } from './types';
import { normalizeCharacter, sampleCharacter, uid } from './rules/factory';
import { SELF_ID, applyCommand, runQuickRoll, sortOrder, type ApplyResult, type Command } from './rules/engine';
import { activeReminders } from './rules/calc';
import { DEFAULT_MODEL } from './config';
import { mergeCharacters } from './backup';
import { setLang, T, type Lang } from './i18n';

export type Theme = 'basic' | 'green' | 'gray' | 'blue';

export interface Settings {
  lang: Lang;
  theme: Theme;
  /** Tocar una característica/habilidad de la hoja tira el dado (desactivado por defecto) */
  tapToRoll: boolean;
  apiKey: string;
  model: string;
  useAiFallback: boolean;
  /** 'auto' = según el idioma de la app */
  speechLang: string;
  /** En combate, anotar a mano la tirada de cada acción de compañeros y enemigos */
  manualRolls: boolean;
  /** Fecha (ms) de la última copia de seguridad exportada */
  lastBackupAt: number | null;
}

interface State {
  characters: Character[];
  activeId: string;
  log: Record<string, LogEntry[]>;
  settings: Settings;
  toast: { title: string; lines: string[] } | null;
  showToast: (title: string, lines: string[]) => void;
  hideToast: () => void;
  // acciones
  active: () => Character;
  update: (fn: (c: Character) => void) => void;
  replace: (c: Character) => void;
  addCharacter: (c: Character) => void;
  removeCharacter: (id: string) => void;
  setActive: (id: string) => void;
  /** Recupera fichas de una copia de seguridad: fusionando por id o reemplazando todas */
  importCharacters: (chars: Character[], mode: 'merge' | 'replace') => void;
  /** Aplica comandos al personaje activo, los registra y (si no es silencioso) muestra un aviso */
  runCommands: (userText: string | null, cmds: Command[], extraLines?: string[], silent?: boolean) => void;
  quickRoll: (expr: string, label: string) => void;
  pushLog: (e: Omit<LogEntry, 'id' | 'at'>) => void;
  undo: (entryId: string) => void;
  clearLog: () => void;
  addNote: (n: Omit<Note, 'id' | 'createdAt'>) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  // Combate y orden de iniciativa
  startCombat: () => void;
  endCombat: () => void;
  endTurn: () => void;
  setOrder: (order: InitEntry[], turn?: number) => void;
  upsertEntry: (e: InitEntry) => void;
  removeEntry: (id: string) => void;
  sortByInitiative: () => void;
  /** Acción de un participante en su turno: ha pegado a alguien, ha curado o ha recibido daño (sin dados) */
  /** Kill count: añadir a mano o quitar una baja */
  addKill: (name: string) => void;
  removeKill: (id: string) => void;
  combatAction: (a: { actorId: string; kind: 'hit' | 'heal' | 'hurt'; targetId: string; amount: number; roll?: number | null }) => void;
}

const detected: Lang = typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('es') ? 'en' : 'es';
setLang(detected);
const first = sampleCharacter();

const defaultSettings: Settings = { lang: detected, theme: 'basic', tapToRoll: false, apiKey: '', model: DEFAULT_MODEL, useAiFallback: true, speechLang: 'auto', manualRolls: false, lastBackupAt: null };

export const speechLangFor = (s: Settings) => (s.speechLang === 'auto' ? (s.lang === 'es' ? 'es-ES' : 'en-US') : s.speechLang);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      characters: [first],
      activeId: first.id,
      log: {},
      settings: defaultSettings,
      toast: null,
      showToast: (title, lines) => set({ toast: { title, lines } }),
      hideToast: () => set({ toast: null }),

      active: () => get().characters.find((c) => c.id === get().activeId) ?? get().characters[0],
      update: (fn) =>
        set((s) => ({
          characters: s.characters.map((c) => {
            if (c.id !== s.activeId) return c;
            const copy = structuredClone(c);
            fn(copy);
            return copy;
          }),
        })),
      replace: (next) => set((s) => ({ characters: s.characters.map((c) => (c.id === next.id ? next : c)) })),
      addCharacter: (c) => set((s) => ({ characters: [...s.characters, c], activeId: c.id })),
      removeCharacter: (id) =>
        set((s) => {
          const rest = s.characters.filter((c) => c.id !== id);
          const characters = rest.length ? rest : [sampleCharacter()];
          return { characters, activeId: characters[0].id };
        }),
      setActive: (id) => set({ activeId: id }),
      importCharacters: (chars, mode) =>
        set((s) => {
          const characters = mergeCharacters(s.characters, chars, mode);
          const activeId = characters.some((c) => c.id === s.activeId) ? s.activeId : chars[0].id;
          return { characters, activeId };
        }),

      pushLog: (e) =>
        set((s) => {
          const id = s.activeId;
          const list = [...(s.log[id] ?? []), { ...e, id: uid(), at: Date.now() }].slice(-200);
          return { log: { ...s.log, [id]: list } };
        }),

      runCommands: (userText, cmds, extraLines = [], silent = false) => {
        const before = get().active();
        let cur = before;
        const lines = [...extraLines];
        const quick: ApplyResult['quickRolls'] = [];
        for (const cmd of cmds) {
          const r = applyCommand(cur, cmd);
          cur = r.char;
          lines.push(...r.lines);
          quick.push(...r.quickRolls);
        }
        if (userText) get().pushLog({ role: 'user', text: userText });
        const changed = cur !== before;
        if (changed) get().replace(cur);
        get().pushLog({ role: 'app', text: lines[0] ?? T('Hecho.', 'Done.'), details: lines.slice(1), undo: changed ? before : undefined, quickRolls: quick });
        if (!silent && lines.length) get().showToast(lines[0], lines.slice(1));
      },

      quickRoll: (expr, label) => {
        const before = get().active();
        const r = runQuickRoll(before, expr);
        if (r.char !== before) get().replace(r.char);
        get().pushLog({ role: 'app', text: `${label}`, details: r.lines, undo: r.char !== before ? before : undefined, quickRolls: r.quickRolls });
        get().showToast(label, r.lines);
      },

      undo: (entryId) => {
        const s = get();
        const list = s.log[s.activeId] ?? [];
        const entry = list.find((e) => e.id === entryId);
        if (!entry?.undo) return;
        s.replace(entry.undo);
        set((st) => ({
          log: { ...st.log, [st.activeId]: list.map((e) => (e.id === entryId ? { ...e, undo: undefined, text: `↩️ ${T('Deshecho', 'Undone')}: ${e.text}` } : e)) },
        }));
      },
      clearLog: () => set((s) => ({ log: { ...s.log, [s.activeId]: [] } })),

      addNote: (n) => get().update((c) => void c.notes.unshift({ ...n, id: uid(), createdAt: Date.now() })),
      updateNote: (id, patch) => get().update((c) => { c.notes = c.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)); }),
      deleteNote: (id) => get().update((c) => { c.notes = c.notes.filter((n) => n.id !== id); }),
      addFolder: (name) => {
        const folder: NoteFolder = { id: uid(), name };
        get().update((c) => { c.noteFolders.push(folder); });
        return folder.id;
      },
      renameFolder: (id, name) => get().update((c) => {
        // Al renombrar una carpeta predefinida deja de traducirse automáticamente
        c.noteFolders = c.noteFolders.map((f) => (f.id === id ? { id: f.id, name } : f));
      }),
      deleteFolder: (id) => get().update((c) => {
        c.noteFolders = c.noteFolders.filter((f) => f.id !== id);
        c.notes = c.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n));
      }),
      startCombat: () => get().update((c) => {
        // Los compañeros se recuerdan entre combates; los enemigos no
        const allies = c.combat.order.filter((e) => e.kind === 'ally').map((e) => ({ ...e, initiative: null }));
        c.combat = { active: true, round: 1, initiative: null, action: false, bonus: false, reaction: false, movementUsed: 0, turn: 0, begun: false, order: [{ id: SELF_ID, name: '', kind: 'self', initiative: null }, ...allies] };
      }),
      endCombat: () => {
        get().update((c) => { c.combat.active = false; c.combat.initiative = null; c.combat.turn = 0; });
        get().pushLog({ role: 'app', text: T('Fin del combate.', 'Combat over.') });
      },
      endTurn: () => {
        const c = get().active();
        const order = c.combat.order.length ? c.combat.order : [{ id: SELF_ID, name: '', kind: 'self' as const, initiative: c.combat.initiative }];
        const next = c.combat.turn + 1;
        const who = (e: InitEntry) => (e.kind === 'self' ? c.name : e.name);
        if (next >= order.length) {
          // Vuelta completa: nueva ronda (duraciones, acción, reacción, movimiento…)
          get().runCommands(null, [{ type: 'nextRound' }], [], true);
          get().update((x) => { x.combat.turn = 0; x.combat.begun = true; });
          const log = get().log[get().activeId] ?? [];
          const details = log[log.length - 1]?.details ?? [];
          get().showToast(T(`Ronda ${c.combat.round + 1} · turno de ${who(order[0])}`, `Round ${c.combat.round + 1} · ${who(order[0])}’s turn`), details);
          return;
        }
        const mine = order[next].kind === 'self';
        get().update((x) => {
          x.combat.turn = next;
          x.combat.begun = true;
          if (mine) Object.assign(x.combat, { action: false, bonus: false, reaction: false, movementUsed: 0 });
        });
        get().showToast(mine ? T('⚔️ ¡Tu turno!', '⚔️ Your turn!') : T(`Turno de ${who(order[next])}`, `${who(order[next])}’s turn`), mine ? activeReminders(get().active()) : []);
      },
      setOrder: (order, turn) => get().update((c) => {
        const current = c.combat.order[c.combat.turn]?.id;
        c.combat.order = order;
        c.combat.turn = turn ?? (c.combat.begun ? Math.max(0, order.findIndex((e) => e.id === current)) : 0);
      }),
      upsertEntry: (e) => get().update((c) => {
        const i = c.combat.order.findIndex((x) => x.id === e.id);
        if (i >= 0) c.combat.order[i] = e;
        else c.combat.order.push(e);
        if (e.kind === 'self' && e.initiative != null) c.combat.initiative = e.initiative;
      }),
      removeEntry: (id) => get().update((c) => {
        const current = c.combat.order[c.combat.turn]?.id;
        c.combat.order = c.combat.order.filter((x) => x.id !== id);
        c.combat.turn = Math.max(0, c.combat.order.findIndex((x) => x.id === current));
      }),
      sortByInitiative: () => get().update((c) => {
        const sorted = sortOrder(c.combat.order, c.combat.turn);
        Object.assign(c.combat, sorted, c.combat.begun ? {} : { turn: 0 });
      }),
      combatAction: ({ actorId, kind, targetId, amount, roll }) => {
        const c = get().active();
        const nameOf = (id: string) => (id === SELF_ID ? c.name : c.combat.order.find((e) => e.id === id)?.name ?? '?');
        const n = Math.max(0, Math.round(amount));
        const actor = nameOf(actorId);
        const target = nameOf(targetId);
        const rollTxt = roll != null ? T(` (tirada ${roll})`, ` (roll ${roll})`) : '';
        const text = kind === 'hit'
          ? T(`${actor} golpea a ${target}${rollTxt}: ${n} de daño`, `${actor} hits ${target}${rollTxt}: ${n} damage`)
          : kind === 'heal'
            ? T(`${actor} cura a ${target}${rollTxt}: ${n} PG`, `${actor} heals ${target}${rollTxt}: ${n} HP`)
            : T(`${actor} recibe ${n} de daño${rollTxt}`, `${actor} takes ${n} damage${rollTxt}`);
        const hurt = kind !== 'heal';
        if (targetId === SELF_ID) {
          // A tu personaje se le aplican las reglas completas (resistencias, temporales, concentración…)
          get().runCommands(text, [hurt ? { type: 'damage', amount: n, damageType: null, critical: false } : { type: 'heal', amount: n }]);
          return;
        }
        let status = '';
        let killed = '';
        get().update((x) => {
          const e = x.combat.order.find((y) => y.id === targetId);
          if (!e) return;
          let dmg = e.damage ?? 0;
          let temp = e.temp ?? 0;
          if (hurt) {
            const absorbed = Math.min(temp, n);
            temp -= absorbed;
            dmg += n - absorbed;
          } else {
            dmg = Math.max(0, dmg - n);
          }
          if (e.hpMax != null) dmg = Math.min(dmg, e.hpMax);
          const wasUp = e.hpMax == null || (e.damage ?? 0) < e.hpMax;
          e.damage = dmg;
          e.temp = temp;
          // Golpe final de tu personaje a un enemigo: cuenta para tu kill count
          if (kind === 'hit' && actorId === SELF_ID && e.kind === 'enemy' && e.hpMax != null && wasUp && dmg >= e.hpMax) {
            x.kills.push({ id: uid(), name: e.name, at: Date.now(), source: 'local' });
            killed = e.name;
          }
          status = e.hpMax != null
            ? (e.hpMax - dmg <= 0 ? T(`💀 ${e.name} cae (0/${e.hpMax})`, `💀 ${e.name} is down (0/${e.hpMax})`) : `❤️ ${e.name}: ${e.hpMax - dmg}/${e.hpMax}`)
            : T(`❤️ ${e.name}: ? (daño recibido ${dmg})`, `❤️ ${e.name}: ? (damage taken ${dmg})`);
        });
        if (killed) status += T(` · ☠️ +1 en tu kill count`, ` · ☠️ +1 to your kill count`);
        get().pushLog({ role: 'app', text, details: [status] });
        get().showToast(text, [status]);
      },
      addKill: (name) => get().update((c) => { c.kills.push({ id: uid(), name: name.trim(), at: Date.now(), source: 'manual' }); }),
      removeKill: (id) => get().update((c) => { c.kills = c.kills.filter((k) => k.id !== id); }),
      setSettings: (p) => set((s) => {
        const settings = { ...s.settings, ...p };
        setLang(settings.lang);
        return { settings };
      }),
    }),
    {
      name: 'dnd-companion',
      version: 2,
      // Las instantáneas para deshacer pesan mucho: solo guardamos las 20 últimas
      partialize: (s) => ({
        characters: s.characters,
        activeId: s.activeId,
        settings: s.settings,
        log: Object.fromEntries(Object.entries(s.log).map(([k, v]) => [k, v.slice(-60).map((e, i, a) => (i < a.length - 20 ? { ...e, undo: undefined } : e))])),
      }),
      migrate: (persisted) => persisted as State,
      // Completa campos nuevos en fichas y ajustes guardados con versiones anteriores
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const settings = { ...current.settings, ...(p.settings ?? {}) };
        setLang(settings.lang);
        return {
          ...current,
          ...p,
          settings,
          characters: p.characters?.length ? p.characters.map((c) => normalizeCharacter(c as never)) : current.characters,
        };
      },
    },
  ),
);

export const useChar = () => useStore((s) => s.characters.find((c) => c.id === s.activeId) ?? s.characters[0]);
