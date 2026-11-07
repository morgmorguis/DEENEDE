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
import { PartyTab, TvView } from './components/Party';
import { DmRosterTab } from './components/DmRoster';
import { TreasureTab } from './components/Treasure';
import { DmGroupTab } from './components/DmGroup';
import { ImageNotifier } from './components/Images';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TransitionFx, useFx } from './components/Transition';
import { ConfirmHost } from './components/Confirm';
import { AvatarTab } from './components/Avatar';
import { useAvatarEditor } from './features';
import { resumeParty, useParty } from './party/client';
import { L, T, setLang } from './i18n';
import { applyScene } from './scenes';

type Tab = 'sheet' | 'avatar' | 'combat' | 'party' | 'group' | 'roster' | 'treasure' | 'assistant' | 'rules' | 'settings';

export default function App() {
  const c = useChar();
  const lang = useStore((s) => s.settings.lang);
  const theme = useStore((s) => s.settings.theme);
  const design = useStore((s) => s.settings.design ?? 'classic');
  const avatarOn = useAvatarEditor();
  // El idioma vive en un módulo: lo fijamos antes de pintar los hijos
  setLang(lang);
  // Al abrir un enlace de la partida (?join= / ?dm=) se va directo a «Partida»
  const [tab, setTab] = useState<Tab>(() => (/[?&](join|dm|view)=/.test(window.location.search) ? 'party' : 'sheet'));
  useEffect(() => { resumeParty(); }, []);
  const partyOnline = useParty((s) => s.status === 'online');
  const sharedCombat = useParty((s) => !!s.view?.encounter.active);
  const sharedPhase = useParty((s) => s.view?.encounter.phase);
  const partyCode = useParty((s) => s.view?.code);
  const joinedAt = useParty((s) => s.joinedAt);
  const role = useParty((s) => s.role);
  // Conexión discreta: al unirte fuera de combate vuelves a tu ficha; la app solo te interrumpe si el DM hace algo
  useEffect(() => {
    if (!joinedAt || role !== 'player' || sharedCombat) return;
    const t = window.setTimeout(() => {
      setTab((cur) => (cur === 'party' ? 'sheet' : cur));
      useStore.getState().showToast(T('🟢 Conectado a la partida', '🟢 Connected to the game'), [
        T('Sigue usando la app con normalidad. Te avisaré si el DM empieza un combate, te da algo o comparte una imagen.', 'Keep using the app as usual. I’ll let you know if the DM starts a combat, gives you something or shares an image.'),
        T('La pestaña Partida (🟢) tiene la party, las imágenes y lo que te han dado.', 'The Game tab (🟢) has the party, images and what you’ve been given.'),
      ]);
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedAt]);
  // Conectado como DM: sin ficha de personaje, con Partida y Personajes
  const dmMode = useParty((s) => s.role === 'dm' && !!s.conn);
  const viewerMode = useParty((s) => !!s.conn?.viewer);
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
    } else if (!sharedCombat && before.active && !dmMode) {
      // Fin del combate compartido: recuperar munición y recoger armas arrojadizas
      useStore.getState().recoverConsumables();
    } else if (sharedCombat && before.phase === 'setup' && sharedPhase === 'running') {
      play('combat', T('¡A LUCHAR!', 'FIGHT!'));
    }
  }, [sharedCombat, sharedPhase, play, dmMode]);
  useEffect(() => {
    if (!avatarOn && tab === 'avatar') setTab('sheet');
    if (dmMode && (tab === 'sheet' || tab === 'avatar' || tab === 'combat' || tab === 'assistant')) setTab('party');
    if (!dmMode && (tab === 'roster' || tab === 'treasure' || tab === 'group')) setTab('party');
  }, [dmMode, tab, avatarOn]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    applyScene(theme, design);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#1b1512');
  }, [theme, design]);
  const [notesOpen, setNotesOpen] = useState(false);
  const inCombat = c.combat.active;
  const endTurn = useStore((s) => s.endTurn);
  const cls = classById(c.classId);

  const tabs: { id: Tab; icon: string; label: string; short?: string }[] = dmMode ? [
    { id: 'party', icon: sharedCombat ? '🔴' : '🎲', label: T('Partida', 'Game') },
    { id: 'group', icon: '👥', label: T('Grupo', 'Party') },
    { id: 'roster', icon: '📋', label: T('Personajes', 'Characters') },
    { id: 'treasure', icon: '💰', label: T('Tesoro', 'Treasure') },
    { id: 'rules', icon: '📚', label: T('Reglas', 'Rules') },
    { id: 'settings', icon: '⚙️', label: T('Ajustes', 'Settings') },
  ] : [
    { id: 'sheet', icon: '🧙', label: T('Hoja', 'Sheet') },
    ...(avatarOn ? [{ id: 'avatar' as Tab, icon: '🎨', label: T('Aspecto', 'Looks') }] : []),
    { id: 'combat', icon: '⚔️', label: T('Combate', 'Combat') },
    { id: 'party', icon: partyOnline ? (sharedCombat ? '🔴' : '🟢') : '🎲', label: T('Partida', 'Game') },
    { id: 'assistant', icon: '💬', label: T('Asistente', 'Assistant'), short: T('Chat', 'Chat') },
    { id: 'rules', icon: '📚', label: T('Reglas', 'Rules') },
    { id: 'settings', icon: '⚙️', label: T('Ajustes', 'Settings') },
  ];

  if (viewerMode) return <div className="app" key={lang}><TvView /><TransitionFx /></div>;

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
          {c.portrait && <img className="top-avatar" src={c.portraitThumb ?? c.portrait} alt="" onClick={() => setTab('sheet')} />}
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
        <ErrorBoundary key={tab} where={tab} onBack={() => setTab(dmMode ? 'party' : 'sheet')}>
        {tab === 'sheet' && <SheetTab />}
        {avatarOn && tab === 'avatar' && <AvatarTab />}
        {tab === 'combat' && <CombatTab />}
        {tab === 'party' && <PartyTab />}
        {tab === 'roster' && <DmRosterTab />}
        {tab === 'treasure' && <TreasureTab />}
        {tab === 'group' && <DmGroupTab />}
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'settings' && <SettingsTab />}
        </ErrorBoundary>
      </main>

      <NotesDrawer open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)} />
      <Toast />
      <InfoBubble />
      <TransitionFx />
      <ImageNotifier />
      <ConfirmHost />

      <nav className="bottomnav" style={{ ['--nav-cols' as string]: tabs.length }}>
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.short ? <><span className="nl-long">{t.label}</span><span className="nl-short">{t.short}</span></> : t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
