// DAO de iniciativas
import pool from "../config/db.js";

/** Lista todas las iniciativas activas (excluyendo las ya postuladas por el voluntario). */
export async function listarIniciativas({
  search,
  category,
  excludeVolunteerId,
  companyId,
}) {
  let query = `
    SELECT i.*, e.nombreempresa
    FROM iniciativa i
    JOIN empresa e ON i.idempresa = e.idempresa
  `;
  const conditions = [
    "i.estado = 'activa'",
    "((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') > NOW()",
  ];
  const params = [];

  if (excludeVolunteerId) {
    params.push(excludeVolunteerId);
    conditions.push(`i.idiniciativa NOT IN (
      SELECT idiniciativa FROM postulacion WHERE idvoluntario = $${params.length}
    )`);
  }

  if (companyId) {
    params.push(companyId);
    conditions.push(`i.idempresa = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(LOWER(i.titulo) LIKE $${params.length} OR LOWER(i.descripcion) LIKE $${params.length} OR LOWER(e.nombreempresa) LIKE $${params.length})`,
    );
  }
  if (category && category !== "todas") {
    params.push(category);
    conditions.push(`LOWER(i.categoria) = $${params.length}`);
  }
  if (conditions.length) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY i.idiniciativa DESC";

  const result = await pool.query(query, params);
  return result.rows;
}

/** Lista las iniciativas creadas por una empresa. */
export async function listarIniciativasDeEmpresa(
  idempresa,
  { soloActivas = false } = {},
) {
  const result = await pool.query(
    `SELECT i.*, e.nombreempresa
     FROM iniciativa i
     JOIN empresa e ON i.idempresa = e.idempresa
     WHERE i.idempresa = $1 ${soloActivas ? "AND i.estado = 'activa' AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') > NOW()" : ""}
     ORDER BY i.idiniciativa DESC`,
    [idempresa],
  );
  return result.rows;
}

/** Resume las valoraciones recibidas por las iniciativas de una empresa. */
export async function obtenerValoracionesDeIniciativas(idsIniciativas) {
  if (!idsIniciativas.length) return {};
  const result = await pool.query(
    `SELECT vi.idiniciativa,
                ROUND(AVG(vi.puntaje)::numeric, 1)::float AS puntaje_promedio,
                COUNT(*)::int AS cantidad_valoraciones,
                (SELECT comentario
                 FROM valoracion_iniciativa reciente
                 WHERE reciente.idiniciativa = vi.idiniciativa
                   AND NULLIF(BTRIM(reciente.comentario), '') IS NOT NULL
                 ORDER BY reciente.creado_en DESC
                 LIMIT 1) AS comentario_reciente
         FROM valoracion_iniciativa vi
         WHERE vi.idiniciativa = ANY($1)
         GROUP BY vi.idiniciativa`,
    [idsIniciativas],
  );
  return Object.fromEntries(result.rows.map((row) => [row.idiniciativa, row]));
}

/** Obtiene una iniciativa por su ID. */
export async function buscarIniciativaPorId(idiniciativa, client = pool) {
  const result = await client.query(
    `SELECT i.*, e.nombreempresa
     FROM iniciativa i
     JOIN empresa e ON i.idempresa = e.idempresa
     WHERE i.idiniciativa = $1`,
    [idiniciativa],
  );
  return result.rows[0] || null;
}

