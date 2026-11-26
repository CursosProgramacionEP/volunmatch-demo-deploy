import { EventEmitter } from 'node:events';
import pool from '../config/db.js';
import { sendNotificationEmail } from '../services/correo.js';

const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(0);

/**
 * Crea una notificación: la guarda en BD, la emite en vivo por SSE y envía correo.
 * @param {number} userId - ID del usuario (voluntario o empresa).
 * @param {string} role - 'volunteer' o 'company'.
 * @param {string} type - Tipo de notificación.
 * @param {string} title - Título.
 * @param {string} message - Mensaje.
 * @param {string} link - URL de destino.
 * @param {string|null} eventKey - Clave única opcional para evitar avisos automáticos duplicados.
 * @returns {Promise<object|null>} Notificación creada o null si falla.
 */
export async function notify(userId, role, type, title, message, link, eventKey = null) {
  try {
    // 1. Guardar la notificación en la BD
    const result = eventKey
      ? await pool.query(
          `INSERT INTO notificacion (idusuario, rol, tipo, titulo, mensaje, enlace, evento_clave)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (evento_clave) WHERE evento_clave IS NOT NULL DO NOTHING
           RETURNING id, idusuario AS "userId", rol AS role, tipo AS type, titulo AS title,
             mensaje AS message, enlace AS link, leida AS read, creado_en AS "createdAt"`,
          [userId, role, type, title, message, link, eventKey],
        )
      : await pool.query(
          `INSERT INTO notificacion (idusuario, rol, tipo, titulo, mensaje, enlace)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, idusuario AS "userId", rol AS role, tipo AS type, titulo AS title,
             mensaje AS message, enlace AS link, leida AS read, creado_en AS "createdAt"`,
          [userId, role, type, title, message, link],
        );
    const notification = result.rows[0];

    // 2. Emitir por SSE (notificaciones en vivo)
    if (notification) notificationEvents.emit(String(userId), notification);

    // 3. Enviar correo al usuario
    if (notification) {
      try {
        const correoUsuario = await obtenerCorreoUsuario(userId, role);
        if (correoUsuario) {
          await sendNotificationEmail({
            email: correoUsuario,
            titulo: title,
            mensaje: message,
            enlace: link,
          });
        }
      } catch (emailError) {
        console.error('Error al enviar notificación por correo:', emailError.message);
      }
    }

    return notification;
  } catch (error) {
    console.error('Error al guardar notificación:', error.message);
    return null;
  }
}

/**
 * Obtiene el correo del usuario según su rol.
 * @param {number} userId - ID del usuario.
 * @param {string} role - 'volunteer' o 'company'.
 * @returns {Promise<string|null>} Correo del usuario o null.
 */
async function obtenerCorreoUsuario(userId, role) {
  try {
    if (role === 'volunteer') {
      const result = await pool.query(
        'SELECT correo FROM voluntario WHERE idvoluntario = $1',
        [userId],
      );
      return result.rows[0]?.correo || null;
    }
    if (role === 'company') {
      const result = await pool.query(
        'SELECT correo FROM empresa WHERE idempresa = $1',
        [userId],
      );
      return result.rows[0]?.correo || null;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener correo del usuario:', error.message);
    return null;
  }
}

/**
 * Suscribe un listener a las notificaciones de un usuario.
 * @param {number} userId - ID del usuario.
 * @param {Function} listener - Función que se ejecuta al recibir notificación.
 * @returns {Function} Función para cancelar la suscripción.
 */
export function subscribeNotifications(userId, listener) {
  notificationEvents.on(String(userId), listener);
  return () => notificationEvents.off(String(userId), listener);
}

/**
 * Lista todas las notificaciones de un usuario (máximo 100, ordenadas por fecha).
 * @param {number} idusuario - ID del usuario (voluntario o empresa).
 * @param {string} rol - 'volunteer' o 'company'.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<Array>} Lista de notificaciones.
 */
export async function listarNotificacionesDeUsuario(idusuario, rol, client = pool) {
  const result = await client.query(
    `SELECT id, tipo AS type, titulo AS title, mensaje AS message, enlace AS link,
            leida AS read, creado_en AS "createdAt"
     FROM notificacion
     WHERE idusuario = $1 AND rol = $2
     ORDER BY creado_en DESC
     LIMIT 100`,
    [idusuario, rol],
  );
  return result.rows;
}

/**
 * Lista solo las notificaciones NO leídas de un usuario.
 * @param {number} idusuario - ID del usuario.
 * @param {string} rol - 'volunteer' o 'company'.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<Array>} Lista de notificaciones no leídas.
 */
export async function listarNotificacionesNoLeidas(idusuario, rol, client = pool) {
  const result = await client.query(
    `SELECT id, idusuario AS "userId", rol AS role, tipo AS type, titulo AS title,
            mensaje AS message, enlace AS link, leida AS read, creado_en AS "createdAt"
     FROM notificacion
     WHERE idusuario = $1 AND rol = $2 AND leida = FALSE
     ORDER BY creado_en DESC
     LIMIT 100`,
    [idusuario, rol],
  );
  return result.rows;
}

/**
 * Marca una notificación como leída.
 * @param {number} id - ID de la notificación.
 * @param {number} idusuario - ID del usuario.
 * @param {string} rol - 'volunteer' o 'company'.
 * @param {object} client - Cliente de BD (opcional).
 * @returns {Promise<number>} Número de filas afectadas (1 si se actualizó, 0 si no).
 */
export async function marcarNotificacionComoLeida(id, idusuario, rol, client = pool) {
  const result = await client.query(
    `UPDATE notificacion SET leida = TRUE
     WHERE id = $1 AND idusuario = $2 AND rol = $3
     RETURNING id`,
    [id, idusuario, rol],
  );
  return result.rowCount;
}
