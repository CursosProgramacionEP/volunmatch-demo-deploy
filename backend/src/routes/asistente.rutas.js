// Rutas del Asistente IA para Voluntarios
import { Router } from 'express';
import { auth } from '../middlewares/autenticacion.js';
import { preguntarAsistenteVoluntario } from '../helpers/AsistenteVoluntario.js';

export const asistenteRouter = Router();

/**
 * POST /api/asistente/preguntar
 * Responde una consulta del voluntario autenticado usando su contexto de actividades.
 * Recibe `pregunta` (hasta 1000 caracteres) y un `historial` opcional.
 */
asistenteRouter.post('/preguntar', auth('volunteer'), async (req, res) => {
  const { pregunta, historial } = req.body;

  if (typeof pregunta !== 'string' || !pregunta.trim()) {
    return res.status(400).json({ message: 'Escribe una pregunta.' });
  }
  if (pregunta.trim().length > 1000) {
    return res.status(400).json({ message: 'La pregunta no puede superar los 1000 caracteres.' });
  }

  try {
    const respuesta = await preguntarAsistenteVoluntario(
      req.user.id, 
      pregunta.trim(), 
      Array.isArray(historial) ? historial : []
    );
    
    return res.json({ respuesta });
  } catch (err) {
    console.error('Error en asistente voluntario:', err.message);
    return res.status(500).json({ message: 'El asistente no pudo responder. Intenta de nuevo.' });
  }
});
