import { useEffect, useRef, useState } from 'react';
import { speechLangFor, useChar, useStore } from '../store';
import { examplePhrases, parseInput } from '../rules/parser';
import { startRecording, type Recorder } from '../speech';
import type { LogEntry } from '../types';
import { T } from '../i18n';

const NO_LOG: LogEntry[] = [];


export function AssistantTab() {
  const c = useChar();
  const log = useStore((s) => s.log[s.activeId] ?? NO_LOG);
  const settings = useStore((s) => s.settings);
  const run = useStore((s) => s.runCommands);
  const pushLog = useStore((s) => s.pushLog);
  const undo = useStore((s) => s.undo);
  const quickRoll = useStore((s) => s.quickRoll);
  const clearLog = useStore((s) => s.clearLog);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Recorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  const submit = async (raw: string) => {
    const input = raw.trim();
    if (!input || busy) return;
    setText('');
    const parsed = parseInput(input, c);
    if (parsed.commands.length > 0) {
      run(input, parsed.commands, [], true);
      return;
    }
    if (settings.apiKey && settings.useAiFallback) {
      setBusy(true);
      pushLog({ role: 'user', text: input });
      const { describeError, interpretWithClaude } = await import('../ai');
      try {
        const res = await interpretWithClaude(settings.apiKey, settings.model, input, c);
        if (res.commands.length) run(null, res.commands, [`🤖 ${res.reply}`], true);
        else pushLog({ role: 'app', text: `🤖 ${res.reply}` });
      } catch (e) {
        pushLog({ role: 'app', text: `⚠️ ${describeError(e)}` });
      } finally {
        setBusy(false);
      }
      return;
    }
    pushLog({ role: 'user', text: input });
    pushLog({
      role: 'app',
      text: T('No he entendido qué cambiar. Prueba con frases como las de los ejemplos (incluye números: "me hace 7 de daño").', 'I didn’t understand what to change. Try phrases like the examples (include numbers: "hits me for 7").'),
      details: [T('Consejo: si añades tu clave de Claude en Ajustes, podré interpretar frases más libres.', 'Tip: add your Claude key in Settings and I’ll understand freer phrasing.')],
    });
  };

  const toggleDictation = async () => {
    if (rec) {
      setRec(null);
      const final = await rec.stop();
      if (final.trim()) setText(final.trim());
      return;
    }
    try {
      const r = await startRecording(speechLangFor(settings), {
        onText: (full, partial) => setText(`${full} ${partial}`.trim()),
        onError: (msg) => pushLog({ role: 'app', text: `⚠️ ${msg}` }),
      });
      setRec(r);
    } catch (e) {
      pushLog({ role: 'app', text: `⚠️ ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  return (
    <div className="tab chat-tab">
      <div className="chat-log">
        {log.length === 0 && (
          <div className="chat-empty">
            <p>{T('Cuéntame qué le pasa a', 'Tell me what happens to')} <b>{c.name}</b> {T('y actualizo la hoja aplicando las reglas 2024: resistencias, PG temporales, concentración, condiciones, muerte…', 'and I’ll update the sheet using the 2024 rules: resistances, temporary HP, concentration, conditions, death…')}</p>
            <div className="chips">
              {examplePhrases().map((e) => <button key={e} className="chip" onClick={() => void submit(e)}>{e}</button>)}
            </div>
          </div>
        )}
        {log.map((e) => (
          <div key={e.id} className={`msg ${e.role}`}>
            <div className="msg-text">{e.text}</div>
            {e.details && e.details.length > 0 && (
              <div className="msg-details">{e.details.map((d, i) => <div key={i}>{d}</div>)}</div>
            )}
            {(e.undo || (e.quickRolls && e.quickRolls.length > 0)) && (
              <div className="row wrap msg-actions">
                {e.quickRolls?.map((q) => <button key={q.expr} className="btn small primary" onClick={() => quickRoll(q.expr, q.label)}>🎲 {q.label}</button>)}
                {e.undo && <button className="btn small" onClick={() => undo(e.id)}>↩️ {T('Deshacer', 'Undo')}</button>}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg app"><div className="msg-text">🤖 {T('Pensando…', 'Thinking…')}</div></div>}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void submit(text); }}>
        <button type="button" className={`icon-btn mic ${rec ? 'recording' : ''}`} onClick={() => void toggleDictation()} aria-label={rec ? T('Parar dictado', 'Stop dictation') : T('Dictar', 'Dictate')}>🎙️</button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={rec ? T('Escuchando…', 'Listening…') : T('Un goblin me ha hecho 7 de daño…', 'A goblin hits me for 7…')} />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{T('Enviar', 'Send')}</button>
      </form>
      {log.length > 0 && <button className="link small clear-log" onClick={clearLog}>{T('Borrar historial', 'Clear history')}</button>}
    </div>
  );
}
