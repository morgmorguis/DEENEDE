// DM: escribir notas (cartas, pistas, secretos) a un jugador, a varios o a todo el grupo; llegan a su grimorio, en «Compartido conmigo».
import { useState } from 'react';
import { useParty } from '../party/client';
import type { RoomView } from '../party/protocol';
import { Section } from './common';
import { confirmDelete } from './Confirm';
import { T, locale } from '../i18n';
import { useStore } from '../store';

export function DmNotes({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const players = view.members.filter((m) => m.role === 'player');
  const nameOf = (id: string) => { const m = view.members.find((x) => x.id === id); return m?.summary?.name ?? m?.name ?? '?'; };
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  /** 'all' = todo el grupo; si no, los jugadores elegidos */
  const [to, setTo] = useState<'all' | string[]>('all');
  const sel = to === 'all' ? [] : to;
  const ready = text.trim() && (to === 'all' || sel.length > 0);
  const sent = [...view.chronicles].reverse();
  const share = () => {
    send({ t: 'chronicleShare', title: title.trim() || T('Nota del DM', 'Note from the DM'), text, to });
    useStore.getState().showToast(T('✉️ Nota enviada', '✉️ Note sent'), [to === 'all' ? T('A todo el grupo.', 'To the whole party.') : sel.map(nameOf).join(', '), T('Llega a su grimorio → 🤝 Compartido conmigo.', 'It goes to their grimoire → 🤝 Shared with me.')]);
    setTitle(''); setText('');
  };
  return (
    <Section title={T('✉️ Notas para los jugadores', '✉️ Notes for the players')}>
      <p className="small muted">{T('Una carta, una pista o un secreto. Se guarda en el grimorio de quien la recibe (🤝 Compartido conmigo), marcada «solo para ti» o «para el grupo». Si alguien no está conectado, le llega al volver.', 'A letter, a clue or a secret. It’s saved in the recipient’s grimoire (🤝 Shared with me), marked “only for you” or “for the party”. Players who are offline get it when they come back.')}</p>
      <label className="field">{T('Título', 'Title')}<input value={title} placeholder={T('Carta sellada con lacre negro', 'Letter sealed with black wax')} onChange={(e) => setTitle(e.target.value)} /></label>
      <textarea className="tall" value={text} placeholder={T('Lo que quieras que lean…', 'Whatever you want them to read…')} onChange={(e) => setText(e.target.value)} />
      <div className="row wrap">
        <label className="check"><input type="radio" checked={to === 'all'} onChange={() => setTo('all')} /> 👥 {T('Todo el grupo', 'Whole party')}</label>
        <label className="check"><input type="radio" checked={to !== 'all'} onChange={() => setTo(sel)} /> 🔒 {T('Solo a…', 'Only to…')}</label>
      </div>
      {to !== 'all' && (players.length ? players.map((m) => (
        <label key={m.id} className="check"><input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => setTo(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} /> {m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</label>
      )) : <p className="small muted">{T('Aún no hay jugadores en la partida.', 'There are no players in the game yet.')}</p>)}
      <button className="btn primary full" disabled={!ready} onClick={share}>📤 {to === 'all' ? T('Enviar a todo el grupo', 'Send to the whole party') : T(`Enviar solo a ${sel.length}`, `Send only to ${sel.length}`)}</button>
      {sent.length > 0 && (
        <details className="mt">
          <summary className="small">{T(`Enviadas (${sent.length})`, `Sent (${sent.length})`)}</summary>
          <ul className="dm-sent-notes">
            {sent.map((ch) => (
              <li key={ch.id}>
                <span className="grow"><b>{ch.title}</b> <span className="tiny muted">· {new Date(ch.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · {Array.isArray(ch.to) ? `🔒 ${ch.to.map(nameOf).join(', ')}` : T('👥 grupo', '👥 party')}</span></span>
                <button className="icon-btn" aria-label={T(`Quitar «${ch.title}»`, `Remove “${ch.title}”`)} title={T('Quitar de la partida (quien ya la tenga la conserva)', 'Remove from the game (whoever already has it keeps it)')} onClick={async () => { if (await confirmDelete(ch.title)) send({ t: 'chronicleRemove', id: ch.id }); }}>🗑️</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}
