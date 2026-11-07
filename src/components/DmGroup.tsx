// Pestaña «Grupo» del DM: el estado de cada jugador siempre a la vista, dentro y fuera de combate:
// vida, CA, condiciones, oro, dados de golpe, espacios de conjuro, recursos y objetos destacados.
import { useParty } from '../party/client';
import type { Member } from '../party/protocol';
import { Section } from './common';
import { T, locale } from '../i18n';

const gp = (n: number) => `${n.toLocaleString(locale(), { maximumFractionDigits: 1 })} ${T('po', 'gp')}`;

function hpColor(cur: number, max: number) {
  const p = max > 0 ? cur / max : 0;
  return p > 0.5 ? 'var(--hp-good)' : p > 0.25 ? 'var(--hp-mid)' : 'var(--hp-bad)';
}

function PlayerCard({ m }: { m: Member }) {
  const s = m.summary;
  if (!s) {
    return (
      <div className={`group-card ${m.online ? '' : 'offline'}`}>
        <b>{m.online ? '🟢' : '⚪'} {m.name}</b>
        <p className="muted small">{T('Aún no ha compartido su ficha.', 'Hasn’t shared a sheet yet.')}</p>
      </div>
    );
  }
  const pct = s.hpMax > 0 ? Math.max(0, Math.min(100, (s.hp / s.hpMax) * 100)) : 0;
  const tempPct = s.hpMax > 0 ? Math.min(100 - pct, (s.temp / s.hpMax) * 100) : 0;
  return (
    <div className={`group-card ${m.online ? '' : 'offline'} ${s.dead ? 'dead' : s.hp === 0 ? 'down' : ''}`}>
      <div className="row">
        <b className="grow">{m.online ? '🟢' : '⚪'} {s.name}</b>
        <span className="small muted">{s.species} {s.className} {s.level}</span>
      </div>
      {s.name !== m.name && <span className="tiny muted">{m.name}</span>}
      <div className="group-hp">
        <div className="hpbar-track"><div className="hpbar-fill" style={{ width: `${pct}%`, background: hpColor(s.hp, s.hpMax) }} />{s.temp > 0 && <div className="hpbar-temp" style={{ left: `${pct}%`, width: `${tempPct}%` }} />}</div>
        <span><b>{s.dead ? '☠️' : s.hp}</b>/{s.hpMax}{s.temp ? ` +${s.temp}` : ''} {T('PG', 'HP')}</span>
      </div>
      <div className="group-stats">
        <span>🛡️ {T('CA', 'AC')} <b>{s.ac}</b></span>
        <span>👁️ <b>{s.passive}</b></span>
        <span>🏃 <b>{s.speed}</b></span>
        {s.gold != null && <span title={s.coins ? Object.entries(s.coins).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(' · ') : ''}>💰 <b>{gp(s.gold)}</b></span>}
        {s.hitDice && <span>🎲 {s.hitDice.left}/{s.hitDice.total} {s.hitDice.die}</span>}
        {s.inspiration && <span className="good">✨ {T('Inspiración', 'Inspiration')}</span>}
        {!!s.exhaustion && <span className="bad">😩 {T('Agotamiento', 'Exhaustion')} {s.exhaustion}</span>}
      </div>
      {(s.conditions.length > 0 || s.concentration || s.deathSaves) && (
        <div className="group-conds">
          {s.concentration && <span className="cond-chip conc">🧠 {s.concentration}</span>}
          {s.conditions.map((c) => <span key={c} className="cond-chip">{c}</span>)}
          {s.deathSaves && <span className="cond-chip bad">💀 {s.deathSaves.success}✓ {s.deathSaves.fail}✗</span>}
        </div>
      )}
      {(s.slots?.length ?? 0) > 0 && (
        <div className="group-line"><span className="small muted">{T('Espacios', 'Slots')}</span>
          {s.slots!.map((x) => <span key={`${x.pact ? 'p' : ''}${x.level}`} className="slot-chip">{x.pact ? '⬟' : ''}{x.level}: <b>{x.left}</b>/{x.max}</span>)}
        </div>
      )}
      {(s.resources?.length ?? 0) > 0 && (
        <div className="group-line"><span className="small muted">{T('Recursos', 'Resources')}</span>
          {s.resources!.map((r) => <span key={r.name} className="slot-chip">{r.name}: <b>{r.left}</b>/{r.max}</span>)}
        </div>
      )}
      {(s.items?.length ?? 0) > 0 && <div className="group-line small"><span className="muted">{T('Objetos', 'Items')}</span> {s.items!.join(' · ')}</div>}
    </div>
  );
}

export function DmGroupTab() {
  const view = useParty((s) => s.view);
  if (!view) return <div className="tab"><p className="muted">{T('Conectando con la partida…', 'Connecting to the game…')}</p></div>;
  const players = view.members.filter((m) => m.role === 'player').sort((a, b) => Number(b.online) - Number(a.online));
  const withSheet = players.filter((m) => m.summary);
  const hp = withSheet.reduce((a, m) => a + Math.max(0, m.summary!.hp), 0);
  const hpMax = withSheet.reduce((a, m) => a + m.summary!.hpMax, 0);
  const gold = withSheet.reduce((a, m) => a + (m.summary!.gold ?? 0), 0);
  const down = withSheet.filter((m) => m.summary!.hp === 0).length;
  return (
    <div className="tab">
      <Section title={T('Estado del grupo', 'Party status')} right={<span className="small muted">{players.filter((m) => m.online).length}/{players.length} {T('conectados', 'online')}</span>}>
        {players.length === 0 ? <p className="muted">{T(`Aún no hay jugadores. Código: ${view.code}`, `No players yet. Code: ${view.code}`)}</p> : (
          <div className="group-totals">
            <div><b style={{ color: hpColor(hp, hpMax) }}>{hp}/{hpMax}</b><span>{T('PG del grupo', 'Party HP')}</span></div>
            <div><b>{gp(gold)}</b><span>{T('Oro total', 'Total gold')}</span></div>
            <div><b>{down}</b><span>{T('A 0 PG', 'At 0 HP')}</span></div>
            <div><b>{view.encounter.active ? `⚔️ ${T('Ronda', 'Round')} ${view.encounter.round}` : '🕊️'}</b><span>{view.encounter.active ? T('En combate', 'In combat') : T('Fuera de combate', 'Out of combat')}</span></div>
          </div>
        )}
      </Section>
      <div className="group-grid">{players.map((m) => <PlayerCard key={m.id} m={m} />)}</div>
      <p className="hint">{T('Se actualiza solo cada vez que un jugador cambia algo en su ficha. Solo tú ves el oro, los objetos y los recursos de cada uno.', 'Updates whenever a player changes their sheet. Only you see each player’s gold, items and resources.')}</p>
    </div>
  );
}
