// DAO de postulaciones
import pool from '../config/db.js';

/** Busca una postulación existente. */
export async function buscarPostulacion({ idiniciativa, idvoluntario }, client = pool) {
    const result = await client.query(
        'SELECT * FROM postulacion WHERE idiniciativa = $1 AND idvoluntario = $2',
        [idiniciativa, idvoluntario],
    );
    return result.rows[0] || null;
}

/** Crea una nueva postulación. */
export async function crearPostulacion({ razon, idvoluntario, idiniciativa }, client = pool) {
    const result = await client.query(
        `INSERT INTO postulacion (razon, idvoluntario, idiniciativa)
     VALUES ($1, $2, $3)
     RETURNING *`, 
        [razon, idvoluntario, idiniciativa],
    );
    return result.rows[0];
}

/** Lista los voluntarios aceptados en una iniciativa. */
export async function listarVoluntariosAceptados(idiniciativa, client = pool) {
    const result = await client.query(
        `SELECT DISTINCT idvoluntario FROM postulacion
     WHERE idiniciativa = $1 AND estado = 'aceptado'`,
        [idiniciativa],
    );
    return result.rows;
}

/**
 * Lista la información mínima de los voluntarios aceptados. Esta consulta se
 * usa únicamente después de validar que la empresa sea dueña de la iniciativa.
 */
export async function listarDetallesVoluntariosAceptados(idiniciativa, client = pool) {
    const result = await client.query(
        `SELECT DISTINCT ON (v.idvoluntario)
           v.idvoluntario AS id,
           v.nombrecompleto AS full_name,
           v.correo AS email,
           v.foto_url,
           p.fecha_postulacion AS applied_at
         FROM postulacion p
         JOIN voluntario v ON v.idvoluntario = p.idvoluntario
         WHERE p.idiniciativa = $1 AND p.estado = 'aceptado'
         ORDER BY v.idvoluntario, p.fecha_postulacion ASC`,
        [idiniciativa],
    );
    return result.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        photoUrl: row.foto_url || null,
        appliedAt: row.applied_at,
    }));
}

/** Verifica si un voluntario está aceptado en una iniciativa. */
export async function estaAceptado({ idiniciativa, idvoluntario }, client = pool) {
    const result = await client.query(
        `SELECT 1 FROM postulacion
     WHERE idiniciativa = $1 AND idvoluntario = $2 AND estado = 'aceptado'`,
        [idiniciativa, idvoluntario],
    );
    return result.rowCount > 0;
}

/**
 * Lista las postulaciones recibidas en las iniciativas de una empresa.
 * @param {number} idempresa - ID de la empresa.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<Array>} Lista de postulaciones con datos del voluntario e iniciativa.
 */
export async function listarPostulacionesDeEmpresa(idempresa, client = pool) {
    const result = await client.query(
        `SELECT 
       p.idpostulacion AS id,
       p.razon,
       p.estado,
       p.idvoluntario,
       p.idiniciativa,
       p.fecha_postulacion,
       v.nombrecompleto AS volunteer_name,
       v.correo AS volunteer_email,
       v.foto_url AS volunteer_photo_url,
       i.titulo AS initiative_title,
       i.categoria AS initiative_category
     FROM postulacion p
     JOIN iniciativa i ON p.idiniciativa = i.idiniciativa
     JOIN voluntario v ON p.idvoluntario = v.idvoluntario
     WHERE i.idempresa = $1
     ORDER BY p.fecha_postulacion DESC`,
        [idempresa],
    );
    return result.rows;
}

/**
 * Lista las postulaciones propias de un voluntario.
 * @param {number} idvoluntario - ID del voluntario.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<Array>} Lista de postulaciones.
 */
export async function listarPostulacionesDeVoluntario(idvoluntario, client = pool) {
    const result = await client.query(
        `SELECT 
       p.idpostulacion AS id,
       p.razon,
       p.estado,
       p.idvoluntario,
       p.idiniciativa,
       p.fecha_postulacion,
       i.titulo AS initiative_title,
       i.categoria AS initiative_category
     FROM postulacion p
     JOIN iniciativa i ON p.idiniciativa = i.idiniciativa
     WHERE p.idvoluntario = $1
     ORDER BY p.fecha_postulacion DESC`,
        [idvoluntario],
    );
    return result.rows;
}

/**
 * Busca una postulación por ID (con datos de iniciativa y empresa).
 * @param {number} idpostulacion - ID de la postulación.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<object|null>} Postulación con datos de iniciativa o null.
 */
export async function buscarPostulacionPorId(idpostulacion, client = pool) {
    const result = await client.query(
        `SELECT p.*, i.idempresa, i.idiniciativa, i.titulo, i.numcupo, i.estado AS initiative_status
     FROM postulacion p
     JOIN iniciativa i ON p.idiniciativa = i.idiniciativa
     WHERE p.idpostulacion = $1
     FOR UPDATE`,
        [idpostulacion],
    );
    return result.rows[0] || null;
}

/**
 * Cuenta los voluntarios aceptados en una iniciativa.
 * @param {number} idiniciativa - ID de la iniciativa.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<number>} Número de aceptados.
 */
export async function contarAceptadosDeIniciativa(idiniciativa, client = pool) {
    const result = await client.query(
        `SELECT COUNT(*) AS total FROM postulacion
     WHERE idiniciativa = $1 AND estado = 'aceptado'`,
        [idiniciativa],
    );
    return Number(result.rows[0].total);
}

/**
 * Actualiza el estado de una postulación.
 * @param {number} idpostulacion - ID de la postulación.
 * @param {string} estado - 'pendiente', 'aceptado' o 'rechazado'.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<number>} Número de filas afectadas.
 */
export async function actualizarEstadoPostulacion(idpostulacion, estado, client = pool) {
    const result = await client.query(
        'UPDATE postulacion SET estado = $1 WHERE idpostulacion = $2',
        [estado, idpostulacion],
    );
    return result.rowCount;
}
