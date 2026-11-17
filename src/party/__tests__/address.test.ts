// Direcciones del servidor: HTTPS automático en servicios públicos y direcciones cortas que apuntan al servidor real.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpBase, resolveServer, wsUrl } from '../client';

afterEach(() => { vi.unstubAllGlobals(); });

describe('direcciones del servidor', () => {
  it('pone https en Cloud Run y Firebase aunque no se escriba', () => {
    expect(wsUrl('di-en-di-abc-no.a.run.app')).toBe('wss://di-en-di-abc-no.a.run.app/ws');
    expect(httpBase('di-en-di.web.app')).toBe('https://di-en-di.web.app');
    expect(wsUrl('192.168.1.20:3000')).toBe('ws://192.168.1.20:3000/ws');
  });

  it('una dirección corta da la del servidor real con /servidor.json', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: 'https://di-en-di-abc-no.a.run.app/' })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveServer('di-en-di.web.app')).toBe('https://di-en-di-abc-no.a.run.app');
    expect(fetchMock).toHaveBeenCalledWith('https://di-en-di.web.app/servidor.json', expect.anything());
  });

  it('sin /servidor.json, o en la red local, se queda la dirección escrita', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200 })));
    expect(await resolveServer('https://pc.tail1234.ts.net')).toBeNull();
    const local = vi.fn();
    vi.stubGlobal('fetch', local);
    expect(await resolveServer('192.168.1.20:3000')).toBeNull();
    expect(local).not.toHaveBeenCalled();
  });
});
