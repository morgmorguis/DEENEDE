// Tesoro: catálogo de objetos, plantilla para crear objetos propios, la caja «Objetos» de la ficha
// y la pestaña «Tesoro» del DM para dar oro y objetos a un jugador y ver el registro de lo entregado.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChar, useStore } from '../store';
import { useParty, giftLines } from '../party/client';
import type { Gift, RoomView } from '../party/protocol';
import type { OwnedItem } from '../types';
import {
  COIN_KEYS, ITEM_TYPES, NO_COINS, RARITIES, RARITY, blankItem, coinLabel, coinName, coinsInGold, coinsText, fromCatalog, hasCoins,
  itemLine, searchCatalog, suggestedValue, valueText, type Coins5, type ItemData, type ItemType, type Rarity,
} from '../rules/items';
import { uid } from '../rules/factory';
import { Modal, NumberInput, Section } from './common';
import { confirmDelete } from './Confirm';
import { L, T, locale } from '../i18n';

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className="rarity-tag" style={{ color: RARITY[rarity].color, borderColor: RARITY[rarity].color }}>{L(RARITY[rarity].name)}</span>;
}

const NO_ITEMS: ItemData[] = [];
const itemsValue = (items: Pick<ItemData, 'value' | 'qty'>[]) => items.reduce((s, i) => s + (i.value || 0) * (i.qty || 1), 0);

// ---------- Plantilla de objeto ----------

/** Crear o editar un objeto: nombre, rareza, tipo, descripción, valor, peso, sintonización y cantidad */
export function ItemForm({ initial, title, onSave, onClose, allowTemplate = true }: { initial?: ItemData; title?: string; onSave: (i: ItemData, asTemplate: boolean) => void; onClose: () => void; allowTemplate?: boolean }) {
  const [f, setF] = useState<ItemData>(initial ?? blankItem());
  const [tpl, setTpl] = useState(false);
  const sug = suggestedValue(f.rarity, f.type);
  return (
    <Modal title={title ?? T('Crear objeto', 'Create item')} onClose={onClose}>
      <label className="field">{T('Nombre', 'Name')}<input value={f.name} autoFocus placeholder={T('Espada de la luna rota', 'Sword of the Broken Moon')} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field">{T('Rareza', 'Rarity')}
          <select value={f.rarity} style={{ color: RARITY[f.rarity].color }} onChange={(e) => setF({ ...f, rarity: e.target.value as Rarity })}>
            {RARITIES.map((r) => <option key={r} value={r}>{L(RARITY[r].name)}</option>)}
          </select>
        </label>
        <label className="field">{T('Tipo', 'Type')}
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ItemType })}>
            {(Object.keys(ITEM_TYPES) as ItemType[]).map((t) => <option key={t} value={t}>{L(ITEM_TYPES[t])}</option>)}
          </select>
        </label>
        <label className="field">{T('Valor (po)', 'Value (gp)')}
          <input type="number" inputMode="decimal" min={0} step="any" value={f.value || ''} onChange={(e) => setF({ ...f, value: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="field">{T('Peso (lb)', 'Weight (lb)')}
          <input type="number" inputMode="decimal" min={0} step="any" value={f.weight || ''} onChange={(e) => setF({ ...f, weight: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="field">{T('Cantidad', 'Quantity')}
          <NumberInput value={f.qty} min={1} max={9999} onChange={(n) => setF({ ...f, qty: Math.max(1, n) })} />
        </label>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!f.attunement} onChange={(e) => setF({ ...f, attunement: e.target.checked })} /> ✨ {T('Requiere sintonización', 'Requires attunement')}</label>
      </div>
      {sug > 0 && f.value !== sug && (
        <button className="btn small" onClick={() => setF({ ...f, value: sug })}>💡 {T(`Precio orientativo DMG 2024: ${valueText(sug)}`, `DMG 2024 guide price: ${valueText(sug)}`)}</button>
      )}
      <label className="field">{T('Descripción (efecto, cargas, historia…)', 'Description (effect, charges, lore…)')}
        <textarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      {allowTemplate && <label className="check"><input type="checkbox" checked={tpl} onChange={(e) => setTpl(e.target.checked)} /> 💾 {T('Guardar también como plantilla para reutilizarlo', 'Also save as a template to reuse it')}</label>}
      <button className="btn primary full" disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim() }, tpl)}>{T('Listo', 'Done')}</button>
    </Modal>
  );
}

// ---------- Elegir objeto: catálogo, plantillas o crear ----------

