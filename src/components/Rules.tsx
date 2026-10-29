import { useMemo, useState } from 'react';
import { useChar, useStore } from '../store';
import { fmt, rollContext, skillBonus } from '../rules/calc';
import { norm } from '../rules/parser';
import { ACTIONS, CONDITIONS, COST_NAMES, EFFECT_PRESETS, EXHAUSTION_INFO, MASTERIES, RULES, SKILLS, abilityShort } from '../rules/srd';
import { L, T } from '../i18n';

interface Entry {
  group: string;
  title: string;
  sub?: string;
  lines: string[];
  active?: boolean;
}

export function RulesTab() {
  const c = useChar();
  const lang = useStore((s) => s.settings.lang);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => [
    ...CONDITIONS.map((x) => ({ group: T('Condiciones', 'Conditions'), title: L(x.name), lines: x.effects.map(L), active: c.conditions.includes(x.id) })),
    { group: T('Condiciones', 'Conditions'), title: T('Agotamiento', 'Exhaustion'), sub: c.exhaustion ? T(`Nivel actual: ${c.exhaustion}`, `Current level: ${c.exhaustion}`) : undefined, lines: EXHAUSTION_INFO.map(L), active: c.exhaustion > 0 },
    ...SKILLS.map((s) => {
      const ctx = rollContext(c, { kind: 'check', ability: s.ability, skill: s.id });
      const limits = [
        ...ctx.advantage.map((x) => `✅ ${T('Ahora tienes ventaja por', 'You currently have advantage from')} ${x}`),
        ...ctx.disadvantage.map((x) => `⬇️ ${T('Ahora tienes desventaja por', 'You currently have disadvantage from')} ${x}`),
        ...ctx.autoFail.map((x) => `⛔ ${x}`),
        ...ctx.penalties.map((x) => `➖ ${x}`),
      ];
      return { group: T('Habilidades', 'Skills'), title: L(s.name), sub: `${abilityShort(s.ability)} · ${T('tu bonificador', 'your bonus')} ${fmt(skillBonus(c, s.id))}`, lines: [L(s.desc), `${T('Ejemplos', 'Examples')}: ${L(s.examples)}`, ...limits], active: limits.length > 0 };
    }),
    ...ACTIONS.map((a) => ({ group: T('Acciones', 'Actions'), title: L(a.name), sub: L(COST_NAMES[a.cost]), lines: [L(a.text)] })),
    ...RULES.map((r) => ({ group: T('Reglas', 'Rules'), title: L(r.name), lines: r.text.map(L) })),
    ...MASTERIES.map((m) => ({ group: T('Maestrías', 'Masteries'), title: L(m.name), lines: [L(m.text)] })),
    ...EFFECT_PRESETS.map((p) => ({ group: T('Conjuros y efectos', 'Spells & effects'), title: L(p.name), sub: p.concentration ? T('Concentración', 'Concentration') : undefined, lines: [L(p.notes)], active: c.effects.some((e) => e.presetId === p.id) })),
    ...c.features.filter((f) => f.name).map((f) => ({ group: T('Mis rasgos', 'My features'), title: f.name, lines: [f.text] })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [c, lang]);

  const all = T('Todo', 'All');
  const groups = [all, ...Array.from(new Set(entries.map((e) => e.group)))];
  const current = group && groups.includes(group) ? group : all;
  const nq = norm(q);
  const shown = entries.filter((e) => (current === all || e.group === current) && (!nq || norm(`${e.title} ${e.lines.join(' ')}`).includes(nq)));

  return (
    <div className="tab">
      <input className="search" placeholder={T('Buscar: derribado, sigilo, concentración…', 'Search: prone, stealth, concentration…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll-x">
        {groups.map((g) => <button key={g} className={`chip toggle ${current === g ? 'on' : ''}`} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      {shown.length === 0 && <p className="muted">{T('Nada encontrado.', 'Nothing found.')}</p>}
      <div className="rules-list">
      {shown.map((e) => (
        <details key={`${e.group}-${e.title}`} className={`rule ${e.active ? 'active' : ''}`} open={!!nq && shown.length <= 3}>
          <summary>
            <span className="grow">{e.active && '● '}{e.title}</span>
            <span className="muted small">{e.sub ?? e.group}</span>
          </summary>
          {e.lines.map((l, i) => <p key={i}>{/^[✅⬇⛔➖]/.test(l) ? l : `• ${l}`}</p>)}
        </details>
      ))}
      </div>
      <p className="hint license">{T('Contenido de reglas basado en el SRD 5.2 de Wizards of the Coast (licencia CC-BY-4.0), traducido y resumido.', 'Rules content based on the Wizards of the Coast SRD 5.2 (CC-BY-4.0 license), summarized.')}</p>
    </div>
  );
}
