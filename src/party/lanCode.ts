// Código de una partida «en casa»: 8 letras que llevan dentro la dirección del PC del DM en la Wi-Fi (IP privada y
// puerto) y una parte al azar. Así la app encuentra la partida solo con el código, sin Internet y sin escribir
// direcciones. Las partidas en la nube usan códigos de 6 letras (no llevan dirección).
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LAN_CODE_LENGTH = 8;
const BASE_PORT = 3000;
const PORT_BITS = 5;

/** Tipos de red privada: cuántos bits de la IP hay que guardar y cómo se rehace */
const KINDS = [
  { bits: 16, match: (p: number[]) => p[0] === 192 && p[1] === 168, pack: (p: number[]) => p[2] * 256 + p[3], unpack: (v: number) => [192, 168, Math.floor(v / 256), v % 256] },
  { bits: 24, match: (p: number[]) => p[0] === 10, pack: (p: number[]) => (p[1] * 256 + p[2]) * 256 + p[3], unpack: (v: number) => [10, Math.floor(v / 65536), Math.floor(v / 256) % 256, v % 256] },
  { bits: 20, match: (p: number[]) => p[0] === 172 && p[1] >= 16 && p[1] <= 31, pack: (p: number[]) => ((p[1] - 16) * 256 + p[2]) * 256 + p[3], unpack: (v: number) => [172, 16 + Math.floor(v / 65536), Math.floor(v / 256) % 256, v % 256] },
];
const TOTAL_BITS = LAN_CODE_LENGTH * 5;

const parts = (ip: string) => { const p = ip.split('.').map(Number); return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null; };

/** ¿Es una IP de red privada de casa (192.168.x.x, 10.x.x.x, 172.16-31.x.x)? */
export const isLanIp = (ip: string) => { const p = parts(ip); return !!p && KINDS.some((k) => k.match(p)); };

/** Código de 8 letras para esta IP y puerto (null si la IP no es de una red de casa o el puerto no cabe) */
export function lanCode(ip: string, port: number, rnd: () => number = Math.random): string | null {
  const p = parts(ip);
  const kind = p ? KINDS.findIndex((k) => k.match(p)) : -1;
  const off = port - BASE_PORT;
  if (!p || kind < 0 || off < 0 || off >= 2 ** PORT_BITS) return null;
  const k = KINDS[kind];
  const randBits = TOTAL_BITS - 2 - PORT_BITS - k.bits;
  // Números de hasta 40 bits: caben de sobra en un Number (sin operaciones de bits, que son de 32)
  let v = kind;
  v = v * 2 ** PORT_BITS + off;
  v = v * 2 ** k.bits + k.pack(p);
  v = v * 2 ** randBits + Math.floor(rnd() * 2 ** randBits);
  let out = '';
  for (let i = 0; i < LAN_CODE_LENGTH; i++) { out = ABC[v % 32] + out; v = Math.floor(v / 32); }
  return out;
}

/** La dirección (http://IP:PUERTO) que lleva dentro un código de partida en casa, o null si no es uno */
export function lanAddress(code: string): string | null {
  const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (c.length !== LAN_CODE_LENGTH) return null;
  let v = 0;
  for (const ch of c) { const d = ABC.indexOf(ch); if (d < 0) return null; v = v * 32 + d; }
  const kind = Math.floor(v / 2 ** (TOTAL_BITS - 2));
  const k = KINDS[kind];
  if (!k) return null;
  const randBits = TOTAL_BITS - 2 - PORT_BITS - k.bits;
  const rest = Math.floor(v / 2 ** randBits);
  const ip = k.unpack(rest % 2 ** k.bits);
  const port = BASE_PORT + Math.floor(rest / 2 ** k.bits) % 2 ** PORT_BITS;
  return `http://${ip.join('.')}:${port}`;
}
