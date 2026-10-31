// Burbuja de información: mantén pulsado algo de la ficha 1,5 s para ver qué hace y qué te limita ahora.
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { useChar } from '../store';
import { explain, type InfoTarget } from '../rules/explain';
import { T } from '../i18n';
import { Modal } from './common';

export const LONG_PRESS_MS = 1500;

interface BubbleState {
  target: InfoTarget | null;
  anchor: DOMRect | null;
  show: (target: InfoTarget, anchor: DOMRect) => void;
  hide: () => void;
}

export const useBubble = create<BubbleState>((set) => ({
  target: null,
  anchor: null,
  show: (target, anchor) => set({ target, anchor }),
  hide: () => set({ target: null, anchor: null }),
}));

// Solo se puede mantener pulsada una cosa a la vez, así que el estado de la pulsación es global
let timer: number | null = null;
let origin: { x: number; y: number } | null = null;
let pressed: HTMLElement | null = null;
let fired = false;

const cancelPress = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  origin = null;
  pressed?.classList.remove('lp-pressing');
  pressed = null;
};

/**
 * Props para un elemento que muestra la burbuja al mantenerlo pulsado. No es un hook: se puede usar dentro de listas.
 * Si la burbuja aparece, se anula el clic que viene después para no abrir también el editor.
 */
export function longPress(target: InfoTarget) {
  return {
    'data-longpress': '',
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      cancelPress();
      fired = false;
      origin = { x: e.clientX, y: e.clientY };
      pressed = e.currentTarget;
      pressed.classList.add('lp-pressing');
      const node = e.currentTarget;
      timer = window.setTimeout(() => {
        fired = true;
        cancelPress();
        navigator.vibrate?.(15);
        useBubble.getState().show(target, node.getBoundingClientRect());
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onPointerLeave: cancelPress,
    onClickCapture: (e: ReactMouseEvent) => {
      if (fired) {
        e.preventDefault();
        e.stopPropagation();
        fired = false;
      }
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}

export function InfoBubble() {
  const { target, anchor, hide } = useBubble();
  const c = useChar();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null);
  const info = target ? explain(c, target) : null;

  useLayoutEffect(() => {
    if (!anchor || !ref.current) { setPos(null); return; }
    // offsetWidth/Height: el tamaño real, sin la escala de la animación de entrada
    const b = { width: ref.current.offsetWidth, height: ref.current.offsetHeight };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const cx = anchor.left + anchor.width / 2;
    const left = Math.max(margin, Math.min(vw - b.width - margin, cx - b.width / 2));
    const below = anchor.top - b.height - 14 < margin && anchor.bottom + b.height + 14 < vh;
    const top = below ? anchor.bottom + 10 : Math.max(margin, anchor.top - b.height - 10);
    setPos({ left, top, arrow: Math.max(16, Math.min(b.width - 16, cx - left)), below });
  }, [anchor, target]);

  useEffect(() => {
    if (!target) return;
    const close = () => hide();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [target, hide]);

  if (!target || !info) return null;
  return (
    <>
      <div className="bubble-backdrop" onPointerDown={hide} />
      <div
        ref={ref}
        className={`info-bubble ${pos?.below ? 'below' : 'above'}`}
        role="tooltip"
        style={pos ? { left: pos.left, top: pos.top, ['--arrow' as string]: `${pos.arrow}px` } : { visibility: 'hidden', left: 0, top: 0 }}
        onClick={hide}
      >
        <div className="ib-head">
          <b>{info.title}</b>
          {info.subtitle && <span className="ib-sub">{info.subtitle}</span>}
        </div>
        {info.lines.map((l, i) => <p key={i}>{l}</p>)}
        {info.limits.length > 0 && (
          <ul className="ib-limits">
            {info.limits.map((l, i) => <li key={i} className={l.tone}>{l.tone === 'good' ? '✅' : l.tone === 'bad' ? '⛔' : 'ℹ️'} {l.text}</li>)}
          </ul>
        )}
        <span className="ib-close">{T('Toca para cerrar', 'Tap to close')}</span>
      </div>
    </>
  );
}

/** Descripción completa de algo de la ficha (al tocarlo): qué hace, sus límites y un botón para editarlo */
export function ExplainModal({ target, onClose, onEdit }: { target: InfoTarget; onClose: () => void; onEdit?: () => void }) {
  const c = useChar();
  const info = explain(c, target);
  if (!info) return null;
  return (
    <Modal title={info.title} onClose={onClose}>
      {info.subtitle && <p className="muted small">{info.subtitle}</p>}
      {info.lines.map((l, i) => <p key={i} className="explain-line">{l}</p>)}
      {info.limits.length > 0 && (
        <div className="reminders">
          <b>{T('Ahora mismo', 'Right now')}:</b>
          {info.limits.map((l, i) => <div key={i}>{l.tone === 'good' ? '✅' : l.tone === 'bad' ? '⛔' : 'ℹ️'} {l.text}</div>)}
        </div>
      )}
      <div className="row">
        {onEdit && <button className="btn" onClick={onEdit}>✏️ {T('Editar', 'Edit')}</button>}
        <button className="btn primary grow" onClick={onClose}>{T('Cerrar', 'Close')}</button>
      </div>
    </Modal>
  );
}
