import { useEffect, type ReactNode } from 'react';
import { useStore } from '../store';
import type { Character, RollScope } from '../types';
import { rollD20, rollExpr, type RollKind } from '../rules/calc';
import { T } from '../i18n';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={T('Cerrar', 'Close')}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      <div className="card-head">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Fila de casillas para recursos y espacios de conjuro: pulsa para gastar / recuperar */
export function Pips({ max, used, onChange, shape }: { max: number; used: number; onChange: (used: number) => void; shape?: 'diamond' }) {
  return (
    <div className="pips">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          className={`pip ${shape ?? ''} ${i < max - used ? 'full' : 'empty'}`}
          aria-label={i < max - used ? T('Disponible', 'Available') : T('Gastado', 'Spent')}
          onClick={() => onChange(i < max - used ? used + 1 : Math.max(0, used - 1))}
        />
      ))}
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const hide = useStore((s) => s.hideToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 6000);
    return () => clearTimeout(t);
  }, [toast, hide]);
  if (!toast) return null;
  return (
    <div className="toast" onClick={hide} role="status">
      <strong>{toast.title}</strong>
      {toast.lines.map((l, i) => (
        <div key={i} className={/^Total|✅|❌|☠️/.test(l) ? 'toast-total' : ''}>{l}</div>
      ))}
    </div>
  );
}

/** Tira un d20 con el contexto del personaje y lo muestra en el registro y como aviso. */
export function useRoll() {
  const pushLog = useStore((s) => s.pushLog);
  const showToast = useStore((s) => s.showToast);
  return (c: Character, kind: RollKind, bonus: number, label: string) => {
    const r = rollD20(c, kind, bonus, label);
    pushLog({ role: 'app', text: `${label}: ${r.total}`, details: r.lines });
    showToast(`${label}: ${r.total}`, r.lines);
    return r;
  };
}

/** Duplica los dados de una expresión (golpe crítico) */
export const critDice = (expr: string) => expr.replace(/(\d*)d(\d+)/g, (_, n, s) => `${Number(n || 1) * 2}d${s}`);

export function useDamageRoll() {
  const pushLog = useStore((s) => s.pushLog);
  const showToast = useStore((s) => s.showToast);
  return (c: Character, label: string, dice: string, flat: number, crit: boolean, scopeBonus: RollScope | null, strBased: boolean) => {
    const expr = crit ? critDice(dice) : dice;
    const r = rollExpr(expr);
    let total = r.total + flat;
    const lines = [`${expr}: ${r.text}${flat ? ` ${flat >= 0 ? '+' : '−'}${Math.abs(flat)}` : ''}`];
    if (scopeBonus) {
      for (const e of c.effects) {
        const b = e.mods.bonus?.[scopeBonus];
        if (!b) continue;
        if (e.presetId === 'furia' && !strBased) continue;
        const x = rollExpr(b);
        total += x.total;
        lines.push(`${e.name}: ${x.text}`);
      }
    }
    lines.push(`Total: ${Math.max(0, total)}${crit ? T(' (crítico)', ' (critical)') : ''}`);
    const title = `${T('Daño', 'Damage')} ${label}: ${Math.max(0, total)}`;
    pushLog({ role: 'app', text: title, details: lines });
    showToast(title, lines);
  };
}

export function NumberInput({ value, onChange, min, max, className, ariaLabel }: { value: number; onChange: (n: number) => void; min?: number; max?: number; className?: string; ariaLabel?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      className={className ?? 'num'}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

/** Abre el selector de archivos del sistema (en Android ofrece cámara, galería o archivos) */
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
