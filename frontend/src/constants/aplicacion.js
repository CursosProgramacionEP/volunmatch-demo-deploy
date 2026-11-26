// Constantes compartidas por varias pantallas de la aplicación.

// Categorías disponibles para filtrar y crear iniciativas.
export const categories = ['Todas', 'Medio ambiente', 'Educación', 'Asistencia social', 'Salud', 'Cultura', 'Deporte', 'Tecnología'];

// Textos y clases CSS para cada estado de una tarea del tablero Kanban.
export const statusMeta = {
  pending: { label: 'Pendiente', className: 'pending' },
  in_progress: { label: 'En proceso', className: 'progress' },
  done: { label: 'Finalizado', className: 'done' },
};
