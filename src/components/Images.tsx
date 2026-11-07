// Imágenes de la mesa: el DM las arrastra (o las elige), decide cuándo y con quién compartirlas, y a los
// jugadores les llegan como un aviso con la imagen; después pueden volver a verlas en «Partida».
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParty } from '../party/client';
import { httpBase } from '../party/client';
import type { RoomView, SharedImage } from '../party/protocol';
import { Modal, Section, pickFiles } from './common';
import { askText, confirmDelete } from './Confirm';
import { T, locale } from '../i18n';

/** Dirección de una imagen para este cliente (con su token: el servidor comprueba que puede verla) */
export function useImageUrl() {
  const conn = useParty((s) => s.conn);
  return (id: string) => `${httpBase(conn?.url)}/img/${id}.jpg?t=${encodeURIComponent(conn?.token ?? '')}`;
}

export { compressImage } from '../imageUtil';
import { compressImage } from '../imageUtil';

const when = (ms: number) => new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Imagen a pantalla completa */
export function ImageViewer({ image, onClose }: { image: SharedImage; onClose: () => void }) {
  const url = useImageUrl();
  return createPortal(
    <div className="img-viewer" onClick={onClose} role="dialog" aria-label={image.title}>
      <img src={url(image.id)} alt={image.title} />
      <div className="img-viewer-bar"><b>{image.title}</b><button className="btn small" onClick={onClose}>✕ {T('Cerrar', 'Close')}</button></div>
    </div>,
    document.body,
  );
}

function ShareModal({ view, image, onClose }: { view: RoomView; image: SharedImage; onClose: () => void }) {
  const send = useParty((s) => s.send);
  const players = view.members.filter((m) => m.role === 'player');
  const [sel, setSel] = useState<string[]>(image.to === 'all' ? players.map((m) => m.id) : image.to);
  return (
    <Modal title={T(`Compartir «${image.title}»`, `Share “${image.title}”`)} onClose={onClose}>
      <button className="btn primary full" onClick={() => { send({ t: 'imageShare', id: image.id, to: 'all' }); onClose(); }}>👥 {T('Con todos (y la tele)', 'With everyone (and the TV)')}</button>
      <span className="p-mini">{T('Solo con…', 'Only with…')}</span>
      {players.map((m) => (
        <label key={m.id} className="check"><input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} /> {m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</label>
      ))}
      <button className="btn full" disabled={!sel.length} onClick={() => { send({ t: 'imageShare', id: image.id, to: sel }); onClose(); }}>🔒 {T(`Compartir solo con ${sel.length}`, `Share only with ${sel.length}`)}</button>
      <p className="hint">{T('A quien la reciba le saldrá un aviso con la imagen. Podrá volver a verla en «Partida».', 'Whoever gets it sees a notice with the image. They can view it again in “Game”.')}</p>
    </Modal>
  );
}

