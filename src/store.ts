import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, LogEntry, Note } from './types';
import { sampleCharacter, uid } from './rules/factory';
import { applyCommand, runQuickRoll, type ApplyResult, type Command } from './rules/engine';
import { DEFAULT_MODEL } from './config';

export interface Settings {
  apiKey: string;
  model: string;
  useAiFallback: boolean;
  speechLang: string;
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
  /** Aplica comandos al personaje activo, los registra y (si no es silencioso) muestra un aviso */
  runCommands: (userText: string | null, cmds: Command[], extraLines?: string[], silent?: boolean) => void;
  quickRoll: (expr: string, label: string) => void;
  pushLog: (e: Omit<LogEntry, 'id' | 'at'>) => void;
  undo: (entryId: string) => void;
  clearLog: () => void;
  addNote: (n: Omit<Note, 'id' | 'createdAt'>) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  setSettings: (p: Partial<Settings>) => void;
}

const first = sampleCharacter();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      characters: [first],
      activeId: first.id,
      log: {},
      settings: { apiKey: '', model: DEFAULT_MODEL, useAiFallback: true, speechLang: 'es-ES' },
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
        get().pushLog({ role: 'app', text: lines[0] ?? 'Hecho.', details: lines.slice(1), undo: changed ? before : undefined, quickRolls: quick });
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
          log: { ...st.log, [st.activeId]: list.map((e) => (e.id === entryId ? { ...e, undo: undefined, text: `↩️ Deshecho: ${e.text}` } : e)) },
        }));
      },
      clearLog: () => set((s) => ({ log: { ...s.log, [s.activeId]: [] } })),

      addNote: (n) => get().update((c) => void c.notes.unshift({ ...n, id: uid(), createdAt: Date.now() })),
      updateNote: (id, patch) => get().update((c) => { c.notes = c.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)); }),
      deleteNote: (id) => get().update((c) => { c.notes = c.notes.filter((n) => n.id !== id); }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
    }),
    {
      name: 'dnd-companion',
      version: 1,
      // Las instantáneas para deshacer pesan mucho: solo guardamos las 20 últimas
      partialize: (s) => ({
        characters: s.characters,
        activeId: s.activeId,
        settings: s.settings,
        log: Object.fromEntries(Object.entries(s.log).map(([k, v]) => [k, v.slice(-60).map((e, i, a) => (i < a.length - 20 ? { ...e, undo: undefined } : e))])),
      }),
    },
  ),
);

export const useChar = () => useStore((s) => s.characters.find((c) => c.id === s.activeId) ?? s.characters[0]);
