// Manual de la app (la guía ilustrada) dentro de una ventana a pantalla completa.
import { T } from '../i18n';

export function ManualViewer({ onClose }: { onClose: () => void }) {
  return (
    <div className="manual" role="dialog" aria-label={T('Manual', 'Manual')}>
      <div className="manual-head">
        <b>📖 {T('Manual de Di en Di', 'Di en Di manual')}</b>
        <button className="btn small" onClick={onClose}>✕ {T('Cerrar', 'Close')}</button>
      </div>
      <iframe className="manual-frame" src="guia/index.html" title={T('Manual', 'Manual')} />
    </div>
  );
}
