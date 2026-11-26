
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';

import pool from '../../src/config/db.js';

import {
  crearTarea,
  buscarTarea,
  listarTareasDeIniciativa,
  listarTareasDeIniciativas,
  tomarTarea,
  actualizarEstadoTarea,
  finalizarTarea,
  eliminarTarea,
  contarAceptadosPorIniciativa,
} from '../../src/helpers/tareas.js';

let idEmpresa;
let idOtraEmpresa;
let idVoluntario;
let idIniciativa;

describe('DAO de tareas (Tablero Kanban) — Sprint 1', () => {

  // Cada prueba prepara sus propios datos.
  beforeEach(async () => {
    await pool.query('SELECT 1');

    const sufijo = `${Date.now()}-${Math.random()}`;

    const empresa = await pool.query(
      `INSERT INTO empresa
       (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING idempresa`,
      [
        'Empresa Test Tablero',
        '99999999998',
        'Coordinador Test',
        `emp-${sufijo}@volunmatch.test`,
        'hash_test',
        'General',
      ],
    );

    idEmpresa = empresa.rows[0].idempresa;

    const otraEmpresa = await pool.query(
      `INSERT INTO empresa
       (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING idempresa`,
      [
        'Otra Empresa Test',
        '99999999997',
        'Coordinador Test 2',
        `emp2-${sufijo}@volunmatch.test`,
        'hash_test',
        'General',
      ],
    );

    idOtraEmpresa = otraEmpresa.rows[0].idempresa;

    const voluntario = await pool.query(
      `INSERT INTO voluntario
       (nombrecompleto, correo, contrasena)
       VALUES ($1, $2, $3)
       RETURNING idvoluntario`,
      [
        'Voluntario Test Tablero',
        `vol-${sufijo}@volunmatch.test`,
        'hash_test',
      ],
    );

    idVoluntario = voluntario.rows[0].idvoluntario;

    const iniciativa = await pool.query(
      `INSERT INTO iniciativa
       (idempresa, titulo, descripcion, categoria, numcupo,
        fechainicio, fechafin, requisito, lugar)
       VALUES
       ($1, $2, $3, $4, $5, NOW(),
        NOW() + INTERVAL '7 days', $6, $7)
       RETURNING idiniciativa`,
      [
        idEmpresa,
        'Iniciativa Test Tablero',
        'Descripción de prueba',
        'General',
        10,
        'Ninguno',
        'Lima',
      ],
    );

    idIniciativa = iniciativa.rows[0].idiniciativa;
  });

  // Cada test crea su propia tarea cuando la necesita.
  async function crearTareaBase() {
    return await crearTarea({
      titulo: 'Tarea base de prueba',
      descripcion: 'Tarea independiente',
      idiniciativa: idIniciativa,
      area: 'General',
      priority: 'Media',
    });
  }

  // Limpieza común para los datos de cada prueba.
  afterEach(async () => {
    try {
      if (idIniciativa) {
        await pool.query(
          'DELETE FROM postulacion WHERE idiniciativa = $1',
          [idIniciativa],
        );

        await pool.query(
          'DELETE FROM tarea WHERE idiniciativa = $1',
          [idIniciativa],
        );

        await pool.query(
          'DELETE FROM iniciativa WHERE idiniciativa = $1',
          [idIniciativa],
        );
      }

      if (idVoluntario) {
        await pool.query(
          'DELETE FROM voluntario WHERE idvoluntario = $1',
          [idVoluntario],
        );
      }

      if (idEmpresa) {
        await pool.query(
          'DELETE FROM empresa WHERE idempresa = $1',
          [idEmpresa],
        );
      }

      if (idOtraEmpresa) {
        await pool.query(
          'DELETE FROM empresa WHERE idempresa = $1',
          [idOtraEmpresa],
        );
      }
    } finally {
      idEmpresa = null;
      idOtraEmpresa = null;
      idVoluntario = null;
      idIniciativa = null;
    }
  });

  // Cierre global: se ejecuta al terminar todas las pruebas.
  afterAll(async () => {
    await pool.end();
  });

  it('1. Devuelve un array vacío cuando no existen tareas', async () => {
    const tareas = await listarTareasDeIniciativa(idIniciativa);

    expect(tareas).toEqual([]);
  });

  it('2. Crea una tarea pendiente sin voluntario asignado', async () => {
    const tarea = await crearTarea({
      titulo: 'Preparar materiales',
      descripcion: 'Organizar materiales',
      idiniciativa: idIniciativa,
      area: 'Logística',
      priority: 'Alta',
    });

    expect(tarea.idtarea).toBeDefined();
    expect(tarea.titulo).toBe('Preparar materiales');
    expect(tarea.idiniciativa).toBe(idIniciativa);
    expect(tarea.estado).toBe('pendiente');
    expect(tarea.idvoluntario_asignado).toBeNull();
  });

  it ('3. Busca una tarea existente', async () => {
    const nueva = await crearTareaBase();

    const tarea = await buscarTarea(
      nueva.idtarea,
      idIniciativa,
    );

    expect(tarea).not.toBeNull();
    expect(tarea.idtarea).toBe(nueva.idtarea);
    expect(tarea.voluntario_nombre).toBeNull();
  });

  it ('4. Devuelve null si la tarea no pertenece a la iniciativa', async () => {
    const nueva = await crearTareaBase();

    const tarea = await buscarTarea(nueva.idtarea, 0);

    expect(tarea).toBeNull();
  });

  it ('5. Lista las tareas de una iniciativa', async () => {
    const nueva = await crearTareaBase();

    const tareas = await listarTareasDeIniciativa(idIniciativa);

    expect(Array.isArray(tareas)).toBe(true);
    expect(tareas).toHaveLength(1);
    expect(tareas[0].idtarea).toBe(nueva.idtarea);
  });

  it ('6. Agrupa las tareas por iniciativa', async () => {
    const nueva = await crearTareaBase();

    const agrupadas = await listarTareasDeIniciativas([
      idIniciativa,
    ]);

    expect(agrupadas[idIniciativa]).toBeDefined();
    expect(agrupadas[idIniciativa]).toHaveLength(1);
    expect(agrupadas[idIniciativa][0].idtarea)
      .toBe(nueva.idtarea);
  });

  it ('7. Devuelve un objeto vacío si la lista de iniciativas está vacía', async () => {
    const agrupadas = await listarTareasDeIniciativas([]);

    expect(agrupadas).toEqual({});
  });

  it ('8. Asigna una tarea al voluntario', async () => {
    const nueva = await crearTareaBase();

    const tarea = await tomarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    expect(tarea.idvoluntario_asignado).toBe(idVoluntario);
    expect(tarea.idvoluntario_modificacion).toBe(idVoluntario);
    expect(tarea.fecha_asignacion).not.toBeNull();
    expect(tarea.estado).toBe('pendiente');
  });

  it ('9. Muestra el nombre del voluntario asignado', async () => {
    const nueva = await crearTareaBase();

    await tomarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    const tarea = await buscarTarea(
      nueva.idtarea,
      idIniciativa,
    );

    expect(tarea.idvoluntario_asignado).toBe(idVoluntario);
    expect(tarea.voluntario_nombre)
      .toBe('Voluntario Test Tablero');
  });

  it ('10. Cambia el estado de la tarea a en_proceso', async () => {
    const nueva = await crearTareaBase();

    await tomarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    const tarea = await actualizarEstadoTarea({
      idtarea: nueva.idtarea,
      estado: 'en_proceso',
      idvoluntario: idVoluntario,
    });

    expect(tarea.estado).toBe('en_proceso');
    expect(tarea.idvoluntario_modificacion).toBe(idVoluntario);
    expect(tarea.fecha_modificacion).not.toBeNull();
  });

 it ('11. Rechaza un estado inválido', async () => {
    const nueva = await crearTareaBase();

    await expect(
      actualizarEstadoTarea({
        idtarea: nueva.idtarea,
        estado: 'estado_invalido',
        idvoluntario: idVoluntario,
      }),
    ).rejects.toThrow();
  });

 it ('12. No elimina una tarea que ya fue asignada', async () => {
    const nueva = await crearTareaBase();

    await tomarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    const eliminada = await eliminarTarea({
      idtarea: nueva.idtarea,
      idiniciativa: idIniciativa,
      idempresa: idEmpresa,
    });

    expect(eliminada).toBeNull();
  });

 it('13. Finaliza una tarea asignada', async () => {
    const nueva = await crearTareaBase();

    await tomarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    const tarea = await finalizarTarea({
      idtarea: nueva.idtarea,
      idvoluntario: idVoluntario,
    });

    expect(tarea.estado).toBe('finalizado');
    expect(tarea.idvoluntario_modificacion).toBe(idVoluntario);
  });

  it('14. Elimina una tarea pendiente de la empresa propietaria', async () => {
    const nueva = await crearTareaBase();

    const eliminada = await eliminarTarea({
      idtarea: nueva.idtarea,
      idiniciativa: idIniciativa,
      idempresa: idEmpresa,
    });

    expect(eliminada).toBe(nueva.idtarea);

    const buscada = await buscarTarea(
      nueva.idtarea,
      idIniciativa,
    );

    expect(buscada).toBeNull();
  });

  it('15. Impide que otra empresa elimine una tarea ajena', async () => {
    const nueva = await crearTareaBase();

    const eliminada = await eliminarTarea({
      idtarea: nueva.idtarea,
      idiniciativa: idIniciativa,
      idempresa: idOtraEmpresa,
    });

    expect(eliminada).toBeNull();

    const buscada = await buscarTarea(
      nueva.idtarea,
      idIniciativa,
    );

    expect(buscada).not.toBeNull();
  });

  it('16. Cuenta las postulaciones aceptadas', async () => {
    const antes = await contarAceptadosPorIniciativa([
      idIniciativa,
    ]);

    expect(antes[idIniciativa]).toBeUndefined();

    await pool.query(
      `INSERT INTO postulacion
       (razon, idvoluntario, idiniciativa, estado)
       VALUES ($1, $2, $3, 'aceptado')`,
      ['Quiero participar', idVoluntario, idIniciativa],
    );

    const despues = await contarAceptadosPorIniciativa([
      idIniciativa,
    ]);

    expect(despues[idIniciativa]).toBe(1);
  });

  it('17. Devuelve un objeto vacío si no se envían iniciativas', async () => {
    const conteo = await contarAceptadosPorIniciativa([]);

    expect(conteo).toEqual({});
  });

});
