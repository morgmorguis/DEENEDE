// Publicar el servidor en Internet al arrancar, con una dirección fija (DNS) y HTTPS, sin Cloudflare.
// - tailscale (por defecto si está instalado): Tailscale Funnel → https://tu-pc.tuXXXX.ts.net
// - ngrok: dominio estático gratis de ngrok → https://tu-nombre.ngrok-free.app
// - no: solo red local (como siempre)
// La red local sigue funcionando en todos los casos.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';

export type PublishMode = 'tailscale' | 'ngrok' | 'no';

export interface PublishConfig {
  /** tailscale | ngrok | no */
  publicar: PublishMode | 'auto';
  /** Para ngrok: el dominio estático gratuito (p. ej. «mi-partida.ngrok-free.app») */
  ngrokDominio?: string;
}

export interface PublishState {
  mode: PublishMode;
  url: string | null;
  status: 'off' | 'starting' | 'on' | 'error';
  message: string;
}

const DEFAULT: PublishConfig = { publicar: 'auto' };

export function loadConfig(dir: string): { config: PublishConfig; file: string } {
  const file = path.join(dir, 'di-en-di-servidor.json');
  try {
    return { config: { ...DEFAULT, ...JSON.parse(fs.readFileSync(file, 'utf8')) }, file };
  } catch {
    // Primera vez: dejamos el archivo de ejemplo para que el DM pueda cambiarlo
    try {
      fs.writeFileSync(file, JSON.stringify({
        publicar: 'auto',
        ngrokDominio: '',
        _ayuda: 'publicar: "auto" (Tailscale si está instalado), "tailscale", "ngrok" o "no" (solo red local). Para ngrok pon tu dominio estático gratuito en ngrokDominio.',
      }, null, 2));
    } catch { /* sin permiso de escritura */ }
    return { config: DEFAULT, file };
  }
}

const run = (cmd: string, args: string[], timeout = 20000) => new Promise<{ ok: boolean; out: string }>((resolve) => {
  execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }));
});

/** Busca un programa en el PATH o en su carpeta de instalación habitual */
function findExe(name: string, extra: string[]): string | null {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), ...extra];
  for (const d of dirs) for (const e of exts) {
    const p = path.join(d, name + e);
    try { if (d && fs.existsSync(p) && fs.statSync(p).isFile()) return p; } catch { /* sigue */ }
  }
  return null;
}

const tailscaleExe = () => findExe('tailscale', [
  'C:\\Program Files\\Tailscale', 'C:\\Program Files (x86)\\Tailscale', '/usr/bin', '/usr/local/bin', '/Applications/Tailscale.app/Contents/MacOS',
]);
const ngrokExe = (dir: string) => findExe('ngrok', [dir, path.join(process.env.LOCALAPPDATA ?? '', 'ngrok'), 'C:\\ngrok', '/usr/local/bin']);

let child: ChildProcess | null = null;
let startedTailscale: string | null = null;

/** Arranca la publicación según la configuración. `onChange` se llama cada vez que cambia el estado */
export async function startPublishing(port: number, dir: string, onChange: (s: PublishState) => void): Promise<PublishState> {
  const { config, file } = loadConfig(dir);
  const ts = tailscaleExe();
  let mode: PublishMode = config.publicar === 'auto' ? (ts ? 'tailscale' : 'no') : config.publicar;
  if (!['tailscale', 'ngrok', 'no'].includes(mode)) mode = 'no';
  const set = (s: Omit<PublishState, 'mode'>) => { const st = { mode, ...s }; onChange(st); return st; };

  if (mode === 'no') {
    return set({ url: null, status: 'off', message: config.publicar === 'auto'
      ? `Solo red local. Para jugar a distancia instala Tailscale (gratis) o configura ngrok en ${file}.`
      : 'Solo red local (publicar: "no").' });
  }

  if (mode === 'tailscale') {
    if (!ts) return set({ url: null, status: 'error', message: 'No encuentro Tailscale. Instálalo desde https://tailscale.com/download e inicia sesión.' });
    set({ url: null, status: 'starting', message: 'Abriendo Tailscale Funnel…' });
    // --bg: queda activo en segundo plano; lo quitamos al cerrar el servidor
    // Destino explícito 127.0.0.1 (el servidor ya ha comprobado que es él quien responde ahí)
    const r = await run(ts, ['funnel', '--bg', `http://127.0.0.1:${port}`], 30000);
    if (!r.ok) {
      const hint = /funnel.*not enabled|Funnel is not enabled|admin|https/i.test(r.out)
        ? ' Activa «HTTPS Certificates» y «Funnel» en la consola de Tailscale (te da el enlace la primera vez) y vuelve a abrir el servidor.' : '';
      return set({ url: null, status: 'error', message: `Tailscale Funnel no se ha podido abrir.${hint}\n${r.out.trim().slice(0, 400)}` });
    }
    startedTailscale = ts;
    const st = await run(ts, ['status', '--json']);
    let url: string | null = null;
    try { const name = String(JSON.parse(st.out).Self?.DNSName ?? '').replace(/\.$/, ''); if (name) url = `https://${name}`; } catch { /* sin nombre */ }
    const m = r.out.match(/https:\/\/[^\s]+\.ts\.net/);
    url = url ?? (m ? m[0].replace(/\/$/, '') : null);
    return set({ url, status: url ? 'on' : 'error', message: url ? 'Publicado con Tailscale Funnel (HTTPS, dirección fija).' : 'Funnel activo, pero no he podido leer la dirección: mírala con «tailscale funnel status».' });
  }

  // ngrok
  const exe = ngrokExe(dir);
  if (!exe) return set({ url: null, status: 'error', message: 'No encuentro ngrok. Descárgalo de https://ngrok.com/download, ejecuta una vez «ngrok config add-authtoken TU_TOKEN» y deja ngrok.exe junto al servidor.' });
  const domain = (config.ngrokDominio ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain) return set({ url: null, status: 'error', message: `Pon tu dominio estático gratuito de ngrok en «ngrokDominio» de ${file}.` });
  set({ url: null, status: 'starting', message: 'Abriendo ngrok…' });
  child = spawn(exe, ['http', `--url=${domain}`, String(port), '--log=stdout'], { windowsHide: true });
  return new Promise((resolve) => {
    let done = false;
    const finish = (s: PublishState) => { if (!done) { done = true; resolve(s); } };
    child!.stdout?.on('data', (d) => {
      const t = String(d);
      if (/started tunnel|url=https/.test(t)) finish(set({ url: `https://${domain}`, status: 'on', message: 'Publicado con ngrok (HTTPS, dominio fijo).' }));
      if (/ERR_NGROK|error/i.test(t) && !done) finish(set({ url: null, status: 'error', message: `ngrok: ${t.trim().slice(0, 300)}` }));
    });
    child!.on('exit', (code) => { if (!done) finish(set({ url: null, status: 'error', message: `ngrok se ha cerrado (código ${code}). Revisa el authtoken y el dominio.` })); });
    setTimeout(() => finish(set({ url: `https://${domain}`, status: 'on', message: 'ngrok arrancado (comprueba que el dominio responde).' })), 8000);
  });
}

/** Al cerrar el servidor: quitar el túnel que abrimos */
export async function stopPublishing() {
  if (child) { try { child.kill(); } catch { /* ya cerrado */ } child = null; }
  if (startedTailscale) { await run(startedTailscale, ['funnel', 'reset'], 8000); startedTailscale = null; }
}
