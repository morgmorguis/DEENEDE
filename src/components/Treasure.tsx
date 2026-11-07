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
  itemLine, searchCatalog, suggestedValue, valueText, BASE_ARMORS, COIN_INFO, COIN_IN_CP, coinsWeight, exchangeCoins, CATALOG_MODS, equippable, type Coins5, type ItemData, type ItemMods, type ItemType, type Rarity,
} from '../rules/items';
import type { AbilityKey } from '../rules/itemTypes';
import { attackFromItem, needsAttunement } from '../rules/gear';
import { uid } from '../rules/factory';
import type { LootBundle } from '../store';
import { GearPlus, Modal, NumberInput, Section } from './common';
import { confirmDelete } from './Confirm';
import { L, T, locale } from '../i18n';

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span className="rarity-tag" style={{ color: RARITY[rarity].color, borderColor: RARITY[rarity].color }}>{L(RARITY[rarity].name)}</span>;
}

const NO_ITEMS: ItemData[] = [];
const itemsValue = (items: Pick<ItemData, 'value' | 'qty'>[]) => items.reduce((s, i) => s + (i.value || 0) * (i.qty || 1), 0);

// ---------- Efectos al equipar ----------

const AB_SHORT: Record<AbilityKey, [string, string]> = { str: ['FUE', 'STR'], dex: ['DES', 'DEX'], con: ['CON', 'CON'], int: ['INT', 'INT'], wis: ['SAB', 'WIS'], cha: ['CAR', 'CHA'] };
const abS = (a: AbilityKey) => T(...AB_SHORT[a]);
const sg = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** «CA 16 (pesada, FUE 13, desventaja en Sigilo)», «+1 CA», «FUE 19»… */
export function effectsText(m?: ItemMods): string[] {
  if (!m) return [];
  const out: string[] = [];
  if (m.armor) {
    const kind = { light: T('ligera', 'light'), medium: T('intermedia', 'medium'), heavy: T('pesada', 'heavy') }[m.armor.kind];
    out.push(`${T('CA', 'AC')} ${m.armor.base}${m.armor.kind === 'heavy' ? '' : m.armor.dexMax == null ? T(' + DES', ' + DEX') : T(` + DES (máx. ${m.armor.dexMax})`, ` + DEX (max ${m.armor.dexMax})`)} · ${kind}${m.armor.str ? ` · ${T('FUE', 'STR')} ${m.armor.str}` : ''}${m.armor.stealthDis ? ` · ${T('desventaja en Sigilo', 'Stealth Disadvantage')}` : ''}`);
  }
  if (m.shield) out.push(T(`Escudo: +${m.shield} CA`, `Shield: +${m.shield} AC`));
  if (m.ac) out.push(`${sg(m.ac)} ${T('CA', 'AC')}`);
  if (m.acNoArmor) out.push(T(`+${m.acNoArmor} CA sin armadura ni escudo`, `+${m.acNoArmor} AC without armor or shield`));
  if (m.saves) out.push(T(`${sg(m.saves)} a las salvaciones`, `${sg(m.saves)} to saving throws`));
  if (m.checks) out.push(T(`${sg(m.checks)} a las pruebas de característica`, `${sg(m.checks)} to ability checks`));
  for (const [a, v] of Object.entries(m.abilitySet ?? {})) if (v) out.push(T(`${abS(a as AbilityKey)} pasa a ser ${v}`, `${abS(a as AbilityKey)} becomes ${v}`));
  for (const [a, v] of Object.entries(m.abilityBonus ?? {})) if (v) out.push(`${abS(a as AbilityKey)} ${sg(v)}`);
  if (m.speed) out.push(T(`${sg(m.speed)} pies de velocidad`, `${sg(m.speed)} ft speed`));
  if (m.attack || m.damage) out.push(T(`${sg(m.attack ?? 0)} al ataque, ${sg(m.damage ?? 0)} al daño`, `${sg(m.attack ?? 0)} to attack, ${sg(m.damage ?? 0)} to damage`));
  if (m.weapon) out.push(`${m.weapon.dice} ${m.weapon.type}${m.weapon.range ? ` · ${m.weapon.range}` : ''}`);
  return out;
}

