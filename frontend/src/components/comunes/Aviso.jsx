import { useEffect } from "react";
import { CircleCheck, X } from "lucide-react";

/**
 * Aviso flotante (éxito o error) que se muestra en pantalla y se cierra
 * automáticamente a los 5 segundos, o antes si el usuario lo cierra.
 *
 * @param {{notice: {type?: string, text: string}|null, onClose: Function}} props Configuración del aviso y callback de cierre.
 * @returns {JSX.Element|null} Tarjeta de notificación o null si no hay aviso.
 */
export function Notice({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, onClose]);

  if (!notice) return null;

  return (
    <div className={`notice notice--${notice.type || "success"}`}>
      <CircleCheck size={19} />
      {notice.text}
      <button onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
