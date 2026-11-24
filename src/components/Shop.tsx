// Tienda del DM: el DM pone objetos con precio y existencias y la abre; los jugadores compran desde «Partida» y
// el objeto les llega a la ficha cobrándoles el precio (como una entrega del DM con cobro).
import { useEffect, useState } from 'react';
import { useParty } from '../party/client';
import type { RoomView, Shop, ShopItem } from '../party/protocol';
import { RARITY, coinsInGold, valueText, type ItemData } from '../rules/items';
import { uid } from '../rules/factory';
import { ItemForm, ItemPicker, RarityTag, useSharedChar } from './Treasure';
import { Modal, Section } from './common';
import { askOk, confirmDelete } from './Confirm';
import { L, T } from '../i18n';

const EMPTY: Shop = { open: false, name: '', items: [] };

/** DM, en «Tesoro»: preparar la tienda y abrirla o cerrarla */
export function DmShop({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const saved = view.shop ?? EMPTY;
  const [draft, setDraft] = useState<Shop>(saved);
  const [adding, setAdding] = useState<'catalog' | 'new' | null>(null);
  const [edit, setEdit] = useState<ShopItem | null>(null);
  // Si cambia en el servidor (una compra gasta existencias), se recoge salvo que haya cambios sin guardar
  const savedKey = JSON.stringify(saved);
  const [base, setBase] = useState(savedKey);
  const dirty = JSON.stringify(draft) !== base;
  useEffect(() => {
    if (!dirty) { setDraft(JSON.parse(savedKey)); setBase(savedKey); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);
  const save = (open = draft.open) => {
    const next = { ...draft, open, name: draft.name.trim() || T('Tienda', 'Shop') };
    send({ t: 'shopSave', shop: next });
    setDraft(next);
    setBase(JSON.stringify(next));
  };
  const add = (i: ItemData) => setDraft({ ...draft, items: [...draft.items, { id: uid(), item: { ...i, qty: 1 }, price: i.value, stock: null }] });
  const patch = (id: string, p: Partial<ShopItem>) => setDraft({ ...draft, items: draft.items.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const sales = view.gifts.filter((g) => g.shop).slice(-30).reverse();
  return (
    <Section title={T('🏪 Tienda', '🏪 Shop')} right={<span className={`shop-state ${saved.open ? 'on' : ''}`}>{saved.open ? T('Abierta', 'Open') : T('Cerrada', 'Closed')}</span>}>
      <p className="small muted">{T('Pon lo que vende el mercader y ábrela: los jugadores compran desde «Partida». Se les cobra al llegar a su ficha y la compra queda en el registro de entregas.', 'Add what the merchant sells and open it: players buy from “Game”. They’re charged when it reaches their sheet and the purchase stays in the gift log.')}</p>
      <label className="field">{T('Nombre', 'Name')}<input value={draft.name} placeholder={T('La Forja de Durgan', 'Durgan’s Forge')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <ul className="shop-list">
        {draft.items.map((x) => (
          <li key={x.id}>
            <button className="plain grow shop-name" onClick={() => setEdit(x)}><span className="item-dot" style={{ background: RARITY[x.item.rarity].color }} aria-hidden /> {x.item.name}</button>
            <label className="tiny">{T('po', 'gp')} <input className="num-input" type="number" min={0} step="0.01" value={x.price} onChange={(e) => patch(x.id, { price: Math.max(0, Number(e.target.value) || 0) })} style={{ width: '5em' }} /></label>
            <label className="tiny" title={T('Vacío = sin límite', 'Empty = unlimited')}>{T('quedan', 'stock')} <input className="num-input" type="number" min={0} value={x.stock ?? ''} placeholder="∞" onChange={(e) => patch(x.id, { stock: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })} style={{ width: '3.6em' }} /></label>
            <button className="icon-btn" aria-label={T(`Quitar ${x.item.name}`, `Remove ${x.item.name}`)} onClick={async () => { if (await confirmDelete(x.item.name)) setDraft({ ...draft, items: draft.items.filter((y) => y.id !== x.id) }); }}>🗑️</button>
          </li>
        ))}
      </ul>
      {!draft.items.length && <p className="small muted">{T('La tienda está vacía.', 'The shop is empty.')}</p>}
      <div className="row wrap">
        <button className="btn small" onClick={() => setAdding('catalog')}>📚 {T('Del catálogo', 'From the catalog')}</button>
        <button className="btn small" onClick={() => setAdding('new')}>✏️ {T('Crear objeto', 'Create item')}</button>
      </div>
      <div className="row">
        <button className="btn grow" disabled={!dirty} onClick={() => save()}>💾 {dirty ? T('Guardar cambios', 'Save changes') : T('Guardada', 'Saved')}</button>
        {saved.open
          ? <button className="btn grow" onClick={() => save(false)}>🔒 {T('Cerrar la tienda', 'Close the shop')}</button>
          : <button className="btn primary grow" disabled={!draft.items.length} onClick={() => save(true)}>🔓 {T('Abrir a los jugadores', 'Open to players')}</button>}
      </div>
      {sales.length > 0 && (
        <details>
          <summary className="small">{T(`Ventas (${sales.length})`, `Sales (${sales.length})`)}</summary>
          <ul className="small">{sales.map((g) => <li key={g.id}><b>{g.toName}</b>: {(g.items ?? []).map((i) => `${i.qty} × ${i.name}`).join(', ')} · {valueText(g.charge ?? 0)} {g.delivered ? '✅' : '⏳'}</li>)}</ul>
        </details>
      )}
      {adding === 'catalog' && <ItemPicker title={T('Añadir a la tienda', 'Add to the shop')} onPick={(i) => { add(i); setAdding(null); }} onClose={() => setAdding(null)} />}
      {adding === 'new' && <ItemForm allowTemplate={false} onSave={(i) => { add(i); setAdding(null); }} onClose={() => setAdding(null)} />}
      {edit && <ItemForm allowTemplate={false} title={T('Editar objeto', 'Edit item')} initial={edit.item} onSave={(i) => { patch(edit.id, { item: { ...i, qty: 1 } }); setEdit(null); }} onClose={() => setEdit(null)} />}
    </Section>
  );
}

/** Jugador, en «Partida»: la tienda abierta del DM */
export function PlayerShop({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const c = useSharedChar();
  const [show, setShow] = useState<ShopItem | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const shop = view.shop;
  if (view.you.role !== 'player' || !shop?.open) return null;
  // Lo que tienes menos lo que aún te tienen que cobrar
  const pending = view.gifts.filter((g) => g.toId === view.you.id && !g.delivered).reduce((s, g) => s + (g.charge ?? 0), 0);
  const gold = Math.round((coinsInGold(c.coins) - pending) * 100) / 100;
  const buy = async (x: ShopItem) => {
    const n = qty[x.id] ?? 1;
    const cost = Math.round(x.price * n * 100) / 100;
    if (!(await askOk(T(`¿Comprar ${n > 1 ? `${n} × ` : ''}${x.item.name} por ${valueText(cost)}?`, `Buy ${n > 1 ? `${n} × ` : ''}${x.item.name} for ${valueText(cost)}?`), { text: T('Te llega a la ficha y se te cobra de tus monedas.', 'It goes to your sheet and is paid from your coins.'), ok: T('🪙 Comprar', '🪙 Buy') }))) return;
    send({ t: 'buy', itemId: x.id, qty: n });
  };
  return (
    <Section title={`🏪 ${shop.name}`} right={<span className="small">💰 {valueText(Math.max(0, gold))}</span>}>
      <ul className="shop-list">
        {shop.items.map((x) => {
          const n = qty[x.id] ?? 1;
          const out = x.stock === 0;
          const cant = out || x.price * n > gold + 1e-9 || (x.stock != null && n > x.stock);
          return (
            <li key={x.id} className={out ? 'muted' : ''}>
              <button className="plain grow shop-name" onClick={() => setShow(x)}><span className="item-dot" style={{ background: RARITY[x.item.rarity].color }} aria-hidden /> {x.item.name}</button>
              <span className="small"><b>{valueText(x.price)}</b>{x.stock != null && <span className="tiny muted"> · {out ? T('agotado', 'sold out') : T(`quedan ${x.stock}`, `${x.stock} left`)}</span>}</span>
              {!out && <input className="num-input" type="number" min={1} max={x.stock ?? 99} value={n} aria-label={T('Cantidad', 'Quantity')} onChange={(e) => setQty({ ...qty, [x.id]: Math.max(1, Math.min(x.stock ?? 99, Math.round(Number(e.target.value) || 1))) })} style={{ width: '3.4em' }} />}
              <button className="btn small primary" disabled={cant} title={cant && !out ? T('No te llega el dinero', 'You can’t afford it') : undefined} onClick={() => void buy(x)}>🪙</button>
            </li>
          );
        })}
      </ul>
      {pending > 0 && <p className="tiny muted">{T(`Hay ${valueText(pending)} pendientes de cobrar.`, `${valueText(pending)} still to be charged.`)}</p>}
      {show && (
        <Modal title={show.item.name} onClose={() => setShow(null)}>
          <p><RarityTag rarity={show.item.rarity} /> · {valueText(show.price)}{show.item.attunement ? T(' · requiere sintonización', ' · requires attunement') : ''}</p>
          {show.item.description && <p className="pre small">{show.item.description}</p>}
          <p className="tiny muted">{L(RARITY[show.item.rarity].name)}</p>
        </Modal>
      )}
    </Section>
  );
}
