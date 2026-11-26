// Tests del DAO de perfiles (Sprint 2 - HU-04, HU-06)
// Cada test es INDEPENDIENTE: crea sus propios datos y los limpia.
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import pool from '../../src/config/db.js';

// El perfil puede desbloquear insignias; estos tests no deben enviar correos.
vi.mock('../../src/services/correo.js', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));
import {
  obtenerPerfilVoluntario,
  obtenerPerfilEmpresa,
  actualizarPerfilVoluntario,
  actualizarPerfilEmpresa,
  actualizarLogoEmpresa,
  actualizarFotoVoluntario,
  correoUsadoPorOtro,
  crearCertificacion,
} from '../../src/helpers/perfiles.js';

// ═══════════════════════════════════════════════════════════
// CIERRE DEL POOL (solo UNA VEZ, al final de TODO el archivo)
// ═══════════════════════════════════════════════════════════
afterAll(async () => {
  await pool.end();
});

// ═══════════════════════════════════════════════════════════
// LIMPIEZA GLOBAL
// ═══════════════════════════════════════════════════════════
const recursosCreados = {
  voluntarios: [],
  empresas: [],
  certificaciones: [],
};

async function limpiarRecursos() {
  for (const id of recursosCreados.certificaciones) {
    await pool.query('DELETE FROM certificacion WHERE idcertificacion = $1', [id]);
  }
  if (recursosCreados.voluntarios.length) {
    await pool.query('DELETE FROM voluntario_insignia WHERE idvoluntario = ANY($1::int[])', [recursosCreados.voluntarios]);
    await pool.query('DELETE FROM notificacion WHERE idusuario = ANY($1::int[]) AND rol = $2', [recursosCreados.voluntarios, 'volunteer']);
  }
  for (const id of recursosCreados.voluntarios) {
    await pool.query('DELETE FROM voluntario WHERE idvoluntario = $1', [id]);
  }
  for (const id of recursosCreados.empresas) {
    await pool.query('DELETE FROM empresa WHERE idempresa = $1', [id]);
  }
  recursosCreados.voluntarios = [];
  recursosCreados.empresas = [];
  recursosCreados.certificaciones = [];
}

// Helpers para generar datos únicos
const generarCorreo = (sufijo) =>
  `${sufijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@volunmatch.test`;

async function crearVoluntario(datosExtra = {}) {
  const correo = datosExtra.correo || generarCorreo('vol-perfil');
  const result = await pool.query(
    `INSERT INTO voluntario (nombrecompleto, telefono, correo, contrasena, biografia)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING idvoluntario, correo`,
    [
      datosExtra.nombrecompleto || 'Voluntario Perfil Test',
      datosExtra.telefono || '999888777',
      correo,
      'hash',
      datosExtra.biografia || 'Bio inicial',
    ],
  );
  recursosCreados.voluntarios.push(result.rows[0].idvoluntario);
  return { id: result.rows[0].idvoluntario, correo: result.rows[0].correo };
}

async function crearEmpresa(datosExtra = {}) {
  const correo = datosExtra.correo || generarCorreo('emp-perfil');
  const ruc = datosExtra.ruc || String(Date.now()).slice(-11);
  const result = await pool.query(
    `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING idempresa, correo`,
    [
      datosExtra.nombreempresa || 'Empresa Perfil Test',
      ruc,
      datosExtra.nombrecoordinador || 'Coordinador Test',
      correo,
      'hash',
      datosExtra.sector || 'General',
    ],
  );
  recursosCreados.empresas.push(result.rows[0].idempresa);
  return { id: result.rows[0].idempresa, correo: result.rows[0].correo };
}

// ═══════════════════════════════════════════════════════════
// TESTS DEL DAO DE PERFILES
// ═══════════════════════════════════════════════════════════

