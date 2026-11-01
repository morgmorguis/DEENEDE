// Transiciones a pantalla completa al estilo de un encuentro de los RPG de los 90: destellos,
// barras que cierran la pantalla, el fondo se difumina y aparece «¡COMBATE!» o «¡SUBES DE NIVEL!».
import { useEffect } from 'react';
import { create } from 'zustand';
import { T } from '../i18n';

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
    navigator.vibrate?.(fx.kind === 'combat' ? [60, 40, 60, 40, 120] : [40, 30, 40]);
    return () => clearTimeout(t);
  }, [fx, stop]);
  if (!fx) return null;
  return (
    <div key={fx.key} className={`fx fx-${fx.kind}`} onClick={stop} role="alert" aria-label={fx.title}>
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
