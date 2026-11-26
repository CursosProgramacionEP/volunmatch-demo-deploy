// Helper para el Asistente IA del Voluntario
import pool from '../config/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// 30 segundos por modelo (igual que en ia.js)
const TIMEOUT_ASISTENTE_MS = Number(process.env.GEMINI_ASSISTANT_TIMEOUT_MS) || 30000;

// 🚨 LA MISMA LISTA DE 10 MODELOS DE RESPALDO QUE EN ia.js
const MODELOS_ASISTENTE = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

/**
 * Carga la información de cuenta que el asistente usa para personalizar respuestas.
 */
async function obtenerContextoVoluntario(idvoluntario) {
  const [tareasResult, postulacionesResult, certificacionesResult] = await Promise.all([
    pool.query(
      `SELECT t.titulo, t.estado, t.area, i.titulo AS iniciativa
       FROM tarea t
       JOIN iniciativa i ON t.idiniciativa = i.idiniciativa
       WHERE t.idvoluntario_asignado = $1
       ORDER BY i.titulo, t.titulo`,
      [idvoluntario],
    ),
    pool.query(
      `SELECT p.estado, i.titulo AS iniciativa, e.nombreempresa AS empresa
       FROM postulacion p
       JOIN iniciativa i ON p.idiniciativa = i.idiniciativa
       JOIN empresa e ON i.idempresa = e.idempresa
       WHERE p.idvoluntario = $1
       ORDER BY p.fecha_postulacion DESC`,
      [idvoluntario],
    ),
    pool.query(
      `SELECT titulo, entidad, fecha_emision
       FROM certificacion
       WHERE idvoluntario = $1
       ORDER BY fecha_emision DESC NULLS LAST, creado_en DESC`,
      [idvoluntario],
    ),
  ]);

  return {
    tareas: tareasResult.rows,
    postulaciones: postulacionesResult.rows,
    certificaciones: certificacionesResult.rows,
  };
}

/**
 * Responde consultas frecuentes mediante reglas locales cuando Gemini no está disponible.
 */
function responderSinIA(pregunta, contexto) {
  const texto = pregunta.toLocaleLowerCase('es');
  
  if (/donde|dónde|ver|revisar|encontrar|buscar/i.test(texto) && /iniciativa|actividad|historial|particip/i.test(texto)) {
    const postulaciones = contexto.postulaciones || [];
    if (postulaciones.length > 0) {
      const lista = postulaciones.map(p => `• ${p.iniciativa} (${p.estado})`).join('\n');
      return `¡Claro! Puedes ver las iniciativas en las que participaste en la sección "Mi historial" (en el menú lateral izquierdo). Según tus datos, veo que has participado en:\n\n${lista}\n\n¿Te gustaría que te ayude con algo más?`;
    }
    return 'Puedes encontrar todas las iniciativas en las que has participado en la sección "Mi historial" del menú lateral. Ahí verás las que están activas, finalizadas o canceladas.';
  }

  if (/kanban|tablero/.test(texto)) {
    return 'Abre Mis actividades en el menú lateral, busca una iniciativa con postulación aceptada y pulsa “Ir al tablero”. También puedes abrir la iniciativa y elegir “Ir al tablero Kanban”.';
  }
  if (/certific|constancia|diploma/.test(texto)) {
    if (/gener|emit|cre(ar|ó)|no (me )?lleg|no (se )?gener/.test(texto)) {
      return 'Cuando finalice una iniciativa en la que fuiste aceptado y envíes tu valoración, VolunMatch generará tu certificado y lo enviará en PDF al correo registrado en tu cuenta. Revisa también la carpeta de spam.';
    }
    const documentos = contexto.certificaciones.map((item) => item.titulo).filter(Boolean);
    return documentos.length
      ? `Los documentos que cargaste manualmente aparecen en Mi perfil > Documentos: ${documentos.join(', ')}.`
      : 'Los documentos que hayas cargado manualmente se consultan en Mi perfil > Documentos.';
  }
  if (/postul|solicitud|inscripci/.test(texto)) {
    if (/donde|dónde|ver|revis|consult/.test(texto)) {
      const estados = { aceptado: 'aceptada', pendiente: 'pendiente de revisión', rechazado: 'no aceptada' };
      const recientes = contexto.postulaciones.slice(0, 5);
      if (!recientes.length) return 'Abre Mis actividades en el menú lateral para ver tus postulaciones y su estado.';
      const resumen = recientes.map((item) => `${item.iniciativa}: ${estados[item.estado] || item.estado}`).join('; ');
      return `Puedes revisar tus postulaciones en Mis actividades. Según el registro, tus más recientes son: ${resumen}.`;
    }
  }
  if (/tarea|actividad/.test(texto)) {
    if (/d[oó]nde|donde|ver|encontrar|acceder|abrir/.test(texto)) {
      return 'Abre Mis actividades desde el menú lateral. En la iniciativa aceptada, pulsa “Ir al tablero” para ver tus tareas.';
    }
    const resumen = contexto.tareas.slice(0, 5).map((item) => `${item.titulo} (${item.estado}) en ${item.iniciativa}`).join('; ');
    return `Tus tareas asignadas son: ${resumen}. Para verlas, abre Mis actividades y pulsa “Ir al tablero”.`;
  }
  if (/historial|participaciones anteriores/.test(texto)) return 'Abre Mi historial desde el menú lateral para consultar tus postulaciones y actividades anteriores. Ahí podrás ver también las iniciativas en las que participaste.';
  
  return 'Puedo ayudarte con pasos de VolunMatch: buscar y postularte a iniciativas, revisar tus actividades, abrir el tablero, ver notificaciones o actualizar tu perfil. ¿Qué quieres hacer?';
}

