// Tests del DAO de iniciativas para el historial de empresa (Sprint 1).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pool from "../../src/config/db.js";
import {
  buscarIniciativaPorId,
  listarIniciativasDeEmpresa,
} from "../../src/helpers/iniciativas.js";

let idEmpresa;
let idOtraEmpresa;
let initiativeIds = [];

describe("DAO de iniciativas — Historial de empresa", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
    const suffix = Date.now();
    const [empresa, otraEmpresa] = await Promise.all([
      pool.query(
        `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING idempresa`,
        [
          "Empresa Historial",
          `91${String(suffix).slice(-9)}`,
          "Coordinadora Historial",
          `empresa-historial-${suffix}@volunmatch.test`,
          "hash_test",
          "Educación",
        ],
      ),
      pool.query(
        `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING idempresa`,
        [
          "Empresa Ajena",
          `92${String(suffix).slice(-9)}`,
          "Coordinador Ajeno",
          `empresa-ajena-${suffix}@volunmatch.test`,
          "hash_test",
          "General",
        ],
      ),
    ]);
    idEmpresa = empresa.rows[0].idempresa;
    idOtraEmpresa = otraEmpresa.rows[0].idempresa;

    const initiatives = await Promise.all([
      pool.query(
        `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
        [
          idEmpresa,
          "Historia ambiental",
          "Actividad de prueba para historial.",
          "Medio ambiente",
          12,
          "2026-10-10",
          "2026-10-12",
          "Ninguno",
          "Lima",
        ],
      ),
      pool.query(
        `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
        [
          idEmpresa,
          "Historia educativa",
          "Segunda actividad de prueba.",
          "Educación",
          20,
          "2026-10-20",
          "2026-10-21",
          "Ninguno",
          "Callao",
        ],
      ),
      pool.query(
        `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
        [
          idOtraEmpresa,
          "Iniciativa ajena",
          "No debe aparecer en el historial.",
          "General",
          8,
          "2026-10-15",
          "2026-10-16",
          "Ninguno",
          "Lima",
        ],
      ),
    ]);
    initiativeIds = initiatives.map((result) => result.rows[0].idiniciativa);
  });

  afterEach(async () => {
    // Limpia solo los datos generados por cada test (postulaciones y tareas)
    if (initiativeIds.length) {
      await pool.query("DELETE FROM postulacion WHERE idiniciativa = ANY($1)", [
        initiativeIds,
      ]);
      await pool.query("DELETE FROM tarea WHERE idiniciativa = ANY($1)", [
        initiativeIds,
      ]);
    }
  });

  afterAll(async () => {
    if (initiativeIds.length) {
      await pool.query("DELETE FROM postulacion WHERE idiniciativa = ANY($1)", [
        initiativeIds,
      ]);
      await pool.query("DELETE FROM tarea WHERE idiniciativa = ANY($1)", [
        initiativeIds,
      ]);
      await pool.query("DELETE FROM iniciativa WHERE idiniciativa = ANY($1)", [
        initiativeIds,
      ]);
    }
    if (idEmpresa)
      await pool.query("DELETE FROM empresa WHERE idempresa = $1", [idEmpresa]);
    if (idOtraEmpresa)
      await pool.query("DELETE FROM empresa WHERE idempresa = $1", [
        idOtraEmpresa,
      ]);
    await pool.end();
  });

  it("lista únicamente las iniciativas de la empresa para el historial", async () => {
    const initiatives = await listarIniciativasDeEmpresa(idEmpresa);

    expect(initiatives).toHaveLength(2);
    expect(initiatives.map((initiative) => initiative.titulo)).toEqual(
      expect.arrayContaining(["Historia ambiental", "Historia educativa"]),
    );
    expect(
      initiatives.every((initiative) => initiative.idempresa === idEmpresa),
    ).toBe(true);
  });

  it("incluye la información necesaria para mostrar una iniciativa histórica", async () => {
    const initiative = await buscarIniciativaPorId(initiativeIds[0]);

    expect(initiative).toMatchObject({
      idiniciativa: initiativeIds[0],
      titulo: "Historia ambiental",
      nombreempresa: "Empresa Historial",
      lugar: "Lima",
    });
  });

  it("devuelve una lista vacía cuando la empresa no tiene iniciativas", async () => {
    const initiatives = await listarIniciativasDeEmpresa(999999999);
    expect(initiatives).toEqual([]);
  });
});
