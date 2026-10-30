// Copias de seguridad: guarda fichas (con sus notas y carpetas del diario) en un archivo .json
// y las recupera más tarde, en este u otro dispositivo.
import { Capacitor } from '@capacitor/core';
import type { Character } from './types';
import { normalizeCharacter } from './rules/factory';
import { T } from './i18n';

export const BACKUP_KIND = 'di-en-di-backup';

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  version: 1;
  exportedAt: string;
  characters: Character[];
}

export function buildBackup(characters: Character[]): BackupFile {
  return { kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(), characters };
}

const looksLikeCharacter = (x: unknown): x is Character =>
  !!x && typeof x === 'object' && typeof (x as Character).name === 'string' && typeof (x as Character).abilities === 'object' && typeof (x as Character).hp === 'object';

/** Lee una copia: acepta el archivo de copia, una ficha suelta exportada o una lista de fichas */
export function parseBackup(text: string): { characters: Character[]; exportedAt: string | null } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(T('El archivo no es una copia válida (no es JSON).', 'The file isn’t a valid backup (not JSON).'));
  }
  let list: unknown[];
  let exportedAt: string | null = null;
  if (data && typeof data === 'object' && (data as BackupFile).kind === BACKUP_KIND) {
    list = (data as BackupFile).characters ?? [];
    exportedAt = (data as BackupFile).exportedAt ?? null;
  } else if (Array.isArray(data)) list = data;
  else list = [data];
  const characters = list.filter(looksLikeCharacter).map((c) => normalizeCharacter(c as never));
  if (!characters.length) throw new Error(T('No he encontrado ninguna ficha en el archivo.', 'No character sheets were found in the file.'));
  return { characters, exportedAt };
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
  return `di-en-di_${safe}_${date}.json`;
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
