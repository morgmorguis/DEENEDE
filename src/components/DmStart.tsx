// Pestaña Partida sin conectar: el DM crea una partida en la nube con un botón (sin clave ni PC) y vuelve a sus partidas desde «Mis partidas».
import { useState } from 'react';
import { DEFAULT_SERVER, ERRORS, useParty } from '../party/client';
import { EXPIRE_DAYS, createGame, forgetGame, gameExists, loadBackup, myGames, type MyGame } from '../party/myGames';
import { Section } from './common';
import { askOk } from './Confirm';
import { T, locale } from '../i18n';

const when = (ms?: number) => (ms ? new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export function DmStart({ server }: { server?: string }) {
  const connect = useParty((s) => s.connect);
  const [list, setList] = useState<MyGame[]>(() => myGames());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Sin dirección escrita: el servidor de esta página si admite partidas desde la app (la nube abierta en el navegador); si no, la nube
  const pickServer = async () => {
    if (server?.trim()) return server.trim();
    try {
      const j = await fetch(`${window.location.origin}/api/info`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json()) as { app?: string; multi?: boolean };
      if (j.app === 'di-en-di' && j.multi) return window.location.origin;
    } catch { /* la app instalada o la de Windows no tienen servidor detrás */ }
    return DEFAULT_SERVER;
  };
  const enter = (g: MyGame) => connect({ url: g.url, code: '', name: 'DM', dmKey: g.dmKey });
  const fail = (code: string) => setErr(ERRORS[code] ? T(...ERRORS[code]) : code);

  const create = async () => {
    setErr(null); setBusy('new');
    const r = await createGame(await pickServer());
    setBusy(null);
    if ('error' in r) { fail(r.error === 'no-server' ? 'no-server' : r.error); return; }
    setList(myGames());
    enter(r);
  };

  const open = async (g: MyGame) => {
    setErr(null); setBusy(g.dmKey);
    const ok = await gameExists(g);
    if (ok) { setBusy(null); enter(g); return; }
    if (ok === null) { setBusy(null); fail('no-server'); return; }
    // Ya no está en la nube: se restaura con la copia de este dispositivo (misma clave, código nuevo)
    const backup = await loadBackup(g.dmKey);
    if (!backup) { setBusy(null); fail('unknown-game'); return; }
    if (!(await askOk(T('Esta partida se borró de la nube', 'This game was deleted from the cloud'), { text: T(`Llevaba más de ${EXPIRE_DAYS} días sin usarse. Tienes una copia en este dispositivo (${when(g.backupAt)}) con los lugares, personajes, tesoro, imágenes y registro. ¿La restauro? Tendrá un código nuevo para los jugadores.`, `It hadn’t been used for over ${EXPIRE_DAYS} days. You have a backup on this device (${when(g.backupAt)}) with places, characters, treasure, images and log. Restore it? It will get a new code for the players.`), ok: T('♻️ Restaurar', '♻️ Restore') }))) { setBusy(null); return; }
    const r = await createGame(g.url, { dmKey: g.dmKey, campaign: backup });
    setBusy(null);
    if ('error' in r) { fail(r.error); return; }
    setList(myGames());
    enter(r);
  };

  return (
    <Section title={T('🎲 Soy el DM', '🎲 I’m the DM')}>
      <p className="small">{T(`Crea la partida en la nube con un botón: te da un código y tus jugadores entran solo con él, desde la app o el navegador. No hace falta PC ni clave. Si una partida pasa ${EXPIRE_DAYS} días sin usarse se borra de la nube, pero este dispositivo guarda una copia para recuperarla.`, `Create the game in the cloud with one button: you get a code and your players join with just that, from the app or the browser. No PC or key needed. If a game goes ${EXPIRE_DAYS} days unused it’s deleted from the cloud, but this device keeps a backup to bring it back.`)}</p>
      <button className="btn primary full big" disabled={!!busy} onClick={() => void create()}>{busy === 'new' ? `⏳ ${T('Creando…', 'Creating…')}` : `🎲 ${T('Crear partida', 'Create game')}`}</button>
      {list.length > 0 && (
        <>
          <span className="p-mini">{T('Mis partidas', 'My games')}</span>
          <ul className="my-games">
            {[...list].reverse().map((g) => (
              <li key={g.dmKey} className="row">
                <span className="grow small">
                  <b>{g.code ?? '——'}</b> · {T('creada', 'created')} {when(g.createdAt)}
                  <br /><span className="muted">{g.backupAt ? T(`💾 copia ${when(g.backupAt)}`, `💾 backup ${when(g.backupAt)}`) : T('sin copia aún', 'no backup yet')}{g.url !== DEFAULT_SERVER ? ` · ${g.url}` : ''}</span>
                </span>
                <button className="btn small primary" disabled={!!busy} onClick={() => void open(g)}>{busy === g.dmKey ? '⏳' : T('Entrar', 'Enter')}</button>
                <button className="btn small" aria-label={T('Quitar de la lista', 'Remove from the list')} title={T('Quitar de la lista', 'Remove from the list')} onClick={async () => { if (await askOk(T('¿Quitar esta partida de la lista?', 'Remove this game from the list?'), { text: T('Sin su clave no podrás volver a entrar como DM desde este dispositivo (salvo con tu enlace de DM).', 'Without its key you won’t be able to enter as DM from this device again (except with your DM link).'), danger: true })) { forgetGame(g.dmKey); setList(myGames()); } }}>🗑️</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {err && <p className="error">⚠️ {err}</p>}
    </Section>
  );
}
