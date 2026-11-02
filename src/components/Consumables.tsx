// Munición y consumibles: en la hoja se gestionan las cantidades; en combate se marca lo que gastas
// y al terminar se recupera lo que permiten las reglas.
import { useState } from 'react';
import { useChar, useStore } from '../store';
import type { Consumable } from '../types';
import { detectConsumables } from '../rules/consumables';
import { uid } from '../rules/factory';
import { T } from '../i18n';

const KIND_ICON: Record<Consumable['kind'], string> = { ammo: '🏹', thrown: '🗡️', item: '🧪' };
const kindLabel = (k: Consumable['kind']) => (k === 'ammo' ? T('Munición (recuperas la mitad)', 'Ammunition (recover half)') : k === 'thrown' ? T('Arrojadiza (se recoge)', 'Thrown (picked up)') : T('Consumible (se gasta)', 'Consumable (used up)'));

export function Consumables({ mode }: { mode: 'sheet' | 'combat' }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const use = useStore((s) => s.useConsumable);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('20');
  const [kind, setKind] = useState<Consumable['kind']>('ammo');
  const list = c.consumables ?? [];
  const detected = detectConsumables(c.inventory, list);

  if (mode === 'combat') {
    if (!list.length) return <p className="muted small">{T('No tienes munición ni consumibles apuntados. Añádelos en la hoja (Equipo).', 'You have no ammo or consumables listed. Add them on the sheet (Equipment).')}</p>;
    return (
      <div className="cons-combat">
        {list.map((x) => (
          <div key={x.id} className={`cons-row ${x.qty === 0 ? 'empty' : ''}`}>
            <span className="grow">{KIND_ICON[x.kind]} <b>{x.name}</b> <span className="muted small">× {x.qty}{x.used ? T(` · usadas en este combate: ${x.used}`, ` · used this combat: ${x.used}`) : ''}</span></span>
            {x.used > 0 && <button className="btn small" onClick={() => use(x.id, -1)} aria-label={T('Deshacer uno', 'Undo one')}>↩</button>}
            <button className="btn small primary" disabled={x.qty <= 0} onClick={() => use(x.id, 1)}>✓ {T('Usar 1', 'Use 1')}</button>
          </div>
        ))}
        <p className="hint">{T('Al terminar el combate recuperas la mitad de la munición gastada (redondeando abajo) y recoges las armas arrojadizas; los consumibles no vuelven.', 'When combat ends you recover half the ammunition used (rounded down) and pick up thrown weapons; consumables don’t come back.')}</p>
      </div>
    );
  }

  return (
    <div className="cons-sheet">
      <div className="p-title"><span>{T('Munición y consumibles', 'Ammo & consumables')}</span><button className="p-add" onClick={() => setAdding(!adding)}>+</button></div>
      {list.map((x) => (
        <div key={x.id} className="cons-row">
          <span className="grow">{KIND_ICON[x.kind]} {x.name}</span>
          <button className="p-step" onClick={() => update((ch) => { const y = ch.consumables.find((z) => z.id === x.id)!; y.qty = Math.max(0, y.qty - 1); })}>−</button>
          <input className="cons-qty" type="number" inputMode="numeric" value={x.qty} onChange={(e) => update((ch) => { ch.consumables.find((z) => z.id === x.id)!.qty = Math.max(0, Number(e.target.value) || 0); })} />
          <button className="p-step" onClick={() => update((ch) => { ch.consumables.find((z) => z.id === x.id)!.qty += 1; })}>+</button>
          <button className="p-link" aria-label={T(`Quitar ${x.name}`, `Remove ${x.name}`)} onClick={() => update((ch) => { ch.consumables = ch.consumables.filter((z) => z.id !== x.id); })}>✕</button>
        </div>
      ))}
      {detected.length > 0 && (
        <button className="p-link" onClick={() => update((ch) => { ch.consumables = [...ch.consumables, ...detected]; })}>
          🔎 {T(`Añadir lo que he encontrado en tu equipo: ${detected.map((d) => `${d.qty} ${d.name.toLowerCase()}`).join(', ')}`, `Add what I found in your equipment: ${detected.map((d) => `${d.qty} ${d.name.toLowerCase()}`).join(', ')}`)}
        </button>
      )}
      {adding && (
        <div className="cons-add">
          <input value={name} placeholder={T('Flechas, poción de curación…', 'Arrows, healing potion…')} onChange={(e) => setName(e.target.value)} />
          <input className="cons-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select value={kind} onChange={(e) => setKind(e.target.value as Consumable['kind'])}>
            {(['ammo', 'thrown', 'item'] as const).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
          <button className="btn small" disabled={!name.trim()} onClick={() => { update((ch) => { ch.consumables.push({ id: uid(), name: name.trim(), qty: Math.max(0, Number(qty) || 0), kind, used: 0 }); }); setName(''); setAdding(false); }}>{T('Añadir', 'Add')}</button>
        </div>
      )}
      {!list.length && !detected.length && !adding && <p className="p-empty">{T('Apunta aquí flechas, virotes, pociones… para marcarlas en combate.', 'List arrows, bolts, potions… here to tick them off in combat.')}</p>}
    </div>
  );
}
