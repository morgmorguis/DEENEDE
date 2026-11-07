// Transiciones a pantalla completa al estilo de un encuentro de los RPG de los 90: destellos,
// barras que cierran la pantalla, el fondo se difumina y aparece «¡COMBATE!» o «¡SUBES DE NIVEL!».
import { useEffect } from 'react';
import { create } from 'zustand';
import { T } from '../i18n';
import { useStore } from '../store';

export type FxKind = 'combat' | 'levelup';

interface FxState {
  fx: { kind: FxKind; title: string; subtitle?: string; key: number } | null;
  play: (kind: FxKind, title?: string, subtitle?: string) => void;
  stop: () => void;
}

export const useFx = create<FxState>((set) => ({
  fx: null,
  play: (kind, title, subtitle) => set({ fx: { kind, title: title ?? (kind === 'combat' ? T('¡COMBATE!', 'COMBAT!') : T('¡SUBES DE NIVEL!', 'LEVEL UP!')), subtitle, key: Date.now() } }),
  stop: () => set({ fx: null }),
}));

const DURATION = 2600;

export function TransitionFx() {
  const fx = useFx((s) => s.fx);
  const stop = useFx((s) => s.stop);
  useEffect(() => {
    if (!fx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(stop, reduced ? 900 : DURATION);
    // Por si el temporizador se retrasa (WebView en segundo plano), nunca más de 4 s
    const safety = setTimeout(stop, 4000);
    try { navigator.vibrate?.(fx.kind === 'combat' ? [60, 40, 60, 40, 120] : [40, 30, 40]); } catch { /* sin vibración */ }
    return () => { clearTimeout(t); clearTimeout(safety); };
  }, [fx, stop]);
  const design = useStore((s) => s.settings.design ?? 'classic');
  if (!fx) return null;
  if (design === 'retro') return <RetroFx fx={fx} stop={stop} />;
  return (
    <div key={fx.key} className={`fx fx-${fx.kind}`} onClick={stop} onAnimationEnd={(e) => { if (e.target === e.currentTarget) stop(); }} role="alert" aria-label={fx.title}>
      <div className="fx-flash" />
      <div className="fx-bars"><span /><span /><span /><span /><span /><span /><span /><span /></div>
      {fx.kind === 'levelup' && (
        <div className="fx-sparks">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${0.5 + (i % 6) * 0.12}s` }} />)}</div>
      )}
      <div className="fx-title">
        <span className="fx-icon">{fx.kind === 'combat' ? '⚔️' : '⬆️'}</span>
        <b data-text={fx.title}>{fx.title}</b>
        {fx.subtitle && <small>{fx.subtitle}</small>}
      </div>
    </div>
  );
}

// ---------- Estilo retro 16-bit ----------

const COLS = 10;
const ROWS = 18;

/** Orden en espiral (de fuera hacia dentro) de las casillas: la pantalla se «rompe» como en los RPG clásicos */
function spiralOrder(): number[] {
  const order = new Array(COLS * ROWS).fill(0);
  let top = 0, left = 0, bottom = ROWS - 1, right = COLS - 1, n = 0;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x++) order[top * COLS + x] = n++;
    for (let y = top + 1; y <= bottom; y++) order[y * COLS + right] = n++;
    if (top < bottom) for (let x = right - 1; x >= left; x--) order[bottom * COLS + x] = n++;
    if (left < right) for (let y = bottom - 1; y > top; y--) order[y * COLS + left] = n++;
    top++; left++; bottom--; right--;
  }
  return order;
}
const SPIRAL = spiralOrder();

function RetroFx({ fx, stop }: { fx: NonNullable<FxState['fx']>; stop: () => void }) {
  const combat = fx.kind === 'combat';
  const total = COLS * ROWS;
  return (
    <div key={fx.key} className={`fx-retro ${combat ? 'combat' : 'levelup'}`} onClick={stop} onAnimationEnd={(e) => { if (e.target === e.currentTarget) stop(); }} role="alert" aria-label={fx.title}>
      <div className="fxr-grid">
        {Array.from({ length: total }, (_, i) => {
          const x = i % COLS, y = Math.floor(i / COLS);
          // Combate: espiral; subida de nivel: barrido en diagonal
          const k = combat ? SPIRAL[i] / total : (x + (ROWS - 1 - y)) / (COLS + ROWS - 2);
          return <i key={i} style={{ animationDelay: `${(k * 0.85).toFixed(3)}s`, ['--tone' as string]: (x + y) % 2 ? 'var(--fxr-a)' : 'var(--fxr-b)' }} />;
        })}
      </div>
      {!combat && <div className="fxr-stars">{Array.from({ length: 22 }, (_, i) => <b key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${0.9 + (i % 7) * 0.09}s` }} />)}</div>}
      <img className="fxr-art" src={`design/retro/fx-${fx.kind}.png`} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div className="fxr-title">
        <span className="fxr-icon">{combat ? '⚔' : '★'}</span>
        <b data-text={fx.title}>{fx.title}</b>
        {fx.subtitle && <small>{fx.subtitle}</small>}
      </div>
    </div>
  );
}
