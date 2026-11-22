// «Mis partidas»: las que el DM crea en la nube desde la app (su clave queda en este dispositivo) y la copia automática de
// cada una, para restaurarla si la nube la borra tras días sin uso.
import { loadFile, saveFile } from '../export/templateStore';
import { httpBase, resolveServer } from './client';

export interface MyGame {
  dmKey: string;
  /** Servidor donde está (la dirección que escribió el DM o la de la nube) */
  url: string;
  createdAt: number;
  /** Código de la última vez que se vio */
  code?: string;
  /** Cuándo se guardó la última copia en este dispositivo */
  backupAt?: number;
}

const KEY = 'di-en-di-mis-partidas';
/** Días sin uso tras los que la nube borra una partida creada desde la app (lo dice el servidor; es el valor por defecto) */
export const EXPIRE_DAYS = 5;

export function myGames(): MyGame[] {
  try { const j = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(j) ? j.filter((g) => g && typeof g.dmKey === 'string') : []; } catch { return []; }
}
function saveList(list: MyGame[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-30))); } catch { /* sin almacenamiento */ }
}
export function rememberGame(g: MyGame) {
  saveList([...myGames().filter((x) => x.dmKey !== g.dmKey), g]);
}
export function patchGame(dmKey: string, patch: Partial<MyGame>) {
  const list = myGames();
  const g = list.find((x) => x.dmKey === dmKey);
  // Solo si cambia algo (se llama con cada estado de la partida)
  if (!g || Object.entries(patch).every(([k, v]) => g[k as keyof MyGame] === v)) return;
  saveList(list.map((x) => (x === g ? { ...x, ...patch } : x)));
}
export function forgetGame(dmKey: string) {
  saveList(myGames().filter((x) => x.dmKey !== dmKey));
}
export const isMyGame = (dmKey?: string) => !!dmKey && myGames().some((g) => g.dmKey === dmKey);

const backupKey = (dmKey: string) => `partida/${dmKey}`;

/** El servidor real (la dirección corta de la nube se traduce) */
async function base(url: string) {
  const b = httpBase(url);
  return (await resolveServer(b)) ?? b;
}

export type NewGameError = 'too-many' | 'full' | 'no-multi' | 'no-server';

/** Crea una partida en el servidor (o restaura una con su copia) y la apunta en «Mis partidas» */
export async function createGame(url: string, restore?: { dmKey: string; campaign: unknown }): Promise<MyGame | { error: NewGameError }> {
  let b: string;
  try { b = await base(url); } catch { return { error: 'no-server' }; }
  try {
    const r = await fetch(`${b}/api/new`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(restore ?? {}) });
    const j = await r.json() as { dmKey?: string; code?: string; error?: NewGameError };
    if (!r.ok || !j.dmKey) return { error: j.error ?? (r.status === 404 ? 'no-multi' : 'no-server') };
    const g: MyGame = { dmKey: j.dmKey, url, createdAt: Date.now(), code: j.code };
    const prev = myGames().find((x) => x.dmKey === g.dmKey);
    rememberGame({ ...prev, ...g, createdAt: prev?.createdAt ?? g.createdAt });
    return g;
  } catch {
    return { error: 'no-server' };
  }
}

/** ¿Sigue existiendo en el servidor? (null si no se puede saber: sin conexión) */
export async function gameExists(g: MyGame): Promise<boolean | null> {
  try {
    const r = await fetch(`${await base(g.url)}/api/info?dm=${encodeURIComponent(g.dmKey)}`);
    const j = await r.json() as { code?: string };
    if (j.code) patchGame(g.dmKey, { code: j.code });
    return !!j.code;
  } catch { return null; }
}

/** La copia guardada en este dispositivo (campaña con imágenes) */
export async function loadBackup(dmKey: string): Promise<unknown | null> {
  const buf = await loadFile(backupKey(dmKey)).catch(() => null);
  if (!buf) return null;
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch { return null; }
}

const lastBackup = new Map<string, number>();
const timers = new Map<string, number>();
/** Cada cuánto se copia la partida al dispositivo del DM mientras juega (como mucho) */
const EVERY = 5 * 60 * 1000;

/** El DM está en una de sus partidas y algo ha cambiado: copia de la campaña en este dispositivo (como mucho cada 5 min) */
export function scheduleBackup(url: string, dmKey: string) {
  if (!isMyGame(dmKey) || timers.has(dmKey)) return;
  const wait = Math.max(20_000, (lastBackup.get(dmKey) ?? 0) + EVERY - Date.now());
  timers.set(dmKey, window.setTimeout(() => { timers.delete(dmKey); void backupNow(url, dmKey); }, wait));
}

export async function backupNow(url: string, dmKey: string): Promise<boolean> {
  try {
    const r = await fetch(`${httpBase(url)}/api/export?dm=${encodeURIComponent(dmKey)}`);
    if (!r.ok) return false;
    const buf = await r.arrayBuffer();
    await saveFile(backupKey(dmKey), buf);
    lastBackup.set(dmKey, Date.now());
    patchGame(dmKey, { backupAt: Date.now() });
    return true;
  } catch { return false; }
}
