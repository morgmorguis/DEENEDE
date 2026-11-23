import { describe, expect, it } from 'vitest';
import { isLanIp, lanAddress, lanCode } from '../lanCode';

describe('código de partida en casa', () => {
  it('lleva dentro la IP y el puerto del PC', () => {
    for (const [ip, port] of [['192.168.1.18', 3000], ['192.168.0.255', 3031], ['10.0.0.5', 3002], ['10.255.254.1', 3000], ['172.16.0.1', 3000], ['172.31.200.7', 3010]] as const) {
      for (let i = 0; i < 20; i++) {
        const code = lanCode(ip, port)!;
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
        expect(lanAddress(code)).toBe(`http://${ip}:${port}`);
      }
    }
  });
  it('cambia cada vez (parte al azar)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => lanCode('192.168.1.18', 3000)));
    expect(codes.size).toBeGreaterThan(40);
  });
  it('no vale para IP públicas, de Tailscale ni puertos lejanos', () => {
    expect(lanCode('100.66.125.66', 3000)).toBeNull();
    expect(lanCode('8.8.8.8', 3000)).toBeNull();
    expect(lanCode('192.168.1.18', 4000)).toBeNull();
    expect(isLanIp('172.32.0.1')).toBe(false);
    expect(isLanIp('192.168.1.18')).toBe(true);
  });
  it('los códigos de la nube (6 letras) no son de casa', () => {
    expect(lanAddress('M2Z9HG')).toBeNull();
    expect(lanAddress('ABCD-EFGH')).not.toBeNull();
  });
});
