// DAO de reportes
import pool from '../config/db.js';

/** Obtiene el reporte de actividad de iniciativas de una empresa. */
export async function obtenerReporteActividad({ idempresa, initiativeId, category, from, to }) {
    const params = [idempresa];
    const conditions = ['i.idempresa = $1'];

    if (initiativeId) {
        params.push(Number(initiativeId));
        conditions.push(`i.idiniciativa = $${params.length}`);
    }
    if (category) {
        params.push(category);
        conditions.push(`i.categoria = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`i.fechainicio >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`i.fechainicio <= $${params.length}::date`);
    }

    const result = await pool.query(
        `SELECT
       i.idiniciativa AS id,
       i.titulo AS title,
       i.categoria AS category,
       i.fechainicio AS date,
       (SELECT COUNT(*) FROM postulacion p
        WHERE p.idiniciativa = i.idiniciativa AND p.estado = 'aceptado')::int AS accepted_volunteers,
       (SELECT COUNT(*) FROM tarea t WHERE t.idiniciativa = i.idiniciativa)::int AS total_tasks,
       (SELECT COUNT(*) FROM tarea t
        WHERE t.idiniciativa = i.idiniciativa AND t.estado = 'finalizado')::int AS completed_tasks
     FROM iniciativa i
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.fechainicio DESC, i.idiniciativa DESC`,
        params,
    );
    return result.rows;
}

/** Obtiene los voluntarios aceptados en el período anterior para comparación. */
export async function obtenerAceptadosPeriodoAnterior({ idempresa, from, to, category }) {
    const params = [idempresa, from, to];
    let categoryCondition = '';
    if (category) {
        params.push(category);
        categoryCondition = ` AND i.categoria = $${params.length}`;
    }
    const result = await pool.query(
        `SELECT COUNT(*)::int AS accepted_volunteers
     FROM postulacion p
     JOIN iniciativa i ON i.idiniciativa = p.idiniciativa
     WHERE i.idempresa = $1 AND p.estado = 'aceptado'
       AND i.fechainicio < $2::date
       AND i.fechainicio >= ($2::date - (($3::date - $2::date) + 1))${categoryCondition}`,
        params,
    );
    return Number(result.rows[0].accepted_volunteers);
}