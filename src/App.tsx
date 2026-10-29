import { useState } from 'react';
import { useChar, useStore } from './store';
import { HpBar } from './components/Hp';
import { SheetTab } from './components/Sheet';
import { CombatTab } from './components/Combat';
import { AssistantTab } from './components/Assistant';
import { RulesTab } from './components/Rules';
import { SettingsTab } from './components/Settings';
import { NotesDrawer } from './components/Notes';
import { Toast } from './components/common';
import { armorClass } from './rules/calc';

type Tab = 'sheet' | 'combat' | 'assistant' | 'rules' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'sheet', icon: '🧙', label: 'Hoja' },
  { id: 'combat', icon: '⚔️', label: 'Combate' },
  { id: 'assistant', icon: '💬', label: 'Asistente' },
  { id: 'rules', icon: '📚', label: 'Reglas' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
];

export default function App() {
  const c = useChar();
  const [tab, setTab] = useState<Tab>('sheet');
  const [notesOpen, setNotesOpen] = useState(false);
  const inCombat = c.combat.active;
  const run = useStore((s) => s.runCommands);

  return (
    <div className={`app ${inCombat ? 'in-combat' : ''}`}>
      <header className="topbar">
        <div className="topbar-row">
          <button className="who" onClick={() => setTab('sheet')}>
            <b>{c.name}</b>
            <span className="muted small">{c.className} {c.level} · CA {armorClass(c).value}</span>
          </button>
          {inCombat ? (
            <button className="combat-badge" onClick={() => setTab('combat')}>⚔️ Ronda {c.combat.round}</button>
          ) : (
            <button className="btn small" onClick={() => { setTab('combat'); }}>⚔️ Combate</button>
          )}
        </div>
        <HpBar />
        {inCombat && tab !== 'combat' && (
          <div className="combat-strip">
            <span className={c.combat.action ? 'used' : ''}>Acción</span>
            <span className={c.combat.bonus ? 'used' : ''}>Adicional</span>
            <span className={c.combat.reaction ? 'used' : ''}>Reacción</span>
            <button className="link small" onClick={() => run('Fin de turno', [{ type: 'nextRound' }])}>Fin de turno ⏭️</button>
          </div>
        )}
      </header>

      <main className="content">
        {tab === 'sheet' && <SheetTab />}
        {tab === 'combat' && <CombatTab />}
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <NotesDrawer open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)} />
      <Toast />

      <nav className="bottomnav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