export function ItemPicker({ onPick, onClose, title }: { onPick: (i: ItemData) => void; onClose: () => void; title?: string }) {
  const custom = useStore((s) => s.settings.customItems) ?? NO_ITEMS;
  const setSettings = useStore((s) => s.setSettings);
  const [q, setQ] = useState('');
  const [rar, setRar] = useState<Rarity | ''>('');
  const [src, setSrc] = useState<'catalog' | 'mine'>('catalog');
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState<ItemData | null>(null);
  const list = useMemo(() => searchCatalog(q).filter((x) => !rar || x.rarity === rar), [q, rar]);
  const mine = custom.filter((x) => (!rar || x.rarity === rar) && x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const saveTemplate = (i: ItemData) => setSettings({ customItems: [...custom.filter((x) => x.name !== i.name), { ...i, qty: 1 }] });
  if (form) {
    return <ItemForm initial={form} onClose={() => setForm(null)} onSave={(i, tpl) => { if (tpl) saveTemplate(i); onPick(i); }} />;
  }
  return (
    <Modal title={title ?? T('Añadir objeto', 'Add item')} onClose={onClose}>
      <div className="segmented">
        <button className={src === 'catalog' ? 'on' : ''} onClick={() => setSrc('catalog')}>📖 {T('Catálogo', 'Catalog')}</button>
        <button className={src === 'mine' ? 'on' : ''} onClick={() => setSrc('mine')}>💾 {T(`Mis plantillas (${custom.length})`, `My templates (${custom.length})`)}</button>
      </div>
      <div className="row">
        <input className="grow" value={q} placeholder={T('Buscar: poción, +1, anillo, gema…', 'Search: potion, +1, ring, gem…')} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => setForm({ ...blankItem(), name: q.trim() })}>✏️ {T('Crear', 'Create')}</button>
      </div>
      <div className="chips scroll-x">
        <button className={`chip ${rar === '' ? 'on' : ''}`} onClick={() => setRar('')}>{T('Todas', 'All')}</button>
        {RARITIES.filter((r) => r !== 'artifact').map((r) => <button key={r} className={`chip ${rar === r ? 'on' : ''}`} style={{ color: RARITY[r].color }} onClick={() => setRar(r)}>{L(RARITY[r].name)}</button>)}
      </div>
      <label className="row small">{T('Cantidad', 'Quantity')} <NumberInput value={qty} min={1} max={999} onChange={(n) => setQty(Math.max(1, n))} /></label>
      <div className="item-pick-list">
        {src === 'catalog' && list.map((x) => (
          <button key={x.id} className="item-pick" onClick={() => onPick(fromCatalog(x, qty))}>
            <span className="grow"><b style={{ color: RARITY[x.rarity].color }}>{L(x.name)}</b>{x.attunement && ' ✨'}<br /><small className="muted">{L(x.text)}</small></span>
            <span className="item-pick-meta"><RarityTag rarity={x.rarity} /><small>{valueText(x.value)}</small></span>
          </button>
        ))}
        {src === 'mine' && mine.map((x) => (
          <div key={x.name} className="item-pick">
            <button className="grow plain" onClick={() => onPick({ ...x, qty })}>
              <b style={{ color: RARITY[x.rarity].color }}>{x.name}</b>{x.attunement && ' ✨'}<br /><small className="muted">{x.description}</small>
            </button>
            <span className="item-pick-meta">
              <RarityTag rarity={x.rarity} /><small>{valueText(x.value)}</small>
              <span className="row">
                <button className="btn small" aria-label={T('Editar', 'Edit')} onClick={() => setForm(x)}>✏️</button>
                <button className="btn small" aria-label={T('Borrar', 'Delete')} onClick={async () => { if (await confirmDelete(x.name)) setSettings({ customItems: custom.filter((y) => y !== x) }); }}>🗑️</button>
              </span>
            </span>
          </div>
        ))}
        {src === 'mine' && !mine.length && <p className="muted small">{T('Aún no tienes plantillas. Pulsa «Crear» y marca «Guardar también como plantilla».', 'No templates yet. Tap “Create” and tick “Also save as a template”.')}</p>}
        {src === 'catalog' && !list.length && <p className="muted small">{T('No hay nada con ese nombre. Pulsa «Crear» para hacerlo tú.', 'Nothing with that name. Tap “Create” to make it yourself.')}</p>}
      </div>
    </Modal>
  );
}

// ---------- Caja «Objetos» de la ficha ----------

