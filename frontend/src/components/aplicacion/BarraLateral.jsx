import { Bell, ClipboardList, History, LayoutDashboard, LogOut, Plus, Search, Settings, UserRound } from 'lucide-react';
import { Brand } from '../autenticacion/Marca.jsx';
import { go } from '../../navigation/navegacion.js';

// Menú lateral. Los enlaces cambian según el rol del usuario:
// voluntarios ven "Explorar" y "Mis actividades"; empresas ven su panel y "Nueva iniciativa".
/**
 * Renderiza la navegación específica según el rol del usuario y cierra el panel de navegación compacto tras un cambio de ruta.
 *
 * @param {{user: object, route: string, isOpen?: boolean, onNavigate?: Function}} props Estado y callbacks de la navegación.
 * @returns {JSX.Element} Barra lateral de la aplicación.
 */
export function Sidebar({ user, route, isOpen = false, onNavigate = () => {} }) {
  const volunteerItems = [
    { path: '/volunteer/explore', label: 'Explorar', icon: Search },
    { path: '/volunteer/activities', label: 'Mis actividades', icon: ClipboardList },
    { path: '/history', label: 'Mi historial', icon: History },
    { path: '/notifications', label: 'Notificaciones', icon: Bell },
    { path: '/profile', label: 'Mi perfil', icon: UserRound },
  ];
  const companyItems = [
    { path: '/company/dashboard', label: 'Mis iniciativas', icon: LayoutDashboard },
    { path: '/company/new', label: 'Nueva iniciativa', icon: Plus },
    { path: '/history', label: 'Historial', icon: History },
    { path: '/notifications', label: 'Notificaciones', icon: Bell },
    { path: '/profile', label: 'Mi perfil de coordinador', icon: UserRound },
  ];
  const items = user.role === 'company' ? companyItems : volunteerItems;

  function logout() {
    localStorage.removeItem('volunmatch-session');
    window.location.hash = '/';
    window.location.reload();
  }

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <Brand />
      <nav>
        {items.map(({ path, label, icon: Icon }) => (
          <button key={path} className={route.startsWith(path) ? 'active' : ''} onClick={() => { go(path); onNavigate(); }}>
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar__bottom">
        <button className={route === '/settings' ? 'active' : ''} onClick={() => { go('/settings'); onNavigate(); }}><Settings size={19} /> Configuración</button>
        <button className="logout" onClick={logout}><LogOut size={19} /> Cerrar sesión</button>
      </div>
    </aside>
  );
}
