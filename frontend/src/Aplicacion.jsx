import { useEffect, useMemo, useState } from "react";
import { Notice } from "./components/comunes/Aviso.jsx";
import { AppLayout } from "./components/aplicacion/EstructuraAplicacion.jsx";
import { HomePage } from "./pages/inicio/PaginaInicio.jsx";
import { AuthPage } from "./pages/autenticacion/PaginaAutenticacion.jsx";
import { ExplorePage } from "./pages/exploracion/PaginaExploracion.jsx";
import { InitiativeDetailPage } from "./pages/iniciativas/PaginaDetalleIniciativa.jsx";
import { ActivitiesPage } from "./pages/actividades/PaginaActividades.jsx";
import { CompanyDashboard } from "./pages/empresa/PanelEmpresa.jsx";
import { NewInitiativePage } from "./pages/iniciativas/PaginaNuevaIniciativa.jsx";
import { KanbanPage } from "./pages/tablero/PaginaTablero.jsx";
import {
  ProfilePage,
  CompanyPublicProfilePage,
  VolunteerPublicProfilePage,
} from "./pages/perfil/PaginaPerfil.jsx";
import { HistoryPage } from "./pages/historial/PaginaHistorial.jsx";
import { go, useRoute } from "./navigation/navegacion.js";
import { api, notificationStreamUrl } from "./services/cliente-api.js";
import { NotificationsPage } from "./pages/PaginaNotificaciones.jsx";
import { VolunteerAssistant } from "./components/aplicacion/AsistenteVoluntario.jsx";
import { AppearanceSettingsPage } from "./pages/configuracion/PaginaConfiguracion.jsx";
import { RutaProtegida } from "./components/comunes/RutaProtegida.jsx";

