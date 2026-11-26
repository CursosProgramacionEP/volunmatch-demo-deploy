// DAO de tareas
import pool from '../config/db.js';

/** Lista las tareas de varias iniciativas a la vez, agrupadas por iniciativa. */
export async function listarTareasDeIniciativas(idsIniciativas) {
    if (!idsIniciativas.length) return {};

    const result = await pool.query(
        `SELECT
       t.idtarea, t.titulo, t.descripcion, t.estado, t.idiniciativa,
       t.idvoluntario_asignado, t.fecha_asignacion, t.area, t.priority,
       v.nombrecompleto AS voluntario_nombre,
       v.correo AS voluntario_correo,
       v.foto_url AS voluntario_foto_url
     FROM tarea t
     LEFT JOIN voluntario v ON v.idvoluntario = t.idvoluntario_asignado
     WHERE t.idiniciativa = ANY($1)
     ORDER BY t.idtarea ASC`,
        [idsIniciativas],
    );

    const tareasPorIniciativa = {};
    result.rows.forEach((t) => {
        if (!tareasPorIniciativa[t.idiniciativa]) tareasPorIniciativa[t.idiniciativa] = [];
        tareasPorIniciativa[t.idiniciativa].push(t);
    });
    return tareasPorIniciativa;
}

/** Lista las tareas de una sola iniciativa. */


export async function listarTareasDeIniciativa(idiniciativa, client = pool) {
    const result = await client.query(
        `SELECT
       t.idtarea, t.titulo, t.descripcion, t.estado, t.idiniciativa,
       t.idvoluntario_asignado, t.fecha_asignacion, t.area, t.priority,
       v.nombrecompleto AS voluntario_nombre,
       v.correo AS voluntario_correo,
       v.foto_url AS voluntario_foto_url
     FROM tarea t
     LEFT JOIN voluntario v ON v.idvoluntario = t.idvoluntario_asignado
     WHERE t.idiniciativa = $1
     ORDER BY t.idtarea ASC`,
        [idiniciativa],
    );
    return result.rows;
}

/** Busca una tarea por su ID y su iniciativa. */
export async function buscarTarea(idtarea, idiniciativa, client = pool) {
    const result = await client.query(
        `SELECT
       t.idtarea, t.titulo, t.descripcion, t.estado, t.idiniciativa,
       t.idvoluntario_asignado, t.fecha_asignacion, t.area, t.priority,
       v.nombrecompleto AS voluntario_nombre,
       v.correo AS voluntario_correo,
       v.foto_url AS voluntario_foto_url
     FROM tarea t
     LEFT JOIN voluntario v ON v.idvoluntario = t.idvoluntario_asignado
     WHERE t.idtarea = $1 AND t.idiniciativa = $2`,
        [idtarea, idiniciativa],
    );
    return result.rows[0] || null;
}

/** Crea una nueva tarea. */
export async function crearTarea({ titulo, descripcion, idiniciativa, area, priority }, client = pool) {
    const result = await client.query(
        `INSERT INTO tarea (titulo, descripcion, idiniciativa, estado, area, priority)
     VALUES ($1, $2, $3, 'pendiente', $4, $5)
     RETURNING *`,
        [titulo, descripcion, idiniciativa, area, priority],
    );
    return result.rows[0];
}

/** Elimina una tarea (solo si pertenece a la empresa y está pendiente sin asignar). */
export async function eliminarTarea({ idtarea, idiniciativa, idempresa }, client = pool) {
    const result = await client.query(
        `DELETE FROM tarea t
     USING iniciativa i
     WHERE t.idtarea = $1 AND t.idiniciativa = $2
       AND t.idvoluntario_asignado IS NULL AND t.estado = 'pendiente'
       AND i.idiniciativa = t.idiniciativa AND i.idempresa = $3
     RETURNING t.idtarea AS id`,
        [idtarea, idiniciativa, idempresa],
    );
    return result.rowCount > 0 ? result.rows[0].id : null;
}

/** Asigna una tarea a un voluntario. */
export async function tomarTarea({ idtarea, idvoluntario }, client = pool) {
    const result = await client.query(
        `UPDATE tarea
     SET estado = 'pendiente',
         idvoluntario_asignado = $1,
         fecha_asignacion = NOW(),
         idvoluntario_modificacion = $1,
         fecha_modificacion = NOW()
     WHERE idtarea = $2
     RETURNING *`,
        [idvoluntario, idtarea],
    );
    return result.rows[0];
}

/** Finaliza una tarea. */
export async function finalizarTarea({ idtarea, idvoluntario }, client = pool) {
    const result = await client.query(
        `UPDATE tarea
     SET estado = 'finalizado',
         idvoluntario_modificacion = $1,
         fecha_modificacion = NOW()
     WHERE idtarea = $2
     RETURNING *`,
        [idvoluntario, idtarea],
    );
    return result.rows[0];
}

/** Actualiza el estado de una tarea. */
export async function actualizarEstadoTarea({ idtarea, estado, idvoluntario }, client = pool) {
    const result = await client.query(
        `UPDATE tarea
     SET estado = $1,
         idvoluntario_modificacion = $2,
         fecha_modificacion = NOW()
     WHERE idtarea = $3
     RETURNING *`,
        [estado, idvoluntario, idtarea],
    );
    return result.rows[0];
}

/** Cuenta los voluntarios aceptados por iniciativa. */
export async function contarAceptadosPorIniciativa(idsIniciativas) {
    if (!idsIniciativas.length) return {};
    const result = await pool.query(
        `SELECT idiniciativa, COUNT(*) as total
     FROM postulacion
     WHERE idiniciativa = ANY($1) AND estado = 'aceptado'
     GROUP BY idiniciativa`,
        [idsIniciativas],
    );
    const counts = {};
    result.rows.forEach((row) => {
        counts[row.idiniciativa] = parseInt(row.total, 10);
    });
    return counts;
}
