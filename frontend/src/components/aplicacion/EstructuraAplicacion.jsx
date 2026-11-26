import { useMemo, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Sidebar } from "./BarraLateral.jsx";
import { go } from "../../navigation/navegacion.js";
import { backendUrlWithVersion } from "../../services/urls.js";
/**
 * Proporciona la navegación fija de escritorio y el panel móvil responsivo compartido por todas las páginas autenticadas.
 *
 * @param {{user: object, route: string, children: import('react').ReactNode}} props Usuario autenticado, ruta activa y contenido de la página.
 * @returns {JSX.Element} Estructura compartida de la aplicación.
 */
export function AppLayout({
  user,
  route,
  notifications = [],
  onOpenNotification,
  children,
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const unread = useMemo(
    () => notifications.filter((item) => !item.read),
    [notifications],
  );
  // Nombre a mostrar (empresa o voluntario)
  const displayName =
    user.role === "company"
      ? user.companyName || user.nombreempresa || "Empresa"
      : user.fullName || user.nombrecompleto || "Voluntario";
  const equippedBadge = user.role === "volunteer"
    ? user.equippedBadge || user.badges?.find((badge) => badge.equipped) || null
    : null;
  // Iniciales de respaldo
  const initials = displayName
    .split(" ")
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // URL de la imagen: logo para empresas, foto para voluntarios
  let imageUrl = null;
  if (user.role === "company" && user.logoUrl) {
    imageUrl = backendUrlWithVersion(user.logoUrl);
  } else if (user.role === "volunteer" && user.fotoUrl) {
    imageUrl = backendUrlWithVersion(user.fotoUrl);
  }

  return (
    <div className="app-layout">
      <button
        className={`navigation-scrim ${navigationOpen ? "navigation-scrim--visible" : ""}`}
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setNavigationOpen(false)}
      />
      <Sidebar
        user={user}
        route={route}
        isOpen={navigationOpen}
        onNavigate={() => setNavigationOpen(false)}
      />
      <main className="workspace">
        <header className="app-header">
          <div className="app-header__context">
            <button
              className="desktop-menu"
              type="button"
              onClick={() => setNavigationOpen((open) => !open)}
              aria-label="Abrir menú"
              aria-expanded={navigationOpen}
            >
              <Menu size={21} />
            </button>
            <span>
              {user.role === "company"
                ? "Espacio de empresa"
                : "Iniciativas disponibles"}
            </span>
          </div>
          <div className="app-header__profile">
            <div className="notification-quick-wrap">
              <button
                className="header-bell"
                type="button"
                aria-label={`Notificaciones, ${unread.length} sin leer`}
                aria-expanded={quickOpen}
                onClick={() => setQuickOpen((open) => !open)}
              >
                <Bell size={20} />
                {unread.length > 0 && (
                  <span className="header-bell__count">
                    {unread.length > 99 ? "99+" : unread.length}
                  </span>
                )}
              </button>
              {quickOpen && (
                <div
                  className="notification-quick"
                  role="dialog"
                  aria-label="Notificaciones recientes"
                >
                  <div className="notification-quick__head">
                    <strong>Sin leer</strong>
                    <button
                      type="button"
                      onClick={() => {
                        go("/notifications");
                        setQuickOpen(false);
                      }}
                    >
                      Ver todas
                    </button>
                  </div>
                  {unread.length ? (
                    unread.slice(0, 5).map((item) => (
                      <button
                        className="notification-quick__item"
                        type="button"
                        key={item.id}
                        onClick={() => {
                          onOpenNotification?.(item);
                          setQuickOpen(false);
                        }}
                      >
                        <b>{item.title}</b>
                        <span>{item.message}</span>
                        <small>
                          {new Date(item.createdAt).toLocaleString("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="notification-quick__empty">
                      No tienes notificaciones sin leer.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="profile-avatar-wrap">
              <button
                className="profile-avatar"
                onClick={() => go("/profile")}
                aria-label={equippedBadge ? `Ver mi perfil, insignia equipada: ${equippedBadge.name}` : "Ver mi perfil"}
                style={{
                  overflow: "hidden",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <span className="profile-avatar__initials" aria-hidden="true">{initials}</span>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={displayName}
                    className="profile-avatar__image"
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                  />
                )}
              </button>
            </div>
            <div className="app-header__identity">
              <div className="app-header__identity-name">
                <b>{displayName}</b>
                {equippedBadge && (
                  <span className="profile-header__equipped-badge" title={`Insignia equipada: ${equippedBadge.name}`} aria-label={`Insignia equipada: ${equippedBadge.name}`}>
                    {equippedBadge.icon}
                  </span>
                )}
              </div>
              <small>{user.role === "company" ? "Coordinador de empresa" : "Voluntario activo"}</small>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
