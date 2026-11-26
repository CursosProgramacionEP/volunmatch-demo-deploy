// Tests del DAO de usuarios (Sprint 2)
// Cada test es INDEPENDIENTE: genera su propio correo/RUC único con Date.now().
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import pool from '../../src/config/db.js';
import {
  existeVoluntarioPorCorreo,
  buscarVoluntarioPorCorreo,
  crearVoluntario,
  crearEmpresa,
  buscarEmpresaPorCorreo,
  existeEmpresaPorCorreo,
  buscarEmpresaPorId,
} from '../../src/helpers/usuarios.js';

// Helper para generar correos únicos por test
const generarCorreo = (sufijo) => `test-${sufijo}-${Date.now()}@volunmatch.test`;
// Helper para generar RUCs únicos de 11 dígitos
const generarRuc = () => String(Date.now()).padStart(11, '0').slice(-11);

describe('DAO de usuarios — Voluntarios', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterEach(async () => {
    // Limpia los voluntarios creados por cada test
    await pool.query("DELETE FROM voluntario WHERE correo LIKE 'test-%@volunmatch.test'");
  });

  // ============ TESTS DE ÉXITO ============

  it('existeVoluntarioPorCorreo devuelve false para un correo inexistente', async () => {
    const correo = generarCorreo('inexistente');
    const existe = await existeVoluntarioPorCorreo(correo);
    expect(existe).toBe(false);
  });

  it('buscarVoluntarioPorCorreo devuelve null para un correo inexistente', async () => {
    const correo = generarCorreo('no-existe');
    const voluntario = await buscarVoluntarioPorCorreo(correo);
    expect(voluntario).toBeNull();
  });

  it('crearVoluntario inserta y devuelve el usuario con la estructura normalizada', async () => {
    const correo = generarCorreo('crear');
    const nuevo = await crearVoluntario({
      nombrecompleto: 'Test Crear',
      telefono: '999888777',
      correo,
      contrasena: 'hash_de_prueba',
      biografia: 'Usuario de test',
    });

    expect(nuevo).toHaveProperty('id');
    expect(nuevo.fullname).toBe('Test Crear');
    expect(nuevo.correo).toBe(correo);
    expect(nuevo.role).toBe('volunteer');
    expect(nuevo.fotoUrl).toBeNull();
    expect(nuevo.logoUrl).toBeNull();
    expect(nuevo.sector).toBeNull();
  });

  it('existeVoluntarioPorCorreo devuelve true después de crear el usuario', async () => {
    const correo = generarCorreo('existe-true');
    await crearVoluntario({
      nombrecompleto: 'Test Existe',
      telefono: '999888777',
      correo,
      contrasena: 'hash',
      biografia: null,
    });

    const existe = await existeVoluntarioPorCorreo(correo);
    expect(existe).toBe(true);
  });

  it('buscarVoluntarioPorCorreo encuentra el usuario recién creado', async () => {
    const correo = generarCorreo('buscar-encontrado');
    await crearVoluntario({
      nombrecompleto: 'Test Buscar',
      telefono: '999888777',
      correo,
      contrasena: 'hash',
      biografia: null,
    });

    const voluntario = await buscarVoluntarioPorCorreo(correo);

    expect(voluntario).not.toBeNull();
    expect(voluntario.fullname).toBe('Test Buscar');
    expect(voluntario.role).toBe('volunteer');
  });

  // ============ TESTS DE ERROR ============

  it('existeVoluntarioPorCorreo devuelve true para un correo ya registrado', async () => {
    const correo = generarCorreo('duplicado');
    await crearVoluntario({
      nombrecompleto: 'Usuario Original',
      telefono: '999000111',
      correo,
      contrasena: 'hash',
      biografia: null,
    });
    const existe = await existeVoluntarioPorCorreo(correo);
    expect(existe).toBe(true);
  });

  it('buscarVoluntarioPorCorreo distingue mayúsculas y minúsculas', async () => {
    const correo = generarCorreo('casesensitive');
    await crearVoluntario({
      nombrecompleto: 'Test Case',
      telefono: '999000222',
      correo,
      contrasena: 'hash',
      biografia: null,
    });
    const voluntario = await buscarVoluntarioPorCorreo(correo.toUpperCase());
    expect(voluntario).toBeNull();
  });

  it('crearVoluntario sin biografía la guarda como null', async () => {
    const correo = generarCorreo('sin-bio');
    const nuevo = await crearVoluntario({
      nombrecompleto: 'Sin Bio',
      telefono: '999000333',
      correo,
      contrasena: 'hash',
      biografia: null,
    });
    expect(nuevo).toHaveProperty('id');
    const result = await pool.query('SELECT biografia FROM voluntario WHERE correo = $1', [correo]);
    expect(result.rows[0].biografia).toBeNull();
  });

  it('crearVoluntario con teléfono null no falla', async () => {
    const correo = generarCorreo('sin-tel');
    const nuevo = await crearVoluntario({
      nombrecompleto: 'Sin Teléfono',
      telefono: null,
      correo,
      contrasena: 'hash',
      biografia: null,
    });
    expect(nuevo).toHaveProperty('id');
  });

  it('buscarVoluntarioPorCorreo devuelve null para un correo vacío', async () => {
    const voluntario = await buscarVoluntarioPorCorreo('');
    expect(voluntario).toBeNull();
  });

  it('crearVoluntario falla al intentar registrar un correo duplicado', async () => {
    const correo = generarCorreo('duplicado-dao');
    
    // 1. Crear el primer usuario
    await crearVoluntario({
      nombrecompleto: 'Usuario Original',
      telefono: '999888777',
      correo,
      contrasena: 'hash',
      biografia: null,
    });

    // 2. Intentar crear otro con el mismo correo (debe fallar por UNIQUE)
    await expect(
      crearVoluntario({
        nombrecompleto: 'Usuario Duplicado',
        telefono: '999777666',
        correo,
        contrasena: 'hash',
        biografia: null,
      }),
    ).rejects.toThrow();
  });
});

