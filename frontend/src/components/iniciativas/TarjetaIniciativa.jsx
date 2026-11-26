import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  MapPin,
  MoreVertical,
  Pencil,
  Users,
  XCircle,
  Video,
} from "lucide-react";
import { Button } from "../comunes/Boton.jsx";
import { formatInitiativeDayMonth } from "../../utils/fechas.js";

export function InitiativeCard({
  initiative,
  onOpen,
  actionLabel,
  actionVariant,
  isCompany = false,
  onEdit,
  onCancel,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 86;
    let left = rect.right + 8;
    if (left + menuWidth > window.innerWidth - 8)
      left = rect.left - menuWidth - 8;
    const top = Math.max(
      8,
      Math.min(rect.top, window.innerHeight - menuHeight - 8),
    );
    setMenuPosition({ left: Math.max(8, left), top });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const dismiss = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const inferredLabel = initiative.isMember
    ? "Ir al tablero"
    : initiative.applicationStatus === "pending"
      ? "Postulación enviada"
      : initiative.applicationStatus === "accepted"
        ? "Ir al tablero"
        : "Ver detalles";
  const label = actionLabel || inferredLabel;
  const variant =
    actionVariant ||
    (initiative.isMember || initiative.applicationStatus === "accepted"
      ? "primary"
      : "secondary");

  return (
    <article className="initiative-card">
      {/* MOSTRAMOS LA IMAGEN SI EXISTE */}
      <div
        className={`initiative-card__cover cover--${initiative.cover}`}
        style={{ position: "relative", overflow: "hidden" }}
      >
        {initiative.imagen ? (
          <img
            src={initiative.imagen}
            alt={initiative.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        ) : (
          <>
            <span>{initiative.category}</span>
            <div className="cover-art">
              <i />
              <i />
              <i />
            </div>
          </>
        )}
      </div>

      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            className="initiative-card__menu initiative-card__menu--floating"
            role="menu"
            ref={menuRef}
            style={{ left: menuPosition.left, top: menuPosition.top }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(initiative);
              }}
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              type="button"
              role="menuitem"
              className="initiative-card__menu-danger"
              onClick={() => {
                setMenuOpen(false);
                onCancel(initiative);
              }}
            >
              <XCircle size={16} /> Cancelar
            </button>
          </div>,
          document.body,
        )}
      <div className="initiative-card__body">
        {onEdit && onCancel && (
          <div
            className="initiative-card__actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="initiative-card__menu-trigger"
              ref={triggerRef}
              aria-label={`Opciones de ${initiative.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreVertical size={21} />
            </button>
          </div>
        )}
        <p className="company-label">{initiative.companyName}</p>
        <h3>{initiative.title}</h3>
        <p>{initiative.summary}</p>
        <div className="initiative-card__meta">
          <span>
            <CalendarDays size={15} />
            {formatInitiativeDayMonth(initiative.date)} al {formatInitiativeDayMonth(initiative.endDate)}
          </span>
          <span>
            <Users size={15} />
            {isCompany
              ? `${initiative.quota} cupos disp.`
              : `${initiative.joinedCount}/${initiative.joinedCount + initiative.quota}`}
          </span>

          <span
            style={{
               position: "absolute", // Permite mover el icono libremente
               right: "15px",         // Distancia desde la derecha de la tarjeta
               bottom: "69px",      // Distancia desde abajo de la tarjeta
              color:
                initiative.modalidad?.toLowerCase() === "virtual"
                  ? "#159150"
                  : "#627065",
              fontWeight: "600",
            }}
          >
            {initiative.modalidad?.toLowerCase() === "virtual" ? (
              <>
                <Video size={15} />
              </>
            ) : (
              <>
                <MapPin size={15} />
              </>
            )}
          </span>
        </div>
        <Button variant={variant} onClick={() => onOpen(initiative)}>
          {label}
        </Button>
      </div>
    </article>
  );
}
