// Archivo de guardado: fichas (con sus notas, categorías, objetos y monedas), su historial, las plantillas
// de objetos y los botines preparados del DM, en un .json que sirve igual en Android, Windows y el navegador.
import { Capacitor } from '@capacitor/core';
import type { Character, LogEntry } from './types';
import type { ItemData } from './rules/itemTypes';
import type { LootBundle } from './store';
import { normalizeCharacter } from './rules/factory';
import { T } from './i18n';

export const BACKUP_KIND = 'di-en-di-backup';

/** Lo que acompaña a las fichas en el archivo */
export interface BackupExtras {
  /** Historial de cada ficha (lo que has hecho y tirado) */
  log?: Record<string, LogEntry[]>;
  customItems?: ItemData[];
  lootBundles?: LootBundle[];
}

export interface BackupFile extends BackupExtras {
  kind: typeof BACKUP_KIND;
  version: 1 | 2;
  exportedAt: string;
  /** Desde qué app se guardó (android, windows, web): solo informativo, el archivo sirve en todas */
  platform?: string;
  characters: Character[];
}

export const platformName = () => (Capacitor.isNativePlatform() ? 'android' : /Electron|Windows/i.test(navigator.userAgent) ? 'windows' : 'web');

export function buildBackup(characters: Character[], extras: BackupExtras = {}): BackupFile {
  // Las instantáneas para deshacer no hacen falta en el archivo
  const log = extras.log ? Object.fromEntries(Object.entries(extras.log).filter(([id]) => characters.some((c) => c.id === id)).map(([id, l]) => [id, l.slice(-200).map((e) => ({ ...e, undo: undefined }))])) : undefined;
  return { kind: BACKUP_KIND, version: 2, exportedAt: new Date().toISOString(), platform: platformName(), characters, ...(log ? { log } : {}), ...(extras.customItems?.length ? { customItems: extras.customItems } : {}), ...(extras.lootBundles?.length ? { lootBundles: extras.lootBundles } : {}) };
}

const looksLikeCharacter = (x: unknown): x is Character =>
  !!x && typeof x === 'object' && typeof (x as Character).name === 'string' && typeof (x as Character).abilities === 'object' && typeof (x as Character).hp === 'object';

/** Lee una copia: acepta el archivo de copia, una ficha suelta exportada o una lista de fichas */
export function parseBackup(text: string): { characters: Character[]; exportedAt: string | null; extras: BackupExtras; platform?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(T('El archivo no es una copia válida (no es JSON).', 'The file isn’t a valid backup (not JSON).'));
  }
  let list: unknown[];
  let exportedAt: string | null = null;
  let extras: BackupExtras = {};
  let platform: string | undefined;
  if (data && typeof data === 'object' && (data as BackupFile).kind === BACKUP_KIND) {
    const f = data as BackupFile;
    list = f.characters ?? [];
    exportedAt = f.exportedAt ?? null;
    platform = f.platform;
    extras = {
      log: f.log && typeof f.log === 'object' ? f.log : undefined,
      customItems: Array.isArray(f.customItems) ? f.customItems : undefined,
      lootBundles: Array.isArray(f.lootBundles) ? f.lootBundles : undefined,
    };
  } else if (Array.isArray(data)) list = data;
  else list = [data];
  const characters = list.filter(looksLikeCharacter).map((c) => normalizeCharacter(c as never));
  if (!characters.length) throw new Error(T('No he encontrado ninguna ficha en el archivo.', 'No character sheets were found in the file.'));
  return { characters, exportedAt, extras, platform };
}

/**
 * Junta las fichas de la copia con las actuales.
 * - merge: las fichas con el mismo id se sustituyen por la versión de la copia; las demás se añaden.
 * - replace: solo quedan las fichas de la copia.
 */
export function mergeCharacters(current: Character[], incoming: Character[], mode: 'merge' | 'replace'): Character[] {
  if (mode === 'replace') return incoming;
  const byId = new Map(incoming.map((c) => [c.id, c]));
  const kept = current.map((c) => byId.get(c.id) ?? c);
  const added = incoming.filter((c) => !current.some((x) => x.id === c.id));
  return [...kept, ...added];
}

export const backupFileName = (label: string) => {
  const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const safe = label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'copia';
  return `di-en-di_guardado_${safe}_${date}.json`;
};

/**
 * Guarda el archivo. En Android se escribe en Documentos/DiEnDi y se abre el menú «Compartir»
 * para enviarlo a Drive, al correo, a WhatsApp…; en el navegador se descarga.
 * Devuelve dónde se ha guardado (si se sabe).
 */
export async function saveBackupFile(json: string, fileName: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    let savedTo: string | null = null;
    try {
      await Filesystem.writeFile({ path: `DiEnDi/${fileName}`, data: json, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      savedTo = `Documents/DiEnDi/${fileName}`;
    } catch {
      // Algunos Android no dejan escribir en Documentos: seguimos con el menú de compartir
    }
    const tmp = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: fileName, files: [tmp.uri], dialogTitle: T('Guardar copia de Di en Di', 'Save Di en Di backup') });
    } catch {
      // El usuario ha cerrado el menú de compartir
    }
    return savedTo;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return null;
}

/** Guarda todo (fichas, notas, historial, plantillas y botines) en el archivo multiplataforma */
export async function exportEverything(): Promise<string | null> {
  const { useStore } = await import('./store');
  const st = useStore.getState();
  const json = JSON.stringify(buildBackup(st.characters, { log: st.log, customItems: st.settings.customItems, lootBundles: st.settings.lootBundles }));
  const where = await saveBackupFile(json, backupFileName(T('todo', 'all')));
  st.setSettings({ lastBackupAt: Date.now() });
  return where;
}
