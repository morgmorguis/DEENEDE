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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startNative(lang: string, cb: Callbacks): Promise<Recorder> {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error(T('El reconocimiento de voz no está disponible en este dispositivo.', 'Speech recognition isn’t available on this device.'));
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error(T('Necesito permiso de micrófono para grabar.', 'I need microphone permission to record.'));

  let running = true;
  let starting = false;
  let committed = '';
  let partial = '';

  const commit = () => {
    if (partial.trim()) committed = `${committed} ${partial.trim()}`.trim();
    partial = '';
  };

  const listen = async () => {
    if (!running || starting) return;
    starting = true;
    try {
      await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 });
    } catch {
      // Los silencios largos dan error en Android: el vigilante de abajo vuelve a empezar
    } finally {
      starting = false;
    }
  };

  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener('partialResults', (data) => {
    if (!running) return;
    partial = data.matches?.[0] ?? '';
    cb.onText(committed, partial);
  });
  await SpeechRecognition.addListener('listeningState', (data) => {
    if (data.status === 'stopped' && running) {
      commit();
      cb.onText(committed, '');
      setTimeout(() => void listen(), 250);
    }
  });

  // Vigilante: tras un silencio largo Android corta la escucha con un error y el plugin no avisa,
  // así que comprobamos cada poco si sigue escuchando y, si no, la reanudamos.
  const watchdog = setInterval(async () => {
    if (!running || starting) return;
    try {
      const { listening } = await SpeechRecognition.isListening();
      if (!listening && running) {
        commit();
        cb.onText(committed, '');
        void listen();
      }
    } catch {
      /* ignorado */
    }
  }, 1500);

  void listen();

  return {
    stop: async () => {
      running = false;
      clearInterval(watchdog);
      commit();
      // El stop() del plugin de Android nunca responde: no lo esperamos más de un momento
      await Promise.race([SpeechRecognition.stop().catch(() => undefined), sleep(400)]);
      void SpeechRecognition.removeAllListeners();
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
