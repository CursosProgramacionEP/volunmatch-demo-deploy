// DAO de recuperación de contraseña
import pool from '../config/db.js';

/** Invalida todos los tokens activos de un correo. */
export async function invalidarTokensActivos(correo, client = pool) {
  const result = await client.query(
    'UPDATE recuperacion_contrasena SET usado = TRUE WHERE correo = $1 AND usado = FALSE',
    [correo],
  );
  return result.rowCount;
}

/** Crea un nuevo token de recuperación. */
export async function crearTokenRecuperacion({ correo, tokenHash, minutosExpiracion = 5 }, client = pool) {
    const result = await client.query(
        `INSERT INTO recuperacion_contrasena (correo, token_hash, vence_en)
         VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,
        [correo, tokenHash, minutosExpiracion]
    );
    return result.rows[0];
}

/** Busca un token válido (no usado y no vencido) por su hash. */
export async function buscarTokenValido(tokenHash, client = pool) {
  const result = await client.query(
    `SELECT idrecuperacion, correo FROM recuperacion_contrasena
     WHERE token_hash = $1 AND usado = FALSE AND vence_en > NOW()
     ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

/** Marca un token como usado. */
export async function marcarTokenUsado(idRecuperacion, client = pool) {
  const result = await client.query(
    'UPDATE recuperacion_contrasena SET usado = TRUE WHERE idrecuperacion = $1',
    [idRecuperacion],
  );
  return result.rowCount;
}