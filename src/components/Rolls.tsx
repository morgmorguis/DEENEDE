// Tiradas de la mesa: el DM pide tiradas (salvación, habilidad o característica, con CD y en secreto si quiere) y
// tira sus dados; al jugador le sale el aviso para tirar con la app o con su dado; registro de tiradas del grupo.
import { useState } from 'react';
import { create } from 'zustand';
import { useParty } from '../party/client';
import type { RollAsk, RollRequest, RoomView } from '../party/protocol';
import { askBonus, askContext, askLabel, beats, manualAsk, pendingAsks, rollAsk, rollLines } from '../party/rolls';
import { ABILITIES, SKILLS, skillName } from '../rules/srd';
import { rollExpr } from '../rules/calc';
import type { AbilityKey } from '../rules/itemTypes';
import { Section } from './common';
import { useSharedChar } from './Treasure';
import { useStore } from '../store';
import { L, T, locale } from '../i18n';

/** Tiradas que el jugador ha dejado para más tarde (vuelven con «Tirar ahora») */
const useRollLater = create<{ later: string[]; add: (id: string) => void; clear: () => void }>((set, get) => ({
  later: [], add: (id) => set({ later: [...get().later, id] }), clear: () => set({ later: [] }),
}));

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const hour = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

/** Atajos para lo que más se pide */
const QUICK: RollAsk[] = [
  { kind: 'skill', skill: 'percepcion' }, { kind: 'skill', skill: 'perspicacia' }, { kind: 'skill', skill: 'sigilo' }, { kind: 'skill', skill: 'investigacion' },
  { kind: 'save', ability: 'dex' }, { kind: 'save', ability: 'con' }, { kind: 'save', ability: 'wis' }, { kind: 'save', ability: 'str' },
];
const sameAsk = (a: RollAsk, b: RollAsk) => JSON.stringify(a) === JSON.stringify(b);

