// Rutas de autenticación, montadas en /api/auth

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import pool from '../config/db.js';
import { auth, signToken } from '../middlewares/autenticacion.js';
import { isEmailDeliveryConfigured, sendPasswordRecoveryEmail } from '../services/correo.js';
import {
  existeVoluntarioPorCorreo,
  existeEmpresaPorCorreo,
  crearVoluntario,
  crearEmpresa,
  buscarVoluntarioPorCorreo,
  buscarEmpresaPorCorreo,
  buscarVoluntarioPorId,
  buscarEmpresaPorId,
  actualizarContrasenaVoluntario,
  actualizarContrasenaEmpresa,
} from '../helpers/usuarios.js';
import {
  invalidarTokensActivos,
  crearTokenRecuperacion,
  buscarTokenValido,
  marcarTokenUsado,
} from '../helpers/recuperacion.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 2, // Máximo 2 intentos por IP
  message: { 
    message: 'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo más tarde.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{9}$/;

/** Comprueba que un nombre tenga entre 3 y 100 letras o espacios. */
function invalidFullName(name) {
  return !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/.test(String(name || '').trim());
}

/** POST /api/auth/register — crea una cuenta de voluntario o empresa y devuelve una sesión JWT. */
authRouter.post('/register', async (req, res) => {
  const { role, fullName, email, password, phone, bio, companyName, ruc, sector, contactName } = req.body;
  if (!['volunteer', 'company'].includes(role)) {
    return res.status(400).json({ message: 'Selecciona un tipo de cuenta válido.' });
  }
  if (!email || !emailPattern.test(email.trim()) || !password || password.length < 6) {
    return res.status(400).json({ message: 'Ingresa un correo y una contraseña de al menos 6 caracteres.' });
  }
  if (role === 'volunteer' && invalidFullName(fullName)) {
    return res.status(400).json({ message: 'Ingresa un nombre válido, usando solo letras y espacios.' });
  }
  if (role === 'volunteer' && !phonePattern.test(String(phone || '').trim())) {
    return res.status(400).json({ message: 'Ingresa un teléfono de 9 dígitos para tus postulaciones.' });
  }
  if (role === 'company' && (!companyName || !/^\d{11}$/.test(String(ruc).trim()) || invalidFullName(contactName))) {
    return res.status(400).json({ message: 'Completa la razón social, un RUC de 11 números y el nombre del responsable.' });
  }

  const emailLimpio = email.toLowerCase().trim();

  try {
    const [existeV, existeE] = await Promise.all([
      existeVoluntarioPorCorreo(emailLimpio),
      existeEmpresaPorCorreo(emailLimpio),
    ]);
    if (existeV || existeE) {
      return res.status(409).json({ message: 'Este correo ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (role === 'volunteer') {
      const user = await crearVoluntario({
        nombrecompleto: fullName,
        telefono: phone || null,
        correo: emailLimpio,
        contrasena: passwordHash,
        biografia: bio || null,
      });
      const token = signToken({ id: user.id, email: user.correo, role: user.role, sessionVersion: user.sessionVersion });
      return res.status(201).json({
        token,
        user: {
          id: user.id,
          fullName: user.fullname,
          email: user.correo,
          phone: user.telefono,
          role: user.role,
          fotoUrl: user.fotoUrl,
        },
      });
    }

    // role === 'company'
    const user = await crearEmpresa({
      nombreempresa: companyName,
      ruc,
      nombrecoordinador: contactName || companyName,
      correo: emailLimpio,
      contrasena: passwordHash,
      sector: sector || 'Otro',
    });
    const token = signToken({ id: user.id, email: user.correo, role: user.role, sessionVersion: user.sessionVersion });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullname,
        companyName: user.fullname,
        email: user.correo,
        role: user.role,
        sector: user.sector,
        logoUrl: user.logoUrl,
      },
    });
  } catch (err) {
    // Manejar correo duplicado (protege contra race condition)
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Este correo ya está registrado.' });
    }
    console.error('Error en registro:', err.message);
    return res.status(500).json({ message: 'No se pudo completar el registro. Inténtalo de nuevo.' });
  }
});