describe('DAO de perfiles — Sprint 2', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    await limpiarRecursos();
  });

  // ─────────────────────────────────────────────────────
  // LECTURA DE PERFIL
  // ─────────────────────────────────────────────────────

  it('obtenerPerfilVoluntario devuelve el perfil con la estructura esperada', async () => {
    const { id: idVoluntario } = await crearVoluntario();

    const perfil = await obtenerPerfilVoluntario(idVoluntario);

    expect(perfil).not.toBeNull();
    expect(perfil.id).toBe(idVoluntario);
    expect(perfil.role).toBe('volunteer');
    expect(perfil.fullName).toBe('Voluntario Perfil Test');
    expect(perfil.phone).toBe('999888777');
    expect(perfil.bio).toBe('Bio inicial');
    expect(perfil.fotoUrl).toBeNull();
    expect(perfil.acceptedInitiatives).toBe(0);
    expect(perfil.completedTasks).toBe(0);
    expect(Array.isArray(perfil.certifications)).toBe(true);
  });

  it('obtenerPerfilVoluntario devuelve null para un ID inexistente', async () => {
    const perfil = await obtenerPerfilVoluntario(-1);
    expect(perfil).toBeNull();
  });

  it('obtenerPerfilEmpresa devuelve el perfil con la estructura esperada', async () => {
    const { id: idEmpresa } = await crearEmpresa();

    const perfil = await obtenerPerfilEmpresa(idEmpresa);

    expect(perfil).not.toBeNull();
    expect(perfil.id).toBe(idEmpresa);
    expect(perfil.role).toBe('company');
    expect(perfil.companyName).toBe('Empresa Perfil Test');
    expect(perfil.sector).toBe('General');
    expect(perfil.logoUrl).toBeNull();
  });

  it('obtenerPerfilEmpresa devuelve null para un ID inexistente', async () => {
    const perfil = await obtenerPerfilEmpresa(-1);
    expect(perfil).toBeNull();
  });

  // ─────────────────────────────────────────────────────
  // ACTUALIZACIÓN
  // ─────────────────────────────────────────────────────

  it('actualizarPerfilVoluntario actualiza los datos correctamente', async () => {
    const { id: idVoluntario, correo } = await crearVoluntario();

    const filasAfectadas = await actualizarPerfilVoluntario({
      idvoluntario: idVoluntario,
      nombrecompleto: 'Voluntario Actualizado',
      correo,
      telefono: '111222333',
      biografia: 'Nueva biografía',
    });

    expect(filasAfectadas).toBe(1);

    const perfil = await obtenerPerfilVoluntario(idVoluntario);
    expect(perfil.fullName).toBe('Voluntario Actualizado');
    expect(perfil.phone).toBe('111222333');
    expect(perfil.bio).toBe('Nueva biografía');
  });

  it('actualizarPerfilEmpresa actualiza los datos correctamente', async () => {
    const { id: idEmpresa, correo } = await crearEmpresa();

    const filasAfectadas = await actualizarPerfilEmpresa({
      idempresa: idEmpresa,
      nombreempresa: 'Empresa Actualizada',
      nombrecoordinador: 'Nuevo Coordinador',
      correo,
      sector: 'Educación',
    });

    expect(filasAfectadas).toBe(1);

    const perfil = await obtenerPerfilEmpresa(idEmpresa);
    expect(perfil.companyName).toBe('Empresa Actualizada');
    expect(perfil.contactName).toBe('Nuevo Coordinador');
    expect(perfil.sector).toBe('Educación');
  });

  it('actualizarLogoEmpresa guarda la URL del logo', async () => {
    const { id: idEmpresa } = await crearEmpresa();

    const filasAfectadas = await actualizarLogoEmpresa({
      idempresa: idEmpresa,
      logoUrl: '/uploads/empresa-test.png',
    });

    expect(filasAfectadas).toBe(1);

    const perfil = await obtenerPerfilEmpresa(idEmpresa);
    expect(perfil.logoUrl).toBe('/uploads/empresa-test.png');
  });

  it('actualizarFotoVoluntario guarda la URL de la foto', async () => {
    const { id: idVoluntario } = await crearVoluntario();

    const filasAfectadas = await actualizarFotoVoluntario({
      idvoluntario: idVoluntario,
      fotoUrl: '/uploads/voluntario-test.png',
    });

    expect(filasAfectadas).toBe(1);

    const perfil = await obtenerPerfilVoluntario(idVoluntario);
    expect(perfil.fotoUrl).toBe('/uploads/voluntario-test.png');
  });

  // ─────────────────────────────────────────────────────
  // CORREO DUPLICADO
  // ─────────────────────────────────────────────────────

  it('correoUsadoPorOtro devuelve false cuando el correo es del mismo usuario', async () => {
    const { id: idVoluntario, correo } = await crearVoluntario();

    const usado = await correoUsadoPorOtro({
      email: correo,
      role: 'volunteer',
      id: idVoluntario,
    });

    expect(usado).toBe(false);
  });

  it('correoUsadoPorOtro devuelve true cuando el correo pertenece a otro usuario', async () => {
    const { id: idVoluntario } = await crearVoluntario();
    const { correo: correoEmpresa } = await crearEmpresa();

    const usado = await correoUsadoPorOtro({
      email: correoEmpresa,
      role: 'volunteer',
      id: idVoluntario,
    });

    expect(usado).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // CERTIFICACIONES
  // ─────────────────────────────────────────────────────

  it('crearCertificacion inserta y devuelve la certificación', async () => {
    const { id: idVoluntario } = await crearVoluntario();

    const certificacion = await crearCertificacion({
      idvoluntario: idVoluntario,
      titulo: 'Certificado de Voluntariado',
      entidad: 'VolunMatch',
      fecha_emision: new Date('2026-01-15'),
      url_documento: 'https://ejemplo.com/cert.pdf',
    });

    recursosCreados.certificaciones.push(certificacion.id);

    expect(certificacion).toHaveProperty('id');
    expect(certificacion.title).toBe('Certificado de Voluntariado');
    expect(certificacion.issuer).toBe('VolunMatch');
    expect(certificacion.documentUrl).toBe('https://ejemplo.com/cert.pdf');
  });

  it('obtenerPerfilVoluntario incluye las certificaciones creadas', async () => {
    const { id: idVoluntario } = await crearVoluntario();
    const cert = await crearCertificacion({
      idvoluntario: idVoluntario,
      titulo: 'Certificado de Voluntariado',
      entidad: 'VolunMatch',
      fecha_emision: new Date('2026-01-15'),
      url_documento: 'https://ejemplo.com/cert.pdf',
    });
    recursosCreados.certificaciones.push(cert.id);

    const perfil = await obtenerPerfilVoluntario(idVoluntario);

    expect(perfil.certifications.length).toBeGreaterThan(0);
    expect(perfil.certifications[0].title).toBe('Certificado de Voluntariado');
  });
});

// ═══════════════════════════════════════════════════════════
// CASOS DE ERROR
// ═══════════════════════════════════════════════════════════

describe('DAO de perfiles — Casos de error', () => {
  it('actualizarPerfilVoluntario devuelve 0 filas si el ID no existe', async () => {
    const filasAfectadas = await actualizarPerfilVoluntario({
      idvoluntario: -1,
      nombrecompleto: 'No existe',
      correo: 'noexiste@test.com',
      telefono: null,
      biografia: null,
    });
    expect(filasAfectadas).toBe(0);
  });

  it('actualizarPerfilEmpresa devuelve 0 filas si el ID no existe', async () => {
    const filasAfectadas = await actualizarPerfilEmpresa({
      idempresa: -1,
      nombreempresa: 'No existe',
      nombrecoordinador: 'Nadie',
      correo: 'noexiste@test.com',
      sector: 'General',
    });
    expect(filasAfectadas).toBe(0);
  });
});
