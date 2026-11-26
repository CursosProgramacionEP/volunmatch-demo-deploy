import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Ventana modal genérica con cierre por Escape cuando existe una acción de cierre. */
export function Modal({ children, onClose }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true">
        {onClose && <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>}
        {children}
      </div>
    </div>
  );
}
