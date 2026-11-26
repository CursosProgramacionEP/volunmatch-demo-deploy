// Rutas de perfiles, montadas en /api/profiles
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'node:fs';
import sanitizeHtml from 'sanitize-html'; // ✅ 1. Importamos sanitize-html
import { auth } from '../middlewares/autenticacion.js';
import {
  listarIniciativasDeEmpresa,
  obtenerPerfilVoluntario,
  obtenerPerfilEmpresa,
  correoUsadoPorOtro,
  actualizarPerfilVoluntario,
  actualizarPerfilEmpresa,
  actualizarLogoEmpresa,
  actualizarFotoVoluntario,
  equiparInsigniaVoluntario,
  crearCertificacion,
  empresaTieneAccesoAVoluntario,
} from '../helpers/perfiles.js';

export const profilesRouter = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/;
const phonePattern = /^\d{9}$/;

// ============ Configuración de Multer ============

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = req.user.role === 'company' ? 'empresa' : 'voluntario';
    cb(null, `${prefix}-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes.'));
  },
});

const certificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cert-${req.user.id}-${Date.now()}${ext}`);
  },
});

const uploadCertification = multer({
  storage: certificationStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten imágenes o archivos PDF.'));
  },
});

// ============ Helpers locales ============

/** Construye el perfil completo del usuario autenticado (voluntario o empresa). */
async function ownProfile(user) {
  if (user.role === 'volunteer') {
    return await obtenerPerfilVoluntario(user.id);
  }
  const profile = await obtenerPerfilEmpresa(user.id);
  if (!profile) return null;
  profile.initiatives = await listarIniciativasDeEmpresa(profile.id);
  return profile;
}

// ============ Rutas ============

/** GET /api/profiles/me — devuelve el perfil del usuario autenticado y sus datos relacionados. */
profilesRouter.get('/me', auth(), async (req, res) => {
  try {
    const profile = await ownProfile(req.user);
    if (!profile) return res.status(404).json({ message: 'No se encontró el perfil.' });
    return res.json({ profile });
  } catch (err) {
    console.error('Error al consultar perfil:', err.message);
    return res.status(500).json({ message: 'No se pudo cargar el perfil.' });
  }
});

/** PATCH /api/profiles/me — valida y actualiza los datos editables del perfil propio. */
profilesRouter.patch('/me', auth(), async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
  }

  try {
    const usadoPorOtro = await correoUsadoPorOtro({ email, role: req.user.role, id: req.user.id });
    if (usadoPorOtro) {
      return res.status(409).json({ message: 'Este correo ya está registrado.' });
    }

    if (req.user.role === 'volunteer') {
      const fullName = String(req.body.fullName || '').trim();
      const phone = String(req.body.phone || '').trim();
      
      // ✅ 2. SANITIZACIÓN DEL XSS: Limpiamos la biografía
      const bioLimpia = sanitizeHtml(String(req.body.bio || '').trim(), {
        allowedTags: [], // No permitimos ninguna etiqueta HTML
        allowedAttributes: {}
      });

      if (!namePattern.test(fullName)) {
        return res.status(400).json({ message: 'El nombre debe tener al menos 3 letras y no incluir números ni símbolos.' });
      }
      if (!phonePattern.test(phone)) {
        return res.status(400).json({ message: 'El teléfono es obligatorio y debe tener exactamente 9 dígitos.' });
      }
      
      await actualizarPerfilVoluntario({
        idvoluntario: req.user.id,
        nombrecompleto: fullName,
        correo: email,
        telefono: phone,
        biografia: bioLimpia, // ✅ Guardamos la versión limpia
      });
    } else {
      const companyName = String(req.body.companyName || '').trim();
      const contactName = String(req.body.contactName || '').trim();
      const sector = String(req.body.sector || '').trim();
      if (companyName.length < 3 || contactName.length < 3 || !sector) {
        return res.status(400).json({ message: 'Completa el nombre de la empresa, responsable y sector.' });
      }
      await actualizarPerfilEmpresa({
        idempresa: req.user.id,
        nombreempresa: companyName,
        nombrecoordinador: contactName,
        correo: email,
        sector,
      });
    }

    const profile = await ownProfile(req.user);
    return res.json({ profile });
  } catch (err) {
    console.error('Error al actualizar perfil:', err.message);
    return res.status(500).json({ message: 'No se pudieron guardar los cambios del perfil.' });
  }
});

/** POST /api/profiles/me/logo — guarda el logo de la empresa autenticada (solo imágenes, hasta 5 MB). */
profilesRouter.post('/me/logo', auth('company'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió ninguna imagen.' });
    const logoUrl = `/uploads/${req.file.filename}`;
    await actualizarLogoEmpresa({ idempresa: req.user.id, logoUrl });
    return res.json({ message: 'Logo actualizado correctamente.', logoUrl });
  } catch (err) {
    console.error('Error al subir logo:', err.message);
    return res.status(500).json({ message: 'Error al subir el logo.' });
  }
});

/** POST /api/profiles/me/photo — guarda la foto del voluntario autenticado (solo imágenes, hasta 5 MB). */
profilesRouter.post('/me/photo', auth('volunteer'), upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió ninguna imagen.' });
    const fotoUrl = `/uploads/${req.file.filename}`;
    await actualizarFotoVoluntario({ idvoluntario: req.user.id, fotoUrl });
    return res.json({ message: 'Foto actualizada correctamente.', fotoUrl });
  } catch (err) {
    console.error('Error al subir foto:', err.message);
    return res.status(500).json({ message: 'Error al subir la foto.' });
  }
});

