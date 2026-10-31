import { useState } from 'react';
import { useChar, useStore } from '../store';
import { maxHp } from '../rules/calc';
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
                : <><b>{c.hp.current}</b>/{mhp}</>}
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
      <p className="hint">{T('«Temporales»: pon los PG temporales que te dan (un conjuro, un rasgo…). Se suman a tu vida y el daño los gasta primero. No se acumulan entre sí: si ya tienes, te quedas con el número mayor.', '“Temp”: enter the Temporary HP you’re granted (a spell, a feature…). They add to your life and damage uses them up first. They don’t stack with each other: you keep the higher number.')}</p>
      <p className="hint">{T('El daño se aplica en orden: inmunidad → resistencia → vulnerabilidad → PG temporales → PG. Se comprueban concentración, caída a 0 PG y muerte instantánea.', 'Damage is applied in order: immunity → resistance → vulnerability → temporary HP → HP. Concentration, dropping to 0 HP and instant death are checked.')}</p>
    </Modal>
  );
}
