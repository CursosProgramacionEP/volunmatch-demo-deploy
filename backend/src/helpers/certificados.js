import pool from '../config/db.js';
import { sendCertificateEmail } from '../services/correo.js';

/** Convierte texto a bytes compatibles con WinAnsi, usada por Helvetica en PDF. */
function winAnsiBytes(value) {
  const replacements = { '’': "'", '‘': "'", '“': '"', '”': '"', '—': '-', '–': '-', '…': '...', '•': '-' };
  const normalized = String(value ?? '').replace(/[’‘“”—–…•]/g, (character) => replacements[character]);
  const bytes = [];
  for (const character of normalized) {
    const code = character.codePointAt(0);
    if (code <= 255) bytes.push(code);
    else {
      const fallback = character.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      for (const fallbackCharacter of fallback) {
        const fallbackCode = fallbackCharacter.codePointAt(0);
        bytes.push(fallbackCode <= 255 ? fallbackCode : 63);
      }
    }
  }
  return Buffer.from(bytes);
}

/** Construye el operador PDF que dibuja texto en una posición y estilo determinados. */
function pdfText(value, x, y, size, color = '0.12 0.30 0.21') {
  const hex = winAnsiBytes(value).toString('hex').toUpperCase();
  return `BT ${color} rg /F1 ${size} Tf ${x} ${y} Td <${hex}> Tj ET`;
}

function pdfTextCentered(value, y, size, color = '0.12 0.30 0.21') {
  const approximateWidth = winAnsiBytes(value).length * size * 0.5;
  return pdfText(value, Math.max(70, Math.round((842 - approximateWidth) / 2)), y, size, color);
}

/** Divide un texto en líneas para que el contenido no exceda el ancho previsto. */
function wrapText(value, maxCharacters = 64) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Genera en memoria un certificado PDF de una página con los datos de participación.
 * @param {{volunteerName: string, initiativeTitle: string, companyName: string, endDate: string, certificateId: string}} data Datos impresos en el certificado.
 * @returns {Buffer} Contenido binario del documento PDF.
 */
export function crearPdfCertificado({ volunteerName, initiativeTitle, companyName, endDate, certificateId }) {
  const content = [
    '0.15 0.37 0.25 RG 3 w 28 28 786 539 re S',
    '0.84 0.67 0.20 RG 1.5 w 39 39 764 517 re S',
    pdfTextCentered('VOLUNMATCH', 505, 18, '0.12 0.36 0.23'),
    '0.84 0.67 0.20 RG 1 w 300 480 m 542 480 l S',
    pdfTextCentered('CERTIFICADO DE PARTICIPACION', 438, 25, '0.12 0.30 0.21'),
    pdfTextCentered('Se otorga el presente reconocimiento a', 397, 13, '0.32 0.39 0.35'),
  ];
  let y = 353;
  for (const line of wrapText(volunteerName, 58)) {
    content.push(pdfTextCentered(line, y, 27, '0.12 0.36 0.23'));
    y -= 35;
  }
  y -= 8;
  content.push(pdfTextCentered('por su participacion en la iniciativa', y, 13, '0.32 0.39 0.35'));
  y -= 28;
  for (const line of wrapText(initiativeTitle, 82)) {
    content.push(pdfTextCentered(line, y, 16, '0.12 0.30 0.21'));
    y -= 22;
  }
  y -= 8;
  for (const line of wrapText(`Organizada por ${companyName}.`, 90)) {
    content.push(pdfTextCentered(line, y, 12, '0.32 0.39 0.35'));
    y -= 18;
  }
  y -= 4;
  content.push(pdfTextCentered(`Fecha de finalizacion: ${endDate}`, y, 12, '0.32 0.39 0.35'));
  content.push('0.84 0.67 0.20 RG 1 w 160 112 m 682 112 l S');
  content.push(pdfTextCentered(`Codigo de certificado: ${certificateId}`, 88, 10, '0.32 0.39 0.35'));

  const stream = Buffer.from(content.join('\n'), 'ascii');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  const parts = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.concat(parts).length);
    parts.push(Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, 'ascii'));
  }
  offsets.push(Buffer.concat(parts).length);
  parts.push(Buffer.concat([
    Buffer.from(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'ascii'),
    stream,
    Buffer.from('\nendstream\nendobj\n', 'ascii'),
  ]));
  const xrefOffset = Buffer.concat(parts).length;
  const xref = [`xref\n0 6\n0000000000 65535 f `];
  for (const offset of offsets.slice(1)) xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
  xref.push(`\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  parts.push(Buffer.from(xref.join('\n'), 'ascii'));
  return Buffer.concat(parts);
}

/**
 * Envía certificados pendientes de participantes aceptados en iniciativas finalizadas.
 * Marca cada certificado como enviado solo después de que SMTP acepte el correo.
 * @param {number} [limit=25] Máximo de certificados procesados en esta ejecución.
 * @returns {Promise<number>} Cantidad de correos aceptados por el servicio SMTP.
 */
export async function enviarCertificadosPendientes(limit = 25) {
  const client = await pool.connect();
  let enviados = 0;
  try {
    await client.query('BEGIN');
    const pending = await client.query(
      `SELECT vi.idvaloracion, vi.idiniciativa, vi.idvoluntario,
              v.nombrecompleto AS voluntario, v.correo,
              i.titulo AS iniciativa, e.nombreempresa AS empresa,
              i.fechafin::date AS fecha_fin
       FROM valoracion_iniciativa vi
       JOIN postulacion p ON p.idiniciativa = vi.idiniciativa
         AND p.idvoluntario = vi.idvoluntario AND p.estado = 'aceptado'
       JOIN voluntario v ON v.idvoluntario = vi.idvoluntario
       JOIN iniciativa i ON i.idiniciativa = vi.idiniciativa
       JOIN empresa e ON e.idempresa = i.idempresa
       WHERE vi.certificado_enviado_en IS NULL
         AND ((i.fechafin::date + TIME '23:59:59') AT TIME ZONE 'America/Lima') <= NOW()
       ORDER BY vi.creado_en ASC
       LIMIT $1
       FOR UPDATE OF vi SKIP LOCKED`,
      [limit],
    );

    for (const certificate of pending.rows) {
      const certificateId = `VM-${certificate.idiniciativa}-${certificate.idvoluntario}`;
      const pdf = crearPdfCertificado({
        volunteerName: certificate.voluntario,
        initiativeTitle: certificate.iniciativa,
        companyName: certificate.empresa,
        endDate: new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(new Date(certificate.fecha_fin)),
        certificateId,
      });
      try {
        const delivered = await sendCertificateEmail({
          email: certificate.correo,
          volunteerName: certificate.voluntario,
          initiativeTitle: certificate.iniciativa,
          certificateId,
          pdf,
        });
        if (delivered) {
          await client.query(
            'UPDATE valoracion_iniciativa SET certificado_enviado_en = NOW() WHERE idvaloracion = $1',
            [certificate.idvaloracion],
          );
          enviados += 1;
        }
      } catch (error) {
        console.error(`No se pudo enviar el certificado ${certificateId}:`, error.message);
      }
    }
    await client.query('COMMIT');
    return enviados;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