function ItemDetail({ item, onClose }: { item: OwnedItem; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const [edit, setEdit] = useState(false);
  const attuned = c.attunement.includes(item.name);
  const set = (fn: (i: OwnedItem) => void) => update((x) => { const i = x.items.find((y) => y.id === item.id); if (i) fn(i); });
  const toggleAttune = () => update((x) => {
    const at = x.attunement.indexOf(item.name);
    if (at >= 0) { x.attunement[at] = ''; return; }
    const free = x.attunement.findIndex((s) => !s.trim());
    if (free >= 0) x.attunement[free] = item.name;
  });
  if (edit) {
    return <ItemForm initial={item} title={T('Editar objeto', 'Edit item')} allowTemplate={false} onClose={() => setEdit(false)} onSave={(i) => {
      update((x) => {
        const it = x.items.find((y) => y.id === item.id);
        if (!it) return;
        const at = x.attunement.indexOf(it.name);
        if (at >= 0) x.attunement[at] = i.name;
        Object.assign(it, i);
      });
      onClose();
    }} />;
  }
  const full = !attuned && c.attunement.every((s) => s.trim());
  return (
    <Modal title={item.name} onClose={onClose}>
      <p className="row"><RarityTag rarity={item.rarity} /> <span className="small muted">{L(ITEM_TYPES[item.type])}{item.weight ? ` · ${item.weight} lb` : ''} · {valueText(item.value)}{item.qty > 1 ? T(` c/u (${valueText(item.value * item.qty)} en total)`, ` each (${valueText(item.value * item.qty)} total)`) : ''}</span></p>
      {item.description && <p className="item-desc">{item.description}</p>}
      {item.from && <p className="hint">🎁 {T(`Te lo dio ${item.from}`, `Given by ${item.from}`)}{item.at ? ` · ${new Date(item.at).toLocaleDateString(locale())}` : ''}</p>}
      <label className="row">{T('Cantidad', 'Quantity')} <NumberInput value={item.qty} min={0} max={9999} onChange={(n) => set((i) => { i.qty = Math.max(0, n); })} /></label>
      {item.attunement && (
        <>
          <button className={`btn full ${attuned ? 'primary' : ''}`} disabled={full} onClick={toggleAttune}>✨ {attuned ? T('Sintonizado (toca para romper el vínculo)', 'Attuned (tap to end attunement)') : T('Sintonizarse (descanso corto)', 'Attune (Short Rest)')}</button>
          {full && <p className="hint">{T('Ya tienes 3 objetos sintonizados, el máximo de las reglas 2024. Rompe un vínculo primero.', 'You already have 3 attuned items, the 2024 maximum. End one first.')}</p>}
        </>
      )}
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await confirmDelete(item.name)) { update((x) => { x.items = x.items.filter((y) => y.id !== item.id); const at = x.attunement.indexOf(item.name); if (at >= 0) x.attunement[at] = ''; }); onClose(); } }}>🗑️ {T('Borrar', 'Delete')}</button>
        <button className="btn grow" onClick={() => setEdit(true)}>✏️ {T('Editar', 'Edit')}</button>
      </div>
    </Modal>
  );
}

export function ItemsBox() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const item = c.items.find((i) => i.id === open);
  const total = itemsValue(c.items);
  return (
    <div className="items-box">
      <span className="p-mini">{T('Objetos', 'Items')}{total > 0 && <span className="muted"> · {T('valor', 'value')} {valueText(total)}</span>}</span>
      {c.items.map((i) => (
        <button key={i.id} className={`item-row ${i.qty === 0 ? 'empty' : ''}`} onClick={() => setOpen(i.id)}>
          <span className="item-dot" style={{ background: RARITY[i.rarity].color }} aria-hidden />
          <span className="grow item-name">{itemLine(i)}{i.attunement && (c.attunement.includes(i.name) ? ' ✨' : ' ◇')}{i.from && ' 🎁'}</span>
          <small className="muted">{valueText(i.value)}</small>
        </button>
      ))}
      <button className="p-link" onClick={() => setAdding(true)}>＋ {T('Añadir objeto', 'Add item')}</button>
      {/* Fuera de la hoja de papel, para que no herede sus estilos ni quede bajo la barra superior */}
      {item && createPortal(<ItemDetail item={item} onClose={() => setOpen(null)} />, document.body)}
      {adding && createPortal(<ItemPicker onClose={() => setAdding(false)} onPick={(i) => { update((x) => { x.items.push({ ...i, id: uid(), at: Date.now() }); }); setAdding(false); }} />, document.body)}
    </div>
  );
}

