// Reconocimiento de voz continuo: plugin nativo en Android, Web Speech API en navegador.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { T } from './i18n';

export interface Recorder {
  stop: () => Promise<string>;
}

interface Callbacks {
  onText: (fullText: string, partial: string) => void;
  onError: (msg: string) => void;
}

/**
 * Empieza a escuchar. El reconocimiento de Android se detiene tras unos segundos de silencio,
 * así que lo reiniciamos automáticamente hasta que el usuario pulse "parar".
 */
export async function startRecording(lang: string, cb: Callbacks): Promise<Recorder> {
  if (Capacitor.isNativePlatform()) return startNative(lang, cb);
  return startWeb(lang, cb);
}

async function startNative(lang: string, cb: Callbacks): Promise<Recorder> {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error(T('El reconocimiento de voz no está disponible en este dispositivo.', 'Speech recognition isn’t available on this device.'));
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error(T('Necesito permiso de micrófono para grabar.', 'I need microphone permission to record.'));

  let running = true;
  let committed = '';
  let partial = '';

  const commit = () => {
    if (partial.trim()) committed = `${committed} ${partial.trim()}`.trim();
    partial = '';
  };

  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener('partialResults', (data) => {
    partial = data.matches?.[0] ?? '';
    cb.onText(committed, partial);
  });
  await SpeechRecognition.addListener('listeningState', (data) => {
    if (data.status === 'stopped') {
      commit();
      cb.onText(committed, '');
      if (running) setTimeout(() => void listen(), 250);
    }
  });

  const listen = async () => {
    if (!running) return;
    try {
      await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 });
    } catch (e) {
      // "No match" y similares ocurren con silencios: reintentamos
      if (running) setTimeout(() => void listen(), 500);
      else cb.onError(String(e));
    }
  };
  void listen();

  return {
    stop: async () => {
      running = false;
      try {
        await SpeechRecognition.stop();
      } catch {
        /* ya estaba parado */
      }
      commit();
      await SpeechRecognition.removeAllListeners();
      return committed;
    },
  };
}

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function startWeb(lang: string, cb: Callbacks): Promise<Recorder> {
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error(T('Este navegador no soporta reconocimiento de voz (prueba con Chrome o con la app de Android).', 'This browser doesn’t support speech recognition (try Chrome or the Android app).')));
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  let running = true;
  let committed = '';
  rec.onresult = (ev) => {
    let partial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) committed = `${committed} ${r[0].transcript.trim()}`.trim();
      else partial += r[0].transcript;
    }
    cb.onText(committed, partial);
  };
  rec.onerror = (ev) => {
    if (ev.error === 'not-allowed') {
      running = false;
      cb.onError(T('Permiso de micrófono denegado.', 'Microphone permission denied.'));
    }
  };
  rec.onend = () => {
    if (running) rec.start();
  };
  rec.start();
  return Promise.resolve({
    stop: async () => {
      running = false;
      rec.stop();
      await new Promise((r) => setTimeout(r, 400));
      return committed;
    },
  });
}
