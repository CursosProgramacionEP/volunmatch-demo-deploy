// Tests de la ruta de valoraciones (Sprint 3).
// Cada test crea su propio escenario y elimina sus datos al terminar.
import express from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import pool from '../../src/config/db.js';
import { signToken } from '../../src/middlewares/autenticacion.js';
import { activitiesRouter } from '../../src/routes/actividades.rutas.js';

// Las pruebas validan el endpoint de valoración, no el envío asíncrono de certificados.
vi.mock('../../src/helpers/certificados.js', () => ({
  enviarCertificadosPendientes: vi.fn().mockResolvedValue(undefined),
}));

const recursosCreados = {
  iniciativas: [],
  voluntarios: [],
  empresas: [],
};

const generarCorreo = (sufijo) =>
  `${sufijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@volunmatch.test`;

async function crearEscenario({ estado = 'aceptado', fechaFin = '2020-01-01' } = {}) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const empresa = await pool.query(
    `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING idempresa`,
    [
      'Empresa Valoraciones Test',
      `${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      'Coordinador Test',
      generarCorreo(`empresa-valoracion-${sufijo}`),
      'hash_test',
      'General',
    ],
  );
  const idEmpresa = empresa.rows[0].idempresa;
  recursosCreados.empresas.push(idEmpresa);

  const voluntario = await pool.query(
    `INSERT INTO voluntario (nombrecompleto, telefono, correo, contrasena, biografia)
     VALUES ($1, $2, $3, $4, $5) RETURNING idvoluntario`,
    [
      'Voluntario Valoraciones Test',
      '999111222',
      generarCorreo(`voluntario-valoracion-${sufijo}`),
      'hash_test',
      'Perfil para pruebas de valoraciones',
    ],
  );
  const idVoluntario = voluntario.rows[0].idvoluntario;
  recursosCreados.voluntarios.push(idVoluntario);

  const iniciativa = await pool.query(
    `INSERT INTO iniciativa (idempresa, titulo, descripcion, categoria, numcupo, fechainicio, fechafin, requisito, lugar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idiniciativa`,
    [
      idEmpresa,
      'Iniciativa Valoraciones Test',
      'Iniciativa creada para probar la ruta de valoraciones.',
      'General',
      10,
      '2020-01-01',
      fechaFin,
      'Ninguno',
      'Lima',
    ],
  );
  const idIniciativa = iniciativa.rows[0].idiniciativa;
  recursosCreados.iniciativas.push(idIniciativa);

  await pool.query(
    `INSERT INTO postulacion (razon, idvoluntario, idiniciativa, estado)
     VALUES ($1, $2, $3, $4)`,
    ['Postulación de prueba independiente.', idVoluntario, idIniciativa, estado],
  );

  return {
    idVoluntario,
    idIniciativa,
    token: signToken({ id: idVoluntario, role: 'volunteer' }),
  };
}

async function enviarValoracion(idIniciativa, token, body) {
  return fetch(`${baseUrl}/api/activities/${idIniciativa}/rating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const app = express();
app.use(express.json());
app.use('/api/activities', activitiesRouter);
let server;
let baseUrl;

describe('Ruta de valoraciones — Sprint 3', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    for (const idIniciativa of recursosCreados.iniciativas) {
      await pool.query('DELETE FROM valoracion_iniciativa WHERE idiniciativa = $1', [idIniciativa]);
      await pool.query('DELETE FROM postulacion WHERE idiniciativa = $1', [idIniciativa]);
      await pool.query('DELETE FROM iniciativa WHERE idiniciativa = $1', [idIniciativa]);
    }
    for (const idVoluntario of recursosCreados.voluntarios) {
      await pool.query('DELETE FROM voluntario WHERE idvoluntario = $1', [idVoluntario]);
    }
    for (const idEmpresa of recursosCreados.empresas) {
      await pool.query('DELETE FROM empresa WHERE idempresa = $1', [idEmpresa]);
    }
    recursosCreados.iniciativas = [];
    recursosCreados.voluntarios = [];
    recursosCreados.empresas = [];
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await pool.end();
  });

  it('registra y devuelve la valoración de un voluntario aceptado en una iniciativa cerrada', async () => {
    const { idIniciativa, token } = await crearEscenario();

    const response = await enviarValoracion(idIniciativa, token, {
      score: 5,
      comment: '  Excelente experiencia.  ',
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.rating).toMatchObject({
      score: 5,
      comment: 'Excelente experiencia.',
    });
    expect(body.rating.id).toBeDefined();

    const guardada = await pool.query(
      'SELECT puntaje, comentario FROM valoracion_iniciativa WHERE idiniciativa = $1',
      [idIniciativa],
    );
    expect(guardada.rows).toEqual([{ puntaje: 5, comentario: 'Excelente experiencia.' }]);
  });

  it ('rechaza puntajes fuera del rango de 1 a 5', async () => {
    const { idIniciativa, token } = await crearEscenario();

    const response = await enviarValoracion(idIniciativa, token, { score: 6, comment: '' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Selecciona una valoración de 1 a 5 estrellas.',
    });
  });

  it('rechaza comentarios que superan los 300 caracteres', async () => {
    const { idIniciativa, token } = await crearEscenario();

    const response = await enviarValoracion(idIniciativa, token, {
      score: 4,
      comment: 'x'.repeat(301),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: 'El comentario no puede superar los 300 caracteres.',
    });
  });

  it('no permite valorar una iniciativa que aún no ha cerrado', async () => {
    const { idIniciativa, token } = await crearEscenario({ fechaFin: '2099-12-31' });

    const response = await enviarValoracion(idIniciativa, token, { score: 4, comment: '' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: 'La valoración estará disponible al cerrar una iniciativa en la que fuiste aceptado.',
    });
  });

  it ('no permite valorar una iniciativa si la postulación no fue aceptada', async () => {
    const { idIniciativa, token } = await crearEscenario({ estado: 'pendiente' });
    
    const response = await enviarValoracion(idIniciativa, token, { score: 4, comment: '' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: 'La valoración estará disponible al cerrar una iniciativa en la que fuiste aceptado.',
    });
  });

  it ('rechaza una segunda valoración para la misma iniciativa', async () => {
    const { idIniciativa, token } = await crearEscenario();
    const primera = await enviarValoracion(idIniciativa, token, { score: 5, comment: 'Primera' });
    expect(primera.status).toBe(201);

    const segunda = await enviarValoracion(idIniciativa, token, { score: 3, comment: 'Segunda' });

    expect(segunda.status).toBe(409);
    await expect(segunda.json()).resolves.toMatchObject({
      message: 'Ya enviaste tu valoración para esta iniciativa.',
    });
  });

  it ('exige autenticación para enviar una valoración', async () => {
    const response = await enviarValoracion(1, null, { score: 5, comment: '' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Inicia sesión para continuar.',
    });
  });
});
