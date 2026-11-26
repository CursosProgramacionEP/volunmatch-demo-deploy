import { Leaf } from 'lucide-react';
import { Button } from './Boton.jsx';

/**
 * Mensaje que se muestra cuando una lista está vacía o no se pudo cargar algo,
 * con un botón opcional de acción (por ejemplo, "Volver" o "Explorar iniciativas").
 *
 * @param {{title: string, text: string, action?: Function, actionLabel?: string}} props Título, texto descriptivo, callback de acción y etiqueta del botón.
 * @returns {JSX.Element} Estado vacío con ícono, mensaje y botón de acción opcional.
 */
export function EmptyState({ title, text, action, actionLabel = 'Volver' }) {
  return (
    <div className="empty-state">
      <span>
        <Leaf size={29} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && <Button onClick={action}>{actionLabel}</Button>}
    </div>
  );
}
