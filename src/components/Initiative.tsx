import { useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useChar, useStore } from '../store';
import type { InitEntry } from '../types';
import { abilityMods, fmt, rollContext } from '../rules/calc';
import { uid } from '../rules/factory';
import { Modal, NumberInput } from './common';
import { T } from '../i18n';

/** Pregunta por la iniciativa: tirarla en la app o escribir el resultado de tu dado */
export function InitiativePrompt({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const run = useStore((s) => s.runCommands);
  const [value, setValue] = useState('');
  const dex = abilityMods(c).dex;
  const ctx = rollContext(c, { kind: 'initiative' });
  const n = Number(value);
  return (
    <Modal title={T('Tirada de iniciativa', 'Initiative roll')} onClose={onClose}>
      <p>{T(`Tira 1d20 ${fmt(dex)} (Destreza) y escribe el total, o deja que la app tire por ti.`, `Roll 1d20 ${fmt(dex)} (Dexterity) and enter the total, or let the app roll for you.`)}</p>
      {(ctx.advantage.length > 0 || ctx.disadvantage.length > 0 || ctx.penalties.length > 0) && (
        <div className="reminders">
          {ctx.advantage.map((x) => <div key={x}>✅ {T('Ventaja por', 'Advantage from')} {x}</div>)}
          {ctx.disadvantage.map((x) => <div key={x}>⬇️ {T('Desventaja por', 'Disadvantage from')} {x}</div>)}
          {ctx.penalties.map((x) => <div key={x}>➖ {x}</div>)}
        </div>
      )}
      <label className="field">{T('He sacado (total)', 'My result (total)')}
        <div className="row">
          <input className="grow big-input" type="number" inputMode="numeric" value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
          <button className="btn primary" disabled={value === '' || !Number.isFinite(n)} onClick={() => { run(null, [{ type: 'setInitiative', value: Math.round(n) }]); onClose(); }}>{T('Guardar', 'Save')}</button>
        </div>
      </label>
      <button className="btn full" onClick={() => { run(T('Tiro iniciativa', 'Roll initiative'), [{ type: 'rollInitiative' }]); onClose(); }}>🎲 {T('Que tire la app', 'Let the app roll')} ({fmt(dex)})</button>
      <button className="link" onClick={onClose}>{T('Ahora no', 'Not now')}</button>
    </Modal>
  );
}

function Bubble({ entry, index, active, name, onEdit }: { entry: InitEntry; index: number; active: boolean; name: string; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bubble ${entry.kind} ${active ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onEdit}
      aria-label={`${index + 1}. ${name}, ${T('iniciativa', 'initiative')} ${entry.initiative ?? '—'}`}
      {...attributes}
      {...listeners}
    >
      <span className="bubble-pos">{index + 1}</span>
      <span className="bubble-circle">{entry.initiative ?? '?'}</span>
      <span className="bubble-name">{entry.kind === 'self' ? '⭐ ' : entry.kind === 'enemy' ? '👹 ' : '🛡️ '}{name}</span>
      {active && <span className="bubble-turn">{T('turno', 'turn')}</span>}
    </button>
  );
}

/** Orden de turnos: burbujas que se pueden reordenar arrastrando (también con el dedo) */
export function InitiativeTracker() {
  const c = useChar();
  const setOrder = useStore((s) => s.setOrder);
  const sortByInitiative = useStore((s) => s.sortByInitiative);
  const endTurn = useStore((s) => s.endTurn);
  const [edit, setEdit] = useState<InitEntry | null>(null);
  const [prompt, setPrompt] = useState(false);
  const order = c.combat.order.length ? c.combat.order : [{ id: 'self', name: '', kind: 'self' as const, initiative: c.combat.initiative }];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (e: InitEntry) => (e.kind === 'self' ? c.name : e.name);

  const onDragEnd = (ev: DragEndEvent) => {
    if (!ev.over || ev.active.id === ev.over.id) return;
    const from = order.findIndex((e) => e.id === ev.active.id);
    const to = order.findIndex((e) => e.id === ev.over!.id);
    setOrder(arrayMove(order, from, to));
  };

  return (
    <section className="card initiative">
      <div className="card-head">
        <h2>{T('Orden de iniciativa', 'Initiative order')}</h2>
        <div className="row wrap">
          <button className="btn small" onClick={() => setEdit({ id: uid(), name: '', kind: 'ally', initiative: null })}>+ {T('Compañero', 'Ally')}</button>
          <button className="btn small" onClick={() => setEdit({ id: uid(), name: '', kind: 'enemy', initiative: null })}>+ {T('Enemigo', 'Enemy')}</button>
        </div>
      </div>
      {c.combat.initiative == null && (
        <button className="init-ask" onClick={() => setPrompt(true)}>🎲 {T('¿Cuánto has sacado en iniciativa? Toca para anotarla o tirarla.', 'What did you roll for initiative? Tap to enter or roll it.')}</button>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((e) => e.id)} strategy={rectSortingStrategy}>
          <div className="bubbles">
            {order.map((e, i) => (
              <Bubble key={e.id} entry={e} index={i} active={i === c.combat.turn} name={nameOf(e) || T('Sin nombre', 'Unnamed')} onEdit={() => (e.kind === 'self' ? setPrompt(true) : setEdit(e))} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="hint">{T('Mantén pulsada una burbuja y arrástrala para cambiar el orden. Tócala para editarla.', 'Press and hold a bubble and drag it to reorder. Tap it to edit.')}</p>
      <div className="row wrap">
        <button className="btn small" onClick={sortByInitiative}>↕️ {T('Ordenar por iniciativa', 'Sort by initiative')}</button>
        <button className="btn small primary grow" onClick={endTurn}>▶ {T('Siguiente turno', 'Next turn')}</button>
      </div>
      {edit && <EntryModal entry={edit} onClose={() => setEdit(null)} />}
      {prompt && <InitiativePrompt onClose={() => setPrompt(false)} />}
    </section>
  );
}

function EntryModal({ entry, onClose }: { entry: InitEntry; onClose: () => void }) {
  const c = useChar();
  const upsert = useStore((s) => s.upsertEntry);
  const remove = useStore((s) => s.removeEntry);
  const exists = c.combat.order.some((e) => e.id === entry.id);
  const [name, setName] = useState(entry.name);
  const [kind, setKind] = useState<'ally' | 'enemy'>(entry.kind === 'enemy' ? 'enemy' : 'ally');
  const [init, setInit] = useState<number | null>(entry.initiative);
  const [count, setCount] = useState(1);

  const save = () => {
    const base = name.trim() || (kind === 'enemy' ? T('Enemigo', 'Enemy') : T('Compañero', 'Ally'));
    if (!exists && count > 1) {
      // Varios enemigos iguales: «Goblin 1», «Goblin 2»…
      for (let i = 1; i <= count; i++) upsert({ id: uid(), name: `${base} ${i}`, kind, initiative: init });
    } else {
      upsert({ ...entry, name: base, kind, initiative: init });
    }
    onClose();
  };

  return (
    <Modal title={exists ? T('Editar', 'Edit') : kind === 'enemy' ? T('Añadir enemigo', 'Add enemy') : T('Añadir compañero', 'Add ally')} onClose={onClose}>
      <div className="segmented">
        <button className={kind === 'ally' ? 'on' : ''} onClick={() => setKind('ally')}>🛡️ {T('Compañero', 'Ally')}</button>
        <button className={kind === 'enemy' ? 'on' : ''} onClick={() => setKind('enemy')}>👹 {T('Enemigo', 'Enemy')}</button>
      </div>
      <label className="field">{T('Nombre', 'Name')}<input value={name} autoFocus placeholder={kind === 'enemy' ? T('Goblin', 'Goblin') : T('Thalia', 'Thalia')} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field">{T('Iniciativa (su tirada)', 'Initiative (their roll)')}
          <input type="number" inputMode="numeric" value={init ?? ''} onChange={(e) => setInit(e.target.value === '' ? null : Number(e.target.value))} />
        </label>
        {!exists && kind === 'enemy' && (
          <label className="field">{T('Cantidad', 'How many')}<NumberInput value={count} min={1} max={20} onChange={(n) => setCount(Math.max(1, Math.min(20, n)))} /></label>
        )}
      </div>
      <p className="hint">{T('Se coloca al final; luego arrástralo o pulsa «Ordenar por iniciativa».', 'It goes at the end; then drag it or tap “Sort by initiative”.')}</p>
      <div className="row">
        {exists && <button className="btn danger" onClick={() => { remove(entry.id); onClose(); }}>{T('Quitar', 'Remove')}</button>}
        <button className="btn primary grow" onClick={save}>{T('Guardar', 'Save')}</button>
      </div>
    </Modal>
  );
}
