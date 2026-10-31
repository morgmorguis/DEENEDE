// Panel de avisos de la ficha: cada aviso explica el motivo y se puede ignorar para siempre.
import { useState } from 'react';
import { useChar, useStore } from '../store';
import { validate, type Flag } from '../rules/flags';
import { T } from '../i18n';

const ICON: Record<Flag['severity'], string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

export function FlagList({ flags, onIgnore, ignored, onFix }: { flags: Flag[]; onIgnore?: (id: string) => void; ignored?: boolean; onFix?: (f: Flag) => void }) {
  return (
    <ul className="flag-list">
      {flags.map((f) => (
        <li key={f.id} className={`flag ${f.severity} ${ignored ? 'ignored' : ''}`}>
          <details>
            <summary><span className="flag-icon">{ICON[f.severity]}</span> {f.title}</summary>
            <p>{f.reason}</p>
          </details>
          {onFix && f.fix && !ignored && <button className="btn small primary" onClick={() => onFix(f)}>🔧 {T('Corregir', 'Fix')}</button>}
          {onIgnore && <button className="btn small" onClick={() => onIgnore(f.id)}>{ignored ? T('Restaurar', 'Restore') : T('Ignorar', 'Ignore')}</button>}
        </li>
      ))}
    </ul>
  );
}

export function FlagsPanel() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const replace = useStore((s) => s.replace);
  const [open, setOpen] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const all = validate(c);
  const active = all.filter((f) => !c.ignoredFlags.includes(f.id));
  const ignored = all.filter((f) => c.ignoredFlags.includes(f.id));
  if (!all.length) return null;
  const worst = active.some((f) => f.severity === 'error') ? 'error' : active.some((f) => f.severity === 'warning') ? 'warning' : 'info';

  return (
    <div className={`flags-panel ${active.length ? worst : 'clear'}`}>
      <button className="flags-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {active.length
          ? <>{ICON[worst]} {T(`${active.length} aviso(s) en la ficha`, `${active.length} sheet warning(s)`)}</>
          : <>✅ {T('Sin avisos pendientes', 'No pending warnings')}</>}
        {ignored.length > 0 && <span className="muted small"> · {T(`${ignored.length} ignorado(s)`, `${ignored.length} ignored`)}</span>}
        <span className="flags-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="flags-body">
          {active.length > 0 && <FlagList flags={active} onIgnore={(id) => update((x) => { x.ignoredFlags = [...x.ignoredFlags, id]; })} onFix={(f) => replace(f.fix!(c))} />}
          {ignored.length > 0 && (
            <>
              <button className="p-link" onClick={() => setShowIgnored(!showIgnored)}>{showIgnored ? T('Ocultar ignorados', 'Hide ignored') : T(`Mostrar ignorados (${ignored.length})`, `Show ignored (${ignored.length})`)}</button>
              {showIgnored && <FlagList flags={ignored} ignored onIgnore={(id) => update((x) => { x.ignoredFlags = x.ignoredFlags.filter((y) => y !== id); })} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
