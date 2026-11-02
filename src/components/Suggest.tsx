// Campo de texto con sugerencias (texto predictivo) que aparecen al escribir.
import { useState, type ReactNode } from 'react';

export interface SuggestItem { key: string; label: string; sub?: string }

function Highlight({ text, q }: { text: string; q: string }) {
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const i = fold(text).indexOf(fold(q.trim()));
  if (!q.trim() || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.trim().length)}</mark>{text.slice(i + q.trim().length)}</>;
}

export function SuggestInput({ value, onChange, items, onPick, autoFocus, placeholder, footer }: {
  value: string; onChange: (v: string) => void; items: SuggestItem[]; onPick: (key: string) => void; autoFocus?: boolean; placeholder?: string; footer?: ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const open = focus && items.length > 0;
  return (
    <div className="suggest">
      <input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onChange={(e) => { onChange(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === 'Enter') { e.preventDefault(); onPick(items[active].key); setFocus(false); }
          if (e.key === 'Escape') setFocus(false);
        }}
      />
      {open && (
        <ul className="suggest-list" role="listbox">
          {items.map((it, i) => (
            <li key={it.key}>
              <button type="button" className={i === active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(it.key); setFocus(false); }}>
                <b><Highlight text={it.label} q={value} /></b>
                {it.sub && <small>{it.sub}</small>}
              </button>
            </li>
          ))}
          {footer && <li className="suggest-foot">{footer}</li>}
        </ul>
      )}
    </div>
  );
}
