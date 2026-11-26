import pool from '../config/db.js';
import { notify } from './notificaciones.js';
import { enviarCertificadosPendientes } from './certificados.js';

const closeAt = "((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima')";

/** Procesa recordatorios y cierres con marcas persistentes para evitar duplicados. */
export async function procesarCierresDeIniciativas() {
  // Las fechas de cierre de la aplicación son días calendario; se cierran a las 23:59:59 de Perú.
  const reminders = await pool.query(
    `SELECT i.idiniciativa, i.titulo, p.idvoluntario, evento.tipo,
            evento.titulo_notificacion, evento.mensaje
     FROM iniciativa i
     JOIN postulacion p ON p.idiniciativa = i.idiniciativa AND p.estado = 'aceptado'
     CROSS JOIN LATERAL (VALUES
       ('initiative_closing_tomorrow', INTERVAL '1 day', 'La iniciativa cierra mañana',
        'La iniciativa "' || i.titulo || '" cierra mañana. Completa las tareas que tienes pendientes.'),
       ('initiative_closing_soon', INTERVAL '30 minutes', 'La iniciativa cierra pronto',
        'Te quedan 30 minutos para finalizar las tareas pendientes antes de que cierre la iniciativa "' || i.titulo || '".')
     ) AS evento(tipo, anticipacion, titulo_notificacion, mensaje)
     WHERE i.estado = 'activa'
       AND ${closeAt} - evento.anticipacion <= NOW()
       AND ${closeAt} > NOW()`,
  );

  for (const reminder of reminders.rows) {
    await notify(
      reminder.idvoluntario, 'volunteer', reminder.tipo,
      reminder.titulo_notificacion, reminder.mensaje, '/volunteer/activities',
      `initiative:${reminder.idiniciativa}:volunteer:${reminder.idvoluntario}:${reminder.tipo}`,
    );
  }

  const companyReminders = await pool.query(
    `SELECT i.idiniciativa, i.idempresa, i.titulo, evento.tipo,
            evento.titulo_notificacion, evento.mensaje
     FROM iniciativa i
     CROSS JOIN LATERAL (VALUES
       ('company_initiative_closing_tomorrow', INTERVAL '1 day', 'Tu iniciativa cierra mañana',
        'La iniciativa "' || i.titulo || '" está por cerrar mañana. Revisa el avance de las tareas y confirma que todo esté listo antes de la fecha de cierre.'),
       ('company_initiative_closing_soon', INTERVAL '30 minutes', 'Tu iniciativa cierra pronto',
        'La iniciativa "' || i.titulo || '" cierra en 30 minutos. Revisa el tablero para verificar el estado final de las tareas.')
     ) AS evento(tipo, anticipacion, titulo_notificacion, mensaje)
     WHERE i.estado = 'activa'
       AND ${closeAt} - evento.anticipacion <= NOW()
       AND ${closeAt} > NOW()`,
  );

  for (const reminder of companyReminders.rows) {
    await notify(
      reminder.idempresa,
      'company',
      reminder.tipo,
      reminder.titulo_notificacion,
      reminder.mensaje,
      '/company/dashboard',
      `initiative:${reminder.idiniciativa}:company:${reminder.idempresa}:${reminder.tipo}`,
    );
  }

  // Solo habilitar la valoración cuando esta ejecución realmente cierra la iniciativa.
  // Así no se crea el aviso por iniciativas finalizadas manualmente antes de su fecha.
  const closures = await pool.query(
    `WITH cerradas AS (
       UPDATE iniciativa i SET estado = 'finalizada'
       WHERE i.estado = 'activa' AND ${closeAt} <= NOW()
       RETURNING i.idiniciativa, i.idempresa, i.titulo
     )
     SELECT cerradas.idiniciativa, cerradas.idempresa, cerradas.titulo,
            ARRAY(
              SELECT p.idvoluntario
              FROM postulacion p
              WHERE p.idiniciativa = cerradas.idiniciativa AND p.estado = 'aceptado'
            ) AS idvoluntarios
     FROM cerradas
    `,
  );

  for (const closure of closures.rows) {
    for (const idvoluntario of closure.idvoluntarios) {
      await notify(
        idvoluntario,
        'volunteer',
        'initiative_closed_rate',
        'Valora tu experiencia',
        `La iniciativa "${closure.titulo}" finalizó. Cuéntanos cómo fue tu experiencia para habilitar tu certificado de participación.`,
        `/history/rate/${closure.idiniciativa}`,
        `initiative:${closure.idiniciativa}:volunteer:${idvoluntario}:initiative_closed_rate`,
      );
    }

    await notify(
      closure.idempresa,
      'company',
      'company_initiative_closed',
      'Tu iniciativa finalizó',
      `La iniciativa "${closure.titulo}" finalizó. Ya puedes revisar el estado final de sus tareas y participantes.`,
      '/company/dashboard',
      `initiative:${closure.idiniciativa}:company:${closure.idempresa}:company_initiative_closed`,
    );
  }

  await enviarCertificadosPendientes();
}
