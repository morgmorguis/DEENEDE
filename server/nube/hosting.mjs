// Dirección corta en Firebase Hosting (https://PROYECTO.web.app) para el servidor de Cloud Run.
// Hosting no deja pasar el WebSocket de la partida, así que solo publica dos archivos:
//   /servidor.json → { "url": "https://….run.app" } (la app lo lee al conectarse a la dirección corta)
//   /index.html    → lleva el navegador al servidor real conservando ?join=… / ?dm=…
// Usa la API REST de Hosting con el token de gcloud (sin firebase-tools ni otro inicio de sesión).
// Uso: GCLOUD_TOKEN=$(gcloud auth print-access-token) node server/nube/hosting.mjs PROYECTO https://….run.app
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const [project, realUrl] = process.argv.slice(2);
const token = process.env.GCLOUD_TOKEN;
if (!project || !/^https:\/\//.test(realUrl ?? '') || !token) {
  console.error('Uso: GCLOUD_TOKEN=… node server/nube/hosting.mjs PROYECTO https://servidor.run.app');
  process.exit(2);
}
const target = realUrl.replace(/\/+$/, '');
const API = 'https://firebasehosting.googleapis.com/v1beta1';
const site = project;

async function call(method, url, body, extra = {}) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Di en Di</title>
<style>body{background:#1b1410;color:#e9dcc3;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#e0a64a}</style>
<script>location.replace(${JSON.stringify(target)} + location.pathname + location.search + location.hash);</script>
</head><body><p>🎲 Entrando en Di en Di… <a href="${target}">${target}</a></p></body></html>
`;
const files = {
  '/index.html': html,
  '/servidor.json': JSON.stringify({ app: 'di-en-di', url: target }) + '\n',
};

// El sitio por defecto del proyecto (PROYECTO.web.app); se crea si aún no existe
try {
  await call('GET', `${API}/projects/${project}/sites/${site}`);
} catch {
  await call('POST', `${API}/projects/${project}/sites?siteId=${site}`, {});
}

const version = await call('POST', `${API}/sites/${site}/versions`, {
  config: {
    headers: [{ glob: '/servidor.json', headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' } }],
    rewrites: [{ glob: '**', path: '/index.html' }],
  },
});
const gz = Object.fromEntries(Object.entries(files).map(([p, text]) => [p, gzipSync(Buffer.from(text, 'utf8'))]));
const hashes = Object.fromEntries(Object.entries(gz).map(([p, b]) => [p, createHash('sha256').update(b).digest('hex')]));
const pop = await call('POST', `${API}/${version.name}:populateFiles`, { files: hashes });
for (const h of pop.uploadRequiredHashes ?? []) {
  const p = Object.keys(hashes).find((k) => hashes[k] === h);
  await call('POST', `${pop.uploadUrl}/${h}`, gz[p], { 'Content-Type': 'application/octet-stream' });
}
await call('PATCH', `${API}/${version.name}?update_mask=status`, { status: 'FINALIZED' });
await call('POST', `${API}/sites/${site}/releases?versionName=${encodeURIComponent(version.name)}`, {});
console.log(`Dirección corta publicada: https://${site}.web.app → ${target}`);
