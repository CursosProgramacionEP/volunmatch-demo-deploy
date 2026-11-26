import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Circle, Inbox } from 'lucide-react';

const filters = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
  { id: 'read', label: 'Leídas' },
];

export function NotificationsPage({ notifications, onOpen }) {
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => notifications.filter((item) =>
    filter === 'all' || (filter === 'unread' ? !item.read : item.read)), [notifications, filter]);

  return (
    <section className="workspace-content notifications-page">
      <div className="page-title">
        <div>
          <p className="section-kicker">CENTRO DE ACTIVIDAD</p>
          <h1>Notificaciones</h1>
          <p>Revisa las novedades de tus iniciativas y postulaciones.</p>
        </div>
        <span className="page-title__badge"><Bell size={15} /> {notifications.filter((item) => !item.read).length} sin leer</span>
      </div>
      <div className="notification-filters" role="tablist" aria-label="Filtrar notificaciones">
        {filters.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      {visible.length ? (
        <div className="notifications-list">
          {visible.map((item) => (
            <button type="button" className={`notification-row ${item.read ? '' : 'notification-row--unread'}`} key={item.id} onClick={() => onOpen(item)}>
              <span className="notification-row__icon"><Bell size={18} /></span>
              <span className="notification-row__copy"><strong>{item.title}</strong><span>{item.message}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</time></span>
              {item.read ? <CheckCheck size={17} className="notification-row__state" aria-label="Leída" /> : <Circle size={11} className="notification-row__unread" aria-label="No leída" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="notifications-empty"><Inbox size={28} /><strong>{filter === 'all' ? 'Aún no tienes notificaciones' : `No hay notificaciones ${filter === 'read' ? 'leídas' : 'sin leer'}`}</strong><span>Cuando haya una novedad, aparecerá aquí.</span></div>
      )}
    </section>
  );
}