/** DM: subir imágenes arrastrándolas y compartirlas cuando quiera */
export function DmImages({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const url = useImageUrl();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [share, setShare] = useState<SharedImage | null>(null);
  const [show, setShow] = useState<SharedImage | null>(null);
  const upload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    setBusy((n) => n + imgs.length);
    for (const f of imgs) {
      try {
        const { data, w, h } = await compressImage(f);
        send({ t: 'imageAdd', title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80), data, w, h });
      } catch { /* imagen que no se puede leer */ }
      setBusy((n) => n - 1);
    }
  };
  const nameOf = (id: string) => { const m = view.members.find((x) => x.id === id); return m?.summary?.name ?? m?.name ?? '?'; };
  const images = [...view.images].reverse();
  return (
    <Section title={T('🖼️ Imágenes para la mesa', '🖼️ Images for the table')}>
      <div
        className={`drop-zone ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void upload([...e.dataTransfer.files]); }}
        onClick={async () => void upload(await pickFiles('image/*', true))}
        role="button" tabIndex={0}
      >
        <b>⬇️ {T('Arrastra aquí mapas, retratos o pistas', 'Drag maps, portraits or clues here')}</b>
        <span className="small muted">{T('o toca para elegirlas. No las ve nadie hasta que las compartas.', 'or tap to choose them. Nobody sees them until you share them.')}</span>
        {busy > 0 && <span className="small">⏳ {T(`Subiendo ${busy}…`, `Uploading ${busy}…`)}</span>}
      </div>
      <div className="img-grid">
        {images.map((im) => (
          <div key={im.id} className={`img-card ${im.shared ? 'shared' : ''}`}>
            <button className="plain img-thumb" onClick={() => setShow(im)}><img src={url(im.id)} alt={im.title} loading="lazy" /></button>
            <button className="plain img-title" onClick={async () => { const t = await askText(T('Título de la imagen', 'Image title'), im.title); if (t) send({ t: 'imageRename', id: im.id, title: t }); }}>{im.title} ✏️</button>
            <span className="tiny muted">{im.shared ? (im.to === 'all' ? T('👥 Compartida con todos', '👥 Shared with everyone') : `🔒 ${im.to.map(nameOf).join(', ')}`) : T('🙈 Solo tú', '🙈 Only you')}</span>
            <div className="row">
              <button className={`btn small grow ${im.shared ? '' : 'primary'}`} onClick={() => setShare(im)}>📤 {im.shared ? T('Cambiar', 'Change') : T('Compartir', 'Share')}</button>
              {im.shared && <button className="btn small" title={T('Dejar de compartir', 'Stop sharing')} onClick={() => send({ t: 'imageUnshare', id: im.id })}>🙈</button>}
              <button className="btn small" aria-label={T('Borrar', 'Delete')} onClick={async () => { if (await confirmDelete(im.title)) send({ t: 'imageRemove', id: im.id }); }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {share && <ShareModal view={view} image={share} onClose={() => setShare(null)} />}
      {show && <ImageViewer image={show} onClose={() => setShow(null)} />}
    </Section>
  );
}

const seenKey = (code: string) => `di-en-di-seen-images-${code}`;
const loadSeen = (code: string): string[] => { try { return JSON.parse(localStorage.getItem(seenKey(code)) ?? '[]'); } catch { return []; } };
const saveSeen = (code: string, ids: string[]) => { try { localStorage.setItem(seenKey(code), JSON.stringify(ids.slice(-300))); } catch { /* sin almacenamiento */ } };
/** Clave de «visto» de una imagen (si el DM la vuelve a compartir, cuenta como nueva) */
const seenId = (im: SharedImage) => `${im.id}@${im.sharedAt ?? 0}`;

/** Jugador: las imágenes que el DM le ha compartido */
export function SharedGallery({ view }: { view: RoomView }) {
  const url = useImageUrl();
  const [show, setShow] = useState<SharedImage | null>(null);
  if (view.you.role !== 'player' || !view.images.length) return null;
  const images = [...view.images].sort((a, b) => (b.sharedAt ?? b.at) - (a.sharedAt ?? a.at));
  return (
    <Section title={T(`🖼️ Imágenes del DM (${images.length})`, `🖼️ Images from the DM (${images.length})`)}>
      <div className="img-grid">
        {images.map((im) => (
          <button key={im.id} className="plain img-card" onClick={() => setShow(im)}>
            <span className="img-thumb"><img src={url(im.id)} alt={im.title} loading="lazy" /></span>
            <span className="img-title">{im.title}</span>
            <span className="tiny muted">{when(im.sharedAt ?? im.at)}</span>
          </button>
        ))}
      </div>
      {show && <ImageViewer image={show} onClose={() => setShow(null)} />}
    </Section>
  );
}

/** Aviso global: cuando el DM comparte una imagen nueva, aparece encima de lo que estés haciendo */
export function ImageNotifier() {
  const view = useParty((s) => s.view);
  const url = useImageUrl();
  const [queue, setQueue] = useState<SharedImage[]>([]);
  useEffect(() => {
    if (!view || view.you.role === 'dm') return;
    const seen = loadSeen(view.code);
    const fresh = view.images.filter((im) => im.shared && !seen.includes(seenId(im)));
    if (!fresh.length) return;
    saveSeen(view.code, [...seen, ...fresh.map(seenId)]);
    setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.id === f.id))]);
    try { navigator.vibrate?.([40, 30, 40]); } catch { /* sin vibración */ }
  }, [view]);
  const im = queue[0];
  if (!im) return null;
  const next = () => setQueue((q) => q.slice(1));
  return createPortal(
    <div className="img-notice" role="alertdialog" aria-label={im.title}>
      <div className="img-notice-card">
        <p className="img-notice-head">🖼️ {T('El DM comparte', 'The DM shares')}: <b>{im.title}</b></p>
        <img src={url(im.id)} alt={im.title} />
        <div className="row">
          <button className="btn primary grow" onClick={next}>👍 {T('Visto', 'Got it')}</button>
        </div>
        <p className="hint">{T('Puedes volver a verla en Partida → Imágenes del DM.', 'You can view it again in Game → Images from the DM.')}</p>
      </div>
    </div>,
    document.body,
  );
}