/** PATCH /api/profiles/me/badges/equipped — equipa una insignia obtenida o la quita de la foto. */
profilesRouter.patch('/me/badges/equipped', auth('volunteer'), async (req, res) => {
  const rawKey = req.body?.badgeKey;
  if (rawKey !== null && typeof rawKey !== 'string') {
    return res.status(400).json({ message: 'Selecciona una insignia válida.' });
  }

  try {
    const result = await equiparInsigniaVoluntario({ idvoluntario: req.user.id, clave: rawKey });
    if (result.invalid) return res.status(400).json({ message: 'La insignia seleccionada no existe.' });
    if (result.notEarned) return res.status(403).json({ message: 'Primero debes desbloquear esa insignia.' });
    const profile = await ownProfile(req.user);
    return res.json({ profile });
  } catch (err) {
    console.error('Error al equipar insignia:', err.message);
    return res.status(500).json({ message: 'No se pudo actualizar la insignia de tu foto.' });
  }
});

/** POST /api/profiles/me/certifications — registra una certificación con URL opcional del documento. */
profilesRouter.post('/me/certifications', auth('volunteer'), async (req, res) => {
  const title = String(req.body.title || '').trim();
  const issuer = String(req.body.issuer || '').trim();
  const issuedAt = req.body.issuedAt || null;
  const documentUrl = String(req.body.documentUrl || '').trim() || null;

  if (title.length < 3 || issuer.length < 3) {
    return res.status(400).json({ message: 'Completa el nombre de la certificación y la entidad emisora.' });
  }
  if (documentUrl && !/^https?:\/\//i.test(documentUrl)) {
    return res.status(400).json({ message: 'La URL del documento debe comenzar con http:// o https://.' });
  }

  try {
    const certification = await crearCertificacion({
      idvoluntario: req.user.id,
      titulo: title,
      entidad: issuer,
      fecha_emision: issuedAt,
      url_documento: documentUrl,
    });
    void obtenerPerfilVoluntario(req.user.id).catch((error) => console.error('Error al revisar insignias del voluntario:', error.message));
    return res.status(201).json({ certification });
  } catch (err) {
    console.error('Error al registrar certificación:', err.message);
    return res.status(500).json({ message: 'No se pudo registrar la certificación.' });
  }
});

/** POST /api/profiles/me/certifications/upload — registra una certificación y guarda su PDF o imagen. */
profilesRouter.post(
  '/me/certifications/upload',
  auth('volunteer'),
  uploadCertification.single('certification'),
  async (req, res) => {
    const title = String(req.body.title || '').trim();
    const issuer = String(req.body.issuer || '').trim();
    const issuedAt = req.body.issuedAt || null;

    if (title.length < 3) {
      return res.status(400).json({ message: 'El nombre de la certificación debe tener al menos 3 caracteres.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Adjunta un archivo PDF o imagen de la certificación.' });
    }

    try {
      const documentUrl = `/uploads/${req.file.filename}`;
      const certification = await crearCertificacion({
        idvoluntario: req.user.id,
        titulo: title,
        entidad: issuer || null,
        fecha_emision: issuedAt,
        url_documento: documentUrl,
      });
      void obtenerPerfilVoluntario(req.user.id).catch((error) => console.error('Error al revisar insignias del voluntario:', error.message));
      return res.status(201).json({ certification });
    } catch (err) {
      console.error('Error al subir certificación:', err.message);
      return res.status(500).json({ message: 'No se pudo subir la certificación.' });
    }
  }
);

/** GET /api/profiles/company/:id — devuelve el perfil de una empresa y sus iniciativas activas. */
profilesRouter.get('/company/:id', auth(), async (req, res) => {
  try {
    const profile = await obtenerPerfilEmpresa(req.params.id);
    if (!profile) return res.status(404).json({ message: 'No se encontró la empresa.' });
    profile.initiatives = await listarIniciativasDeEmpresa(profile.id, { soloActivas: true });
    return res.json({ profile });
  } catch (err) {
    console.error('Error al consultar perfil de empresa:', err.message);
    return res.status(500).json({ message: 'No se pudo cargar el perfil de la empresa.' });
  }
});

/** GET /api/profiles/volunteer/:id — permite a la empresa consultar voluntarios postulados a sus iniciativas. */
profilesRouter.get('/volunteer/:id', auth('company'), async (req, res) => {
  try {
    const tieneAcceso = await empresaTieneAccesoAVoluntario({
      idvoluntario: req.params.id,
      idempresa: req.user.id,
    });
    if (!tieneAcceso) {
      return res.status(403).json({ message: 'Solo puedes consultar perfiles de voluntarios postulados a tus iniciativas.' });
    }

    const profile = await obtenerPerfilVoluntario(req.params.id);
    if (!profile) return res.status(404).json({ message: 'No se encontró el perfil del voluntario.' });
    return res.json({ profile });
  } catch (err) {
    console.error('Error al consultar perfil de voluntario:', err.message);
    return res.status(500).json({ message: 'No se pudo cargar el perfil del voluntario.' });
  }
});

/** Traduce errores de tamaño y tipo de archivo de Multer a respuestas HTTP 400. */
profilesRouter.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'El archivo supera el tamaño máximo permitido.' });
  }
  if (error?.message === 'Solo se permiten imágenes.' || error?.message === 'Solo se permiten imágenes o archivos PDF.') {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
});