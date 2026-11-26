// Tests del historial de actividades del voluntario (Sprint 2).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pool from "../../src/config/db.js";
import {
  listarActividadesDeVoluntario,
  listarTareasPorIniciativas,
} from "../../src/helpers/actividades.js";

let idEmpresa;
let idVoluntario;
let idIniciativa;
let idTarea;

describe("DAO de historial de voluntario — Sprint 2", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
    const suffix = Date.now();
    const empresa = await pool.query(
      `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING idempresa`,
      [
        "Empresa Actividades",
        `93${String(suffix).slice(-9)}`,
        "Coordinadora Actividades",
        `actividades-${suffix}@volunmatch.test`,
        "hash_test",
        "Asistencia social",
      ],
    );
    idEmpresa = empresa.rows[0].idempresa;

    const voluntario = await pool.query(
      `INSERT INTO voluntario (nombrecompleto, telefono, correo, contrasena, biografia)
       VALUES ($1, $2, $3, $4, $5) RETURNING idvoluntario`,
      [
        "Voluntario Historial",
        "999111222",
        `voluntario-historial-${suffix}@volunmatch.test`,
        "hash_test",
        "Bio de prueba",
      ],
    );
    idVoluntario = voluntario.rows[0].idvoluntario;

    const initiative = await pool.query(
      `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
      [
        idEmpresa,
        "Actividad para historial",
        "Una actividad para probar el historial.",
        "Asistencia social",
        15,
        "2026-10-11",
        "2026-10-12",
        "Ninguno",
        "Lima",
      ],
    );
    idIniciativa = initiative.rows[0].idiniciativa;

    await pool.query(
      `INSERT INTO postulacion (razon, idvoluntario, idiniciativa, estado)
       VALUES ($1, $2, $3, 'aceptado')`,
      ["Quiero participar en la actividad.", idVoluntario, idIniciativa],
    );
  });

  afterEach(async () => {
    if (idIniciativa) {
      await pool.query("DELETE FROM tarea WHERE idiniciativa = $1", [
        idIniciativa,
      ]);
      await pool.query("DELETE FROM postulacion WHERE idiniciativa = $1", [
        idIniciativa,
      ]);
    }
  });

  afterAll(async () => {
    if (idIniciativa) {
      await pool.query("DELETE FROM tarea WHERE idiniciativa = $1", [
        idIniciativa,
      ]);
      await pool.query("DELETE FROM postulacion WHERE idiniciativa = $1", [
        idIniciativa,
      ]);
      await pool.query("DELETE FROM iniciativa WHERE idiniciativa = $1", [
        idIniciativa,
      ]);
    }
    if (idVoluntario)
      await pool.query("DELETE FROM voluntario WHERE idvoluntario = $1", [
        idVoluntario,
      ]);
    if (idEmpresa)
      await pool.query("DELETE FROM empresa WHERE idempresa = $1", [idEmpresa]);
    await pool.end();
  });

  it("muestra en el historial solo las actividades del voluntario y su estado de postulación", async () => {
    const activities = await listarActividadesDeVoluntario(idVoluntario);

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      idiniciativa: idIniciativa,
      titulo: "Actividad para historial",
      nombreempresa: "Empresa Actividades",
      estado_postulacion: "aceptado",
      lugar: "Lima",
    });
  });

  it("devuelve un historial vacío para un voluntario sin postulaciones", async () => {
    const activities = await listarActividadesDeVoluntario(999999999);
    expect(activities).toEqual([]);
  });

  it("obtiene las tareas de las iniciativas que aparecen en el historial", async () => {
    // Crear la tarea aquí mismo (porque afterEach la borra)
    const task = await pool.query(
      `INSERT INTO tarea (titulo, descripcion, idiniciativa, estado, area, priority)
     VALUES ($1, $2, $3, 'pendiente', $4, $5) RETURNING idtarea`,
      [
        "Registrar asistentes",
        "Registrar a los voluntarios al llegar.",
        idIniciativa,
        "Logística",
        "Media",
      ],
    );
    const idTarea = task.rows[0].idtarea;

    const tasks = await listarTareasPorIniciativas([idIniciativa]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      idtarea: idTarea,
      idiniciativa: idIniciativa,
      titulo: "Registrar asistentes",
      area: "Logística",
      priority: "Media",
    });
  });

  it("no consulta tareas cuando el historial no tiene iniciativas", async () => {
    await expect(listarTareasPorIniciativas([])).resolves.toEqual([]);
  });
});