/** POST /api/auth/login — valida las credenciales y devuelve el usuario junto con su JWT. */
authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password, role: selectedRole } = req.body;
  const emailLimpio = String(email || '').toLowerCase().trim();

  if (!emailPattern.test(emailLimpio) || !password) {
    return res.status(400).json({ message: 'Ingresa un correo electrónico y contraseña válidos.' });
  }
  if (selectedRole && !['volunteer', 'company'].includes(selectedRole)) {
    return res.status(400).json({ message: 'Selecciona si ingresarás como voluntario o empresa.' });
  }

  try {
    let user = await buscarVoluntarioPorCorreo(emailLimpio);
    let role = 'volunteer';

    if (!user) {
      user = await buscarEmpresaPorCorreo(emailLimpio);
      role = 'company';
    }

    if (!user || !(await bcrypt.compare(password || '', user.contrasena))) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    if (selectedRole && selectedRole !== role) {
      return res.status(401).json({
        message: 'Credenciales incorrectas',
      });
    }

    const token = signToken({ id: user.id, email: user.correo, role, sessionVersion: user.sessionVersion });

    const userResponse = {
      id: user.id,
      fullName: user.fullname,
      email: user.correo,
      role,
    };

    if (role === 'company') {
      userResponse.companyName = user.fullname;
      userResponse.sector = user.sector || null;
      userResponse.logoUrl = user.logoUrl || null;
    } else {
      userResponse.fotoUrl = user.fotoUrl || null;
      userResponse.phone = user.telefono || null;
    }

    return res.json({ token, user: userResponse });
  } catch (err) {
    console.error('Error en login:', err.message);
    return res.status(500).json({ message: 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
  }
});

/** POST /api/auth/recover-password — solicita por correo un enlace temporal de recuperación. */
authRouter.post('/recover-password', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();

  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
  }

  if (!isEmailDeliveryConfigured()) {
    return res.status(503).json({
      message: 'La recuperación por correo no está configurada todavía.',
      emailDeliveryConfigured: false,
    });
  }

  try {
    const [existeV, existeE] = await Promise.all([
      existeVoluntarioPorCorreo(email),
      existeEmpresaPorCorreo(email),
    ]);

    if (existeV || existeE) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await invalidarTokensActivos(email);
      await crearTokenRecuperacion({ correo: email, tokenHash, minutosExpiracion: 5 });
      await sendPasswordRecoveryEmail({ email, token });
    }

    return res.json({
      message: 'Si el correo está registrado, recibirás un enlace de recuperación válido por 5 minutos.',
      emailDeliveryConfigured: true,
    });
  } catch (err) {
    console.error('Error al solicitar recuperación:', err.message);
    return res.status(500).json({ message: 'No se pudo procesar la solicitud. Inténtalo de nuevo.' });
  }
});

/** POST /api/auth/reset-password — cambia la contraseña usando un token de recuperación vigente. */
authRouter.post('/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (!token || password.length < 6) {
    return res.status(400).json({ message: 'El enlace es inválido o la contraseña tiene menos de 6 caracteres.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recovery = await buscarTokenValido(tokenHash, client);
    if (!recovery) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'El enlace de recuperación no es válido o ya venció.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const actualizadoV = await actualizarContrasenaVoluntario(recovery.correo, passwordHash, client);
    if (!actualizadoV) {
      await actualizarContrasenaEmpresa(recovery.correo, passwordHash, client);
    }
    await marcarTokenUsado(recovery.idrecuperacion, client);
    await client.query('COMMIT');
    return res.json({ message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al restablecer contraseña:', err.message);
    return res.status(500).json({ message: 'No se pudo restablecer la contraseña. Inténtalo de nuevo.' });
  } finally {
    client.release();
  }
});

/** GET /api/auth/me — devuelve los datos actuales del usuario autenticado. */
authRouter.get('/me', auth(), async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role === 'volunteer') {
      const user = await buscarVoluntarioPorId(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }
      return res.json({
        user: {
          id: user.id,
          fullName: user.fullname,
          email: user.correo,
          phone: user.telefono,
          bio: user.biografia,
          fotoUrl: user.fotoUrl,
          role: 'volunteer',
        },
      });
    }

    // role === 'company'
    const user = await buscarEmpresaPorId(id);
    if (!user) {
      return res.status(404).json({ message: 'Empresa no encontrada.' });
    }
    return res.json({
      user: {
        id: user.id,
        fullName: user.fullname,
        companyName: user.fullname,
        ruc: user.ruc,
        contactName: user.nombrecoordinador,
        email: user.correo,
        sector: user.sector,
        logoUrl: user.logoUrl,
        role: 'company',
      },
    });
  } catch (err) {
    console.error('Error al obtener usuario:', err.message);
    return res.status(500).json({ message: 'No se pudo cargar la sesión.' });
  }
});