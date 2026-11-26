// Ruta de actividades, montada en /api/activities
//   GET /api/activities -> TODAS las iniciativas a las que el voluntario se postuló

import { Router } from 'express';
import { auth } from '../middlewares/autenticacion.js';
import {
  listarActividadesDeVoluntario,
  listarTareasPorIniciativas,
} from '../helpers/actividades.js';
import { serializeInitiative } from '../helpers/serializers.js';
import { enviarCertificadosPendientes } from '../helpers/certificados.js';
import pool from '../config/db.js';

export const activitiesRouter = Router();

/**
 * GET /api/activities
 * Devuelve todas las iniciativas a las que el voluntario se ha postulado,
 * incluyendo el estado de cada postulación y las tareas asociadas.
 */
activitiesRouter.get('/', auth('volunteer'), async (req, res) => {
  try {
    // 1. Obtener las iniciativas del voluntario
    const rows = await listarActividadesDeVoluntario(req.user.id, {
      soloActivas: req.query.activeOnly === 'true',
    });
    const ids = rows.map((r) => r.idiniciativa);

    // 2. Obtener las tareas de esas iniciativas
    const tareas = await listarTareasPorIniciativas(ids);

    // 3. Agrupar tareas por iniciativa
    const tasksByInitiative = {};
    tareas.forEach((t) => {
      if (!tasksByInitiative[t.idiniciativa]) tasksByInitiative[t.idiniciativa] = [];
      tasksByInitiative[t.idiniciativa].push(t);
    });

    // 4. Serializar y devolver
    return res.json({
      activities: rows.map((row) =>
        serializeInitiative(
          row,
          tasksByInitiative[row.idiniciativa] || [],
          {
            joinedCount: Number(row.participantes_aceptados || 0),
            // Una postulación pendiente o rechazada nunca recibe el enlace.
            includeMeetingUrl: row.estado_postulacion === 'aceptado',
          },
        ),
      ),
    });
  } catch (err) {
    console.error('Error al listar actividades:', err.message);
    return res.status(500).json({ message: 'Error al cargar tus actividades.' });
  }
});

/**
 * POST /api/activities/:id/rating
 * Registra una valoración de 1 a 5 estrellas para una iniciativa cerrada en la que fue aceptado.
 * El comentario es opcional y admite hasta 300 caracteres; al guardar, intenta procesar certificados pendientes.
 */
activitiesRouter.post('/:id/rating', auth('volunteer'), async (req, res) => {
  const score = Number(req.body.score);
  const comment = String(req.body.comment || '').trim();
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ message: 'Selecciona una valoración de 1 a 5 estrellas.' });
  }
  if (comment.length > 300) {
    return res.status(400).json({ message: 'El comentario no puede superar los 300 caracteres.' });
  }

  try {
    const initiative = await pool.query(
      `SELECT i.idiniciativa
       FROM iniciativa i
       JOIN postulacion p ON p.idiniciativa = i.idiniciativa
       WHERE i.idiniciativa = $1 AND p.idvoluntario = $2 AND p.estado = 'aceptado'
         AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW()`,
      [req.params.id, req.user.id],
    );
    if (!initiative.rowCount) {
      return res.status(409).json({ message: 'La valoración estará disponible al cerrar una iniciativa en la que fuiste aceptado.' });
    }

    const saved = await pool.query(
      `INSERT INTO valoracion_iniciativa (idiniciativa, idvoluntario, puntaje, comentario)
       VALUES ($1, $2, $3, $4)
       RETURNING idvaloracion AS id, puntaje AS score, comentario AS comment`,
      [initiative.rows[0].idiniciativa, req.user.id, score, comment || null],
    );
    void enviarCertificadosPendientes().catch((error) => {
      console.error('No se pudo procesar la cola de certificados:', error.message);
    });
    return res.status(201).json({
      rating: saved.rows[0],
      message: 'Tu valoración quedó registrada. El certificado se enviará al correo registrado cuando el servicio de correo esté disponible.',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ya enviaste tu valoración para esta iniciativa.' });
    }
    console.error('Error al guardar valoración:', err.message);
    return res.status(500).json({ message: 'No se pudo guardar tu valoración.' });
  }
});
