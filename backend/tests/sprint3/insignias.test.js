// Tests de insignias del voluntario (Sprint 3).
// Cada prueba crea sus propios datos y los elimina al terminar.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import pool from '../../src/config/db.js';
import {
  equiparInsigniaVoluntario,
  obtenerPerfilVoluntario,
} from '../../src/helpers/perfiles.js';

// Evita enviar correos reales al desbloquear insignias.
vi.mock('../../src/services/correo.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));

const recursosCreados = {
  voluntarios: [],
  empresas: [],
  iniciativas: [],
};

const generarCorreo = (sufijo) =>
  `${sufijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@volunmatch.test`;

async function crearVoluntario() {
  const result = await pool.query(
    `INSERT INTO voluntario (nombrecompleto, telefono, correo, contrasena, biografia)
     VALUES ($1, $2, $3, $4, $5) RETURNING idvoluntario`,
    ['Voluntario Insignias Test', '999111222', generarCorreo('insignias'), 'hash_test', 'Perfil de prueba'],
  );
  const id = result.rows[0].idvoluntario;
  recursosCreados.voluntarios.push(id);
  return id;
}

async function crearIniciativa(idVoluntario, { estadoPostulacion = 'aceptado' } = {}) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const empresa = await pool.query(
    `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING idempresa`,
    [
      'Empresa Insignias Test',
      `${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      'Coordinador Test',
      generarCorreo(`empresa-insignias-${sufijo}`),
      'hash_test',
      'General',
    ],
  );
  const idEmpresa = empresa.rows[0].idempresa;
  recursosCreados.empresas.push(idEmpresa);

  const iniciativa = await pool.query(
    `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
    [idEmpresa, 'Iniciativa Insignias Test', 'Iniciativa para pruebas.', 'General', 10, '2026-01-01', '2026-12-31', 'Ninguno', 'Lima'],
  );
  const idIniciativa = iniciativa.rows[0].idiniciativa;
  recursosCreados.iniciativas.push(idIniciativa);

  await pool.query(
    `INSERT INTO postulacion (razon, idvoluntario, idiniciativa, estado)
     VALUES ($1, $2, $3, $4)`,
    ['Postulación creada para probar insignias.', idVoluntario, idIniciativa, estadoPostulacion],
  );
  return idIniciativa;
}

async function crearTareasFinalizadas(idIniciativa, idVoluntario, cantidad) {
  for (let index = 1; index <= cantidad; index += 1) {
    await pool.query(
      `INSERT INTO tarea (titulo, descripcion, idiniciativa, estado, idvoluntario_asignado)
       VALUES ($1, $2, $3, 'finalizado', $4)`,
      [`Tarea ${index}`, 'Tarea finalizada para probar insignias.', idIniciativa, idVoluntario],
    );
  }
}

async function crearCertificacion(idVoluntario) {
  await pool.query(
    `INSERT INTO certificacion (idvoluntario, titulo, entidad, fecha_emision, url_documento)
     VALUES ($1, $2, $3, $4, $5)`,
    [idVoluntario, 'Certificación de prueba', 'Entidad de prueba', '2026-01-15', 'https://example.test/certificado'],
  );
}

async function limpiarRecursos() {
  for (const idIniciativa of recursosCreados.iniciativas) {
    await pool.query('DELETE FROM tarea WHERE idiniciativa = $1', [idIniciativa]);
    await pool.query('DELETE FROM postulacion WHERE idiniciativa = $1', [idIniciativa]);
    await pool.query('DELETE FROM iniciativa WHERE idiniciativa = $1', [idIniciativa]);
  }
  for (const idVoluntario of recursosCreados.voluntarios) {
    await pool.query('DELETE FROM notificacion WHERE idusuario = $1 AND rol = $2', [idVoluntario, 'volunteer']);
    await pool.query('DELETE FROM certificacion WHERE idvoluntario = $1', [idVoluntario]);
    await pool.query('DELETE FROM voluntario_insignia WHERE idvoluntario = $1', [idVoluntario]);
    await pool.query('DELETE FROM voluntario WHERE idvoluntario = $1', [idVoluntario]);
  }
  for (const idEmpresa of recursosCreados.empresas) {
    await pool.query('DELETE FROM empresa WHERE idempresa = $1', [idEmpresa]);
  }
  recursosCreados.voluntarios = [];
  recursosCreados.empresas = [];
  recursosCreados.iniciativas = [];
}

describe('Insignias del voluntario — Sprint 3', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    await limpiarRecursos();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('muestra el progreso y mantiene bloqueadas las insignias que aún no alcanza', async () => {
    const idVoluntario = await crearVoluntario();
    const idIniciativa = await crearIniciativa(idVoluntario);
    await crearTareasFinalizadas(idIniciativa, idVoluntario, 2);

    const perfil = await obtenerPerfilVoluntario(idVoluntario);

    expect(perfil.completedTasks).toBe(2);
    expect(perfil.acceptedInitiatives).toBe(1);
    expect(perfil.badges).toHaveLength(5);
    expect(perfil.badges.find(({ key }) => key === 'primer_paso')).toMatchObject({
      unlocked: true,
      progress: 1,
      progressLabel: '1 de 1',
    });
    expect(perfil.badges.find(({ key }) => key === 'manos_a_la_obra')).toMatchObject({
      unlocked: false,
      progress: 2,
      progressLabel: '2 de 5',
    });
    expect(perfil.badges.find(({ key }) => key === 'voluntario_activo')).toMatchObject({
      unlocked: false,
      progress: 1,
      progressLabel: '1 de 3',
    });
    expect(perfil.equippedBadge).toBeNull();
  });

  it('desbloquea las insignias al alcanzar sus metas y no duplica el logro ni su notificación', async () => {
    const idVoluntario = await crearVoluntario();
    const idIniciativa = await crearIniciativa(idVoluntario);
    await crearTareasFinalizadas(idIniciativa, idVoluntario, 5);
    await crearCertificacion(idVoluntario);

    const primerPerfil = await obtenerPerfilVoluntario(idVoluntario);
    const desbloqueadas = primerPerfil.badges.filter(({ unlocked }) => unlocked).map(({ key }) => key);
    expect(desbloqueadas).toEqual(['primer_paso', 'manos_a_la_obra', 'con_certificado']);

    const insigniasGuardadas = await pool.query(
      'SELECT clave FROM voluntario_insignia WHERE idvoluntario = $1 ORDER BY clave',
      [idVoluntario],
    );
    expect(insigniasGuardadas.rows.map(({ clave }) => clave)).toHaveLength(3);

    await obtenerPerfilVoluntario(idVoluntario);

    const notificaciones = await pool.query(
      `SELECT evento_clave FROM notificacion
       WHERE idusuario = $1 AND rol = 'volunteer' AND tipo = 'badge_earned'
       ORDER BY evento_clave`,
      [idVoluntario],
    );
    expect(notificaciones.rows.map(({ evento_clave }) => evento_clave)).toHaveLength(3);
    expect(new Set(notificaciones.rows.map(({ evento_clave }) => evento_clave)).size).toBe(3);
  });

  it('solo permite equipar insignias desbloqueadas y permite quitar la insignia equipada', async () => {
    const idVoluntario = await crearVoluntario();
    await crearCertificacion(idVoluntario);
    await obtenerPerfilVoluntario(idVoluntario);

    await expect(equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: 'no_existe' }))
      .resolves.toEqual({ invalid: true });
    await expect(equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: 'primer_paso' }))
      .resolves.toEqual({ notEarned: true });

    await expect(equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: 'con_certificado' }))
      .resolves.toEqual({ ok: true });
    let perfil = await obtenerPerfilVoluntario(idVoluntario);
    expect(perfil.equippedBadge).toMatchObject({ key: 'con_certificado', equipped: true });

    await expect(equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: null }))
      .resolves.toEqual({ ok: true });
    perfil = await obtenerPerfilVoluntario(idVoluntario);
    expect(perfil.equippedBadge).toBeNull();
    expect(perfil.badges.find(({ key }) => key === 'con_certificado').equipped).toBe(false);
  });

  it('mantiene como máximo una insignia equipada por voluntario', async () => {
    const idVoluntario = await crearVoluntario();
    const idIniciativa = await crearIniciativa(idVoluntario);
    await crearTareasFinalizadas(idIniciativa, idVoluntario, 1);
    await crearCertificacion(idVoluntario);
    await obtenerPerfilVoluntario(idVoluntario);

    await equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: 'primer_paso' });
    await equiparInsigniaVoluntario({ idvoluntario: idVoluntario, clave: 'con_certificado' });

    const equipadas = await pool.query(
      'SELECT clave FROM voluntario_insignia WHERE idvoluntario = $1 AND equipada = TRUE',
      [idVoluntario],
    );
    expect(equipadas.rows).toEqual([{ clave: 'con_certificado' }]);
  });
});