/** Crea una nueva iniciativa. (CAMBIO: modalidad en minúsculas) */
export async function crearIniciativa(
  {
    idempresa,
    titulo,
    descripcion,
    categoria,
    numcupo,
    fechainicio,
    fechafin,
    requisito,
    lugar,
    imagen = null,
    modalidad = "presencial",
    enlaceReunion = null,
    horario = null,
  },
  client,
) {
  const result = await client.query(
    `INSERT INTO iniciativa
       (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar, imagen, modalidad, enlace_reunion, horario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      idempresa,
      titulo,
      descripcion,
      categoria,
      numcupo,
      fechainicio,
      fechafin,
      requisito,
      lugar,
      imagen || null,
      (modalidad || "presencial").toLowerCase(),
      enlaceReunion || null,
      horario || null,
    ],
  );
  return result.rows[0];
}

/** Cancela una iniciativa. */
export async function cancelarIniciativa({ idiniciativa, idempresa }, client) {
  const result = await client.query(
    `UPDATE iniciativa SET estado = 'cancelada'
     WHERE idiniciativa = $1 AND idempresa = $2
     RETURNING idiniciativa, titulo, estado`,
    [idiniciativa, idempresa],
  );
  return result.rows[0] || null;
}

/** Cuenta todas las iniciativas de una empresa. */
export async function contarIniciativasDeEmpresa(idempresa) {
  const result = await pool.query(
    "SELECT COUNT(*) as total FROM iniciativa WHERE idempresa = $1",
    [idempresa],
  );
  return parseInt(result.rows[0].total, 10);
}

/** Obtiene los contadores del dashboard de empresa. */
export async function obtenerStatsDashboard(idempresa) {
  const [initiatives, accepted, tasks, pending] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) as total FROM iniciativa WHERE idempresa = $1 AND estado = 'activa' AND ((fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') > NOW()",
      [idempresa],
    ),
    pool.query(
      `SELECT COUNT(*) as total FROM postulacion p JOIN iniciativa i ON p.idiniciativa = i.idiniciativa WHERE i.idempresa = $1 AND p.estado = 'aceptado'`,
      [idempresa],
    ),
    pool.query(
      `SELECT COUNT(*) as total FROM tarea t JOIN iniciativa i ON t.idiniciativa = i.idiniciativa WHERE i.idempresa = $1`,
      [idempresa],
    ),
    pool.query(
      `SELECT COUNT(*) as total FROM postulacion p JOIN iniciativa i ON p.idiniciativa = i.idiniciativa WHERE i.idempresa = $1 AND p.estado = 'pendiente'`,
      [idempresa],
    ),
  ]);
  return {
    totalInitiatives: parseInt(initiatives.rows[0].total, 10),
    acceptedVolunteers: parseInt(accepted.rows[0].total, 10),
    totalTasks: parseInt(tasks.rows[0].total, 10),
    pendingApplications: parseInt(pending.rows[0].total, 10),
  };
}

/** Obtiene datos de acceso de un voluntario. */
export async function obtenerAccesoVoluntario(
  idiniciativa,
  idvoluntario,
  client = pool,
) {
  const result = await client.query(
    `SELECT i.idempresa, i.titulo, i.estado, p.estado AS application_status,
            ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW() AS cerrada
     FROM iniciativa i
     LEFT JOIN postulacion p ON p.idiniciativa = i.idiniciativa AND p.idvoluntario = $2
     WHERE i.idiniciativa = $1`,
    [idiniciativa, idvoluntario],
  );
  return result.rows[0] || null;
}

/** Descuenta un cupo. */
export async function descontarCupo(idiniciativa, client) {
  const result = await client.query(
    `UPDATE iniciativa SET numcupo = numcupo - 1 WHERE idiniciativa = $1 AND numcupo > 0 RETURNING numcupo`,
    [idiniciativa],
  );
  return result.rowCount > 0;
}

/** Verifica acceso a reseñas. */
export async function verificarAccesoResenas(idiniciativa, idusuario) {
  const result = await pool.query(
    `SELECT i.idempresa, ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW() AS cerrada,
            EXISTS (SELECT 1 FROM postulacion p WHERE p.idiniciativa = i.idiniciativa AND p.idvoluntario = $2 AND p.estado = 'aceptado') AS voluntario_aceptado
     FROM iniciativa i WHERE i.idiniciativa = $1`,
    [idiniciativa, idusuario],
  );
  return result.rows[0] || null;
}

/** Lista reseñas. */
export async function listarResenasDeIniciativa(idiniciativa) {
  const result = await pool.query(
    `SELECT idvaloracion AS id, puntaje AS score, comentario AS comment, creado_en AS "createdAt"
     FROM valoracion_iniciativa WHERE idiniciativa = $1 ORDER BY creado_en DESC, idvaloracion DESC`,
    [idiniciativa],
  );
  return result.rows;
}

/** Obtiene estado de edición. */
export async function obtenerEstadoEdicionIniciativa(
  idiniciativa,
  client = pool,
) {
  const result = await client.query(
    `SELECT estado, ((fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW() AS cerrada,
            (((fechainicio::date::timestamp AT TIME ZONE 'America/Lima') > NOW()) AND ((fechainicio::date::timestamp AT TIME ZONE 'America/Lima') < NOW() + INTERVAL '24 hours')) AS inicia_en_menos_de_24h
     FROM iniciativa WHERE idiniciativa = $1 FOR UPDATE`,
    [idiniciativa],
  );
  return result.rows[0] || null;
}

/** Actualiza iniciativa. (CAMBIO: modalidad en minúsculas) */
export async function actualizarIniciativa(
  idiniciativa,
  idempresa,
  {
    titulo,
    categoria,
    descripcion,
    fechainicio,
    fechafin,
    lugar,
    numcupo,
    requisito,
    imagen,
    modalidad,
    enlaceReunion,
    horario,
  },
  client,
) {
  const result = await client.query(
    `UPDATE iniciativa
         SET titulo = $1, categoria = $2, descripcion = $3, fechainicio = $4, fechafin = $5, lugar = $6, numcupo = $7, requisito = $8,
             imagen = COALESCE($9, imagen), modalidad = COALESCE($10, modalidad), enlace_reunion = $11, horario = $12
         WHERE idiniciativa = $13 AND idempresa = $14 RETURNING *`,
    [
      titulo,
      categoria,
      descripcion,
      fechainicio,
      fechafin,
      lugar,
      numcupo,
      requisito,
      imagen,
      (modalidad || "presencial").toLowerCase(),
      enlaceReunion || null,
      horario || null,
      idiniciativa,
      idempresa,
    ],
  );
  return result.rows[0] || null;
}

/** Cuenta aceptados. */
export async function contarAceptadosEnIniciativa(idiniciativa, client = pool) {
  const result = await client.query(
    "SELECT COUNT(*)::int AS total FROM postulacion WHERE idiniciativa = $1 AND estado = 'aceptado'",
    [idiniciativa],
  );
  return result.rows[0].total;
}

/** Política de cancelación. */
export async function obtenerPoliticaCancelacion(idiniciativa, client = pool) {
  const result = await client.query(
    `SELECT (i.estado = 'finalizada' OR ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW()) AS finished,
            (((i.fechainicio::date::timestamp AT TIME ZONE 'America/Lima') > NOW()) AND ((i.fechainicio::date::timestamp AT TIME ZONE 'America/Lima') < NOW() + INTERVAL '24 hours')) AS starts_within_24h,
            (SELECT COUNT(*)::int FROM postulacion p WHERE p.idiniciativa = i.idiniciativa AND p.estado = 'aceptado') AS accepted_count,
            EXISTS (SELECT 1 FROM tarea t WHERE t.idiniciativa = i.idiniciativa AND t.estado IN ('en_proceso', 'finalizado')) AS has_locked_tasks
     FROM iniciativa i WHERE i.idiniciativa = $1 FOR UPDATE`,
    [idiniciativa],
  );
  return result.rows[0] || null;
}

/** Verifica cierre. */
export async function verificarCierreIniciativa(idiniciativa, client = pool) {
  const result = await client.query(
    `SELECT ((fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW() AS cerrada FROM iniciativa WHERE idiniciativa = $1`,
    [idiniciativa],
  );
  return result.rows[0]?.cerrada || false;
}

/** Busca calificación pendiente. */
export async function buscarCalificacionPendiente(
  idvoluntario,
  idempresa,
  client = pool,
) {
  const result = await client.query(
    `SELECT i.titulo FROM postulacion p
     JOIN iniciativa i ON i.idiniciativa = p.idiniciativa
     LEFT JOIN valoracion_iniciativa v ON v.idiniciativa = i.idiniciativa AND v.idvoluntario = p.idvoluntario
     WHERE p.idvoluntario = $1 AND p.estado = 'aceptado' AND i.idempresa = $2 AND v.idvaloracion IS NULL
       AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW() ORDER BY i.fechafin ASC LIMIT 1`,
    [idvoluntario, idempresa],
  );
  return result.rows[0] || null;
}

/** Estado de postulación. */
export async function obtenerEstadoPostulacion(
  idiniciativa,
  idvoluntario,
  client = pool,
) {
  const result = await client.query(
    "SELECT estado FROM postulacion WHERE idiniciativa = $1 AND idvoluntario = $2",
    [idiniciativa, idvoluntario],
  );
  return result.rows[0]?.estado || null;
}

/** Crea solicitud de cancelación. */
export async function crearSolicitudCancelacion(
  idiniciativa,
  idempresa,
  motivo,
  client = pool,
) {
  await client.query(
    `INSERT INTO solicitud_cancelacion_iniciativa (idiniciativa, idempresa, motivo) VALUES ($1, $2, $3)`,
    [idiniciativa, idempresa, motivo],
  );
}

/** Actualiza o crea tareas de una iniciativa */
export async function actualizarTareasDeIniciativa(tasks, initiativeId, client) {
  const currentTasks = await client.query(
    'SELECT idtarea, titulo, descripcion, area, priority, idvoluntario_asignado, estado FROM tarea WHERE idiniciativa = $1',
    [initiativeId]
  );
  
  const currentIds = new Set(currentTasks.rows.map((task) => Number(task.idtarea)));
  
  if (tasks.some((task) => task.id && !currentIds.has(task.id))) {
    throw new Error("Una de las tareas no pertenece a esta iniciativa.");
  }

  const submittedIds = new Set(tasks.filter((task) => task.id).map((task) => task.id));
  const removedTasks = currentTasks.rows.filter((task) => !submittedIds.has(Number(task.idtarea)));
  
  const isBlankTask = (task) =>
    !String(task.titulo || "").trim() &&
    !String(task.descripcion || "").trim() &&
    !String(task.area || "").trim();

  if (removedTasks.some((task) => !isBlankTask(task) && (task.idvoluntario_asignado || task.estado !== "pendiente"))) {
    throw new Error("No puedes quitar tareas asignadas o que ya empezaron. Corrige sus datos o déjalas en la lista.");
  }

  if (removedTasks.length) {
    const removedIds = removedTasks.map((task) => task.idtarea);
    const deletion = await client.query(
      `DELETE FROM tarea WHERE idtarea = ANY($1) AND idiniciativa = $2 AND ((NULLIF(BTRIM(titulo), '') IS NULL AND NULLIF(BTRIM(descripcion), '') IS NULL AND NULLIF(BTRIM(area), '') IS NULL) OR (idvoluntario_asignado IS NULL AND estado = 'pendiente')) RETURNING idtarea`,
      [removedIds, initiativeId]
    );
    if (deletion.rowCount !== removedTasks.length) {
      throw new Error("Una tarea cambió y ya no se puede quitar. Recarga la iniciativa e inténtalo de nuevo.");
    }
  }

  for (const task of tasks) {
    if (task.id) {
      await client.query(
        `UPDATE tarea SET titulo = $1, descripcion = $2, area = $3, priority = $4 WHERE idtarea = $5 AND idiniciativa = $6`,
        [task.title, task.description, task.area, task.priority, task.id, initiativeId]
      );
    }
  }
}
