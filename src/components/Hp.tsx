import { useState } from 'react';
import { useChar, useStore } from '../store';
import { maxHp, rollExpr } from '../rules/calc';
import { uid } from '../rules/factory';
import { DAMAGE_TYPES } from '../rules/srd';
import type { DamageType } from '../types';
import { Modal } from './common';
import { L, T } from '../i18n';

export function HpBar() {
  const c = useChar();
  const [open, setOpen] = useState(false);
  const mhp = maxHp(c);
  // Si los temporales superan el máximo, la barra se escala para que se vean enteros
  const scale = Math.max(mhp, c.hp.current + c.hp.temp);
  const pct = Math.max(0, Math.min(100, (c.hp.current / scale) * 100));
  const tempPct = Math.min(100 - pct, (c.hp.temp / scale) * 100);
  const lifePct = (c.hp.current / mhp) * 100;
  const color = c.dead ? 'var(--muted)' : lifePct > 50 ? 'var(--hp-good)' : lifePct > 25 ? 'var(--hp-mid)' : 'var(--hp-bad)';
  return (
    <>
      <button className="hpbar" onClick={() => setOpen(true)} aria-label={T('Puntos de golpe: tocar para modificar', 'Hit points: tap to change')}>
        <div className="hpbar-track">
          <div className="hpbar-fill" style={{ width: `${pct}%`, background: color }} />
          {c.hp.temp > 0 && <div className="hpbar-temp" style={{ left: `${pct}%`, width: `${tempPct}%` }} />}
        </div>
        <div className="hpbar-text">
          {c.dead ? T('☠️ Muerto', '☠️ Dead') : (
            <>
              ❤️ {c.hp.temp > 0
                ? <><b>{c.hp.current + c.hp.temp}</b>/{mhp} <span className="temp">({c.hp.current} + {c.hp.temp} {T('temp.', 'temp')})</span></>
                : <><b>{c.hp.current}</b>/<span className={(c.hpMaxMods ?? []).length ? ((c.hpMaxMods ?? []).reduce((a, m) => a + m.amount, 0) < 0 ? 'max-down' : 'max-up') : ''}>{mhp}</span></>}
              {c.hp.current === 0 && !c.stable && <span className="warn"> · 💀 {c.deathSaves.success}✓ {c.deathSaves.fail}✗</span>}
              {c.hp.current === 0 && c.stable && <span> · {T('Estable', 'Stable')}</span>}
            </>
          )}
        </div>
      </button>
      {open && <HpModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function HpModal({ onClose }: { onClose: () => void }) {
  const c = useChar();
  const run = useStore((s) => s.runCommands);
  const update = useStore((s) => s.update);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DamageType | ''>('');
  const [crit, setCrit] = useState(false);
  const n = Math.floor(Number(amount));
  const valid = Number.isFinite(n) && n > 0;

  const go = (kind: 'damage' | 'heal' | 'temp') => {
    if (!valid) return;
    if (kind === 'damage') run(T(`Recibo ${n} de daño`, `I take ${n} damage`), [{ type: 'damage', amount: n, damageType: type || null, critical: crit }]);
    if (kind === 'heal') run(T(`Me curo ${n}`, `I heal ${n}`), [{ type: 'heal', amount: n }]);
    if (kind === 'temp') run(T(`Gano ${n} PG temporales`, `I gain ${n} temporary HP`), [{ type: 'tempHp', amount: n }]);
    onClose();
  };

  return (
    <Modal title={T('Puntos de golpe', 'Hit points')} onClose={onClose}>
      <p className="muted">{T('PG', 'HP')} {c.hp.current}/{maxHp(c)} · {T('temporales', 'temporary')} {c.hp.temp}{c.hp.temp > 0 ? ` · ${T('total', 'total')} ${c.hp.current + c.hp.temp}` : ''}</p>
      <input className="big-input" inputMode="numeric" type="number" placeholder={T('Cantidad', 'Amount')} value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
      <div className="row wrap">
        <select value={type} onChange={(e) => setType(e.target.value as DamageType | '')} aria-label={T('Tipo de daño', 'Damage type')}>
          <option value="">{T('Tipo de daño (opcional)', 'Damage type (optional)')}</option>
          {DAMAGE_TYPES.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> {T('Crítico', 'Critical')}</label>
      </div>
      <div className="row">
        <button className="btn danger grow" disabled={!valid} onClick={() => go('damage')}>{T('Daño', 'Damage')}</button>
        <button className="btn good grow" disabled={!valid} onClick={() => go('heal')}>{T('Curar', 'Heal')}</button>
        <button className="btn grow" disabled={!valid} onClick={() => go('temp')}>{T('Temporales', 'Temp')}</button>
      </div>
      {c.hp.current === 0 && !c.dead && (
        <button className="btn" onClick={() => { run(null, [{ type: 'deathSave' }]); onClose(); }}>💀 {T('Tirar salvación contra la muerte', 'Roll Death Saving Throw')}</button>
      )}
      {c.dead && (
        <button className="btn" onClick={() => { update((x) => { x.dead = false; x.hp.current = 1; x.deathSaves = { success: 0, fail: 0 }; x.conditions = x.conditions.filter((k) => k !== 'inconsciente'); }); onClose(); }}>
          {T('Revivir con 1 PG (p. ej. Revivificar)', 'Revive with 1 HP (e.g. Revivify)')}
        </button>
      )}
      <MaxHpMods />
      <p className="hint">{T('«Temporales»: pon los PG temporales que te dan (un conjuro, un rasgo…). Se suman a tu vida y el daño los gasta primero. No se acumulan entre sí: si ya tienes, te quedas con el número mayor.', '“Temp”: enter the Temporary HP you’re granted (a spell, a feature…). They add to your life and damage uses them up first. They don’t stack with each other: you keep the higher number.')}</p>
      <p className="hint">{T('El daño se aplica en orden: inmunidad → resistencia → vulnerabilidad → PG temporales → PG. Se comprueban concentración, caída a 0 PG y muerte instantánea.', 'Damage is applied in order: immunity → resistance → vulnerability → temporary HP → HP. Concentration, dropping to 0 HP and instant death are checked.')}</p>
    </Modal>
  );
}

/** Atajos habituales de cambios de PG máximos (reglas 2024) */
const MAX_PRESETS: { label: [string, string]; amount: number | 'ask'; sign: 1 | -1; until: 'long' | 'manual'; heal: boolean }[] = [
  { label: ['Ayuda (nivel 2)', 'Aid (level 2)'], amount: 5, sign: 1, until: 'manual', heal: true },
  { label: ['Ayuda (nivel 3)', 'Aid (level 3)'], amount: 10, sign: 1, until: 'manual', heal: true },
  { label: ['Ayuda (nivel 4)', 'Aid (level 4)'], amount: 15, sign: 1, until: 'manual', heal: true },
  { label: ['Banquete de héroes (2d10)', 'Heroes’ Feast (2d10)'], amount: 'ask', sign: 1, until: 'manual', heal: true },
  { label: ['Drenaje de vida (necrótico)', 'Life Drain (necrotic)'], amount: 'ask', sign: -1, until: 'long', heal: false },
];

/** Vida máxima temporal: sube (Ayuda, Banquete de héroes) o baja (drenajes necróticos) el máximo */
function MaxHpMods() {
  const c = useChar();
  const update = useStore((s) => s.update);
  const showToast = useStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [until, setUntil] = useState<'long' | 'manual'>('manual');
  const [heal, setHeal] = useState(true);
  const mods = c.hpMaxMods ?? [];
  const n = Math.floor(Number(amount));
  const ok = Number.isFinite(n) && n > 0;

  const add = () => {
    if (!ok) return;
    const delta = sign * n;
    const label = source.trim() || (sign > 0 ? T('Aumento de PG máximos', 'HP maximum increase') : T('Reducción de PG máximos', 'HP maximum reduction'));
    let died = false;
    update((x) => {
      x.hpMaxMods = [...(x.hpMaxMods ?? []), { id: uid(), amount: delta, source: label, until, at: Date.now() }];
      const max = maxHp(x);
      // Ayuda y Banquete de héroes también suben los PG actuales en lo mismo
      if (delta > 0 && heal) x.hp.current = Math.min(max, x.hp.current + delta);
      x.hp.current = Math.min(x.hp.current, max);
      // Reglas 2024: si los PG máximos llegan a 0, mueres
      if (max <= 0) { x.dead = true; x.hp.current = 0; died = true; }
    });
    showToast(sign > 0 ? T('❤️ PG máximos aumentados', '❤️ HP maximum increased') : T('🖤 PG máximos reducidos', '🖤 HP maximum reduced'), [
      `${label}: ${delta > 0 ? '+' : ''}${delta}`,
      ...(died ? [T('☠️ Tus PG máximos han llegado a 0: mueres (reglas 2024).', '☠️ Your HP maximum reached 0: you die (2024 rules).')] : []),
      until === 'long' ? T('Termina con un descanso largo.', 'Ends on a Long Rest.') : T('Quítalo cuando termine el efecto.', 'Remove it when the effect ends.'),
    ]);
    setAmount(''); setSource(''); setOpen(false);
  };
  const remove = (id: string) => update((x) => { x.hpMaxMods = (x.hpMaxMods ?? []).filter((m) => m.id !== id); x.hp.current = Math.min(x.hp.current, maxHp(x)); });

  return (
    <div className="maxhp-box">
      <div className="row">
        <b className="grow">{T('Vida máxima temporal', 'Temporary HP maximum')}</b>
        {!open && <button className="btn small" onClick={() => setOpen(true)}>＋ {T('Añadir', 'Add')}</button>}
      </div>
      {mods.map((m) => (
        <div key={m.id} className={`row maxhp-row ${m.amount < 0 ? 'neg' : 'pos'}`}>
          <span className="grow"><b>{m.amount > 0 ? '+' : ''}{m.amount}</b> · {m.source}{m.until === 'long' ? <small className="muted"> · {T('hasta descanso largo', 'until Long Rest')}</small> : null}</span>
          <button className="btn small" aria-label={T(`Quitar ${m.source}`, `Remove ${m.source}`)} onClick={() => remove(m.id)}>✕</button>
        </div>
      ))}
      {open && (
        <>
          <div className="chips">
            {MAX_PRESETS.map((p) => (
              <button key={p.label[1]} className="chip" onClick={() => {
                setSign(p.sign); setUntil(p.until); setHeal(p.heal); setSource(T(...p.label));
                if (p.amount === 'ask') setAmount(p.label[1].includes('2d10') ? String(rollExpr('2d10').total) : '');
                else setAmount(String(p.amount));
              }}>{p.sign > 0 ? '❤️' : '🖤'} {T(...p.label)}</button>
            ))}
          </div>
          <div className="segmented">
            <button className={sign > 0 ? 'on' : ''} onClick={() => { setSign(1); setHeal(true); }}>＋ {T('Aumentar', 'Increase')}</button>
            <button className={sign < 0 ? 'on' : ''} onClick={() => { setSign(-1); setUntil('long'); }}>− {T('Reducir', 'Reduce')}</button>
          </div>
          <div className="row">
            <input className="grow" type="number" inputMode="numeric" min={1} placeholder={T('Cuánto', 'How much')} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="grow" placeholder={T('Origen (Ayuda, espectro…)', 'Source (Aid, wraith…)')} value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <label className="field">{T('Dura', 'Lasts')}
            <select value={until} onChange={(e) => setUntil(e.target.value as 'long' | 'manual')}>
              <option value="manual">{T('Hasta que lo quite (p. ej. Ayuda: 8 horas)', 'Until I remove it (e.g. Aid: 8 hours)')}</option>
              <option value="long">{T('Hasta el próximo descanso largo', 'Until my next Long Rest')}</option>
            </select>
          </label>
          {sign > 0 && <label className="check"><input type="checkbox" checked={heal} onChange={(e) => setHeal(e.target.checked)} /> {T('Subir también los PG actuales en lo mismo (Ayuda, Banquete de héroes)', 'Also raise current HP by the same amount (Aid, Heroes’ Feast)')}</label>}
          <p className="hint">{sign > 0
            ? T('Ayuda: +5 PG máximos y actuales por cada nivel de espacio desde el 2.º, durante 8 horas.', 'Aid: +5 maximum and current HP per slot level from 2nd, for 8 hours.')
            : T('Algunos ataques necróticos (como el Drenaje de vida de un espectro o un tumulario) reducen tus PG máximos en el daño recibido hasta un descanso largo. Si llegan a 0, mueres.', 'Some necrotic attacks (like a wraith’s or wight’s Life Drain) reduce your HP maximum by the damage taken until a Long Rest. If it reaches 0, you die.')}</p>
          <div className="row">
            <button className="btn grow" onClick={() => setOpen(false)}>{T('Cancelar', 'Cancel')}</button>
            <button className={`btn grow ${sign > 0 ? 'good' : 'danger'}`} disabled={!ok} onClick={add}>{sign > 0 ? T(`Subir máximo +${ok ? n : ''}`, `Raise max +${ok ? n : ''}`) : T(`Bajar máximo −${ok ? n : ''}`, `Lower max −${ok ? n : ''}`)}</button>
          </div>
        </>
      )}
    </div>
  );
}