describe('DAO de Usuarios — Empresas', () => {
  const generarCorreoEmpresa = (sufijo) => `test-empresa-${sufijo}-${Date.now()}@volunmatch.test`;

  afterEach(async () => {
    // Limpia las empresas creadas por cada test
    await pool.query("DELETE FROM empresa WHERE correo LIKE 'test-empresa-%@volunmatch.test'");
  });

  it('existeEmpresaPorCorreo devuelve false para un correo inexistente', async () => {
    const correo = generarCorreoEmpresa('inexistente');
    const existe = await existeEmpresaPorCorreo(correo);
    expect(existe).toBe(false);
  });

  it('crearEmpresa guarda correctamente un sector personalizado (Otro)', async () => {
    const correo = generarCorreoEmpresa('otro');
    const nueva = await crearEmpresa({
      nombreempresa: 'Empresa Tecnológica',
      ruc: generarRuc(), // 🎯 RUC único
      nombrecoordinador: 'Contacto Test',
      correo,
      contrasena: 'hash',
      sector: 'Tecnología',
    });
    expect(nueva).toHaveProperty('id');
    expect(nueva.sector).toBe('Tecnología');
    expect(nueva.role).toBe('company');
  });

  it('buscarEmpresaPorCorreo encuentra la empresa recién creada', async () => {
    const correo = generarCorreoEmpresa('buscar');
    await crearEmpresa({
      nombreempresa: 'Empresa Buscar',
      ruc: generarRuc(), // 🎯 RUC único
      nombrecoordinador: 'Contacto Test',
      correo,
      contrasena: 'hash',
      sector: 'Educación',
    });

    const empresa = await buscarEmpresaPorCorreo(correo);
    expect(empresa).not.toBeNull();
    expect(empresa.fullname).toBe('Empresa Buscar');
  });

  it('buscarEmpresaPorId devuelve los datos correctos de la empresa', async () => {
    const correo = generarCorreoEmpresa('buscar-id');
    const rucUnico = generarRuc(); // 🎯 RUC único guardado en variable para comparar
    const nueva = await crearEmpresa({
      nombreempresa: 'Empresa ID',
      ruc: rucUnico,
      nombrecoordinador: 'Contacto Test',
      correo,
      contrasena: 'hash',
      sector: 'Otro',
    });

    const empresa = await buscarEmpresaPorId(nueva.id);
    expect(empresa).not.toBeNull();
    expect(empresa.ruc).toBe(rucUnico); // Compara con el RUC creado
    expect(empresa.nombrecoordinador).toBe('Contacto Test');
  });

  //Correo duplicado en empresa
  it('crearEmpresa falla al intentar registrar un correo duplicado', async () => {
    const correo = generarCorreoEmpresa('duplicado-dao');
    
    await crearEmpresa({
      nombreempresa: 'Empresa Original',
      ruc: generarRuc(),
      nombrecoordinador: 'Contacto Test',
      correo,
      contrasena: 'hash',
      sector: 'Educación',
    });

    await expect(
      crearEmpresa({
        nombreempresa: 'Empresa Duplicada',
        ruc: generarRuc(), // RUC distinto, pero MISMO correo
        nombrecoordinador: 'Contacto Test 2',
        correo,
        contrasena: 'hash',
        sector: 'Otro',
      }),
    ).rejects.toThrow();
  });
});

// 🎯 Cierre global al final de todos los describes
afterAll(async () => {
  await pool.end();
});