/** «≈ 123 po en total» bajo las monedas */
export function CoinsTotal() {
  const c = useChar();
  const g = coinsInGold(c.coins);
  return g > 0 ? <p className="hint coins-total">≈ {valueText(Math.round(g * 100) / 100)} {T('en total', 'in total')}</p> : null;
}

// ---------- Pestaña «Tesoro» del DM ----------

const fmtDate = (at: number) => new Date(at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function GiftRow({ g, dm }: { g: Gift; dm: boolean }) {
  const send = useParty((s) => s.send);
  return (
    <li className={`gift-row ${g.delivered ? 'done' : 'pending'}`}>
      <div className="row">
        <span className="small muted grow">{fmtDate(g.at)}{dm && <> · <b>{g.toName}</b></>}</span>
        <span className={`gift-status ${g.delivered ? 'ok' : ''}`}>{g.delivered ? T('✅ En su ficha', '✅ On their sheet') : T('⏳ Pendiente', '⏳ Pending')}</span>
        {dm && !g.delivered && <button className="btn small" onClick={async () => { if (await confirmDelete(T('esta entrega', 'this gift'))) send({ t: 'giftCancel', id: g.id }); }}>✕</button>}
      </div>
      <ul className="gift-lines">
        {g.coins && hasCoins(g.coins) && <li>💰 {coinsText(g.coins)}</li>}
        {(g.items ?? []).map((i, k) => <li key={k}><span className="item-dot" style={{ background: RARITY[i.rarity].color }} aria-hidden /> {itemLine(i)} <small className="muted">· {L(RARITY[i.rarity].name)} · {valueText(i.value)}</small></li>)}
        {g.note && <li className="muted">✉️ {g.note}</li>}
      </ul>
    </li>
  );
}

/** Totales de lo entregado: monedas y valor de los objetos */
function Totals({ gifts }: { gifts: Gift[] }) {
  const coins: Coins5 = { ...NO_COINS };
  for (const g of gifts) for (const k of COIN_KEYS) coins[k] += g.coins?.[k] ?? 0;
  const items = gifts.flatMap((g) => g.items ?? []);
  const gold = coinsInGold(coins) + itemsValue(items);
  return (
    <p className="small gift-totals">
      {hasCoins(coins) ? `💰 ${coinsText(coins)}` : T('💰 sin monedas', '💰 no coins')} · 🎁 {items.reduce((s, i) => s + i.qty, 0)} {T('objetos', 'items')} · <b>≈ {valueText(Math.round(gold * 100) / 100)}</b>
    </p>
  );
}

function GiveForm({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const showToast = useStore((s) => s.showToast);
  // Conectados primero: es a quien normalmente se le da algo en la mesa
  const players = view.members.filter((m) => m.role === 'player').sort((a, b) => Number(b.online) - Number(a.online));
  const [to, setTo] = useState('');
  const [coins, setCoins] = useState<Coins5>({ ...NO_COINS });
  const [items, setItems] = useState<ItemData[]>([]);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const target = players.find((m) => m.id === to) ?? players[0];
  const ok = !!target && (hasCoins(coins) || items.length > 0);
  const give = () => {
    if (!target) return;
    send({ t: 'give', toId: target.id, coins, items, note });
    showToast(T(`🎁 Entregado a ${target.summary?.name ?? target.name}`, `🎁 Given to ${target.summary?.name ?? target.name}`), [...giftLines({ coins, items, note }), target.online ? T('Llega a su ficha ahora.', 'It reaches their sheet now.') : T('Está desconectado: le llegará al volver a conectarse.', 'They’re offline: it’ll arrive when they reconnect.')]);
    setCoins({ ...NO_COINS }); setItems([]); setNote('');
  };
  if (!players.length) return <p className="muted">{T(`Aún no hay jugadores en la partida. Código: ${view.code}`, `No players in the game yet. Code: ${view.code}`)}</p>;
  return (
    <>
      <label className="field">{T('Para', 'To')}
        <select value={target?.id ?? ''} onChange={(e) => setTo(e.target.value)}>
          {players.map((m) => <option key={m.id} value={m.id}>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}{m.summary && m.summary.name !== m.name ? ` (${m.name})` : ''}</option>)}
        </select>
      </label>
      <span className="p-mini">{T('Monedas', 'Coins')}</span>
      <div className="p-coins give-coins">
        {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
          <label key={k} title={coinName(k)}>
            <span>{coinLabel(k).toUpperCase()}</span>
            <NumberInput value={coins[k]} min={0} ariaLabel={coinName(k)} onChange={(n) => setCoins({ ...coins, [k]: Math.max(0, n) })} />
          </label>
        ))}
      </div>
      <div className="chips">
        {[10, 25, 50, 100, 250].map((n) => <button key={n} className="chip" onClick={() => setCoins({ ...coins, gp: coins.gp + n })}>+{n} {T('po', 'gp')}</button>)}
      </div>
      <span className="p-mini">{T('Objetos', 'Items')}</span>
      {items.map((i, k) => (
        <div key={k} className="item-row">
          <span className="item-dot" style={{ background: RARITY[i.rarity].color }} aria-hidden />
          <button className="grow plain item-name" onClick={() => setEditing(k)}>{itemLine(i)} <small className="muted">· {valueText(i.value)}</small></button>
          <button className="btn small" aria-label={T('Quitar', 'Remove')} onClick={() => setItems(items.filter((_, j) => j !== k))}>✕</button>
        </div>
      ))}
      <button className="btn full" onClick={() => setPicking(true)}>📦 {T('Añadir objeto (catálogo, plantillas o crear)', 'Add item (catalog, templates or create)')}</button>
      <label className="field">{T('Nota para el jugador (opcional)', 'Note for the player (optional)')}<input value={note} placeholder={T('Botín del dragón de la cripta', 'Loot from the crypt dragon')} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="btn primary full" disabled={!ok} onClick={give}>🎁 {T(`Dar a ${target?.summary?.name ?? target?.name ?? ''}`, `Give to ${target?.summary?.name ?? target?.name ?? ''}`)}</button>
      {picking && <ItemPicker title={T('Objeto para dar', 'Item to give')} onClose={() => setPicking(false)} onPick={(i) => { setItems([...items, i]); setPicking(false); }} />}
      {editing != null && items[editing] && <ItemForm initial={items[editing]} title={T('Editar objeto', 'Edit item')} onClose={() => setEditing(null)} onSave={(i, tpl) => {
        if (tpl) { const st = useStore.getState(); const custom = st.settings.customItems ?? []; st.setSettings({ customItems: [...custom.filter((x) => x.name !== i.name), { ...i, qty: 1 }] }); }
        setItems(items.map((x, j) => (j === editing ? i : x))); setEditing(null);
      }} />}
    </>
  );
}

