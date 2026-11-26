import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// El servidor se inicia desde la raíz del proyecto o desde backend según el script.
// Cargar esta ruta explícita evita que SMTP quede vacío cuando Node no encuentra .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);

/** Indica si el proyecto tiene los datos SMTP mínimos para enviar correos reales. */
export function isEmailDeliveryConfigured() {
  return smtpConfigured;
}

/** Crea el transporte SMTP usando la cuenta configurada por el administrador. */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Envía un enlace de un solo uso para restablecer la contraseña.
 * El token nunca se guarda en texto plano: la base de datos recibe únicamente su hash.
 *
 * @param {{email: string, token: string}} payload Destinatario y token temporal original.
 * @returns {Promise<boolean>} true cuando SMTP aceptó el mensaje.
 */
export async function sendPasswordRecoveryEmail({ email, token }) {
  if (!smtpConfigured) return false;
  const resetUrl = `${appUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
  await createTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Recupera tu contraseña de VolunMatch',
    text: `Solicitaste restablecer tu contraseña. Abre este enlace dentro de los próximos 5 minutos: ${resetUrl}`,
    html: `<p>Solicitaste restablecer tu contraseña de <b>VolunMatch</b>.</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p>Este enlace vence en 5 minutos. Si no hiciste esta solicitud, ignora este correo.</p>`,
  });
  return true;
}

/**
 * Envía una notificación por correo electrónico.
 * @param {{email: string, titulo: string, mensaje: string, enlace?: string}} payload Datos del destinatario.
 * @returns {Promise<boolean>} true cuando SMTP aceptó el mensaje.
 */
export async function sendNotificationEmail({ email, titulo, mensaje, enlace }) {
  if (!smtpConfigured) return false;
  const urlCompleta = enlace ? `${appUrl}/#${enlace}` : appUrl;
  await createTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `VolunMatch · ${titulo}`,
    text: `${mensaje}\n\nVer en VolunMatch: ${urlCompleta}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F5C3D;">${titulo}</h2>
        <p>${mensaje}</p>
        <p><a href="${urlCompleta}" style="background:#1F5C3D;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Ver en VolunMatch</a></p>
        <p style="color:#666;font-size:12px;">Este correo fue enviado automáticamente por VolunMatch.</p>
      </div>
    `,
  });
  return true;
}

/** Sends a participation certificate as a PDF attachment to its participant. */
export async function sendCertificateEmail({ email, volunteerName, initiativeTitle, certificateId, pdf }) {
  if (!smtpConfigured) return false;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const safeName = escapeHtml(volunteerName);
  const safeInitiative = escapeHtml(initiativeTitle);
  await createTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'VolunMatch · Tu certificado de participación',
    text: `Hola ${volunteerName},\n\nAdjuntamos tu certificado de participación por completar la iniciativa "${initiativeTitle}".\n\nCódigo del certificado: ${certificateId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#26372d"><h2 style="color:#1F5C3D">¡Tu certificado está listo!</h2><p>Hola ${safeName},</p><p>Adjuntamos tu certificado de participación por completar la iniciativa <b>${safeInitiative}</b>.</p><p style="color:#68766d;font-size:12px">Código del certificado: ${certificateId}</p></div>`,
    attachments: [{
      filename: `certificado-volunmatch-${certificateId}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    }],
  });
  return true;
}
