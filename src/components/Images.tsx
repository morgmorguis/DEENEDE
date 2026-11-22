// Imágenes de la mesa: el DM las arrastra (o las elige), decide cuándo y con quién compartirlas, y a los
// jugadores les llegan como un aviso con la imagen; después pueden volver a verlas en «Partida».
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { createPortal } from 'react-dom';
import { useParty } from '../party/client';
import { httpBase } from '../party/client';
import type { ImageCategory, RoomView, SharedImage } from '../party/protocol';
import { IMAGE_CATEGORIES, categoryLabel } from '../imageCategories';
import { Modal, Section, pickFiles } from './common';
import { DoodleViewer } from './DoodleViewer';
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

/** Imagen a pantalla completa: zoom y pluma para garabatear encima (solo lo ve quien dibuja) */
export function ImageViewer({ image, onClose }: { image: SharedImage; onClose: () => void }) {
  const url = useImageUrl();
  return <DoodleViewer src={url(image.id)} title={image.title} doodleRef={`img:${image.id}`} onClose={onClose} />;
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
  const [cat, setCat] = useState<ImageCategory>('map');
  const upload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    setBusy((n) => n + imgs.length);
    for (const f of imgs) {
      try {
        const { data, w, h } = await compressImage(f);
        send({ t: 'imageAdd', title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80), data, w, h, category: cat });
      } catch { /* imagen que no se puede leer */ }
      setBusy((n) => n - 1);
    }
  };
  const nameOf = (id: string) => { const m = view.members.find((x) => x.id === id); return m?.summary?.name ?? m?.name ?? '?'; };
  const images = [...view.images].reverse();
  return (
    <Section title={T('🖼️ Imágenes para la mesa', '🖼️ Images for the table')}>
      <label className="field">{T('Categoría de lo que subas', 'Category for what you upload')}
        <select value={cat} onChange={(e) => setCat(e.target.value as ImageCategory)}>
          {IMAGE_CATEGORIES.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}
        </select>
      </label>
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
            <select className="img-cat" value={im.category ?? 'other'} aria-label={T('Categoría', 'Category')} onChange={(e) => send({ t: 'imageCategory', id: im.id, category: e.target.value as ImageCategory })}>
              {IMAGE_CATEGORIES.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}
            </select>
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
  const [cat, setCat] = useState<ImageCategory | ''>('');
  if (view.you.role !== 'player' || !view.images.length) return null;
  const all = [...view.images].sort((a, b) => (b.sharedAt ?? b.at) - (a.sharedAt ?? a.at));
  const cats = IMAGE_CATEGORIES.filter((k) => all.some((im) => (im.category ?? 'other') === k));
  const images = cat ? all.filter((im) => (im.category ?? 'other') === cat) : all;
  return (
    <Section title={T(`🖼️ Imágenes del DM (${all.length})`, `🖼️ Images from the DM (${all.length})`)}>
      {cats.length > 1 && (
        <div className="chips">
          <button className={`chip ${cat ? '' : 'on'}`} onClick={() => setCat('')}>{T('Todas', 'All')}</button>
          {cats.map((k) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{categoryLabel(k)}</button>)}
        </div>
      )}
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
    // Sin partida (ha salido o el DM la ha cerrado) no queda nada que enseñar desde el servidor
    if (!view) { setQueue([]); return; }
    if (view.you.role === 'dm') return;
    const seen = loadSeen(view.code);
    // Las que ya están guardadas en el diario de este dispositivo ya se vieron (aunque el código haya cambiado)
    const saved = new Set(useStore.getState().characters.flatMap((c) => c.notes.map((n) => n.ref)).filter(Boolean));
    const fresh = view.images.filter((im) => im.shared && !seen.includes(seenId(im)) && !saved.has(`img:${im.id}`));
    if (!fresh.length) return;
    saveSeen(view.code, [...seen, ...fresh.map(seenId)]);
    setQueue((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.id === f.id))]);
    try { navigator.vibrate?.([40, 30, 40]); } catch { /* sin vibración */ }
  }, [view]);
  const [big, setBig] = useState(false);
  const im = queue[0];
  if (!im) return null;
  const next = () => { setBig(false); setQueue((q) => q.slice(1)); };
  return createPortal(
    <div className="img-notice" role="alertdialog" aria-label={im.title}>
      <div className="img-notice-card">
        <div className="img-notice-top">
          <p className="img-notice-head grow">🖼️ {T('El DM comparte', 'The DM shares')}: <b>{im.title}</b></p>
          <button className="img-notice-x" onClick={next} aria-label={T('Cerrar', 'Close')}>✕</button>
        </div>
        <button className="plain img-notice-img" onClick={() => setBig(true)} title={T('Ver en grande', 'View large')}><img src={url(im.id)} alt={im.title} /></button>
        <div className="row">
          <button className="btn grow" onClick={() => setBig(true)}>🔍 {T('Ver en grande', 'View large')}</button>
          <button className="btn primary grow" onClick={next}>👍 {T('Visto', 'Got it')}</button>
        </div>
        {big && <ImageViewer image={im} onClose={() => setBig(false)} />}
        <p className="hint">{T('Queda guardada en tu diario → 🤝 Compartido conmigo, también cuando acabe la partida.', 'It’s kept in your journal → 🤝 Shared with me, also after the game ends.')}</p>
      </div>
    </div>,
    document.body,
  );
}
