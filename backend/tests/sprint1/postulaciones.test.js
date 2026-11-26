// Tests del DAO de postulaciones (Sprint 1 - HU-02)
// Cada test es INDEPENDIENTE: crea sus propios datos y los limpia.
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import pool from '../../src/config/db.js';
import {
  crearPostulacion,
  buscarPostulacion,
  listarVoluntariosAceptados,
  estaAceptado,
} from '../../src/helpers/postulaciones.js';

// Helper para generar correos únicos
const generarCorreo = (sufijo) => `${sufijo}-${Date.now()}@volunmatch.test`;

// Helper para crear todos los datos necesarios para un test
// Retorna { idEmpresa, idVoluntario, idIniciativa }
async function crearEscenario() {
  const empresa = await pool.query(
    `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING idempresa`,
    [
      'Empresa Test',
      String(Date.now()).slice(-11),   // RUC único (11 dígitos)
      'Coordinador Test',
      generarCorreo('emp'),
      'hash_test',
      'General',
    ],
  );

  const voluntario = await pool.query(
    `INSERT INTO voluntario (nombrecompleto, correo, contrasena)
     VALUES ($1, $2, $3)
     RETURNING idvoluntario`,
    ['Voluntario Test', generarCorreo('vol'), 'hash_test'],
  );

  const iniciativa = await pool.query(
    `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '7 days', $6, $7)
     RETURNING idiniciativa`,
    [empresa.rows[0].idempresa, 'Iniciativa Test', 'Descripción', 'General', 10, 'Ninguno', 'Lima'],
  );

  return {
    idEmpresa: empresa.rows[0].idempresa,
    idVoluntario: voluntario.rows[0].idvoluntario,
    idIniciativa: iniciativa.rows[0].idiniciativa,
  };
}

