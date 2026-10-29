import { useMemo, useState } from 'react';
import { useChar } from '../store';
import { fmt, rollContext, skillBonus } from '../rules/calc';
import { norm } from '../rules/parser';
import { ACTIONS, CONDITIONS, EFFECT_PRESETS, EXHAUSTION_INFO, MASTERIES, RULES, SKILLS, abilityShort } from '../rules/srd';

interface Entry {
  group: string;
  title: string;
  sub?: string;
  lines: string[];
  active?: boolean;
}

export function RulesTab() {
  const c = useChar();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('Todo');

  const entries = useMemo<Entry[]>(() => [
    ...CONDITIONS.map((x) => ({ group: 'Condiciones', title: x.name, lines: x.effects, active: c.conditions.includes(x.id) })),
    { group: 'Condiciones', title: 'Agotamiento', sub: c.exhaustion ? `Nivel actual: ${c.exhaustion}` : undefined, lines: EXHAUSTION_INFO, active: c.exhaustion > 0 },
    ...SKILLS.map((s) => {
      const ctx = rollContext(c, { kind: 'check', ability: s.ability, skill: s.id });
      const limits = [
        ...ctx.advantage.map((x) => `✅ Ahora tienes ventaja por ${x}`),
        ...ctx.disadvantage.map((x) => `⬇️ Ahora tienes desventaja por ${x}`),
        ...ctx.autoFail.map((x) => `⛔ ${x}`),
        ...ctx.penalties.map((x) => `➖ ${x}`),
      ];
      return { group: 'Habilidades', title: s.name, sub: `${abilityShort(s.ability)} · tu bonificador ${fmt(skillBonus(c, s.id))}`, lines: [s.desc, `Ejemplos: ${s.examples}`, ...limits], active: limits.length > 0 };
    }),
    ...ACTIONS.map((a) => ({ group: 'Acciones', title: a.name, sub: a.cost, lines: [a.text] })),
    ...RULES.map((r) => ({ group: 'Reglas', title: r.name, lines: r.text })),
    ...MASTERIES.map((m) => ({ group: 'Maestrías', title: m.name, lines: [m.text] })),
    ...EFFECT_PRESETS.map((p) => ({ group: 'Conjuros y efectos', title: p.name, sub: p.concentration ? 'Concentración' : undefined, lines: [p.notes], active: c.effects.some((e) => e.presetId === p.id) })),
    ...c.features.map((f) => ({ group: 'Mis rasgos', title: f.name, lines: [f.text] })),
  ], [c]);

  const groups = ['Todo', ...Array.from(new Set(entries.map((e) => e.group)))];
  const nq = norm(q);
  const shown = entries.filter((e) => (group === 'Todo' || e.group === group) && (!nq || norm(`${e.title} ${e.lines.join(' ')}`).includes(nq)));

  return (
    <div className="tab">
      <input className="search" placeholder="Buscar: derribado, sigilo, concentración…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll-x">
        {groups.map((g) => <button key={g} className={`chip toggle ${group === g ? 'on' : ''}`} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      {shown.length === 0 && <p className="muted">Nada encontrado.</p>}
      {shown.map((e) => (
        <details key={`${e.group}-${e.title}`} className={`rule ${e.active ? 'active' : ''}`} open={!!nq && shown.length <= 3}>
          <summary>
            <span className="grow">{e.active && '● '}{e.title}</span>
            <span className="muted small">{e.sub ?? e.group}</span>
          </summary>
          {e.lines.map((l, i) => <p key={i}>{l.startsWith('✅') || l.startsWith('⬇️') || l.startsWith('⛔') || l.startsWith('➖') ? l : `• ${l}`}</p>)}
        </details>
      ))}
      <p className="hint license">Contenido de reglas basado en el SRD 5.2 de Wizards of the Coast (licencia CC-BY-4.0), traducido y resumido.</p>
    </div>
  );
}
