// DAO de perfiles (voluntarios y empresas)
import pool from '../config/db.js';
import { notify } from './notificaciones.js';

const INSIGNIAS = [
    { key: 'primer_paso', name: 'Primer paso', description: 'Completa tu primera tarea de voluntariado.', icon: '🌱', metric: 'completedTasks', goal: 1 },
    { key: 'manos_a_la_obra', name: 'Manos a la obra', description: 'Completa 5 tareas de voluntariado.', icon: '🛠️', metric: 'completedTasks', goal: 5 },
    { key: 'voluntario_imparable', name: 'Voluntario imparable', description: 'Completa 10 tareas de voluntariado.', icon: '🔥', metric: 'completedTasks', goal: 10 },
    { key: 'voluntario_activo', name: 'Voluntario activo', description: 'Consigue que acepten tu postulación en 3 iniciativas.', icon: '🤝', metric: 'acceptedInitiatives', goal: 3 },
    { key: 'con_certificado', name: 'Con certificado', description: 'Sube tu primer certificado a tu perfil.', icon: '📜', metric: 'certifications', goal: 1 },
];

// ============ CONSULTAS DE PERFIL ============

/** Lista las iniciativas de una empresa (opcionalmente solo las activas). */
export async function listarIniciativasDeEmpresa(idempresa, { soloActivas = false } = {}) {
    const result = await pool.query(
        `SELECT idiniciativa AS id, titulo AS title, descripcion AS summary, categoria AS category,
            fechainicio AS date, fechafin AS end_date, lugar AS location, numcupo AS quota,
            estado
     FROM iniciativa
     WHERE idempresa = $1 ${soloActivas ? "AND estado = 'activa'" : ''}
     ORDER BY fechainicio DESC`,
        [idempresa],
    );
    return result.rows.map((row) => ({ ...row, endDate: row.end_date }));
}

/** Obtiene el perfil público de un voluntario (con stats y certificaciones). */
export async function obtenerPerfilVoluntario(idvoluntario, client = pool) {
    const result = await client.query(
        `SELECT idvoluntario AS id, nombrecompleto AS full_name, correo AS email,
            telefono AS phone, biografia AS bio, foto_url, creado_en
     FROM voluntario WHERE idvoluntario = $1`,
        [idvoluntario],
    );
    const profile = result.rows[0];
    if (!profile) return null;

    const [progress, certifications] = await Promise.all([
        client.query(
            `SELECT COUNT(DISTINCT p.idiniciativa) FILTER (WHERE p.estado = 'aceptado') AS accepted,
              COUNT(DISTINCT t.idtarea) FILTER (WHERE t.estado = 'finalizado' AND t.idvoluntario_asignado = $1) AS completed_tasks
       FROM postulacion p
       LEFT JOIN tarea t ON t.idiniciativa = p.idiniciativa
       WHERE p.idvoluntario = $1`,
            [idvoluntario],
        ),
        client.query(
            `SELECT idcertificacion AS id, titulo AS title, entidad AS issuer,
              fecha_emision AS issued_at, url_documento AS document_url
       FROM certificacion
       WHERE idvoluntario = $1
       ORDER BY fecha_emision DESC NULLS LAST, creado_en DESC`,
            [idvoluntario],
        ),
    ]);

    const stats = {
        acceptedInitiatives: Number(progress.rows[0]?.accepted || 0),
        completedTasks: Number(progress.rows[0]?.completed_tasks || 0),
        certifications: certifications.rows.length,
    };

    // Registra cada logro una sola vez y avisa al voluntario solo cuando se desbloquea.
    const earnedNow = [];
    for (const badge of INSIGNIAS) {
        if (stats[badge.metric] < badge.goal) continue;
        const inserted = await client.query(
            `INSERT INTO voluntario_insignia (idvoluntario, clave)
             VALUES ($1, $2)
             ON CONFLICT (idvoluntario, clave) DO NOTHING
             RETURNING clave`,
            [idvoluntario, badge.key],
        );
        if (inserted.rowCount) earnedNow.push(badge);
    }

    const earnedResult = await client.query(
        'SELECT clave, otorgada_en, equipada FROM voluntario_insignia WHERE idvoluntario = $1',
        [idvoluntario],
    );
    const earned = new Map(earnedResult.rows.map((row) => [row.clave, row]));
    const badges = INSIGNIAS.map((badge) => {
        const record = earned.get(badge.key);
        const current = stats[badge.metric];
        return {
            ...badge,
            unlocked: Boolean(record),
            equipped: Boolean(record?.equipada),
            awardedAt: record?.otorgada_en || null,
            progress: Math.min(current, badge.goal),
            progressLabel: `${Math.min(current, badge.goal)} de ${badge.goal}`,
        };
    });

    await Promise.all(earnedNow.map((badge) => notify(
        idvoluntario,
        'volunteer',
        'badge_earned',
        `¡Nueva insignia: ${badge.name}!`,
        `Acabas de recibir la insignia “${badge.name}”. Entra a tu perfil para equiparla en tu foto.`,
        '/profile',
        `badge_award:${idvoluntario}:${badge.key}`,
    )));

    return {
        id: profile.id,
        role: 'volunteer',
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone || '',
        bio: profile.bio || '',
        fotoUrl: profile.foto_url || null,
        createdAt: profile.creado_en,
        acceptedInitiatives: stats.acceptedInitiatives,
        completedTasks: stats.completedTasks,
        badges,
        equippedBadge: badges.find((badge) => badge.equipped) || null,
        certifications: certifications.rows.map((c) => ({
            id: c.id,
            title: c.title,
            issuer: c.issuer,
            issuedAt: c.issued_at,
            documentUrl: c.document_url,
        })),
    };
}

