// Middleware de autenticación.
//
// - signToken(user): genera el token JWT que se entrega al iniciar sesión o registrarse.
// - auth(requiredRole): protege una ruta. Si se indica un rol ('volunteer' o 'company'),
//   además exige que el usuario tenga ese rol para continuar.


import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/entorno.js';
import pool from '../config/db.js';

/**
 * Firma un JWT de sesión con el identificador y rol del usuario.
 * @param {{id: number|string, role: 'volunteer'|'company', sessionVersion?: number}} user Usuario autenticado.
 * @returns {string} Token con vigencia de dos horas.
 */
export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, sv: user.sessionVersion ?? 0 }, JWT_SECRET, { expiresIn: '2h' });
}

/**
 * Crea un middleware que valida el JWT y vuelve a cargar el usuario desde la BD.
 * @param {'volunteer'|'company'} [requiredRole] Rol requerido; si se omite, admite ambos.
 * @returns {import('express').RequestHandler} Middleware que asigna el usuario a `req.user`.
 */
export function auth(requiredRole) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Inicia sesión para continuar.' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const userId = payload.sub;
      const userRole = payload.role;

      let user = null;
      if (userRole === 'volunteer') {
        const result = await pool.query(
          'SELECT idvoluntario AS id, nombrecompleto AS "fullName", correo AS email, telefono, biografia, session_version FROM voluntario WHERE idvoluntario = $1',
          [userId]
        );
        user = result.rows[0];
        if (user) user.role = 'volunteer';
      } else if (userRole === 'company') {
        const result = await pool.query(
          'SELECT idempresa AS id, nombreempresa AS "fullName", nombreempresa AS "companyName", correo AS email, sector, nombrecoordinador, session_version FROM empresa WHERE idempresa = $1',
          [userId]
        );
        user = result.rows[0];
        if (user) user.role = 'company';
      }

      if (!user) return res.status(401).json({ message: 'Sesión no válida.' });
      if (payload.sv !== user.session_version) {
        return res.status(401).json({ message: 'Tu contraseña cambió. Inicia sesión nuevamente.' });
      }
      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ message: 'No tienes permiso para esta acción.' });
      }
      req.user = user;
      return next();
    } catch (err) {
      console.error('Error en auth:', err.message);
      return res.status(401).json({ message: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    }
  };
};