export default function App() {
  const route = useRoute();

  // 1. ESTADO GLOBAL DEL TEMA
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("volunmatch-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("volunmatch-session") || "null");
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const user = session?.user;
  const token = session?.token;
  const showNotice = (item) => setNotice(item);

  // 2. EFECTO PARA APLICAR EL TEMA AL HTML
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // 3. FUNCIÓN PARA GUARDAR EL TEMA
  function saveTheme(nextTheme) {
    setTheme(nextTheme);
    try {
      localStorage.setItem("volunmatch-theme", nextTheme);
    } catch {
      // Manejo de errores
    }
  }

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      return undefined;
    }
    let active = true;
    let stream;
    const initNotifications = async () => {
      try {
        // 1. Cargar notificaciones iniciales
        const { notifications: items } = await api.notifications(token);
        if (active)
          setNotifications((current) => {
            const merged = new Map(items.map((item) => [item.id, item]));
            current.forEach((item) => merged.set(item.id, item));
            return [...merged.values()].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            );
          });

        // 2. Obtener el ticket de un solo uso
        const { ticket } = await api.getNotificationTicket(token);

        // 3. Abrir el EventSource con el ticket
        if (active) {
          stream = new EventSource(notificationStreamUrl(ticket));
          stream.onmessage = (event) => {
            const incoming = JSON.parse(event.data);
            if (active) {
              if (incoming.type === "badge_earned")
                setNotice({ text: incoming.title || incoming.message });
              setNotifications((current) =>
                current.some((item) => item.id === incoming.id)
                  ? current
                  : [incoming, ...current],
              );
            }
          };
        }
      } catch (error) {
        console.error("Error al inicializar notificaciones:", error);
      }
    };

    initNotifications();

    return () => {
      active = false;
      if (stream) stream.close(); // Cerrar el stream al desmontar
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;

    const checkSession = () =>
      api
        .me(token)
        .then(({ user: currentUser }) => {
          if (!active) return;
          setSession((current) => {
            if (!current?.user || current.user.id !== currentUser.id)
              return current;
            const nextSession = {
              ...current,
              user: { ...current.user, ...currentUser },
            };
            localStorage.setItem(
              "volunmatch-session",
              JSON.stringify(nextSession),
            );
            return nextSession;
          });
        })
        .catch((error) => {
          //  Si el token expiró o la sesión es inválida (401), cerramos sesión
          if (!active || error.status !== 401) return;
          localStorage.removeItem("volunmatch-session");
          setSession(null);
          setNotice({
            text:
              error.message || "Tu sesión terminó. Inicia sesión nuevamente.",
          });
        });

    checkSession(); // Se ejecuta inmediatamente
    const interval = window.setInterval(checkSession, 10000); // Se repite cada 10s

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || user?.role !== "volunteer") return undefined;
    let active = true;
    api
      .myProfile(token)
      .then(({ profile }) => {
        if (active) onSessionUpdated(profile);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, user?.id, user?.role]);

  async function openNotification(notification) {
    if (!notification.read) {
      await api.markNotificationRead(token, notification.id).catch(() => {});
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );
    }
    if (notification.type === "initiative_closed_rate") {
      go(
        notification.link?.startsWith("/history/rate/")
          ? notification.link
          : "/history/rate/pending",
      );
      return;
    }
    go(notification.link || "/notifications");
  }

  const routeParts = useMemo(() => route.split("/").filter(Boolean), [route]);
  const initiativeId =
    routeParts[0] === "initiative" || routeParts[0] === "kanban"
      ? routeParts[1]
      : null;
  const rateInitiativeId =
    routeParts[0] === "history" && routeParts[1] === "rate"
      ? routeParts[2]
      : null;
  const companyId =
    routeParts[0] === "company" && routeParts[1] === "profile"
      ? routeParts[2]
      : null;
  const volunteerId =
    routeParts[0] === "volunteer" && routeParts[1] === "profile"
      ? routeParts[2]
      : null;

  useEffect(() => {
    if (
      !user &&
      route !== "/" &&
      route !== "/auth" &&
      !route.startsWith("/reset-password")
    )
      go("/auth");
  }, [route, user]);

  function onAuthenticated(nextSession) {
    localStorage.setItem("volunmatch-session", JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function onPasswordReset() {
    localStorage.removeItem("volunmatch-session");
    setSession(null);
  }

  function onSessionUpdated(profile) {
    setSession((current) => {
      if (!current || !current.user) return current;

      const nextUser = {
        ...current.user,
        fullName:
          profile.role === "company"
            ? profile.companyName || current.user.fullName
            : profile.fullName || current.user.fullName,
        companyName:
          profile.role === "company"
            ? profile.companyName || current.user.companyName
            : current.user.companyName,
        logoUrl: profile.logoUrl || current.user.logoUrl || null,
        fotoUrl: profile.fotoUrl || current.user.fotoUrl || null,
        equippedBadge:
          profile.role === "volunteer"
            ? profile.equippedBadge || null
            : current.user.equippedBadge || null,
        sector: profile.sector || current.user.sector || null,
        phone: profile.phone || current.user.phone || null,
        bio: profile.bio || current.user.bio || null,
        email: profile.email || current.user.email,
      };

      const nextSession = { ...current, user: nextUser };
      localStorage.setItem("volunmatch-session", JSON.stringify(nextSession));
      return nextSession;
    });
  }

  let content;

  if (route.startsWith("/reset-password")) {
    content = (
      <AuthPage
        onAuthenticated={onAuthenticated}
        onPasswordReset={onPasswordReset}
        showNotice={showNotice}
        route={route}
      />
    );
  } else if (!user) {
    content =
      route === "/" ? (
        <HomePage user={null} />
      ) : (
        <AuthPage
          onAuthenticated={onAuthenticated}
          onPasswordReset={onPasswordReset}
          showNotice={showNotice}
          route={route}
        />
      );
  } else if (route === "/") {
    content = <HomePage user={user} />;
  } else {
    let page;
    // --- RUTAS DE EMPRESA (Solo Company) ---
    if (route.startsWith("/company") && route !== "/company/profile") {
      page = (
        <RutaProtegida user={user} rolRequerido="company">
          {route === "/company/new" ? (
            <NewInitiativePage token={token} showNotice={showNotice} />
          ) : (
            <CompanyDashboard token={token} showNotice={showNotice} />
          )}
        </RutaProtegida>
      );
    }
    // --- RUTAS DE VOLUNTARIO (Solo Volunteer) ---
    else if (
      route === "/volunteer/activities" ||
      route === "/history" ||
      rateInitiativeId
    ) {
      page = (
        <RutaProtegida user={user} rolRequerido="volunteer">
          {route === "/volunteer/activities" ? (
            <ActivitiesPage token={token} />
          ) : (
            <HistoryPage
              token={token}
              user={user}
              rateInitiativeId={rateInitiativeId}
            />
          )}
        </RutaProtegida>
      );
    }
    // --- RUTAS COMPARTIDAS O PÚBLICAS ---
    else if (route.startsWith("/initiative/")) {
      page = (
        <InitiativeDetailPage
          token={token}
          user={user}
          initiativeId={initiativeId}
          showNotice={showNotice}
        />
      );
    } else if (route.startsWith("/kanban/")) {
      page = (
        <KanbanPage
          token={token}
          user={user}
          initiativeId={initiativeId}
          showNotice={showNotice}
        />
      );
    } else if (route === "/profile") {
      page = (
        <ProfilePage
          token={token}
          user={user}
          showNotice={showNotice}
          onSessionUpdated={onSessionUpdated}
        />
      );
    } else if (route === "/settings") {
      page = (
        <AppearanceSettingsPage
          user={user}
          theme={theme}
          onSaveTheme={saveTheme}
        />
      );
    } else if (route.startsWith("/notifications")) {
      page = (
        <NotificationsPage
          notifications={notifications}
          onOpen={openNotification}
        />
      );
    } else if (companyId && user.role === "volunteer") {
      page = <CompanyPublicProfilePage token={token} companyId={companyId} />;
    } else if (volunteerId && user.role === "company") {
      page = (
        <VolunteerPublicProfilePage token={token} volunteerId={volunteerId} />
      );
    } else {
      // Ruta por defecto para voluntarios (Explorar)
      page = (
        <ExplorePage
          token={token}
          onOpen={(initiative) =>
            go(
              initiative.isMember || initiative.applicationStatus === "accepted"
                ? `/kanban/${initiative.id}`
                : `/initiative/${initiative.id}`,
            )
          }
          showNotice={showNotice}
        />
      );
    }
    content = (
      <AppLayout
        user={user}
        route={route}
        notifications={notifications}
        onOpenNotification={openNotification}
      >
        {page}
      </AppLayout>
    );
  }

  return (
    <>
      {content}
      {user?.role === "volunteer" && <VolunteerAssistant token={token} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