describe('DAO de postulaciones — Sprint 1', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

        afterEach(async () => {
    // 1. Primero borramos las tareas (hijas de iniciativa)
    await pool.query(`
      DELETE FROM tarea 
      WHERE idiniciativa IN (
        SELECT idiniciativa FROM iniciativa 
        WHERE idempresa IN (SELECT idempresa FROM empresa WHERE correo LIKE 'emp-%@volunmatch.test')
      )
    `);

    // 2. Luego borramos TODAS las postulaciones (hijas de iniciativa y voluntario)
    // que pertenezcan a las iniciativas de prueba
    await pool.query(`
      DELETE FROM postulacion 
      WHERE idiniciativa IN (
        SELECT idiniciativa FROM iniciativa 
        WHERE idempresa IN (SELECT idempresa FROM empresa WHERE correo LIKE 'emp-%@volunmatch.test')
      )
    `);

    // 3. Ahora sí, borramos las iniciativas (padres)
    await pool.query(`
      DELETE FROM iniciativa 
      WHERE idempresa IN (SELECT idempresa FROM empresa WHERE correo LIKE 'emp-%@volunmatch.test')
    `);

    // 4. Borramos los registros dependientes de los voluntarios creados aquí.
    await pool.query(`
      DELETE FROM certificacion
      WHERE idvoluntario IN (
        SELECT idvoluntario FROM voluntario WHERE correo LIKE 'vol-%@volunmatch.test'
      )
    `);
    await pool.query(`
      DELETE FROM voluntario_insignia
      WHERE idvoluntario IN (
        SELECT idvoluntario FROM voluntario WHERE correo LIKE 'vol-%@volunmatch.test'
      )
    `);
    await pool.query(`
      DELETE FROM notificacion
      WHERE rol = 'volunteer' AND idusuario IN (
        SELECT idvoluntario FROM voluntario WHERE correo LIKE 'vol-%@volunmatch.test'
      )
    `);

    // 5. Borramos los voluntarios de prueba
    await pool.query(`
      DELETE FROM voluntario WHERE correo LIKE 'vol-%@volunmatch.test'
    `);

    // 6. Finalmente, las empresas de prueba
    await pool.query(`
      DELETE FROM empresa WHERE correo LIKE 'emp-%@volunmatch.test'
    `);
  });

  afterAll(async () => {
    await pool.end();
  });

  // ─────────────────────────────────────────────
  // TEST 1: Buscar postulación inexistente
  // ─────────────────────────────────────────────
  it('buscarPostulacion devuelve null si no existe', async () => {
    // 1. Preparar: crear escenario (empresa + voluntario + iniciativa)
    const { idVoluntario, idIniciativa } = await crearEscenario();

    // 2. Actuar
    const postulacion = await buscarPostulacion({
      idiniciativa: idIniciativa,
      idvoluntario: idVoluntario,
    });

    // 3. Verificar
    expect(postulacion).toBeNull();

    // 4. Limpiar: lo hace el afterEach
  });

  // ─────────────────────────────────────────────
  // TEST 2: Crear una postulación
  // ─────────────────────────────────────────────
  it('crearPostulacion inserta y devuelve la postulación con estado pendiente', async () => {
    const { idVoluntario, idIniciativa } = await crearEscenario();

    const postulacion = await crearPostulacion({
      razon: 'Quiero participar en esta iniciativa',
      idvoluntario: idVoluntario,
      idiniciativa: idIniciativa,
    });

    expect(postulacion).toHaveProperty('idpostulacion');
    expect(postulacion.razon).toBe('Quiero participar en esta iniciativa');
    expect(postulacion.idvoluntario).toBe(idVoluntario);
    expect(postulacion.idiniciativa).toBe(idIniciativa);
    expect(postulacion.estado).toBe('pendiente');
  });

  // ─────────────────────────────────────────────
  // TEST 3: Buscar postulación recién creada
  // ─────────────────────────────────────────────
  it('buscarPostulacion encuentra la postulación recién creada', async () => {
    // 1. Preparar: crear escenario Y postulación
    const { idVoluntario, idIniciativa } = await crearEscenario();
    const creada = await crearPostulacion({
      razon: 'Test',
      idvoluntario: idVoluntario,
      idiniciativa: idIniciativa,
    });

    // 2. Actuar
    const postulacion = await buscarPostulacion({
      idiniciativa: idIniciativa,
      idvoluntario: idVoluntario,
    });

    // 3. Verificar
    expect(postulacion).not.toBeNull();
    expect(postulacion.idpostulacion).toBe(creada.idpostulacion);
    expect(postulacion.idvoluntario).toBe(idVoluntario);
  });

  // ─────────────────────────────────────────────
  // TEST 4: estaAceptado devuelve false si está pendiente
  // ─────────────────────────────────────────────
  it('estaAceptado devuelve false cuando la postulación está pendiente', async () => {
    // 1. Preparar
    const { idVoluntario, idIniciativa } = await crearEscenario();
    await crearPostulacion({
      razon: 'Test',
      idvoluntario: idVoluntario,
      idiniciativa: idIniciativa,
    });

    // 2. Actuar
    const aceptado = await estaAceptado({
      idiniciativa: idIniciativa,
      idvoluntario: idVoluntario,
    });

    // 3. Verificar
    expect(aceptado).toBe(false);
  });

  // ─────────────────────────────────────────────
  // TEST 5: estaAceptado devuelve true después de aceptar
  // ─────────────────────────────────────────────
  it('estaAceptado devuelve true después de aceptar la postulación', async () => {
    // 1. Preparar: crear escenario Y postulación
    const { idVoluntario, idIniciativa } = await crearEscenario();
    const postulacion = await crearPostulacion({
      razon: 'Test',
      idvoluntario: idVoluntario,
      idiniciativa: idIniciativa,
    });

    // Actualizar el estado a 'aceptado'
    await pool.query(
      `UPDATE postulacion SET estado = 'aceptado' WHERE idpostulacion = $1`,
      [postulacion.idpostulacion],
    );

    // 2. Actuar
    const aceptado = await estaAceptado({
      idiniciativa: idIniciativa,
      idvoluntario: idVoluntario,
    });

    // 3. Verificar
    expect(aceptado).toBe(true);
  });

  // ─────────────────────────────────────────────
  // TEST 6: listarVoluntariosAceptados devuelve al voluntario
  // ─────────────────────────────────────────────
  it('listarVoluntariosAceptados devuelve los voluntarios con estado aceptado', async () => {
    // 1. Preparar: crear escenario + postulación aceptada
    const { idVoluntario, idIniciativa } = await crearEscenario();
    const postulacion = await crearPostulacion({
      razon: 'Test',
      idvoluntario: idVoluntario,
      idiniciativa: idIniciativa,
    });
    await pool.query(
      `UPDATE postulacion SET estado = 'aceptado' WHERE idpostulacion = $1`,
      [postulacion.idpostulacion],
    );

    // 2. Actuar
    const voluntarios = await listarVoluntariosAceptados(idIniciativa);

    // 3. Verificar
    expect(Array.isArray(voluntarios)).toBe(true);
    expect(voluntarios.length).toBe(1);
    expect(voluntarios[0].idvoluntario).toBe(idVoluntario);
  });

  // ─────────────────────────────────────────────
  // TEST 7: listarVoluntariosAceptados con iniciativa sin aceptados
  // ─────────────────────────────────────────────
  it('listarVoluntariosAceptados devuelve array vacío si no hay aceptados', async () => {
    // 1. Preparar: crear escenario pero SIN postulaciones aceptadas
    const { idIniciativa } = await crearEscenario();

    // 2. Actuar
    const voluntarios = await listarVoluntariosAceptados(idIniciativa);

    // 3. Verificar
    expect(voluntarios).toEqual([]);
  });
});
