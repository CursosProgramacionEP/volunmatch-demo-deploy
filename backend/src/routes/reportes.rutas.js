// Reporte operativo de voluntariado para las empresas coordinadoras.
import { Router } from 'express';
import { auth } from '../middlewares/autenticacion.js';
import {
  obtenerReporteActividad,
  obtenerAceptadosPeriodoAnterior,
} from '../helpers/reportes.js';

export const reportsRouter = Router();

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Valida que una fecha esté en formato ISO (YYYY-MM-DD). */
function validDate(value) {
  return !value || datePattern.test(String(value));
}

/**
 * Devuelve indicadores de actividad y completado para las iniciativas
 * de la empresa autenticada.
 */
reportsRouter.get('/volunteer-activity', auth('company'), async (req, res) => {
  const initiativeId = String(req.query.initiativeId || '').trim();
  const category = String(req.query.category || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if ((initiativeId && !/^\d+$/.test(initiativeId)) || !validDate(from) || !validDate(to) || (from && to && from > to)) {
    return res.status(400).json({ message: 'Revisa los filtros de iniciativa y rango de fechas.' });
  }

  try {
    const rows = await obtenerReporteActividad({
      idempresa: req.user.id,
      initiativeId,
      category,
      from,
      to,
    });

    const items = rows.map((row) => {
      const totalTasks = Number(row.total_tasks);
      const completedTasks = Number(row.completed_tasks);
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        date: row.date,
        acceptedVolunteers: Number(row.accepted_volunteers),
        totalTasks,
        completedTasks,
        completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    });

    let comparison = null;
    if (from && to) {
      const previousAccepted = await obtenerAceptadosPeriodoAnterior({
        idempresa: req.user.id,
        from,
        to,
        category,
      });
      const currentAccepted = items.reduce((sum, item) => sum + item.acceptedVolunteers, 0);
      comparison = {
        currentAccepted,
        previousAccepted,
        changePercent: previousAccepted
          ? Math.round(((currentAccepted - previousAccepted) / previousAccepted) * 100)
          : null,
      };
    }

    return res.json({ report: items, comparison });
  } catch (err) {
    console.error('Error al generar reporte de actividad:', err.message);
    return res.status(500).json({ message: 'No se pudo generar el reporte de actividad.' });
  }
});