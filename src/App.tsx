import { useEffect, useRef, useState } from 'react';
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
import { PartyTab } from './components/Party';
import { DmRosterTab } from './components/DmRoster';
import { TransitionFx, useFx } from './components/Transition';
import { resumeParty, useParty } from './party/client';
import { L, T, setLang } from './i18n';

type Tab = 'sheet' | 'combat' | 'party' | 'roster' | 'assistant' | 'rules' | 'settings';

export default function App() {
  const c = useChar();
  const lang = useStore((s) => s.settings.lang);
  const theme = useStore((s) => s.settings.theme);
  // El idioma vive en un módulo: lo fijamos antes de pintar los hijos
  setLang(lang);
  // Al abrir un enlace de la partida (?join= / ?dm=) se va directo a «Partida»
  const [tab, setTab] = useState<Tab>(() => (/[?&](join|dm)=/.test(window.location.search) ? 'party' : 'sheet'));
  useEffect(() => { resumeParty(); }, []);
  const partyOnline = useParty((s) => s.status === 'online');
  const sharedCombat = useParty((s) => !!s.view?.encounter.active);
  const sharedPhase = useParty((s) => s.view?.encounter.phase);
  const partyCode = useParty((s) => s.view?.code);
  // Conectado como DM: sin ficha de personaje, con Partida y Personajes
  const dmMode = useParty((s) => s.role === 'dm' && !!s.conn);
  const play = useFx((s) => s.play);

  // Transición «¡COMBATE!» cuando el DM empieza un combate compartido y «¡A LUCHAR!» cuando todos están listos
  const prev = useRef<{ active: boolean; phase?: string } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { active: sharedCombat, phase: sharedPhase };
    if (!before) return;
    if (sharedCombat && !before.active) {
      play('combat', undefined, T('Introduce tus datos y pulsa «Listo»', 'Enter your data and tap “Ready”'));
      setTab('party');
    } else if (sharedCombat && before.phase === 'setup' && sharedPhase === 'running') {
      play('combat', T('¡A LUCHAR!', 'FIGHT!'));
    }
  }, [sharedCombat, sharedPhase, play]);
  useEffect(() => {
    if (dmMode && (tab === 'sheet' || tab === 'combat' || tab === 'assistant')) setTab('party');
  }, [dmMode, tab]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#1b1512');
  }, [theme]);
  const [notesOpen, setNotesOpen] = useState(false);
  const inCombat = c.combat.active;
  const endTurn = useStore((s) => s.endTurn);
  const cls = classById(c.classId);

  const tabs: { id: Tab; icon: string; label: string }[] = dmMode ? [
    { id: 'party', icon: sharedCombat ? '🔴' : '🎲', label: T('Partida', 'Game') },
    { id: 'roster', icon: '📋', label: T('Personajes', 'Characters') },
    { id: 'rules', icon: '📚', label: T('Reglas', 'Rules') },
    { id: 'settings', icon: '⚙️', label: T('Ajustes', 'Settings') },
  ] : [
    { id: 'sheet', icon: '🧙', label: T('Hoja', 'Sheet') },
    { id: 'combat', icon: '⚔️', label: T('Combate', 'Combat') },
    { id: 'party', icon: partyOnline ? (sharedCombat ? '🔴' : '🟢') : '🎲', label: T('Partida', 'Game') },
    { id: 'assistant', icon: '💬', label: T('Asistente', 'Assistant') },
    { id: 'rules', icon: '📚', label: T('Reglas', 'Rules') },
    { id: 'settings', icon: '⚙️', label: T('Ajustes', 'Settings') },
  ];

  return (
    <div className={`app ${inCombat ? 'in-combat' : ''}`} key={lang}>
      <header className="topbar">
        {dmMode ? (
          <div className="topbar-row dm-top">
            <b>🎲 DM</b>
            <span className="muted small grow">{T('Partida', 'Game')} {partyCode ?? '…'} · {partyOnline ? T('conectado', 'connected') : T('reconectando…', 'reconnecting…')}</span>
            {sharedCombat && <button className="combat-badge" onClick={() => setTab('party')}>⚔️ {sharedPhase === 'setup' ? T('Preparando', 'Getting ready') : T('En combate', 'In combat')}</button>}
          </div>
        ) : (<>
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
        </>)}
      </header>

      <main className="content">
        {tab === 'sheet' && <SheetTab />}
        {tab === 'combat' && <CombatTab />}
        {tab === 'party' && <PartyTab />}
        {tab === 'roster' && <DmRosterTab />}
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <NotesDrawer open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)} />
      <Toast />
      <InfoBubble />
      <TransitionFx />

      <nav className="bottomnav" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
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
