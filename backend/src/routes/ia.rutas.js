// Rutas de IA, montadas en /api/ia
import { Router } from 'express';
import { auth } from '../middlewares/autenticacion.js';
import { generarTareasConIA } from '../helpers/ia.js';

export const iaRouter = Router();

/**
 * POST /api/ia/generar-tareas
 * Genera tareas para una iniciativa usando IA (Gemini).
 */
iaRouter.post('/generar-tareas', auth('company'), async (req, res) => {
  const { titulo, objetivo, categoria, tareasExistentes = [], cantidad = 3 } = req.body;

  // Validaciones
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ message: 'El título de la iniciativa es obligatorio.' });
  }
  if (!objetivo || !String(objetivo).trim()) {
    return res.status(400).json({ message: 'El objetivo de la iniciativa es obligatorio.' });
  }
  if (!Array.isArray(tareasExistentes)) {
    return res.status(400).json({ message: 'tareasExistentes debe ser un array.' });
  }

  const cantidadNum = Math.min(Math.max(Number(cantidad) || 3, 1), 10);

  try {
    const tareas = await generarTareasConIA(
      {
        titulo: String(titulo).trim(),
        objetivo: String(objetivo).trim(),
        categoria: categoria ? String(categoria).trim() : null,
        tareasExistentes: tareasExistentes.map((t) => String(t).trim()).filter(Boolean),
      },
      cantidadNum,
    );

    return res.json({
      tareas,
      total: tareas.length,
      cantidadSolicitada: cantidadNum,
    });
  } catch (err) {
    console.error('[API] Error al generar tareas con IA:', err.message);

    // Errores específicos
    if (err.message.includes('Timeout')) {
      return res.status(504).json({
        message: 'La IA tardó demasiado en responder. Intenta de nuevo.',
      });
    }
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(500).json({
        message: 'La IA no está configurada correctamente.',
      });
    }

    return res.status(500).json({
      message: err.message || 'No se pudieron generar las tareas.',
    });
  }
});