// Copia de la campaña del DM: personajes preparados, encuentros, entregas, registro de combate, crónicas,
// imágenes (con los archivos dentro) y ajustes de la partida, más las plantillas de objetos y los botines
// preparados de esta app. Un único .json que sirve en Android, Windows y el navegador.
import { useState } from 'react';
import { httpBase, useParty } from '../party/client';
import { CAMPAIGN_KIND, type CampaignData } from '../party/room';
import { useStore, type LootBundle } from '../store';
import type { ItemData } from '../rules/itemTypes';
import { backupFileName, platformName, saveBackupFile } from '../backup';
import { Section, pickFiles } from './common';
import { T } from '../i18n';

export interface CampaignFile {
  kind: typeof CAMPAIGN_KIND;
  version: 1;
  exportedAt: string;
  platform?: string;
  room?: CampaignData;
  local?: { customItems?: ItemData[]; lootBundles?: LootBundle[] };
}

/** Lee un archivo de campaña (o lanza un error explicado) */
export function parseCampaign(text: string): CampaignFile {
  let f: CampaignFile;
  try { f = JSON.parse(text); } catch { throw new Error(T('El archivo no es válido (no es JSON).', 'The file isn’t valid (not JSON).')); }
  if (!f || f.kind !== CAMPAIGN_KIND) throw new Error(T('No es una copia de campaña del DM. Las fichas se restauran en «Archivo de guardado».', 'This isn’t a DM campaign backup. Sheets are restored in “Save file”.'));
  return f;
}

const count = (f: CampaignFile) => {
  const r = f.room;
  return T(
    `${r?.roster.length ?? 0} personaje(s) preparado(s), ${r?.encounters.length ?? 0} encuentro(s), ${r?.images.length ?? 0} imagen(es), ${r?.chronicles.length ?? 0} crónica(s), ${r?.log.length ?? 0} línea(s) de registro, ${f.local?.lootBundles?.length ?? 0} botín(es) y ${f.local?.customItems?.length ?? 0} plantilla(s) de objeto`,
    `${r?.roster.length ?? 0} prepared character(s), ${r?.encounters.length ?? 0} encounter(s), ${r?.images.length ?? 0} image(s), ${r?.chronicles.length ?? 0} chronicle(s), ${r?.log.length ?? 0} log line(s), ${f.local?.lootBundles?.length ?? 0} loot bundle(s) and ${f.local?.customItems?.length ?? 0} item template(s)`,
  );
};

export function DmBackupSection() {
  const conn = useParty((s) => s.conn);
  const role = useParty((s) => s.role);
  const online = useParty((s) => s.status === 'online');
  const dm = role === 'dm' && !!conn?.dmKey;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setError(null); setStatus(null);
    try { setStatus(await fn()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const exportAll = () => run(async () => {
    const st = useStore.getState();
    let room: CampaignData | undefined;
    if (dm && online) {
      const res = await fetch(`${httpBase(conn!.url)}/api/export?dm=${encodeURIComponent(conn!.dmKey!)}`);
      if (!res.ok) throw new Error(T(`El servidor no ha dado la copia (${res.status}). ¿Es un servidor antiguo? Actualízalo.`, `The server didn’t return the backup (${res.status}). Is it an old server? Update it.`));
      room = (await res.json()).room;
    }
    const file: CampaignFile = { kind: CAMPAIGN_KIND, version: 1, exportedAt: new Date().toISOString(), platform: platformName(), room, local: { customItems: st.settings.customItems ?? [], lootBundles: st.settings.lootBundles ?? [] } };
    const where = await saveBackupFile(JSON.stringify(file), backupFileName(T('campaña', 'campaign')).replace('_guardado_', '_dm_'));
    const what = count(file);
    return where ? T(`Guardado en ${where}: ${what}.`, `Saved to ${where}: ${what}.`) : T(`Copia creada: ${what}.`, `Backup created: ${what}.`);
  });

  const restore = () => run(async () => {
    const [file] = await pickFiles('*/*', false);
    if (!file) return '';
    const f = parseCampaign(await file.text());
    // Lo de esta app: botines y plantillas se suman (sin duplicar)
    const st = useStore.getState();
    const bundles = f.local?.lootBundles ?? [];
    const items = f.local?.customItems ?? [];
    st.setSettings({
      lootBundles: [...(st.settings.lootBundles ?? []).filter((b) => !bundles.some((x) => x.id === b.id)), ...bundles],
      customItems: [...(st.settings.customItems ?? []).filter((i) => !items.some((x) => x.name === i.name)), ...items],
    });
    let serverPart = '';
    if (f.room) {
      if (!dm || !online) serverPart = T(' La parte del servidor (personajes preparados, encuentros, imágenes…) necesita que te conectes como DM: vuelve a restaurar el archivo cuando lo estés.', ' The server part (prepared characters, encounters, images…) needs you to be connected as DM: restore the file again once you are.');
      else {
        // text/plain evita la consulta previa CORS desde la app de Android
        const res = await fetch(`${httpBase(conn!.url)}/api/import?dm=${encodeURIComponent(conn!.dmKey!)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ room: f.room }) });
        if (!res.ok) throw new Error(T(`El servidor no ha aceptado la copia (${res.status}).`, `The server rejected the backup (${res.status}).`));
      }
    }
    return T(`Restaurado: ${count(f)}.`, `Restored: ${count(f)}.`) + serverPart;
  });

  return (
    <Section title={T('Copia de la campaña (DM)', 'Campaign backup (DM)')}>
      <p className="small">{T(
        'Guarda en un archivo todo lo que has creado como DM: personajes y monstruos preparados (con su equipo y ataques), encuentros con enemigos ocultos, entregas de oro y objetos, el registro de los combates, las crónicas, las imágenes, los botines y las plantillas de objetos.',
        'Save everything you’ve created as DM to a file: prepared characters and monsters (with gear and attacks), encounters with hidden enemies, gold and item gifts, the combat log, chronicles, images, loot bundles and item templates.')}</p>
      <p className="hint">{dm && online
        ? T('✅ Conectado como DM: la copia incluye lo que guarda el servidor.', '✅ Connected as DM: the backup includes what the server stores.')
        : T('Sin conexión como DM solo se guardan los botines y plantillas de esta app. El servidor, además, guarda la partida solo en «di-en-di-partida.json» junto al programa.', 'Without a DM connection only this app’s loot and templates are saved. The server also keeps the game in “di-en-di-partida.json” next to the program.')}</p>
      <div className="row">
        <button className="btn primary grow" disabled={busy} onClick={() => void exportAll()}>💾 {T('Exportar campaña', 'Export campaign')}</button>
        <button className="btn grow" disabled={busy} onClick={() => void restore()}>📂 {T('Restaurar campaña', 'Restore campaign')}</button>
      </div>
      {status && <p className="hint">✅ {status}</p>}
      {error && <p className="error">⚠️ {error}</p>}
    </Section>
  );
}
