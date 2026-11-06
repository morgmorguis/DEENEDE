// Diálogos propios («¿Seguro que quieres borrar…?», «Nombre de la carpeta») con el estilo de la app.
// No usamos confirm()/prompt() del navegador: en el WebView de Android y en algunas apps de escritorio
// no aparecen o no dejan escribir.
import { useState } from 'react';
import { create } from 'zustand';
import { T } from '../i18n';

interface Ask { title: string; text?: string; ok?: string; danger?: boolean; input?: { value: string; placeholder?: string }; resolve: (v: string | boolean | null) => void }
interface ConfirmState { ask: Ask | null; open: (a: Omit<Ask, 'resolve'>) => Promise<string | boolean | null>; close: (v: string | boolean | null) => void }

export const useConfirm = create<ConfirmState>((set, get) => ({
  ask: null,
  open: (a) => new Promise((resolve) => { get().ask?.resolve(a.input ? null : false); set({ ask: { ...a, resolve } }); }),
  close: (v) => { get().ask?.resolve(v); set({ ask: null }); },
}));

/** Pregunta sí/no; resuelve true si el usuario acepta */
export const askOk = async (title: string, opts: { text?: string; ok?: string; danger?: boolean } = {}) => (await useConfirm.getState().open({ title, ...opts })) === true;

/** Pide un texto (nombre de carpeta…); resuelve null si se cancela */
export const askText = async (title: string, value = '', placeholder?: string) => {
  const r = await useConfirm.getState().open({ title, input: { value, placeholder }, ok: T('Aceptar', 'OK') });
  return typeof r === 'string' ? r : null;
};

/** Pregunta antes de borrar algo; resuelve true si el usuario confirma */
export const confirmDelete = (what: string) =>
  askOk(T(`¿Seguro que quieres borrar «${what}»?`, `Are you sure you want to delete “${what}”?`), { text: T('No se puede deshacer.', 'This can’t be undone.'), ok: T('Borrar', 'Delete'), danger: true });

function InputAsk({ ask, close }: { ask: Ask; close: (v: string | boolean | null) => void }) {
  const [value, setValue] = useState(ask.input!.value);
  return (
    <form className="confirm" role="dialog" aria-modal="true" aria-label={ask.title} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); close(value.trim() ? value : null); }}>
      <p className="confirm-title">{ask.title}</p>
      {ask.text && <p className="muted small">{ask.text}</p>}
      <input autoFocus value={value} placeholder={ask.input!.placeholder} onChange={(e) => setValue(e.target.value)} />
      <div className="row">
        <button type="button" className="btn grow" onClick={() => close(null)}>{T('Cancelar', 'Cancel')}</button>
        <button type="submit" className="btn grow primary" disabled={!value.trim()}>{ask.ok ?? T('Aceptar', 'OK')}</button>
      </div>
    </form>
  );
}

export function ConfirmHost() {
  const ask = useConfirm((s) => s.ask);
  const close = useConfirm((s) => s.close);
  if (!ask) return null;
  return (
    <div className="confirm-backdrop" onClick={() => close(ask.input ? null : false)}>
      {ask.input ? <InputAsk key={ask.title} ask={ask} close={close} /> : (
        <div className="confirm" role="alertdialog" aria-modal="true" aria-label={ask.title} onClick={(e) => e.stopPropagation()}>
          <p className="confirm-title">{ask.danger ? '🗑️ ' : ''}{ask.title}</p>
          {ask.text && <p className="muted small">{ask.text}</p>}
          <div className="row">
            <button className="btn grow" autoFocus onClick={() => close(false)}>{T('Cancelar', 'Cancel')}</button>
            <button className={`btn grow ${ask.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>{ask.ok ?? T('Aceptar', 'OK')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
