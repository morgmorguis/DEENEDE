import { describe, expect, it, vi } from 'vitest';

// Simula el plugin nativo de Android tal como se comporta: stop() nunca responde
// y tras un silencio deja de escuchar sin avisar.
const listeners: Record<string, (d: unknown) => void> = {};
let listening = false;
const plugin = {
  available: vi.fn(async () => ({ available: true })),
  requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
  removeAllListeners: vi.fn(async () => undefined),
  addListener: vi.fn(async (name: string, fn: (d: unknown) => void) => { listeners[name] = fn; return { remove: async () => undefined }; }),
  start: vi.fn(async () => { listening = true; }),
  stop: vi.fn(() => new Promise<void>(() => { listening = false; })),
  isListening: vi.fn(async () => ({ listening })),
};
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: plugin }));

describe('grabación de voz en Android', () => {
  it('parar responde aunque el plugin no conteste y devuelve el texto', async () => {
    const { startRecording } = await import('../speech');
    const texts: string[] = [];
    const rec = await startRecording('es-ES', { onText: (full, partial) => texts.push(`${full}|${partial}`), onError: () => undefined });
    listeners.partialResults({ matches: ['un goblin me ataca'] });
    const t0 = Date.now();
    const final = await rec.stop();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(final).toBe('un goblin me ataca');
  });

  it('reanuda la escucha tras un silencio y acumula el texto', async () => {
    vi.useFakeTimers();
    const { startRecording } = await import('../speech');
    const rec = await startRecording('es-ES', { onText: () => undefined, onError: () => undefined });
    await vi.advanceTimersByTimeAsync(10);
    listeners.partialResults({ matches: ['primera frase'] });
    const starts = plugin.start.mock.calls.length;
    listening = false; // Android corta por silencio sin avisar
    await vi.advanceTimersByTimeAsync(1600);
    expect(plugin.start.mock.calls.length).toBe(starts + 1);
    listeners.partialResults({ matches: ['segunda frase'] });
    const stopping = rec.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(await stopping).toBe('primera frase segunda frase');
    vi.useRealTimers();
  });
});
