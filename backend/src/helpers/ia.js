// DAO de IA — integración con Google Gemini (con 10 respaldos)
import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════

const API_KEY = process.env.GEMINI_API_KEY;
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30000; // 30 seg por modelo

if (!API_KEY) {
  console.warn('[IA] ⚠️ GEMINI_API_KEY no está configurada en el .env');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Lista de 10 modelos de respaldo.
 * Se intentan en orden: del más rápido/ligero al más potente.
 * Si uno falla (saturación, timeout, etc.), prueba el siguiente.
 */
const MODELOS_RESPALDO = [
  'gemini-flash-lite-latest',   // 1. El más rápido y menos saturado
  'gemini-2.5-flash-lite',      // 2. Ligero, estable
  'gemini-2.5-flash',           // 3. Estable, buena capacidad
  'gemini-flash-latest',        // 4. Alias al flash más reciente
  'gemini-2.0-flash',           // 5. Flash clásico
  'gemini-2.5-pro',             // 6. Más potente, más lento
  'gemini-pro-latest',          // 7. Alias al pro más reciente
  'gemini-3.1-flash-lite',      // 8. Flash lite de nueva generación
  'gemini-3.5-flash',           // 9. Flash de nueva generación
  'gemini-3.8-flash',           // 10. El más nuevo
];

// ═══════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

/**
 * Genera tareas para una iniciativa usando IA (Gemini).
 * Si un modelo falla, automáticamente prueba con el siguiente.
 *
 * @param {object} contexto
 * @param {string} contexto.titulo
 * @param {string} contexto.objetivo
 * @param {string} [contexto.categoria]
 * @param {Array<string>} [contexto.tareasExistentes]
 * @param {number} [cantidad=3]
 * @returns {Promise<Array<{titulo, descripcion, area, priority}>>}
 */
export async function generarTareasConIA(contexto, cantidad = 3) {
  const { titulo, objetivo, categoria, tareasExistentes = [] } = contexto;

  // Validaciones primero (no necesitan API Key)
  if (!titulo || !objetivo) {
    throw new Error('Se requiere el título y el objetivo de la iniciativa.');
  }

  if (!genAI) {
    throw new Error('La IA no está configurada. Falta GEMINI_API_KEY en el .env');
  }

  const cantidadNum = Math.min(Math.max(Number(cantidad) || 3, 1), 10);
  const prompt = construirPrompt({
    titulo,
    objetivo,
    categoria,
    tareasExistentes,
    cantidad: cantidadNum,
  });

  // Llamada con FALLBACK: prueba cada modelo hasta que uno funcione
  const tareas = await llamarGeminiConFallback(prompt, cantidadNum);

  return tareas;
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE RESPALDO (10 modelos)
// ═══════════════════════════════════════════════════════════

/** Prueba los modelos configurados en secuencia y analiza la primera respuesta válida. */
async function llamarGeminiConFallback(prompt, cantidad) {
  const errores = [];

  for (let i = 0; i < MODELOS_RESPALDO.length; i++) {
    const modelo = MODELOS_RESPALDO[i];
    console.log(`[IA] Intentando modelo ${i + 1}/${MODELOS_RESPALDO.length}: ${modelo}...`);

    try {
      const inicio = Date.now();
      const textoRespuesta = await llamarGeminiConTimeout(prompt, modelo);
      const duracion = Date.now() - inicio;

      console.log(`[IA] ✅ ${modelo} respondió en ${duracion}ms`);

      const tareas = parsearRespuestaIA(textoRespuesta);
      return tareas;
    } catch (error) {
      console.warn(`[IA] ❌ ${modelo} falló: ${error.message}`);
      errores.push({ modelo, error: error.message });

      // Si es el último modelo, no hay más opciones
      if (i === MODELOS_RESPALDO.length - 1) {
        break;
      }

      // Pequeña espera antes de probar el siguiente (500ms)
      await esperar(500);
    }
  }

  // Si llegó aquí, TODOS los modelos fallaron
  console.error('[IA] ❌ Todos los modelos fallaron:');
  errores.forEach((e) => console.error(`   - ${e.modelo}: ${e.error}`));

  throw new Error('Todos los modelos de IA fallaron. Intenta más tarde.');
}

// ═══════════════════════════════════════════════════════════
// LLAMADA A UN MODELO ESPECÍFICO (con timeout)
// ═══════════════════════════════════════════════════════════

/** Ejecuta la solicitud a un modelo y la rechaza si supera el límite de espera configurado. */
function llamarGeminiConTimeout(prompt, modelo) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${modelo} tardó más de ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    const model = genAI.getGenerativeModel({ model: modelo });
    model
      .generateContent(prompt)
      .then((result) => result.response)
      .then((response) => {
        clearTimeout(timer);
        resolve(response.text());
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** Espera el intervalo indicado antes de intentar el siguiente modelo. */
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════

/** Compone las instrucciones y restricciones que Gemini debe seguir al proponer tareas. */
function construirPrompt({ titulo, objetivo, categoria, tareasExistentes, cantidad }) {
  const contextoExistente = tareasExistentes.length
    ? `\nTAREAS QUE YA EXISTEN (NO las repitas):\n- ${tareasExistentes.join('\n- ')}`
    : '';

  return `
Eres un asistente experto en gestión de proyectos de voluntariado.

CONTEXTO DE LA INICIATIVA:
- Título: "${titulo}"
- Objetivo: "${objetivo}"
${categoria ? `- Categoría: "${categoria}"` : ''}${contextoExistente}

INSTRUCCIONES:
Genera exactamente ${cantidad} tareas relevantes, específicas y coherentes con el objetivo de la iniciativa.

REGLAS ESTRICTAS:
1. Devuelve SOLO un array JSON válido. Sin texto antes ni después. Sin markdown.
2. Cada tarea debe tener esta estructura EXACTA:
   {
     "titulo": "Título corto (máx. 100 caracteres)",
     "descripcion": "Descripción clara (máx. 300 caracteres)",
     "area": "Logística | Comunicación | Educación | General",
     "priority": "Alta | Media | Baja"
   }
3. NO incluyas tareas que ya existan.
4. Los títulos empiezan con verbo en infinitivo ("Preparar", "Coordinar"...).
5. Usa español de Perú.
6. Si no sabes qué área asignar, usa "General".
7. Prioridad por defecto: "Media".

EJEMPLO DE RESPUESTA VÁLIDA:
[
  {
    "titulo": "Preparar materiales de limpieza",
    "descripcion": "Reunir guantes, bolsas y herramientas necesarias para la jornada.",
    "area": "Logística",
    "priority": "Alta"
  }
]

Devuelve SOLO el array JSON:
`.trim();
}

// ═══════════════════════════════════════════════════════════
// PARSER DE RESPUESTA
// ═══════════════════════════════════════════════════════════

/**
 * Extrae y valida las tareas JSON devueltas por el proveedor de IA.
 * Recorta campos extensos, normaliza área y prioridad y descarta entradas incompletas.
 * @param {string} texto Respuesta textual del modelo, con o sin bloque Markdown.
 * @returns {Array<{titulo: string, descripcion: string, area: string, priority: string}>} Tareas normalizadas.
 * @throws {Error} Si la respuesta no contiene tareas válidas.
 */
export function parsearRespuestaIA(texto) {
  if (!texto || typeof texto !== 'string') {
    throw new Error('La IA no devolvió texto.');
  }

  const textoLimpio = texto
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  let tareas;

  try {
    tareas = JSON.parse(textoLimpio);
  } catch {
    const match = textoLimpio.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error('La IA no devolvió un array JSON válido.');
    }
    tareas = JSON.parse(match[0]);
  }

  if (!Array.isArray(tareas)) {
    throw new Error('La IA no devolvió un array.');
  }

  const tareasValidas = tareas
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      titulo: String(t.titulo || '').trim().slice(0, 100),
      descripcion: String(t.descripcion || '').trim().slice(0, 300),
      area: normalizarArea(t.area),
      priority: normalizarPrioridad(t.priority),
    }))
    .filter((t) => t.titulo && t.descripcion);

  if (tareasValidas.length === 0) {
    throw new Error('La IA no generó tareas válidas.');
  }

  return tareasValidas;
}

// ═══════════════════════════════════════════════════════════
// NORMALIZACIÓN (con eliminación de tildes)
// ═══════════════════════════════════════════════════════════

/**
 * Normaliza texto: quita tildes, convierte a minúsculas y limpia espacios.
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')                       // Descompone letras con tilde
    .replace(/[\u0300-\u036f]/g, '');       // Elimina los acentos
}

/** Ajusta el área a una categoría admitida y usa «General» como valor por defecto. */
export function normalizarArea(area) {
  const validas = ['Logística', 'Comunicación', 'Educación', 'General'];
  const areaNorm = normalizarTexto(area);
  const encontrada = validas.find((v) => normalizarTexto(v) === areaNorm);
  return encontrada || 'General';
}

/** Ajusta la prioridad a Alta, Media o Baja y usa «Media» si no coincide. */
export function normalizarPrioridad(priority) {
  const validas = ['Alta', 'Media', 'Baja'];
  const prioridadNorm = normalizarTexto(priority);
  const encontrada = validas.find((v) => normalizarTexto(v) === prioridadNorm);
  return encontrada || 'Media';
}
