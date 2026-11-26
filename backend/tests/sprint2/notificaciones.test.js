// Tests del DAO de notificaciones (Sprint 2)
// Cada test es INDEPENDIENTE: crea sus propios datos y los limpia en afterEach.
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import pool from '../../src/config/db.js';
import { notify } from '../../src/helpers/notificaciones.js';
import { crearVoluntario } from '../../src/helpers/usuarios.js';

// Evita enviar correos reales durante las pruebas
vi.mock('../../src/services/correo.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));

// ═══════════════════════════════════════════════════════════
// CIERRE DEL POOL (solo UNA VEZ, al final de TODO el archivo)
// ═══════════════════════════════════════════════════════════
afterAll(async () => {
  await pool.end();
});

// ═══════════════════════════════════════════════════════════
// HELPERS DE TEST
// ═══════════════════════════════════════════════════════════

// Generar correos únicos
const generarCorreo = (sufijo) =>
  `${sufijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@volunmatch.test`;

const voluntariosCreados = [];

async function limpiarVoluntariosDePrueba() {
  if (!voluntariosCreados.length) return;

  await pool.query('DELETE FROM notificacion WHERE idusuario = ANY($1::int[]) AND rol = $2', [voluntariosCreados, 'volunteer']);
  await pool.query('DELETE FROM certificacion WHERE idvoluntario = ANY($1::int[])', [voluntariosCreados]);
  await pool.query('DELETE FROM voluntario_insignia WHERE idvoluntario = ANY($1::int[])', [voluntariosCreados]);
  await pool.query('DELETE FROM voluntario WHERE idvoluntario = ANY($1::int[])', [voluntariosCreados]);
  voluntariosCreados.length = 0;
}

// Crear un voluntario de prueba
async function crearVoluntarioTest(sufijo = 'notif') {
  const correo = generarCorreo(sufijo);
  const voluntario = await crearVoluntario({
    nombrecompleto: `Test ${sufijo}`,
    telefono: '999333444',
    correo,
    contrasena: 'hash_de_prueba',
    biografia: null,
  });
  voluntariosCreados.push(voluntario.id);
  return { idVoluntario: voluntario.id, correo };
}

// ═══════════════════════════════════════════════════════════
// TESTS DE ÉXITO
// ═══════════════════════════════════════════════════════════

describe('DAO de notificaciones — Sprint 2', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    await limpiarVoluntariosDePrueba();
  });

  it('notify inserta una notificación y devuelve la estructura esperada', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-estructura');

    const notificacion = await notify(
      idVoluntario,
      'volunteer',
      'application_accepted',
      'Postulación aceptada',
      'Fuiste aceptado en la iniciativa X',
      '/volunteer/activities',
    );

    expect(notificacion).not.toBeNull();
    expect(notificacion).toHaveProperty('id');
    expect(notificacion.userId).toBe(idVoluntario);
    expect(notificacion.role).toBe('volunteer');
    expect(notificacion.type).toBe('application_accepted');
    expect(notificacion.title).toBe('Postulación aceptada');
    expect(notificacion.message).toBe('Fuiste aceptado en la iniciativa X');
    expect(notificacion.link).toBe('/volunteer/activities');
    expect(notificacion.read).toBe(false);
    expect(notificacion).toHaveProperty('createdAt');
  });

  it('la notificación se guarda en la base de datos', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-guardar');

    await notify(
      idVoluntario,
      'volunteer',
      'application_received',
      'Nueva postulación',
      'Test de guardado',
      '/test',
    );

    const result = await pool.query(
      'SELECT COUNT(*)::int AS total FROM notificacion WHERE idusuario = $1 AND rol = $2',
      [idVoluntario, 'volunteer'],
    );
    expect(result.rows[0].total).toBe(1);
  });

  it('el campo "leida" es false por defecto', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-leida');
    await notify(idVoluntario, 'volunteer', 'test', 'Título', 'Mensaje', '/test');

    const result = await pool.query(
      'SELECT leida FROM notificacion WHERE idusuario = $1 AND rol = $2 ORDER BY id DESC LIMIT 1',
      [idVoluntario, 'volunteer'],
    );

    expect(result.rows[0].leida).toBe(false);
  });

  it('notify guarda correctamente el tipo y el rol', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-tipo');

    const notificacion = await notify(
      idVoluntario,
      'volunteer',
      'task_completed',
      'Tarea finalizada',
      'Completaste la tarea Y',
      '/kanban/1',
    );

    expect(notificacion.type).toBe('task_completed');
    expect(notificacion.role).toBe('volunteer');
  });

  it('se pueden crear múltiples notificaciones para el mismo usuario', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-multiples');

    await notify(idVoluntario, 'volunteer', 'test_1', 'Notif 1', 'Mensaje 1', '/test');
    await notify(idVoluntario, 'volunteer', 'test_2', 'Notif 2', 'Mensaje 2', '/test');
    await notify(idVoluntario, 'volunteer', 'test_3', 'Notif 3', 'Mensaje 3', '/test');

    const result = await pool.query(
      'SELECT COUNT(*)::int AS total FROM notificacion WHERE idusuario = $1 AND rol = $2',
      [idVoluntario, 'volunteer'],
    );
    expect(result.rows[0].total).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// TESTS DE CASOS DE ERROR
// ═══════════════════════════════════════════════════════════

describe('DAO de notificaciones — Casos de error', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    await pool.query("DELETE FROM notificacion WHERE idusuario = 99999999 AND tipo = 'test_fantasma'");
    await limpiarVoluntariosDePrueba();
  });

  it('notify con tipo vacío no falla (guarda string vacío)', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-tipo-vacio');

    const notificacion = await notify(
      idVoluntario,
      'volunteer',
      '',
      'Título de prueba',
      'Mensaje de prueba',
      '/test',
    );

    expect(notificacion).not.toBeNull();
    expect(notificacion.type).toBe('');
  });

  it('notify con mensaje largo (>1000 caracteres) se guarda correctamente', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-largo');
    const mensajeLargo = 'A'.repeat(1500);

    const notificacion = await notify(
      idVoluntario,
      'volunteer',
      'test_largo',
      'Mensaje largo',
      mensajeLargo,
      '/test',
    );

    expect(notificacion).not.toBeNull();
    expect(notificacion.message.length).toBe(1500);
  });

  it('notify con usuario inexistente guarda la notificación igual (no hay FK)', async () => {
    const idFantasma = 99999999;

    const notificacion = await notify(
      idFantasma,
      'volunteer',
      'test_fantasma',
      'Usuario fantasma',
      'No debería crear esto',
      '/test',
    );

    expect(notificacion).not.toBeNull();
    expect(notificacion.userId).toBe(idFantasma);
  });

  it('notify con rol inválido falla por el CHECK constraint y devuelve null', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-rol-invalido');

    const notificacion = await notify(
      idVoluntario,
      'rol_invalido',
      'test_rol',
      'Rol inválido',
      'Mensaje',
      '/test',
    );

    expect(notificacion).toBeNull();
  });

  it('notify con título vacío se guarda correctamente', async () => {
    const { idVoluntario } = await crearVoluntarioTest('notif-sin-titulo');

    const notificacion = await notify(
      idVoluntario,
      'volunteer',
      'test_sin_titulo',
      '',
      'Mensaje sin título',
      '/test',
    );

    expect(notificacion).not.toBeNull();
    expect(notificacion.title).toBe('');
  });
});
