import { useState } from 'react';
import { useChar, useStore } from '../store';
import { maxHp } from '../rules/calc';
import { DAMAGE_TYPES } from '../rules/srd';
import type { DamageType } from '../types';
import { Modal } from './common';

export function HpBar({ compact }: { compact?: boolean }) {
  const c = useChar();
  const [open, setOpen] = useState(false);
  const mhp = maxHp(c);
  const pct = Math.max(0, Math.min(100, (c.hp.current / mhp) * 100));
  const tempPct = Math.min(100 - pct, (c.hp.temp / mhp) * 100);
  const color = c.dead ? 'var(--muted)' : pct > 50 ? 'var(--hp-good)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-bad)';
  return (
    <>
      <button className={`hpbar ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)} aria-label="Puntos de golpe: tocar para modificar">
        <div className="hpbar-track">
          <div className="hpbar-fill" style={{ width: `${pct}%`, background: color }} />
          {c.hp.temp > 0 && <div className="hpbar-temp" style={{ left: `${pct}%`, width: `${tempPct}%` }} />}
        </div>
        <div className="hpbar-text">
          {c.dead ? '☠️ Muerto' : (
            <>
              ❤️ <b>{c.hp.current}</b>/{mhp}
              {c.hp.temp > 0 && <span className="temp"> +{c.hp.temp}</span>}
              {c.hp.current === 0 && !c.stable && <span className="warn"> · 💀 {c.deathSaves.success}✓ {c.deathSaves.fail}✗</span>}
              {c.hp.current === 0 && c.stable && <span> · Estable</span>}
            </>
          )}
        </div>
      </button>
      {open && <HpModal onClose={() => setOpen(false)} />}
    </>
  );
}

function HpModal({ onClose }: { onClose: () => void }) {
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
    if (kind === 'damage') run(`Recibo ${n} de daño${type ? ' ' + type : ''}${crit ? ' (crítico)' : ''}`, [{ type: 'damage', amount: n, damageType: type || null, critical: crit }]);
    if (kind === 'heal') run(`Me curo ${n}`, [{ type: 'heal', amount: n }]);
    if (kind === 'temp') run(`Gano ${n} PG temporales`, [{ type: 'tempHp', amount: n }]);
    onClose();
  };

  return (
    <Modal title="Puntos de golpe" onClose={onClose}>
      <p className="muted">PG {c.hp.current}/{maxHp(c)} · temporales {c.hp.temp}</p>
      <input className="big-input" inputMode="numeric" type="number" placeholder="Cantidad" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
      <div className="row wrap">
        <select value={type} onChange={(e) => setType(e.target.value as DamageType | '')} aria-label="Tipo de daño">
          <option value="">Tipo de daño (opcional)</option>
          {DAMAGE_TYPES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Crítico</label>
      </div>
      <div className="row">
        <button className="btn danger grow" disabled={!valid} onClick={() => go('damage')}>Daño</button>
        <button className="btn good grow" disabled={!valid} onClick={() => go('heal')}>Curar</button>
        <button className="btn grow" disabled={!valid} onClick={() => go('temp')}>Temporales</button>
      </div>
      {c.hp.current === 0 && !c.dead && (
        <div className="row">
          <button className="btn grow" onClick={() => { run(null, [{ type: 'deathSave' }]); onClose(); }}>💀 Tirar salvación contra la muerte</button>
        </div>
      )}
      {c.dead && (
        <button className="btn" onClick={() => { update((x) => { x.dead = false; x.hp.current = 1; x.deathSaves = { success: 0, fail: 0 }; x.conditions = x.conditions.filter((k) => k !== 'inconsciente'); }); onClose(); }}>
          Revivir con 1 PG (p. ej. Revivificar)
        </button>
      )}
      <p className="hint">El daño se aplica en orden: inmunidad → resistencia → vulnerabilidad → PG temporales → PG. Se comprueban concentración, caída a 0 PG y muerte instantánea.</p>
    </Modal>
  );
}