/** DM: pedir una tirada a todos o a algunos jugadores */
export function RollAskForm({ view, onSent }: { view: RoomView; onSent?: () => void }) {
  const send = useParty((s) => s.send);
  const players = view.members.filter((m) => m.role === 'player');
  const [ask, setAsk] = useState<RollAsk>({ kind: 'skill', skill: 'percepcion' });
  const [dc, setDc] = useState('');
  const [secret, setSecret] = useState(false);
  const [to, setTo] = useState<'all' | string[]>('all');
  const [note, setNote] = useState('');
  const sel = to === 'all' ? [] : to;
  const ready = players.length > 0 && (to === 'all' || sel.length > 0);
  const setKind = (k: RollAsk['kind']) => setAsk(k === 'skill' ? { kind: 'skill', skill: 'percepcion' } : { kind: k, ability: 'dex' });
  const go = () => {
    send({ t: 'rollAsk', ask, dc: Number(dc) || null, secret, to, ...(note.trim() ? { note: note.trim() } : {}) });
    useStore.getState().showToast(secret ? T('🤫 Tirada secreta pedida', '🤫 Secret roll requested') : T('🎲 Tirada pedida', '🎲 Roll requested'), [askLabel(ask) + (Number(dc) ? ` · CD ${dc}` : ''), secret ? T('La app de cada jugador la tira sola; solo tú ves el resultado.', 'Each player’s app rolls it on its own; only you see the result.') : T('A cada jugador le sale un aviso para tirar.', 'Each player gets a prompt to roll.')]);
    setNote('');
    onSent?.();
  };
  return (
    <div className="roll-ask">
      <div className="chips">
        {QUICK.map((q) => <button key={JSON.stringify(q)} className={`chip toggle ${sameAsk(q, ask) ? 'on' : ''}`} onClick={() => setAsk(q)}>{askLabel(q)}</button>)}
      </div>
      <div className="row wrap">
        <select value={ask.kind} onChange={(e) => setKind(e.target.value as RollAsk['kind'])} aria-label={T('Tipo de tirada', 'Roll type')}>
          <option value="skill">{T('Habilidad', 'Skill')}</option>
          <option value="save">{T('Salvación', 'Saving throw')}</option>
          <option value="check">{T('Característica', 'Ability check')}</option>
        </select>
        {ask.kind === 'skill' ? (
          <select value={ask.skill} onChange={(e) => setAsk({ kind: 'skill', skill: e.target.value })} aria-label={T('Habilidad', 'Skill')}>
            {[...SKILLS].sort((a, b) => skillName(a.id).localeCompare(skillName(b.id))).map((s) => <option key={s.id} value={s.id}>{skillName(s.id)}</option>)}
          </select>
        ) : (
          <select value={ask.ability} onChange={(e) => setAsk({ kind: ask.kind, ability: e.target.value as AbilityKey })} aria-label={T('Característica', 'Ability')}>
            {ABILITIES.map((a) => <option key={a.id} value={a.id}>{L(a.name)}</option>)}
          </select>
        )}
        <label className="check">{T('CD', 'DC')} <input className="num-input" type="number" min={1} max={40} value={dc} placeholder="—" onChange={(e) => setDc(e.target.value)} style={{ width: '4.5em' }} /></label>
      </div>
      <input value={note} placeholder={T('Qué pasa (opcional): «El suelo cede bajo vuestros pies…»', 'What happens (optional): “The floor gives way…”')} onChange={(e) => setNote(e.target.value)} />
      <label className="check"><input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> 🤫 {T('Secreta: la app del jugador la tira sola y solo tú ves el resultado', 'Secret: the player’s app rolls it on its own and only you see the result')}</label>
      <div className="row wrap">
        <label className="check"><input type="radio" checked={to === 'all'} onChange={() => setTo('all')} /> 👥 {T('Todos', 'Everyone')}</label>
        <label className="check"><input type="radio" checked={to !== 'all'} onChange={() => setTo(sel)} /> 🎯 {T('Solo a…', 'Only…')}</label>
      </div>
      {to !== 'all' && players.map((m) => (
        <label key={m.id} className="check"><input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => setTo(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} /> {m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</label>
      ))}
      {!players.length && <p className="small muted">{T('Aún no hay jugadores en la partida.', 'There are no players in the game yet.')}</p>}
      <button className="btn primary full" disabled={!ready} onClick={go}>🎲 {T(`Pedir ${askLabel(ask)}`, `Ask for ${askLabel(ask)}`)}{Number(dc) ? ` (CD ${dc})` : ''}</button>
    </div>
  );
}

/** DM: cómo va una tirada pedida (quién ha sacado qué y quién falta) */
function RequestCard({ q, view }: { q: RollRequest; view: RoomView }) {
  const send = useParty((s) => s.send);
  const nameOf = (id: string) => { const m = view.members.find((x) => x.id === id); return m?.summary?.name ?? m?.name ?? '?'; };
  const missing = q.to.filter((id) => !q.answers.some((a) => a.memberId === id));
  const ok = q.answers.filter((a) => beats(a.total, q.dc)).length;
  return (
    <li className={`roll-req ${q.closed ? 'closed' : ''}`}>
      <div className="row">
        <b className="grow">{q.secret ? '🤫 ' : '🎲 '}{askLabel(q.ask)}{q.dc ? ` · CD ${q.dc}` : ''}</b>
        <span className="tiny muted">{hour(q.at)}</span>
        {!q.closed && <button className="btn small" onClick={() => send({ t: 'rollClose', id: q.id })}>{T('Cerrar', 'Close')}</button>}
      </div>
      {q.note && <p className="small muted">{q.note}</p>}
      <ul className="roll-answers">
        {[...q.answers].sort((a, b) => b.total - a.total).map((a) => {
          const pass = beats(a.total, q.dc);
          return (
            <li key={a.memberId} title={a.detail}>
              <span className="grow">{a.name}</span>
              {a.manual && <span className="tiny muted" title={T('Con su dado', 'With their own die')}>✍️</span>}
              {a.natural === 20 && <span className="tiny">✨20</span>}
              {a.natural === 1 && <span className="tiny">💀1</span>}
              <b className={pass == null ? '' : pass ? 'good-text' : 'bad-text'}>{a.total}{pass == null ? '' : pass ? ' ✅' : ' ❌'}</b>
            </li>
          );
        })}
        {!q.closed && missing.map((id) => <li key={id} className="muted"><span className="grow">{nameOf(id)}</span>⏳</li>)}
      </ul>
      {q.dc && q.answers.length > 0 && <p className="tiny muted">{T(`Superan la CD: ${ok} de ${q.answers.length}`, `Beat the DC: ${ok} of ${q.answers.length}`)}{q.closed && missing.length ? T(` · sin responder: ${missing.map(nameOf).join(', ')}`, ` · no answer: ${missing.map(nameOf).join(', ')}`) : ''}</p>}
    </li>
  );
}

/** DM: tirar sus propios dados, a la vista o detrás de la pantalla */
function DmDice() {
  const send = useParty((s) => s.send);
  const [expr, setExpr] = useState('1d20');
  const [hidden, setHidden] = useState(true);
  const [last, setLast] = useState<string>('');
  const valid = /^\s*[+-]?(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i.test(expr);
  const roll = (e = expr) => {
    if (!/^\s*[+-]?(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i.test(e)) return;
    const r = rollExpr(e);
    setLast(`${e} → ${r.text} = ${r.total}`);
    send({ t: 'dmRoll', label: e.replace(/\s+/g, ''), total: r.total, detail: r.text, hidden });
  };
  return (
    <div className="dm-dice">
      <div className="chips">
        {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d20', '1d100'].map((d) => <button key={d} className="chip" onClick={() => { setExpr(d); roll(d); }}>{d}</button>)}
      </div>
      <div className="row">
        <input className="grow" value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') roll(); }} aria-label={T('Dados a tirar', 'Dice to roll')} placeholder="1d20+5" />
        <button className="btn primary" disabled={!valid} onClick={() => roll()}>🎲 {T('Tirar', 'Roll')}</button>
      </div>
      <label className="check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> 🛡️ {T('Detrás de la pantalla (los jugadores no la ven)', 'Behind the screen (players don’t see it)')}</label>
      {last && <p className="roll-last"><b>{last}</b></p>}
    </div>
  );
}

/** DM: la sección de tiradas (en «Partida» y en «Combate») */
export function DmRollsSection({ view }: { view: RoomView }) {
  const reqs = [...(view.rollRequests ?? [])].reverse();
  const open = reqs.filter((q) => !q.closed);
  const done = reqs.filter((q) => q.closed).slice(0, 8);
  return (
    <Section title={T('🎲 Tiradas', '🎲 Rolls')}>
      <details open={open.length === 0}>
        <summary><b>{T('Pedir una tirada', 'Ask for a roll')}</b></summary>
        <RollAskForm view={view} />
      </details>
      {open.length > 0 && <ul className="roll-reqs">{open.map((q) => <RequestCard key={q.id} q={q} view={view} />)}</ul>}
      {done.length > 0 && (
        <details>
          <summary className="small">{T(`Tiradas cerradas (${done.length})`, `Closed rolls (${done.length})`)}</summary>
          <ul className="roll-reqs">{done.map((q) => <RequestCard key={q.id} q={q} view={view} />)}</ul>
        </details>
      )}
      <details>
        <summary><b>{T('Tus dados', 'Your dice')}</b></summary>
        <DmDice />
      </details>
    </Section>
  );
}

/** Registro de tiradas del grupo: las pedidas por el DM, las del DM a la vista y las del combate */
export function RollLog({ view }: { view: RoomView }) {
  const [all, setAll] = useState(false);
  const lines = rollLines(view, all ? 200 : 15);
  if (!lines.length) return null;
  const dm = view.you.role === 'dm';
  return (
    <Section title={T('📜 Registro de tiradas', '📜 Roll log')}>
      <ul className="roll-log">
        {lines.map((l) => {
          const pass = beats(l.total, l.dc);
          return (
            <li key={l.id} title={l.detail}>
              <span className="tiny muted">{hour(l.at)}</span>
              <span className="grow"><b>{l.who}</b> · {l.label}{l.dc ? ` (CD ${l.dc})` : ''}{dm && l.secret ? ' 🤫' : ''}{l.manual ? ' ✍️' : ''}</span>
              <b className={pass == null ? '' : pass ? 'good-text' : 'bad-text'}>{l.total}</b>
            </li>
          );
        })}
      </ul>
      {!all && lines.length >= 15 && <button className="btn small" onClick={() => setAll(true)}>{T('Ver más', 'Show more')}</button>}
      <p className="tiny muted">{dm ? T('🤫 = solo lo ves tú · ✍️ = con su dado', '🤫 = only you see it · ✍️ = with their own die') : T('Las tiradas que pide el DM, las suyas a la vista y las del combate. ✍️ = con su dado.', 'Rolls the DM asks for, the DM’s open rolls and combat rolls. ✍️ = with their own die.')}</p>
    </Section>
  );
}

/** Jugador: aviso para tirar lo que pide el DM, con la app o con su dado */
export function RollPrompt() {
  const view = useParty((s) => s.view);
  const send = useParty((s) => s.send);
  const c = useSharedChar();
  const later = useRollLater((s) => s.later);
  const [face, setFace] = useState('');
  const [result, setResult] = useState<{ id: string; total: number; lines: string[] } | null>(null);
  const q = pendingAsks(view).find((x) => !later.includes(x.id));
  if (result) {
    // Ya enviada: se enseña el resultado hasta que lo cierre
    return (
      <div className="modal-backdrop" onClick={() => setResult(null)}>
        <div className="modal roll-prompt" role="dialog" aria-label={T('Tu tirada', 'Your roll')} onClick={(e) => e.stopPropagation()}>
          <h3>🎲 {T('Has sacado', 'You rolled')} <span className="roll-big">{result.total}</span></h3>
          <ul className="small">{result.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="small muted">{T('El DM ya lo tiene.', 'The DM has it.')}</p>
          <button className="btn primary full" onClick={() => setResult(null)}>{T('Vale', 'OK')}</button>
        </div>
      </div>
    );
  }
  if (!q || !c) return null;
  const ctx = askContext(c, q.ask);
  const bonus = askBonus(c, q.ask) - 2 * c.exhaustion;
  const n = Number(face);
  const faceOk = Number.isInteger(n) && n >= 1 && n <= 20;
  const submit = (r: { total: number; natural: number; lines: string[] }, manual: boolean) => {
    send({ t: 'rollAnswer', id: q.id, total: r.total, natural: r.natural, manual, detail: r.lines.join('\n') });
    useStore.getState().pushLog({ role: 'app', text: `${askLabel(q.ask)} ${T('para el DM', 'for the DM')}: ${r.total}`, details: r.lines });
    setResult({ id: q.id, total: r.total, lines: r.lines });
    setFace('');
  };
  const adv = ctx.advantage.length > 0 && !ctx.disadvantage.length;
  const dis = ctx.disadvantage.length > 0 && !ctx.advantage.length;
  return (
    <div className="modal-backdrop invite-backdrop">
      <div className="modal roll-prompt" role="dialog" aria-label={T('El DM pide una tirada', 'The DM asks for a roll')}>
        <p className="small muted">{T('El DM pide una tirada', 'The DM asks for a roll')}</p>
        <h3>🎲 {askLabel(q.ask)}{q.dc ? <> · {T('CD', 'DC')} {q.dc}</> : null}</h3>
        {q.note && <p className="roll-note">{q.note}</p>}
        <p>{T('Tu bonificador', 'Your bonus')}: <b>{sign(bonus)}</b>{adv && <> · <b className="good-text">{T('ventaja', 'advantage')}</b></>}{dis && <> · <b className="bad-text">{T('desventaja', 'disadvantage')}</b></>}</p>
        {(adv || dis) && <p className="tiny muted">{[...ctx.advantage, ...ctx.disadvantage].join(', ')}</p>}
        {ctx.autoFail.map((f) => <p key={f} className="small warn">⚠️ {f}</p>)}
        {ctx.notes.map((f) => <p key={f} className="tiny muted">📌 {f}</p>)}
        <button className="btn primary full" onClick={() => submit(rollAsk(c, q.ask), false)}>🎲 {T('Tira la app', 'Let the app roll')}</button>
        <div className="roll-manual">
          <label className="field">{adv || dis ? T(`Con tu dado: lo que cuenta del d20 (${adv ? 'el mayor de dos' : 'el menor de dos'})`, `With your die: the d20 that counts (${adv ? 'higher of two' : 'lower of two'})`) : T('Con tu dado: lo que ha salido en el d20', 'With your die: what the d20 shows')}
            <input type="number" inputMode="numeric" min={1} max={20} value={face} onChange={(e) => setFace(e.target.value)} placeholder="1–20" />
          </label>
          <button className="btn full" disabled={!faceOk} onClick={() => submit(manualAsk(c, q.ask, n), true)}>✍️ {faceOk ? T(`Enviar ${n} ${sign(bonus)} = ${n + bonus}`, `Send ${n} ${sign(bonus)} = ${n + bonus}`) : T('Enviar mi tirada', 'Send my roll')}</button>
        </div>
        <button className="link small" onClick={() => useRollLater.getState().add(q.id)}>{T('Más tarde (queda en «Partida»)', 'Later (it stays in “Game”)')}</button>
      </div>
    </div>
  );
}

/** Jugador, en «Partida»: tiradas pendientes que dejó para más tarde */
export function PendingRolls({ view }: { view: RoomView }) {
  const pend = pendingAsks(view);
  if (!pend.length) return null;
  return (
    <Section title={T('🎲 El DM te pide tirar', '🎲 The DM asks you to roll')}>
      <p className="small">{pend.map((q) => askLabel(q.ask) + (q.dc ? ` (CD ${q.dc})` : '')).join(' · ')}</p>
      <button className="btn primary full" onClick={() => useRollLater.getState().clear()}>🎲 {T('Tirar ahora', 'Roll now')}</button>
    </Section>
  );
}
