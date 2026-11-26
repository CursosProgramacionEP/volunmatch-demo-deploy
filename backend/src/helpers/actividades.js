// DAO de actividades (acceso a datos de actividades del voluntario)
import pool from "../config/db.js";

/**
 * Lista las iniciativas a las que un voluntario se ha postulado.
 * @param {number} idvoluntario - ID del voluntario.
 * @param {object} options - Filtros opcionales de la consulta.
 * @param {boolean} options.soloActivas - Limita los resultados a iniciativas vigentes.
 * @param {object} client - Cliente de BD (opcional, para transacciones).
 * @returns {Promise<Array>} Lista de iniciativas con estado de postulación.
 */
export async function listarActividadesDeVoluntario(
  idvoluntario,
  { soloActivas = false } = {},
  client = pool,
) {
  const result = await client.query(
    `SELECT i.*, e.nombreempresa, v.nombrecompleto AS nombrevoluntario,
            p.estado AS estado_postulacion, vi.puntaje AS valoracion_puntaje,
            vi.comentario AS valoracion_comentario,
            (SELECT COUNT(*)::int FROM postulacion aceptada
             WHERE aceptada.idiniciativa = i.idiniciativa AND aceptada.estado = 'aceptado') AS participantes_aceptados,
            CASE WHEN p.estado = 'aceptado'
              AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW()
              THEN TRUE ELSE FALSE END AS valoracion_disponible
     FROM postulacion p
     JOIN iniciativa i ON p.idiniciativa = i.idiniciativa
     JOIN empresa e ON i.idempresa = e.idempresa
     JOIN voluntario v ON v.idvoluntario = p.idvoluntario
     LEFT JOIN valoracion_iniciativa vi
       ON vi.idiniciativa = i.idiniciativa AND vi.idvoluntario = p.idvoluntario
     WHERE p.idvoluntario = $1
       ${soloActivas ? "AND i.estado = 'activa' AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') > NOW()" : ""}
     ORDER BY p.fecha_postulacion DESC`,
    [idvoluntario],
  );
  return result.rows;
}

/**
 * Lista las tareas de varias iniciativas, con datos del voluntario asignado.
 * @param {Array<number>} ids - IDs de las iniciativas.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<Array>} Lista de tareas con nombre/correo del voluntario.
 */
export async function listarTareasPorIniciativas(ids, client = pool) {
  if (!ids.length) return [];
  const result = await client.query(
    `SELECT t.*, v.nombrecompleto AS voluntario_nombre, v.correo AS voluntario_correo,
            v.biografia AS voluntario_biografia
     FROM tarea t
     LEFT JOIN voluntario v ON v.idvoluntario = t.idvoluntario_asignado
     WHERE t.idiniciativa = ANY($1)
     ORDER BY t.idtarea ASC`,
    [ids],
  );
  return result.rows;
}