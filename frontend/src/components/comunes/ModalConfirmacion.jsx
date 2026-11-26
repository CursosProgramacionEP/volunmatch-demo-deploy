import { AlertTriangle, CircleHelp, Trash2 } from "lucide-react";
import { Button } from "./Boton.jsx";
import { Modal } from "./VentanaModal.jsx";

/**
 * Modal de confirmación reutilizable para acciones que modifican o eliminan datos.
 * Centralizarlo mantiene el mismo lenguaje, colores y accesibilidad en todo el sistema.
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: 'primary'|'danger',
 *   icon?: import('react').ElementType,
 *   busy?: boolean,
 *   onCancel?: Function,
 *   onConfirm: Function
 * }} props Configuración del mensaje y de las acciones.
 * @returns {JSX.Element} Ventana de confirmación uniforme.
 */
export function ConfirmationModal({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Volver",
  variant = "primary",
  icon: Icon = CircleHelp,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const ResolvedIcon =
    variant === "danger" && Icon === CircleHelp ? AlertTriangle : Icon;

  return (
    <Modal onClose={busy ? undefined : onCancel}>
      <div className="confirm-modal">
        <span className={`confirm-modal__icon confirm-modal__icon--${variant}`}>
          <ResolvedIcon size={30} />
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="confirm-modal__actions">
          {/* 🚨 Si no hay onCancel, no mostramos el botón de cancelar */}
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
          )}
                    <Button
            variant={variant}
            onClick={onConfirm}
            disabled={busy}
            // 🚨 LÍNEA ELIMINADA: icon={variant === "danger" ? Trash2 : undefined}
          >
            {busy ? "Procesando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}