// Diálogo propio de confirmación («¿Seguro que quieres borrar…?»), con el estilo de la app.
import { create } from 'zustand';
import { T } from '../i18n';

interface Ask { title: string; text?: string; ok?: string; danger?: boolean; resolve: (v: boolean) => void }
interface ConfirmState { ask: Ask | null; open: (a: Omit<Ask, 'resolve'>) => Promise<boolean>; close: (v: boolean) => void }

export const useConfirm = create<ConfirmState>((set, get) => ({
  ask: null,
  open: (a) => new Promise<boolean>((resolve) => set({ ask: { ...a, resolve } })),
  close: (v) => { get().ask?.resolve(v); set({ ask: null }); },
}));

/** Pregunta antes de borrar algo; resuelve true si el usuario confirma */
export const confirmDelete = (what: string) =>
  useConfirm.getState().open({ title: T(`¿Seguro que quieres borrar «${what}»?`, `Are you sure you want to delete “${what}”?`), text: T('No se puede deshacer.', 'This can’t be undone.'), ok: T('Borrar', 'Delete'), danger: true });

export function ConfirmHost() {
  const ask = useConfirm((s) => s.ask);
  const close = useConfirm((s) => s.close);
  if (!ask) return null;
  return (
    <div className="confirm-backdrop" onClick={() => close(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={ask.title} onClick={(e) => e.stopPropagation()}>
        <p className="confirm-title">{ask.danger ? '🗑️ ' : ''}{ask.title}</p>
        {ask.text && <p className="muted small">{ask.text}</p>}
        <div className="row">
          <button className="btn grow" autoFocus onClick={() => close(false)}>{T('Cancelar', 'Cancel')}</button>
          <button className={`btn grow ${ask.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>{ask.ok ?? T('Aceptar', 'OK')}</button>
        </div>
      </div>
    </div>
  );
}