/**
 * Genera una respuesta personalizada con datos del voluntario y Gemini.
 */
export async function preguntarAsistenteVoluntario(idvoluntario, pregunta, historial = []) {
  const contexto = await obtenerContextoVoluntario(idvoluntario);
  if (!genAI) return responderSinIA(pregunta, contexto);

  const historialTexto = historial.map(m => `${m.role === 'user' ? 'Voluntario' : 'Asistente'}: ${m.text}`).join('\n');

  // 🚨 NUEVO PROMPT MEJORADO Y MOTIVADOR
  const prompt = `
Eres "Voly", el asistente virtual motivador y amigable de VolunMatch. Tu objetivo es inspirar a los voluntarios y guiarlos por la plataforma.

HISTORIAL DE LA CONVERSACIÓN:
${historialTexto || 'Esta es la primera pregunta del voluntario.'}

DATOS DE ESTA CUENTA:
- Postulaciones: ${JSON.stringify(contexto.postulaciones)}
- Tareas asignadas: ${JSON.stringify(contexto.tareas)}
- Documentos cargados: ${JSON.stringify(contexto.certificaciones)}

PREGUNTA ACTUAL DEL VOLUNTARIO: ${JSON.stringify(pregunta)}

REGLAS ESTRICTAS:
1. NUNCA saludes (con "Hola", "Buenos días", etc.) si ya lo hiciste en el historial de la conversación. Ve directo al grano o usa frases como "¡Claro que sí!", "¡Buena pregunta!", "Para ayudarte con eso...".
2. Usa un tono motivador, cálido y entusiasta. Usa emojis (🌱, 🚀, 🌟) para hacerlo visual.
3. Si el usuario te cuenta que es nuevo, dale la bienvenida con mucho entusiasmo y explícale los primeros pasos.
4. Usa viñetas o negritas para estructurar tus respuestas y que sean fáciles de leer.
5. No inventes información de la cuenta. Si no hay tareas o postulaciones, anímalo a explorar nuevas iniciativas.
6. Si el voluntario pregunta "dónde veo mis iniciativas" o "dónde participé", respóndele que puede verlas en "Mis actividades" y también en "Mi historial" (menú lateral).
7. NUNCA respondas con otra pregunta al final. Da una respuesta directa y útil.
8. Para crear tareas, aclara que solo las empresas pueden hacerlo, pero ofrécele ayuda para encontrar una iniciativa donde pueda participar.

Tu respuesta:
`;

  // 🚨 SISTEMA DE RESPALDO CON LOS 10 MODELOS
  for (let i = 0; i < MODELOS_ASISTENTE.length; i++) {
    const modelo = MODELOS_ASISTENTE[i];
    let temporizador;
    try {
      console.log(`[Asistente Voluntario] Intentando modelo ${i + 1}/${MODELOS_ASISTENTE.length}: ${modelo}...`);
      
      const model = genAI.getGenerativeModel({ model: modelo });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => {
          temporizador = setTimeout(
            () => reject(new Error(`Timeout: ${modelo} tardó más de ${TIMEOUT_ASISTENTE_MS}ms`)),
            TIMEOUT_ASISTENTE_MS,
          );
        }),
      ]);
      const respuesta = (await result.response).text()?.trim();
      if (respuesta) {
        console.log(`[Asistente Voluntario] ✅ ${modelo} respondió con éxito.`);
        return respuesta;
      }
    } catch (error) {
      console.warn(`[Asistente Voluntario] ❌ ${modelo} falló: ${error.message}`);
      if (i === MODELOS_ASISTENTE.length - 1) break; // Si es el último, salir
      await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms antes del siguiente
    } finally {
      clearTimeout(temporizador);
    }
  }

  // Si todos los modelos fallaron, usar el respaldo
  console.error('[Asistente Voluntario] ❌ Todos los modelos fallaron. Usando respuesta de respaldo.');
  return responderSinIA(pregunta, contexto);
}