import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto'; 
import { JWT_SECRET } from '../config/entorno.js';
import { auth } from '../middlewares/autenticacion.js';
import {
  subscribeNotifications,
  listarNotificacionesDeUsuario,
  listarNotificacionesNoLeidas,
  marcarNotificacionComoLeida,
} from '../helpers/notificaciones.js';

export const notificationsRouter = Router();

// ALMACÉN TEMPORAL DE TICKETS (En producción usar Redis o BD)
const sseTickets = new Map();

/**
 * POST /api/notifications/ticket
 * Genera un ticket de un solo uso para el stream SSE.
 */
notificationsRouter.post('/ticket', auth(), async (req, res) => {
  const ticket = crypto.randomUUID();
  // Guardamos el ID y el rol, válido por 30 segundos
  sseTickets.set(ticket, {
    userId: req.user.id,
    role: req.user.role,
    expires: Date.now() + 30000,
  });

  // Limpieza automática
  setTimeout(() => sseTickets.delete(ticket), 30000);

  return res.json({ ticket });
});

/**
 * GET /api/notifications
 * Devuelve todas las notificaciones del usuario autenticado.
 */
notificationsRouter.get('/', auth(), async (req, res) => {
  try {
    const notifications = await listarNotificacionesDeUsuario(req.user.id, req.user.role);
    return res.json({ notifications });
  } catch (error) {
    console.error('Error al cargar notificaciones:', error.message);
    return res.status(500).json({ message: 'No se pudieron cargar las notificaciones.' });
  }
});

/**
 * GET /api/notifications/stream
 * Stream en tiempo real de notificaciones (SSE).
 */
notificationsRouter.get('/stream', async (req, res) => {
  try {
    // MODIFICADO: Leemos el ticket en lugar del token
    const ticketData = sseTickets.get(req.query.ticket);

    if (!ticketData || ticketData.expires < Date.now()) {
      throw new Error('Ticket inválido o expirado');
    }

    //  Consumimos el ticket (un solo uso)
    sseTickets.delete(req.query.ticket);

    const payload = { sub: ticketData.userId, role: ticketData.role };

    const pending = await listarNotificacionesNoLeidas(payload.sub, payload.role);

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(': conectado\n\n');

    pending.forEach((notification) => {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    });

    const unsubscribe = subscribeNotifications(payload.sub, (notification) => {
      if (notification.role === payload.role) {
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
      }
    });

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch {
    return res.status(401).end();
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marca una notificación como leída.
 */
notificationsRouter.patch('/:id/read', auth(), async (req, res) => {
  try {
    const filasAfectadas = await marcarNotificacionComoLeida(
      req.params.id,
      req.user.id,
      req.user.role,
    );
    if (!filasAfectadas) {
      return res.status(404).json({ message: 'No se encontró la notificación.' });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al actualizar notificación:', error.message);
    return res.status(500).json({ message: 'No se pudo actualizar la notificación.' });
  }
});