export function TreasureTab() {
  const view = useParty((s) => s.view);
  const [who, setWho] = useState<string>('');
  if (!view) return <div className="tab"><p className="muted">{T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  const players = view.members.filter((m) => m.role === 'player');
  const gifts = [...view.gifts].reverse();
  const shown = who ? gifts.filter((g) => g.toId === who) : gifts;
  return (
    <div className="tab">
      <Section title={T('Dar oro y objetos', 'Give gold and items')}>
        <GiveForm view={view} />
      </Section>
      <Section title={T('Registro de entregas', 'Gift log')}>
        {players.length > 0 && (
          <div className="gift-summary">
            {players.map((m) => {
              const mine = view.gifts.filter((g) => g.toId === m.id);
              return (
                <button key={m.id} className={`gift-card ${who === m.id ? 'on' : ''}`} onClick={() => setWho(who === m.id ? '' : m.id)}>
                  <b>{m.summary?.name ?? m.name}</b>
                  {mine.length ? <Totals gifts={mine} /> : <span className="small muted">{T('Nada todavía', 'Nothing yet')}</span>}
                </button>
              );
            })}
          </div>
        )}
        {who && <button className="btn small" onClick={() => setWho('')}>← {T('Ver todas', 'Show all')}</button>}
        <ul className="gift-list">{shown.map((g) => <GiftRow key={g.id} g={g} dm />)}</ul>
        {!shown.length && <p className="muted small">{T('Aún no has dado nada. Lo que des queda guardado aquí, en el servidor de la partida.', 'You haven’t given anything yet. Everything you give is saved here, on the game server.')}</p>}
      </Section>
    </div>
  );
}

/** Para el jugador en «Partida»: lo que le ha dado el DM */
export function MyGifts({ view }: { view: RoomView }) {
  if (view.you.role !== 'player' || !view.gifts.length) return null;
  return (
    <Section title={T('🎁 Lo que te ha dado el DM', '🎁 What the DM gave you')}>
      <Totals gifts={view.gifts} />
      <ul className="gift-list">{[...view.gifts].reverse().map((g) => <GiftRow key={g.id} g={g} dm={false} />)}</ul>
    </Section>
  );
}