/** Editor de los efectos al equipar (armadura base, escudo, CA, salvaciones, características…) */
function ModsEditor({ mods, onChange }: { mods?: ItemMods; onChange: (m: ItemMods | undefined) => void }) {
  const m = mods ?? {};
  const set = (patch: Partial<ItemMods>) => {
    const next: ItemMods = { ...m, ...patch };
    for (const k of Object.keys(next) as (keyof ItemMods)[]) if (next[k] == null || next[k] === 0) delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const baseId = m.armor ? BASE_ARMORS.find((x) => { const a = CATALOG_MODS[x.id].armor!; return a.base === m.armor!.base && a.kind === m.armor!.kind; })?.id ?? '' : '';
  const setAb = Object.entries(m.abilitySet ?? {})[0] as [AbilityKey, number] | undefined;
  const bonAb = Object.entries(m.abilityBonus ?? {})[0] as [AbilityKey, number] | undefined;
  const num = (label: string, v: number | undefined, f: (n: number) => void) => (
    <label className="field">{label}<NumberInput value={v ?? 0} min={-10} max={30} onChange={f} /></label>
  );
  return (
    <details className="equip-box" open={!!mods}>
      <summary><b>⚙️ {T('Efectos al equipar', 'Effects when equipped')}</b>{mods ? ` · ${effectsText(mods).join(' · ')}` : ''}</summary>
      <label className="field">{T('Armadura base', 'Base armor')}
        <select value={baseId} onChange={(e) => set({ armor: e.target.value ? structuredClone(CATALOG_MODS[e.target.value].armor) : undefined })}>
          <option value="">— {T('no es armadura', 'not armor')}</option>
          {BASE_ARMORS.map((x) => <option key={x.id} value={x.id}>{L(x.name)} ({effectsText(CATALOG_MODS[x.id])[0]})</option>)}
        </select>
      </label>
      <div className="grid2">
        {num(T('CA del escudo (0 = no)', 'Shield AC (0 = none)'), m.shield, (n) => set({ shield: Math.max(0, n) }))}
        {num(T('CA extra', 'Extra AC'), m.ac, (n) => set({ ac: n }))}
        {num(T('Salvaciones', 'Saving throws'), m.saves, (n) => set({ saves: n }))}
        {num(T('Pruebas de característica', 'Ability checks'), m.checks, (n) => set({ checks: n }))}
        {num(T('Ataque (arma mágica)', 'Attack (magic weapon)'), m.attack, (n) => set({ attack: n }))}
        {num(T('Daño (arma mágica)', 'Damage (magic weapon)'), m.damage, (n) => set({ damage: n }))}
        {num(T('Velocidad (pies)', 'Speed (ft)'), m.speed, (n) => set({ speed: n }))}
        {num(T('CA sin armadura', 'AC without armor'), m.acNoArmor, (n) => set({ acNoArmor: Math.max(0, n) }))}
      </div>
      <div className="row adj-row">
        <span className="small">{T('Fija', 'Sets')}</span>
        <select value={setAb?.[0] ?? ''} onChange={(e) => set({ abilitySet: e.target.value ? { [e.target.value]: setAb?.[1] ?? 19 } : undefined })}>
          <option value="">—</option>
          {(Object.keys(AB_SHORT) as AbilityKey[]).map((a) => <option key={a} value={a}>{abS(a)}</option>)}
        </select>
        {setAb && <NumberInput value={setAb[1]} min={1} max={30} onChange={(n) => set({ abilitySet: { [setAb[0]]: n } })} />}
      </div>
      <div className="row adj-row">
        <span className="small">{T('Suma', 'Adds')}</span>
        <select value={bonAb?.[0] ?? ''} onChange={(e) => set({ abilityBonus: e.target.value ? { [e.target.value]: bonAb?.[1] ?? 2 } : undefined })}>
          <option value="">—</option>
          {(Object.keys(AB_SHORT) as AbilityKey[]).map((a) => <option key={a} value={a}>{abS(a)}</option>)}
        </select>
        {bonAb && <NumberInput value={bonAb[1]} min={-10} max={10} onChange={(n) => set({ abilityBonus: { [bonAb[0]]: n } })} />}
      </div>
      <p className="hint">{T('Se aplican al equipar el objeto en la ficha (y, si requiere sintonización, al sintonizarlo).', 'They apply when the item is equipped on the sheet (and attuned, if it requires attunement).')}</p>
    </details>
  );
}

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
      <ModsEditor mods={f.mods} onChange={(mods) => setF({ ...f, mods })} />
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
  const [giving, setGiving] = useState(false);
  const partyView = useParty((s) => s.view);
  const attuned = c.attunement.includes(item.name);
  const set = (fn: (i: OwnedItem) => void) => update((x) => { const i = x.items.find((y) => y.id === item.id); if (i) fn(i); });
  const toggleAttune = () => update((x) => {
    const at = x.attunement.indexOf(item.name);
    if (at >= 0) { x.attunement[at] = ''; return; }
    const free = x.attunement.findIndex((s) => !s.trim());
    if (free >= 0) x.attunement[free] = item.name;
  });
  const canEquip = equippable(item);
  const toggleEquip = () => update((x) => {
    const it = x.items.find((y) => y.id === item.id);
    if (!it) return;
    it.equipped = !it.equipped;
    if (it.equipped) {
      // Solo una armadura y un escudo a la vez
      if (it.mods?.armor) for (const o of x.items) if (o.id !== it.id && o.mods?.armor) o.equipped = false;
      if (it.mods?.shield) { x.shield = false; for (const o of x.items) if (o.id !== it.id && o.mods?.shield) o.equipped = false; }
      const atk = attackFromItem(x, it);
      if (atk && !x.attacks.some((a) => a.itemId === it.id)) x.attacks.push(atk);
    } else {
      x.attacks = x.attacks.filter((a) => a.itemId !== it.id);
    }
  });
  const fx = effectsText(item.mods);
  const waiting = needsAttunement(c, item);
  if (edit) {
    return <ItemForm initial={item} title={T('Editar objeto', 'Edit item')} allowTemplate={false} onClose={() => setEdit(false)} onSave={(i) => {
      update((x) => {
        const it = x.items.find((y) => y.id === item.id);
        if (!it) return;
        const at = x.attunement.indexOf(it.name);
        if (at >= 0) x.attunement[at] = i.name;
        for (const a of x.attacks) if (a.itemId === it.id) a.name = i.name;
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
      {canEquip && (
        <div className="equip-box">
          {fx.length > 0 ? fx.map((t) => <div key={t} className="gear-line"><GearPlus /> {t}</div>) : <p className="hint">{T('Sin efectos automáticos. Edítalo para añadirlos (CA, salvaciones, características…).', 'No automatic effects. Edit it to add some (AC, saves, abilities…).')}</p>}
          <button className={`btn full ${item.equipped ? 'primary' : ''}`} onClick={toggleEquip}>{item.equipped ? T('🛡️ Equipado (toca para quitártelo)', '🛡️ Equipped (tap to take it off)') : T('🛡️ Equipar', '🛡️ Equip')}</button>
          {waiting && <p className="hint warn">✨ {T('Requiere sintonización: sus efectos no se aplican hasta que te sintonices.', 'Requires attunement: its effects don’t apply until you attune to it.')}</p>}
          {item.equipped && (item.mods?.attack || item.mods?.damage) && !item.mods?.weapon && (
            <label className="field">{T('Se aplica al arma', 'Applies to weapon')}
              <select value={item.attackId ?? ''} onChange={(e) => set((i) => { i.attackId = e.target.value || undefined; })}>
                <option value="">— {T('elige una fila de Armas', 'pick a Weapons row')}</option>
                {c.attacks.map((a) => <option key={a.id} value={a.id}>{a.name || '—'}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <label className="row">{T('Cantidad', 'Quantity')} <NumberInput value={item.qty} min={0} max={9999} onChange={(n) => set((i) => { i.qty = Math.max(0, n); })} /></label>
      {item.attunement && (
        <>
          <button className={`btn full ${attuned ? 'primary' : ''}`} disabled={full} onClick={toggleAttune}>✨ {attuned ? T('Sintonizado (toca para romper el vínculo)', 'Attuned (tap to end attunement)') : T('Sintonizarse (descanso corto)', 'Attune (Short Rest)')}</button>
          {full && <p className="hint">{T('Ya tienes 3 objetos sintonizados, el máximo de las reglas 2024. Rompe un vínculo primero.', 'You already have 3 attuned items, the 2024 maximum. End one first.')}</p>}
        </>
      )}
      {partyView?.you.role === 'player' && partyView.members.some((m) => m.role === 'player' && m.id !== partyView.you.id) && (
        <button className="btn full" onClick={() => setGiving(true)}>🤝 {T('Dar a un compañero', 'Give to a companion')}</button>
      )}
      {giving && partyView && <GiveToFriend view={partyView} itemId={item.id} onClose={() => { setGiving(false); onClose(); }} />}
      <div className="row">
        <button className="btn danger" onClick={async () => { if (await confirmDelete(item.name)) { update((x) => { x.items = x.items.filter((y) => y.id !== item.id); x.attacks = x.attacks.filter((a) => a.itemId !== item.id); const at = x.attunement.indexOf(item.name); if (at >= 0) x.attunement[at] = ''; }); onClose(); } }}>🗑️ {T('Borrar', 'Delete')}</button>
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
          <span className="grow item-name">{itemLine(i)}{i.attunement && (c.attunement.includes(i.name) ? ' ✨' : ' ◇')}{i.from && ' 🎁'} {i.equipped && <span className={`item-eq ${needsAttunement(c, i) ? 'warn' : ''}`}>{needsAttunement(c, i) ? T('sin sintonizar', 'not attuned') : T('equipado', 'equipped')}</span>}</span>
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
  const [info, setInfo] = useState<keyof Coins5 | 'all' | null>(null);
  const g = coinsInGold(c.coins);
  const w = coinsWeight(c.coins);
  return (
    <>
      <div className="row coins-foot">
        <button className="p-link" onClick={() => setInfo('all')}>ℹ️ {T('¿Qué vale cada moneda?', 'What is each coin worth?')}</button>
        <span className="grow" />
        {g > 0 && <span className="hint coins-total">≈ {valueText(Math.round(g * 100) / 100)} {T('en total', 'in total')}{w >= 0.5 ? ` · ${Math.round(w * 10) / 10} lb` : ''}</span>}
      </div>
      {info && createPortal(<CoinInfoModal focus={info === 'all' ? undefined : info} onClose={() => setInfo(null)} />, document.body)}
    </>
  );
}

/** Abrir la explicación de una moneda desde fuera (etiquetas del recuadro Monedas) */
export function CoinLabel({ k }: { k: keyof Coins5 }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="coin-label" title={`${L(COIN_INFO[k].metal)} · ${L(COIN_INFO[k].text)}`} onClick={(e) => { e.preventDefault(); setOpen(true); }}>{coinLabel(k).toUpperCase()}</button>
      {open && createPortal(<CoinInfoModal focus={k} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

const ORDER: (keyof Coins5)[] = ['cp', 'sp', 'ep', 'gp', 'pp'];

/** Qué es cada moneda, equivalencias, ejemplos de precios, peso y un cambista sin comisión */
export function CoinInfoModal({ focus, onClose }: { focus?: keyof Coins5; onClose: () => void }) {
  const c = useChar();
  const update = useStore((s) => s.update);
  const [from, setFrom] = useState<keyof Coins5>(focus ?? 'cp');
  const [to, setTo] = useState<keyof Coins5>('gp');
  const [amount, setAmount] = useState(0);
  const result = exchangeCoins(c.coins, from, to, amount);
  const gets = amount > 0 ? (amount * COIN_IN_CP[from]) / COIN_IN_CP[to] : 0;
  const list = focus ? [focus, ...ORDER.filter((k) => k !== focus)] : ORDER;
  return (
    <Modal title={focus ? L(COIN_INFO[focus].metal) : T('Las monedas', 'Coins')} onClose={onClose}>
      <div className="coin-cards">
        {list.map((k) => (
          <div key={k} className={`coin-card ${k === focus ? 'on' : ''}`}>
            <div className="row"><span className="coin-emoji" aria-hidden>{COIN_INFO[k].emoji}</span><b className="grow">{L(COIN_INFO[k].metal)} <span className="muted">({coinLabel(k)})</span></b><span className="small">{T('tienes', 'you have')} <b>{c.coins[k] ?? 0}</b></span></div>
            <p className="small">{L(COIN_INFO[k].text)}</p>
            <p className="small muted">💰 {L(COIN_INFO[k].examples)}</p>
          </div>
        ))}
      </div>
      <table className="coin-table">
        <thead><tr><th></th>{ORDER.map((k) => <th key={k}>{coinLabel(k)}</th>)}</tr></thead>
        <tbody>
          {ORDER.map((a) => (
            <tr key={a}><th>1 {coinLabel(a)} =</th>{ORDER.map((b) => { const v = COIN_IN_CP[a] / COIN_IN_CP[b]; return <td key={b} className={a === b ? 'muted' : ''}>{v >= 1 ? v : `1/${1 / v}`}</td>; })}</tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{T('Se lee por filas: 1 po = 10 pp = 100 pc. 50 monedas (de cualquier tipo) pesan 1 libra.', 'Read across: 1 gp = 10 sp = 100 cp. 50 coins (of any kind) weigh 1 pound.')}</p>
      <div className="equip-box">
        <b>🔄 {T('Cambiar monedas', 'Exchange coins')}</b>
        <div className="row adj-row">
          <NumberInput value={amount} min={0} max={c.coins[from] ?? 0} onChange={(n) => setAmount(Math.max(0, Math.min(c.coins[from] ?? 0, n)))} />
          <select value={from} onChange={(e) => setFrom(e.target.value as keyof Coins5)}>{ORDER.map((k) => <option key={k} value={k}>{L(COIN_INFO[k].metal)}</option>)}</select>
          <span>→</span>
          <select value={to} onChange={(e) => setTo(e.target.value as keyof Coins5)}>{ORDER.map((k) => <option key={k} value={k}>{L(COIN_INFO[k].metal)}</option>)}</select>
        </div>
        {amount > 0 && <p className="small">{result ? T(`Recibes ${gets} ${coinLabel(to)}.`, `You get ${gets} ${coinLabel(to)}.`) : from === to ? T('Elige monedas distintas.', 'Pick different coins.') : T(`No sale exacto: ${amount} ${coinLabel(from)} son ${gets} ${coinLabel(to)}. Cambia una cantidad que dé un número entero.`, `Not exact: ${amount} ${coinLabel(from)} is ${gets} ${coinLabel(to)}. Exchange an amount that gives a whole number.`)}</p>}
        <button className="btn primary full" disabled={!result} onClick={() => { if (result) { update((x) => { x.coins = result; }); setAmount(0); } }}>🔄 {T('Cambiar', 'Exchange')}</button>
        <p className="hint">{T('Sin comisión. En la partida, un cambista o un banco pueden cobrar una parte: pregunta al DM.', 'No fee. In the game, a moneychanger or bank may take a cut: ask your DM.')}</p>
      </div>
    </Modal>
  );
}

// ---------- Pestaña «Tesoro» del DM ----------

const fmtDate = (at: number) => new Date(at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function GiftRow({ g, dm, me }: { g: Gift; dm: boolean; me?: string }) {
  const send = useParty((s) => s.send);
  const who = dm ? <> · {g.fromName ? <>{g.fromName} → </> : null}<b>{g.toName}</b></> : g.fromId === me ? <> · {T('para', 'to')} <b>{g.toName}</b></> : <> · {T('de', 'from')} <b>{g.fromName ?? 'DM'}</b></>;
  return (
    <li className={`gift-row ${g.delivered ? 'done' : 'pending'} ${g.fromName ? 'trade' : ''}`}>
      <div className="row">
        <span className="small muted grow">{fmtDate(g.at)}{who}</span>
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

export interface Loot { coins: Coins5; items: ItemData[]; note: string }
const emptyLoot = (): Loot => ({ coins: { ...NO_COINS }, items: [], note: '' });
const NO_BUNDLES: LootBundle[] = [];

/** Monedas, objetos y nota: se usa para dar ahora y para preparar botines antes de la partida */
function LootEditor({ loot, onChange }: { loot: Loot; onChange: (l: Loot) => void }) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const { coins, items, note } = loot;
  return (
    <>
      <span className="p-mini">{T('Monedas', 'Coins')}</span>
      <div className="p-coins give-coins">
        {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
          <label key={k} title={coinName(k)}>
            <span>{coinLabel(k).toUpperCase()}</span>
            <NumberInput value={coins[k]} min={0} ariaLabel={coinName(k)} onChange={(n) => onChange({ ...loot, coins: { ...coins, [k]: Math.max(0, n) } })} />
          </label>
        ))}
      </div>
      <div className="chips">
        {[10, 25, 50, 100, 250].map((n) => <button key={n} className="chip" onClick={() => onChange({ ...loot, coins: { ...coins, gp: coins.gp + n } })}>+{n} {T('po', 'gp')}</button>)}
      </div>
      <span className="p-mini">{T('Objetos', 'Items')}</span>
      {items.map((i, k) => (
        <div key={k} className="item-row">
          <span className="item-dot" style={{ background: RARITY[i.rarity].color }} aria-hidden />
          <button className="grow plain item-name" onClick={() => setEditing(k)}>{itemLine(i)} <small className="muted">· {valueText(i.value)}</small></button>
          <button className="btn small" aria-label={T('Quitar', 'Remove')} onClick={() => onChange({ ...loot, items: items.filter((_, j) => j !== k) })}>✕</button>
        </div>
      ))}
      <button className="btn full" onClick={() => setPicking(true)}>📦 {T('Añadir objeto (catálogo, plantillas o crear)', 'Add item (catalog, templates or create)')}</button>
      <label className="field">{T('Nota para el jugador (opcional)', 'Note for the player (optional)')}<input value={note} placeholder={T('Botín del dragón de la cripta', 'Loot from the crypt dragon')} onChange={(e) => onChange({ ...loot, note: e.target.value })} /></label>
      {picking && <ItemPicker title={T('Objeto para dar', 'Item to give')} onClose={() => setPicking(false)} onPick={(i) => { onChange({ ...loot, items: [...items, i] }); setPicking(false); }} />}
      {editing != null && items[editing] && <ItemForm initial={items[editing]} title={T('Editar objeto', 'Edit item')} onClose={() => setEditing(null)} onSave={(i, tpl) => {
        if (tpl) { const st = useStore.getState(); const custom = st.settings.customItems ?? []; st.setSettings({ customItems: [...custom.filter((x) => x.name !== i.name), { ...i, qty: 1 }] }); }
        onChange({ ...loot, items: items.map((x, j) => (j === editing ? i : x)) }); setEditing(null);
      }} />}
    </>
  );
}

const lootEmpty = (l: Loot) => !hasCoins(l.coins) && !l.items.length;
const bundleLine = (b: LootBundle) => [hasCoins(b.coins) ? coinsText(b.coins) : '', ...b.items.map(itemLine)].filter(Boolean).join(' · ') || T('vacío', 'empty');

/** Botines preparados (se guardan en este dispositivo; sirven sin estar conectado) */
export function BundleList({ onLoad }: { onLoad?: (b: LootBundle) => void }) {
  const bundles = useStore((s) => s.settings.lootBundles) ?? NO_BUNDLES;
  const setSettings = useStore((s) => s.setSettings);
  const [edit, setEdit] = useState<LootBundle | null>(null);
  const save = (b: LootBundle) => setSettings({ lootBundles: [...bundles.filter((x) => x.id !== b.id), b] });
  return (
    <>
      {bundles.length === 0 && <p className="muted small">{T('Aún no tienes botines preparados.', 'No prepared loot yet.')}</p>}
      <ul className="gift-list">
        {bundles.map((b) => (
          <li key={b.id} className="gift-row bundle-row">
            <div className="row">
              <b className="grow">🎒 {b.name || T('Botín', 'Loot')}</b>
              {onLoad && <button className="btn small primary" onClick={() => onLoad(b)}>{T('Usar', 'Use')}</button>}
              <button className="btn small" onClick={() => setEdit(b)}>✏️</button>
              <button className="btn small" onClick={async () => { if (await confirmDelete(b.name || T('botín', 'loot'))) setSettings({ lootBundles: bundles.filter((x) => x.id !== b.id) }); }}>🗑️</button>
            </div>
            <span className="small muted">{bundleLine(b)}</span>
          </li>
        ))}
      </ul>
      <button className="btn full" onClick={() => setEdit({ id: uid(), name: '', ...emptyLoot() })}>＋ {T('Preparar un botín', 'Prepare loot')}</button>
      {edit && (
        <Modal title={T('Botín preparado', 'Prepared loot')} onClose={() => setEdit(null)}>
          <label className="field">{T('Nombre', 'Name')}<input value={edit.name} autoFocus placeholder={T('Cofre de la cripta, recompensa del alcalde…', 'Crypt chest, mayor’s reward…')} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <LootEditor loot={edit} onChange={(l) => setEdit({ ...edit, ...l })} />
          <button className="btn primary full" disabled={lootEmpty(edit)} onClick={() => { save(edit); setEdit(null); }}>💾 {T('Guardar botín', 'Save loot')}</button>
        </Modal>
      )}
    </>
  );
}

function GiveForm({ view }: { view: RoomView }) {
  const send = useParty((s) => s.send);
  const showToast = useStore((s) => s.showToast);
  const setSettings = useStore((s) => s.setSettings);
  // Conectados primero: es a quien normalmente se le da algo en la mesa
  const players = view.members.filter((m) => m.role === 'player').sort((a, b) => Number(b.online) - Number(a.online));
  const [to, setTo] = useState('');
  const [loot, setLoot] = useState<Loot>(emptyLoot());
  const [fromBundle, setFromBundle] = useState<string | null>(null);
  const target = players.find((m) => m.id === to) ?? players[0];
  const ok = !!target && !lootEmpty(loot);
  const give = () => {
    if (!target) return;
    send({ t: 'give', toId: target.id, coins: loot.coins, items: loot.items, note: loot.note });
    showToast(T(`🎁 Entregado a ${target.summary?.name ?? target.name}`, `🎁 Given to ${target.summary?.name ?? target.name}`), [...giftLines(loot), target.online ? T('Llega a su ficha ahora.', 'It reaches their sheet now.') : T('Está desconectado: le llegará al volver a conectarse.', 'They’re offline: it’ll arrive when they reconnect.')]);
    setLoot(emptyLoot()); setFromBundle(null);
  };
  const saveBundle = () => {
    const bundles = useStore.getState().settings.lootBundles ?? [];
    const name = loot.note || `${T('Botín', 'Loot')} ${bundles.length + 1}`;
    setSettings({ lootBundles: [...bundles, { id: uid(), name, ...structuredClone(loot) }] });
    showToast(T('💾 Botín guardado', '💾 Loot saved'), [name]);
  };
  if (!players.length) return (
    <>
      <p className="muted">{T(`Aún no hay jugadores en la partida (código ${view.code}). Mientras tanto puedes preparar botines para darlos luego.`, `No players in the game yet (code ${view.code}). Meanwhile you can prepare loot to hand out later.`)}</p>
      <span className="p-mini">🎒 {T('Botines preparados', 'Prepared loot')}</span>
      <BundleList />
    </>
  );
  return (
    <>
      <label className="field">{T('Para', 'To')}
        <select value={target?.id ?? ''} onChange={(e) => setTo(e.target.value)}>
          {players.map((m) => <option key={m.id} value={m.id}>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}{m.summary && m.summary.name !== m.name ? ` (${m.name})` : ''}</option>)}
        </select>
      </label>
      {fromBundle && <p className="hint">🎒 {T(`Cargado: ${fromBundle}`, `Loaded: ${fromBundle}`)}</p>}
      <LootEditor loot={loot} onChange={setLoot} />
      <div className="row">
        <button className="btn" disabled={lootEmpty(loot)} onClick={saveBundle}>💾 {T('Guardar para luego', 'Save for later')}</button>
        <button className="btn primary grow" disabled={!ok} onClick={give}>🎁 {T(`Dar a ${target?.summary?.name ?? target?.name ?? ''}`, `Give to ${target?.summary?.name ?? target?.name ?? ''}`)}</button>
      </div>
      <details className="bundles">
        <summary className="small"><b>🎒 {T('Botines preparados', 'Prepared loot')}</b></summary>
        <BundleList onLoad={(b) => { setLoot({ coins: { ...b.coins }, items: structuredClone(b.items), note: b.note }); setFromBundle(b.name); }} />
      </details>
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
  const [giving, setGiving] = useState(false);
  if (view.you.role !== 'player') return null;
  const friends = view.members.filter((m) => m.role === 'player' && m.id !== view.you.id);
  const received = view.gifts.filter((g) => g.toId === view.you.id);
  return (
    <Section title={T('🎁 Objetos y monedas', '🎁 Items and coins')}>
      {friends.length > 0 && <button className="btn full" onClick={() => setGiving(true)}>🤝 {T('Dar a un compañero', 'Give to a companion')}</button>}
      {received.length > 0 && <><span className="p-mini">{T('Lo que has recibido', 'What you received')}</span><Totals gifts={received} /></>}
      <ul className="gift-list">{[...view.gifts].reverse().map((g) => <GiftRow key={g.id} g={g} dm={false} me={view.you.id} />)}</ul>
      {!view.gifts.length && <p className="muted small">{T('Aquí verás lo que te dé el DM o un compañero, y lo que tú des.', 'Here you’ll see what the DM or a companion gives you, and what you give.')}</p>}
      {giving && <GiveToFriend view={view} onClose={() => setGiving(false)} />}
    </Section>
  );
}

/** El personaje que se comparte en la partida (el activo si no hay otro) */
function useSharedChar() {
  const id = useParty((s) => s.conn?.characterId);
  const active = useChar();
  return useStore((s) => s.characters.find((c) => c.id === id)) ?? active;
}

/** Un jugador da monedas u objetos de su ficha a un compañero: se quitan de su ficha y le llegan al otro */
export function GiveToFriend({ view, itemId, onClose }: { view: RoomView; itemId?: string; onClose: () => void }) {
  const c = useSharedChar();
  const send = useParty((s) => s.send);
  const st = useStore.getState();
  const friends = view.members.filter((m) => m.role === 'player' && m.id !== view.you.id).sort((a, b) => Number(b.online) - Number(a.online));
  const [to, setTo] = useState(friends[0]?.id ?? '');
  const [coins, setCoins] = useState<Coins5>({ ...NO_COINS });
  const [sel, setSel] = useState<Record<string, number>>(itemId ? { [itemId]: 1 } : {});
  const [note, setNote] = useState('');
  const target = friends.find((m) => m.id === to);
  const items = c.items.filter((i) => i.qty > 0);
  const chosen = items.filter((i) => (sel[i.id] ?? 0) > 0);
  const ok = !!target && (hasCoins(coins) || chosen.length > 0) && COIN_KEYS.every((k) => coins[k] <= (c.coins[k] ?? 0));
  const give = () => {
    if (!target || !ok) return;
    const out: ItemData[] = chosen.map((i) => ({ name: i.name, rarity: i.rarity, type: i.type, description: i.description, value: i.value, weight: i.weight, attunement: i.attunement, qty: Math.min(i.qty, sel[i.id]), ...(i.ref ? { ref: i.ref } : {}), ...(i.mods ? { mods: i.mods } : {}) }));
    // Sale de tu ficha
    const next = structuredClone(c);
    for (const k of COIN_KEYS) next.coins[k] = Math.max(0, (next.coins[k] ?? 0) - coins[k]);
    for (const i of chosen) {
      const it = next.items.find((x) => x.id === i.id)!;
      it.qty -= Math.min(it.qty, sel[i.id]);
      if (it.qty <= 0) {
        next.items = next.items.filter((x) => x.id !== it.id);
        next.attacks = next.attacks.filter((a) => a.itemId !== it.id);
        const at = next.attunement.indexOf(it.name);
        if (at >= 0 && !next.items.some((x) => x.name === it.name)) next.attunement[at] = '';
      }
    }
    st.replace(next);
    send({ t: 'give', toId: target.id, coins, items: out, note });
    st.showToast(T(`🤝 Has dado a ${target.summary?.name ?? target.name}`, `🤝 You gave ${target.summary?.name ?? target.name}`), giftLines({ coins, items: out, note }));
    onClose();
  };
  const body = (
    <Modal title={T('Dar a un compañero', 'Give to a companion')} onClose={onClose}>
      {!friends.length ? <p className="muted">{T('No hay más jugadores en la partida.', 'There are no other players in the game.')}</p> : (
        <>
          <label className="field">{T('Para', 'To')}
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {friends.map((m) => <option key={m.id} value={m.id}>{m.online ? '🟢' : '⚪'} {m.summary?.name ?? m.name}</option>)}
            </select>
          </label>
          <span className="p-mini">{T('Monedas (de las tuyas)', 'Coins (from yours)')}</span>
          <div className="p-coins give-coins">
            {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
              <label key={k} title={coinName(k)}>
                <span>{coinLabel(k).toUpperCase()} <small className="muted">/{c.coins[k] ?? 0}</small></span>
                <NumberInput value={coins[k]} min={0} max={c.coins[k] ?? 0} ariaLabel={coinName(k)} onChange={(n) => setCoins({ ...coins, [k]: Math.max(0, Math.min(c.coins[k] ?? 0, n)) })} />
              </label>
            ))}
          </div>
          <span className="p-mini">{T('Objetos (de tu ficha)', 'Items (from your sheet)')}</span>
          {!items.length && <p className="muted small">{T('No tienes objetos en la lista «Objetos».', 'You have no items in the “Items” list.')}</p>}
          {items.map((i) => (
            <div key={i.id} className="item-row">
              <input type="checkbox" checked={(sel[i.id] ?? 0) > 0} onChange={(e) => setSel({ ...sel, [i.id]: e.target.checked ? 1 : 0 })} aria-label={i.name} />
              <span className="item-dot" style={{ background: RARITY[i.rarity].color }} aria-hidden />
              <span className="grow item-name">{i.name}{i.equipped && <span className="item-eq">{T('equipado', 'equipped')}</span>}</span>
              {(sel[i.id] ?? 0) > 0 && i.qty > 1 && <NumberInput value={sel[i.id]} min={1} max={i.qty} onChange={(n) => setSel({ ...sel, [i.id]: Math.max(1, Math.min(i.qty, n)) })} />}
              <small className="muted">×{i.qty}</small>
            </div>
          ))}
          <label className="field">{T('Nota (opcional)', 'Note (optional)')}<input value={note} placeholder={T('Te debía una', 'I owed you one')} onChange={(e) => setNote(e.target.value)} /></label>
          <p className="hint">{T('Se quita de tu ficha y le llega a su ficha (si está desconectado, al volver). El DM lo ve en su registro.', 'It leaves your sheet and reaches theirs (if they’re offline, when they return). The DM sees it in the log.')}</p>
          <button className="btn primary full" disabled={!ok} onClick={give}>🤝 {T(`Dar a ${target?.summary?.name ?? target?.name ?? ''}`, `Give to ${target?.summary?.name ?? target?.name ?? ''}`)}</button>
        </>
      )}
    </Modal>
  );
  return createPortal(body, document.body);
}