/** Obtiene el perfil de una empresa. */
export async function obtenerPerfilEmpresa(idempresa, client = pool) {
    const result = await client.query(
        `SELECT idempresa AS id, nombreempresa AS company_name, ruc, nombrecoordinador AS contact_name,
            correo AS email, sector, logo_url
     FROM empresa WHERE idempresa = $1`,
        [idempresa],
    );
    const profile = result.rows[0];
    if (!profile) return null;
    return {
        id: profile.id,
        role: 'company',
        companyName: profile.company_name,
        ruc: profile.ruc,
        contactName: profile.contact_name,
        email: profile.email,
        sector: profile.sector,
        logoUrl: profile.logo_url || null,
    };
}

// ============ ACTUALIZACIONES ============

/** Verifica si un correo ya está en uso por OTRO usuario. */
export async function correoUsadoPorOtro({ email, role, id }) {
    const [v, e] = await Promise.all([
        pool.query('SELECT idvoluntario FROM voluntario WHERE correo = $1', [email]),
        pool.query('SELECT idempresa FROM empresa WHERE correo = $1', [email]),
    ]);
    if (role === 'volunteer') {
        return v.rows.some((row) => row.idvoluntario !== id) || e.rowCount > 0;
    }
    return v.rowCount > 0 || e.rows.some((row) => row.idempresa !== id);
}

/** Actualiza el perfil de un voluntario. */
export async function actualizarPerfilVoluntario({ idvoluntario, nombrecompleto, correo, telefono, biografia }) {
    const result = await pool.query(
        `UPDATE voluntario
     SET nombrecompleto = $1, correo = $2, telefono = $3, biografia = $4
     WHERE idvoluntario = $5`,
        [nombrecompleto, correo, telefono || null, biografia || null, idvoluntario],
    );
    return result.rowCount;
}

/** Actualiza el perfil de una empresa. */
export async function actualizarPerfilEmpresa({ idempresa, nombreempresa, nombrecoordinador, correo, sector }) {
    const result = await pool.query(
        `UPDATE empresa
     SET nombreempresa = $1, nombrecoordinador = $2, correo = $3, sector = $4
     WHERE idempresa = $5`,
        [nombreempresa, nombrecoordinador, correo, sector, idempresa],
    );
    return result.rowCount;
}

/** Actualiza el logo de una empresa. */
export async function actualizarLogoEmpresa({ idempresa, logoUrl }) {
    const result = await pool.query(
        'UPDATE empresa SET logo_url = $1 WHERE idempresa = $2',
        [logoUrl, idempresa],
    );
    return result.rowCount;
}

/** Actualiza la foto de un voluntario. */
export async function actualizarFotoVoluntario({ idvoluntario, fotoUrl }) {
    const result = await pool.query(
        'UPDATE voluntario SET foto_url = $1 WHERE idvoluntario = $2',
        [fotoUrl, idvoluntario],
    );
    return result.rowCount;
}

/** Equipa una insignia que el voluntario ya obtuvo, o elimina la insignia de su foto. */
export async function equiparInsigniaVoluntario({ idvoluntario, clave }) {
    if (clave !== null && !INSIGNIAS.some((badge) => badge.key === clave)) return { invalid: true };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (clave !== null) {
            const earned = await client.query(
                'SELECT 1 FROM voluntario_insignia WHERE idvoluntario = $1 AND clave = $2',
                [idvoluntario, clave],
            );
            if (!earned.rowCount) {
                await client.query('ROLLBACK');
                return { notEarned: true };
            }
        }

        await client.query('UPDATE voluntario_insignia SET equipada = FALSE WHERE idvoluntario = $1', [idvoluntario]);
        if (clave !== null) {
            await client.query(
                'UPDATE voluntario_insignia SET equipada = TRUE WHERE idvoluntario = $1 AND clave = $2',
                [idvoluntario, clave],
            );
        }
        await client.query('COMMIT');
        return { ok: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ============ CERTIFICACIONES ============

/** Crea una certificación para un voluntario. */
export async function crearCertificacion({ idvoluntario, titulo, entidad, fecha_emision, url_documento }) {
    const result = await pool.query(
        `INSERT INTO certificacion (idvoluntario, titulo, entidad, fecha_emision, url_documento)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING idcertificacion AS id, titulo AS title, entidad AS issuer,
               fecha_emision AS issued_at, url_documento AS document_url`,
        [idvoluntario, titulo, entidad, fecha_emision, url_documento],
    );
    const c = result.rows[0];
    return {
        id: c.id,
        title: c.title,
        issuer: c.issuer,
        issuedAt: c.issued_at,
        documentUrl: c.document_url,
    };
}

// ============ VERIFICACIONES DE ACCESO ============

/** Verifica si una empresa tiene acceso al perfil de un voluntario (por postulación). */
export async function empresaTieneAccesoAVoluntario({ idvoluntario, idempresa }) {
    const result = await pool.query(
        `SELECT 1
     FROM postulacion p
     JOIN iniciativa i ON i.idiniciativa = p.idiniciativa
     WHERE p.idvoluntario = $1 AND i.idempresa = $2
     LIMIT 1`,
        [idvoluntario, idempresa],
    );
    return result.rowCount > 0;
}

/**
 * Obtiene el nombre de una empresa por su ID.
 * @param {number} idempresa - ID de la empresa.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<string>} Nombre de la empresa o ''.
 */
export async function obtenerNombreEmpresa(idempresa, client = pool) {
    const result = await client.query(
        'SELECT nombreempresa FROM empresa WHERE idempresa = $1',
        [idempresa],
    );
    return result.rows[0]?.nombreempresa || '';
}
