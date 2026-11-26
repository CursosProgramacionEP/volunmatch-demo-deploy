// DAO de usuarios: voluntarios y empresas
import pool from '../config/db.js';

// ============ CONTRATO COMÚN (LSP) ============
function normalizarUsuario(row, role) {
  if (!row) return null;
  return {
    id: row.id,
    fullname: row.fullname,
    correo: row.correo,
    sessionVersion: row.session_version ?? 0,
    role,
    fotoUrl: row.foto_url || null,
    logoUrl: row.logo_url || null,
    sector: row.sector || null,
    telefono: row.telefono || null,
  };
}

// Solo para login (incluye contraseña)
function normalizarUsuarioParaLogin(row, role) {
  const user = normalizarUsuario(row, role);
  if (!user) return null;
  return { ...user, contrasena: row.contrasena };
}

// ============ VOLUNTARIOS ============

/** Busca un voluntario por su correo (incluye contraseña para login). */
export async function buscarVoluntarioPorCorreo(correo) {
  const result = await pool.query(
    `SELECT idvoluntario AS id, nombrecompleto AS fullname, correo, contrasena, telefono, foto_url, session_version
     FROM voluntario WHERE correo = $1`,
    [correo],
  );
  return normalizarUsuarioParaLogin(result.rows[0], 'volunteer');
}

/** Verifica si existe un voluntario con ese correo. */
export async function existeVoluntarioPorCorreo(correo) {
  const result = await pool.query('SELECT 1 FROM voluntario WHERE correo = $1', [correo]);
  return result.rowCount > 0;
}

/** Crea un nuevo voluntario. */
export async function crearVoluntario({ nombrecompleto, telefono, correo, contrasena, biografia }) {
  const result = await pool.query(
    `INSERT INTO voluntario (nombrecompleto, telefono, correo, contrasena, biografia)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING idvoluntario AS id, nombrecompleto AS fullname, correo, contrasena, foto_url, session_version`,
    [nombrecompleto, telefono || null, correo, contrasena, biografia || null],
  );
  // Retornamos con contraseña para el registro (el front lo ignora)
  return normalizarUsuarioParaLogin(result.rows[0], 'volunteer');
}

/** Busca un voluntario por su ID (SIN contraseña, para perfil). */
export async function buscarVoluntarioPorId(id) {
  const result = await pool.query(
    `SELECT idvoluntario AS id, nombrecompleto AS fullname, correo, telefono, biografia, foto_url
     FROM voluntario WHERE idvoluntario = $1`, 
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...normalizarUsuario(row, 'volunteer'),
    telefono: row.telefono,
    biografia: row.biografia,
  };
}

/** Actualiza la contraseña de un voluntario por correo. */
export async function actualizarContrasenaVoluntario(correo, contrasenaHash, client = pool) {
  const result = await client.query(
    'UPDATE voluntario SET contrasena = $1, session_version = session_version + 1 WHERE correo = $2 RETURNING session_version',
    [contrasenaHash, correo],
  );
  return result.rows[0]?.session_version ?? 0;
}

// ============ EMPRESAS ============

/** Busca una empresa por su correo (incluye contraseña para login). */
export async function buscarEmpresaPorCorreo(correo) {
  const result = await pool.query(
    `SELECT idempresa AS id, nombreempresa AS fullname, correo, contrasena, sector, logo_url, session_version
     FROM empresa WHERE correo = $1`,
    [correo],
  );
  return normalizarUsuarioParaLogin(result.rows[0], 'company');
}

/** Verifica si existe una empresa con ese correo. */
export async function existeEmpresaPorCorreo(correo) {
  const result = await pool.query('SELECT 1 FROM empresa WHERE correo = $1', [correo]);
  return result.rowCount > 0;
}

/** Crea una nueva empresa. */
export async function crearEmpresa({ nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector }) {
  const result = await pool.query(
    `INSERT INTO empresa (nombreempresa, ruc, nombrecoordinador, correo, contrasena, sector)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING idempresa AS id, nombreempresa AS fullname, correo, contrasena, sector, logo_url, session_version`,
    [nombreempresa, ruc, nombrecoordinador || nombreempresa, correo, contrasena, sector || 'Otro'],
  );
  return normalizarUsuarioParaLogin(result.rows[0], 'company');
}

/** Busca una empresa por su ID (SIN contraseña, para perfil). */
export async function buscarEmpresaPorId(id) {
  const result = await pool.query(
    `SELECT idempresa AS id, nombreempresa AS fullname, ruc, nombrecoordinador, correo, sector, logo_url
     FROM empresa WHERE idempresa = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...normalizarUsuario(row, 'company'),
    ruc: row.ruc,
    nombrecoordinador: row.nombrecoordinador,
  };
}

/** Actualiza la contraseña de una empresa por correo. */
export async function actualizarContrasenaEmpresa(correo, contrasenaHash, client = pool) {
  const result = await client.query(
    'UPDATE empresa SET contrasena = $1, session_version = session_version + 1 WHERE correo = $2 RETURNING session_version',
    [contrasenaHash, correo],
  );
return result.rows[0]?.session_version ?? 0;
}
