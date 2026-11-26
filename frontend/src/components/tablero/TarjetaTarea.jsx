import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Ellipsis, Minus, Trash2 } from 'lucide-react';
import { backendUrlWithVersion } from '../../services/urls.js';

const priorityMeta = {
  Baja: { Icon: ArrowDown, label: 'Baja' },
  Media: { Icon: Minus, label: 'Media' },
  Alta: { Icon: ArrowUp, label: 'Alta' },
};

export function TaskCard({ task, currentUser, onDragStart, canDelete = false, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = task.ownerId === currentUser.id;
  const isDone = task.status === 'done';
  const canClaim = currentUser.role === 'volunteer' && !task.ownerId;
  const { Icon: PriorityIcon, label } = priorityMeta[task.priority] || priorityMeta.Media;

  return (
    <article className={`task-card${isDone ? ' task-card--done' : ''}${canClaim ? ' task-card--claimable' : ''}`} data-hover-message={canClaim ? 'Arrastra esta actividad a Pendiente para que se te asigne.' : undefined} draggable={currentUser.role === 'volunteer' && (!task.ownerId || isOwner) && !isDone} onDragStart={onDragStart}>
      <div className="task-card__top">
        <span className="priority-tag">{task.area}</span>
        <span className={`task-priority task-priority--${label.toLowerCase()}`} aria-label={`Prioridad ${label}`}>
          <PriorityIcon size={16} /> {label}
        </span>
        {canDelete && <div className="task-card__menu-wrap">
          <button className="task-card__menu-button" type="button" aria-label={`Opciones de ${task.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <Ellipsis size={19} />
          </button>
          {menuOpen && <button className="task-card__menu-item" type="button" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={15} /> Eliminar</button>}
        </div>}
      </div>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      {task.ownerName && (
        <div className="task-card__details">
          <span className="owner-dot">
            {task.ownerPhotoUrl ? (
              <img src={backendUrlWithVersion(task.ownerPhotoUrl)} alt={`Foto de ${task.ownerName}`} />
            ) : (
              task.ownerName.split(' ').map((name) => name[0]).slice(0, 2).join('')
            )}
          </span>
          <span className="task-card__owner-name">{task.ownerName}</span>
        </div>
      )}
      {isDone && <span className="completed-task"><CheckCircle2 size={15} /> Completada</span>}
    </article>
  );
}
