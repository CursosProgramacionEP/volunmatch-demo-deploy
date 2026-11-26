// Funciones para transformar datos de la BD al formato del frontend.

/**
 * Adapta una iniciativa y su estado de postulación al formato del frontend.
 * @param {object} row - Fila de iniciativa + empresa + postulación.
 * @param {Array<object>} [tasks=[]] - Tareas relacionadas con la iniciativa.
 * @param {object} [options={}] - Opciones adicionales (joinedCount, isMember, applicationStatus).
 * @returns {object} Iniciativa serializada.
 */
export function serializeInitiative(row, tasks = [], options = {}) {
  const statusMap = {
    pendiente: "pending",
    en_proceso: "in_progress",
    finalizado: "done",
    cancelada: "cancelled",
  };
  const initiativeStatusMap = {
    activa: "active",
    finalizada: "completed",
    cancelada: "cancelled",
  };
  const applicationStatusMap = {
    pendiente: "pending",
    aceptado: "accepted",
    rechazado: "rejected",
  };
  const modalidad = String(row.modalidad || "presencial").toLowerCase();

  return {
    id: row.idiniciativa,
    companyId: row.idempresa,
    companyName: row.nombreempresa || "",
    title: row.titulo,
    category: row.categoria,
    summary: row.descripcion,
    date: row.fechainicio,
    endDate: row.fechafin,
    schedule: row.horario || "",
    location: row.lugar || "",
    modalidad: modalidad === "virtual" ? "virtual" : "presencial",
    // El enlace es privado: solo las rutas que ya verificaron la aceptación
    // del voluntario (o la propiedad de la empresa) pueden incluirlo.
    meetingUrl: options.includeMeetingUrl
      ? row.enlace_reunion || (modalidad === "virtual" ? row.lugar || "" : "")
      : "",
    quota: row.numcupo,
    joinedCount: options.joinedCount || 0,
    isMember: options.isMember || row.estado_postulacion === 'aceptado',
    applicationStatus: options.applicationStatus || applicationStatusMap[row.estado_postulacion] || null,
    volunteerName: row.nombrevoluntario || null,
    ratingAvailable: Boolean(row.valoracion_disponible),
    ratingPending: Boolean(row.valoracion_disponible) && !row.valoracion_puntaje,
    ratingScore: row.valoracion_puntaje ? Number(row.valoracion_puntaje) : null,
    ratingComment: row.valoracion_comentario || '',
    ratingAverage: options.ratingAverage ?? null,
    ratingCount: options.ratingCount || 0,
    ratingSummaryComment: options.ratingComment || '',
    requirements: row.requisito ? row.requisito.split('\n').filter(Boolean) : [],
    cover: 'custom',
    imagen: row.imagen || null, // <--- AGREGA ESTO AQUÍ
    members: options.members || [],
    tasks: tasks.map((t) => ({
      id: t.idtarea,
      title: t.titulo,
      description: t.descripcion,
      status: statusMap[t.estado] || "pending",
      area: t.area || "General",
      priority: t.priority || "Media",
      schedule: "Por definir",
      ownerId: t.idvoluntario_asignado || null,
      ownerName: t.voluntario_nombre || null,
      ownerEmail: t.voluntario_correo || null,
      ownerPhotoUrl: t.voluntario_foto_url || null,
      ownerBio: t.voluntario_biografia || null,
      assignedAt: t.fecha_asignacion || null,
      // imagen: row.imagen || null, <--- ELIMINA ESTA LÍNEA DE AQUÍ
    })),
    createdAt: row.creado_en || new Date().toISOString(),
    status: initiativeStatusMap[row.estado] || "active",
  };
}

