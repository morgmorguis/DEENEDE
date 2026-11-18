// Imágenes que el DM comparte contigo (mapas, retratos…): el archivo completo se guarda en este dispositivo (IndexedDB, sin el límite de la ficha) y la nota del diario lleva una miniatura.
import { loadFile, removeFile, saveFile } from './export/templateStore';

/** Clave en IndexedDB de una imagen compartida ('img:<id>' → 'compartido/img:<id>') */
export const sharedImageKey = (ref: string) => `compartido/${ref}`;

/** Quita «data:image/jpeg;base64,» si lo lleva */
export const stripDataUrl = (s: string) => s.replace(/^data:[^,]*,/, '');

export async function storeSharedImage(ref: string, blob: Blob): Promise<string> {
  const key = sharedImageKey(ref);
  await saveFile(key, await blob.arrayBuffer());
  return key;
}

export async function loadSharedImage(key: string): Promise<Blob | null> {
  const buf = await loadFile(key);
  return buf ? new Blob([buf], { type: 'image/jpeg' }) : null;
}

/** La imagen completa en base64 (sin prefijo), para exportar el diario */
export async function sharedImageBase64(key: string): Promise<string | null> {
  const buf = await loadFile(key);
  if (!buf) return null;
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const removeSharedImage = (key: string) => removeFile(key).catch(() => undefined);
