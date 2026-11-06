// Si una pantalla falla, en vez de quedarse en negro muestra el error y deja volver o copiarlo para avisar.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { T } from '../i18n';

interface Props { children: ReactNode; onBack?: () => void; where?: string }
interface State { error: Error | null; info: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? '' });
    console.error('Di en Di:', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const text = `${this.props.where ?? ''} ${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 6).join('\n')}\n${info.split('\n').slice(0, 8).join('\n')}\n${navigator.userAgent}`;
    return (
      <div className="tab crash">
        <h2>⚠️ {T('Algo ha fallado en esta pantalla', 'Something went wrong on this screen')}</h2>
        <p>{T('Tus datos están a salvo. Puedes volver e intentarlo de nuevo. Si se repite, copia el error y envíaselo a quien mantiene la app.', 'Your data is safe. You can go back and try again. If it keeps happening, copy the error and send it to whoever maintains the app.')}</p>
        <pre className="crash-text">{text}</pre>
        <div className="row">
          <button className="btn grow" onClick={() => { void navigator.clipboard?.writeText(text).catch(() => undefined); }}>📋 {T('Copiar error', 'Copy error')}</button>
          <button className="btn primary grow" onClick={() => { this.setState({ error: null, info: '' }); this.props.onBack?.(); }}>↩️ {T('Volver', 'Go back')}</button>
        </div>
      </div>
    );
  }
}
