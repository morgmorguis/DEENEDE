import { useEffect, useState } from 'react';
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
import { classById } from './rules/srd';
import { InfoBubble } from './components/InfoBubble';
import { L, T, setLang } from './i18n';

type Tab = 'sheet' | 'combat' | 'assistant' | 'rules' | 'settings';

export default function App() {
  const c = useChar();
  const lang = useStore((s) => s.settings.lang);
  const theme = useStore((s) => s.settings.theme);
  // El idioma vive en un módulo: lo fijamos antes de pintar los hijos
  setLang(lang);
  const [tab, setTab] = useState<Tab>('sheet');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#1b1512');
  }, [theme]);
  const [notesOpen, setNotesOpen] = useState(false);
  const inCombat = c.combat.active;
  const endTurn = useStore((s) => s.endTurn);
  const cls = classById(c.classId);

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'sheet', icon: '🧙', label: T('Hoja', 'Sheet') },
    { id: 'combat', icon: '⚔️', label: T('Combate', 'Combat') },
    { id: 'assistant', icon: '💬', label: T('Asistente', 'Assistant') },
    { id: 'rules', icon: '📚', label: T('Reglas', 'Rules') },
    { id: 'settings', icon: '⚙️', label: T('Ajustes', 'Settings') },
  ];

  return (
    <div className={`app ${inCombat ? 'in-combat' : ''}`} key={lang}>
      <header className="topbar">
        <div className="topbar-row">
          {c.portrait && <img className="top-avatar" src={c.portrait} alt="" onClick={() => setTab('sheet')} />}
          <button className="who" onClick={() => setTab('sheet')}>
            <b>{c.name || T('Sin nombre', 'Unnamed')}</b>
            <span className="muted small">{cls ? L(cls.name) : c.className} {c.level} · {T('CA', 'AC')} {armorClass(c).value}</span>
          </button>
          {inCombat ? (
            <button className="combat-badge" onClick={() => setTab('combat')}>⚔️ {T('Ronda', 'Round')} {c.combat.round}</button>
          ) : (
            <button className="btn small" onClick={() => setTab('combat')}>⚔️ {T('Combate', 'Combat')}</button>
          )}
        </div>
        <HpBar />
        {inCombat && tab !== 'combat' && (
          <div className="combat-strip">
            <span className={c.combat.action ? 'used' : ''}>{T('Acción', 'Action')}</span>
            <span className={c.combat.bonus ? 'used' : ''}>{T('Adicional', 'Bonus')}</span>
            <span className={c.combat.reaction ? 'used' : ''}>{T('Reacción', 'Reaction')}</span>
            <button className="link small" onClick={endTurn}>{T('Fin de turno', 'End turn')} ⏭️</button>
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
      <InfoBubble />

      <nav className="bottomnav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
