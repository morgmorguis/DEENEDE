// Imagen a pantalla completa con zoom y garabatos propios (pluma con tres colores): lo que dibujas solo lo ves tú y se guarda en este dispositivo.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loadFile, removeFile, saveFile } from '../export/templateStore';
import { T } from '../i18n';

/** Colores de la pluma: negro, verde y azul */
const INKS = [
  { id: 'black', color: '#111111', name: () => T('Negro', 'Black') },
  { id: 'green', color: '#15803d', name: () => T('Verde', 'Green') },
  { id: 'blue', color: '#1d4ed8', name: () => T('Azul', 'Blue') },
] as const;

/** Clave en IndexedDB del garabato de una imagen ('img:<id>' → 'garabato/img:<id>') */
const doodleKey = (ref: string) => `garabato/${ref}`;

/** El garabato se dibuja a la resolución de la imagen, con un tope para no gastar memoria en fotos enormes */
const MAX_SIDE = 2400;

type Stroke = { color: string; width: number; pts: [number, number][] };

export function DoodleViewer({ src, title, doodleRef, onClose, extra }: { src: string; title: string; doodleRef: string; onClose: () => void; extra?: ReactNode }) {
  const [zoom, setZoom] = useState(false);
  const [pen, setPen] = useState(false);
  const [ink, setInk] = useState<string>(INKS[0].color);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLImageElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const [count, setCount] = useState(0);
  const dirty = useRef(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const redraw = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (base.current) ctx.drawImage(base.current, 0, 0, cv.width, cv.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of [...strokes.current, ...(drawing.current ? [drawing.current] : [])]) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      ctx.stroke();
    }
  }, []);

  // El garabato guardado de esta imagen (si lo hay)
  useEffect(() => {
    if (!size) return;
    let url: string | null = null;
    void loadFile(doodleKey(doodleRef)).then((buf) => {
      if (!buf) { redraw(); return; }
      url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      const im = new Image();
      im.onload = () => { base.current = im; redraw(); };
      im.src = url;
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [size, doodleRef, redraw]);

  const save = useCallback(async () => {
    const cv = canvas.current;
    if (!cv || !dirty.current) return;
    dirty.current = false;
    if (!base.current && !strokes.current.length) { await removeFile(doodleKey(doodleRef)).catch(() => undefined); return; }
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
    if (blob) await saveFile(doodleKey(doodleRef), await blob.arrayBuffer()).catch(() => undefined);
  }, [doodleRef]);

  // Se guarda al cerrar (y al soltar cada trazo, un momento después)
  useEffect(() => () => { void save(); }, [save]);
  const close = () => { void save(); onClose(); };

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * e.currentTarget.width) / r.width, ((e.clientY - r.top) * e.currentTarget.height) / r.height];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pen) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cv = e.currentTarget;
    drawing.current = { color: ink, width: Math.max(3, Math.round(Math.max(cv.width, cv.height) / 300)), pts: [point(e)] };
    redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.pts.push(point(e));
    redraw();
  };
  const up = () => {
    if (!drawing.current) return;
    strokes.current.push(drawing.current);
    drawing.current = null;
    dirty.current = true;
    setCount(strokes.current.length);
    redraw();
    window.setTimeout(() => void save(), 400);
  };
  const undo = () => { strokes.current.pop(); dirty.current = true; setCount(strokes.current.length); redraw(); void save(); };
  const clear = () => { strokes.current = []; base.current = null; dirty.current = true; setCount(0); redraw(); void save(); };

  return createPortal(
    <div className={`img-viewer ${zoom ? 'zoom' : ''} ${pen ? 'pen' : ''}`} role="dialog" aria-label={title}>
      <button className="img-viewer-x" onClick={close} aria-label={T('Cerrar', 'Close')}>✕</button>
      <div className="img-viewer-pane" onClick={() => { if (!pen) setZoom(!zoom); }}>
        <div className="doodle-wrap">
          <img src={src} alt={title} draggable={false} onLoad={(e) => {
            const im = e.currentTarget; const k = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
            setSize({ w: Math.round(im.naturalWidth * k), h: Math.round(im.naturalHeight * k) });
          }} />
          {size && <canvas ref={canvas} className="doodle" width={size.w} height={size.h} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={(e) => { if (pen) e.stopPropagation(); }} />}
        </div>
      </div>
      {pen && (
        <div className="doodle-bar" role="toolbar" aria-label={T('Pluma', 'Quill')}>
          {INKS.map((k) => <button key={k.id} className={`ink ${ink === k.color ? 'on' : ''}`} style={{ background: k.color }} aria-label={k.name()} title={k.name()} aria-pressed={ink === k.color} onClick={() => setInk(k.color)} />)}
          <button className="btn small" disabled={!count} onClick={undo}>↶ {T('Deshacer', 'Undo')}</button>
          <button className="btn small" onClick={clear}>🧽 {T('Borrar todo', 'Clear all')}</button>
        </div>
      )}
      <div className="img-viewer-bar">
        <b className="grow">{title}</b>
        <button className={`btn small ${pen ? 'primary' : ''}`} aria-pressed={pen} title={T('Pluma: dibuja encima (solo lo ves tú)', 'Quill: draw on it (only you see it)')} onClick={() => setPen(!pen)}>✒️ {pen ? T('Listo', 'Done') : T('Pluma', 'Quill')}</button>
        <button className="btn small" onClick={() => setZoom(!zoom)}>{zoom ? '🔎 −' : '🔍 +'}</button>
        {extra}
        <button className="btn small" onClick={close}>✕ {T('Cerrar', 'Close')}</button>
      </div>
    </div>,
    document.body,
  );
}
