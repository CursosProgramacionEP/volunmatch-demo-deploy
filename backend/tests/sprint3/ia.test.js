// Tests del DAO de IA (Sprint 3 - HU-07)
// Los tests rápidos usan validaciones internas.
// El test de integración llama a Gemini (tarda ~5s).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  generarTareasConIA,
  parsearRespuestaIA,
  normalizarArea,
  normalizarPrioridad,
} from '../../src/helpers/ia.js';

// ═══════════════════════════════════════════════════════════
// TESTS RÁPIDOS (sin llamar a Gemini)
// ═══════════════════════════════════════════════════════════

describe('IA — Validaciones (rápidas)', () => {

  it('generarTareasConIA falla si no hay título', async () => {
    await expect(
      generarTareasConIA({ objetivo: 'Objetivo de prueba' }),
    ).rejects.toThrow('Se requiere el título y el objetivo');
  });

  it('generarTareasConIA falla si no hay objetivo', async () => {
    await expect(
      generarTareasConIA({ titulo: 'Título de prueba' }),
    ).rejects.toThrow('Se requiere el título y el objetivo');
  });

});

// ═══════════════════════════════════════════════════════════
// TESTS DE NORMALIZACIÓN (rápidos)
// ═══════════════════════════════════════════════════════════

describe('IA — Normalización de datos', () => {

  it('normalizarArea devuelve el área correcta', () => {
    expect(normalizarArea('Logística')).toBe('Logística');
    expect(normalizarArea('logistica')).toBe('Logística');
    expect(normalizarArea('LOGÍSTICA')).toBe('Logística');
    expect(normalizarArea('Comunicación')).toBe('Comunicación');
    expect(normalizarArea('Educación')).toBe('Educación');
    expect(normalizarArea('General')).toBe('General');
  });

  it('normalizarArea devuelve "General" si el área es inválida', () => {
    expect(normalizarArea('Marketing')).toBe('General');
    expect(normalizarArea('')).toBe('General');
    expect(normalizarArea(null)).toBe('General');
    expect(normalizarArea(undefined)).toBe('General');
  });

  it('normalizarPrioridad devuelve la prioridad correcta', () => {
    expect(normalizarPrioridad('Alta')).toBe('Alta');
    expect(normalizarPrioridad('alta')).toBe('Alta');
    expect(normalizarPrioridad('ALTA')).toBe('Alta');
    expect(normalizarPrioridad('Media')).toBe('Media');
    expect(normalizarPrioridad('Baja')).toBe('Baja');
  });

  it('normalizarPrioridad devuelve "Media" si la prioridad es inválida', () => {
    expect(normalizarPrioridad('Urgente')).toBe('Media');
    expect(normalizarPrioridad('')).toBe('Media');
    expect(normalizarPrioridad(null)).toBe('Media');
  });

});

// ═══════════════════════════════════════════════════════════
// TESTS DEL PARSER (rápidos)
// ═══════════════════════════════════════════════════════════

describe('IA — Parser de respuestas', () => {

  it('parsearRespuestaIA parsea un JSON válido', () => {
    const respuesta = JSON.stringify([
      { titulo: 'Tarea 1', descripcion: 'Desc 1', area: 'Logística', priority: 'Alta' },
      { titulo: 'Tarea 2', descripcion: 'Desc 2', area: 'General', priority: 'Media' },
    ]);

    const tareas = parsearRespuestaIA(respuesta);
    expect(tareas.length).toBe(2);
    expect(tareas[0].titulo).toBe('Tarea 1');
    expect(tareas[0].area).toBe('Logística');
    expect(tareas[1].priority).toBe('Media');
  });

  it('parsearRespuestaIA limpia bloques de markdown', () => {
    const respuesta = '```json\n[{"titulo": "T", "descripcion": "D", "area": "General", "priority": "Alta"}]\n```';

    const tareas = parsearRespuestaIA(respuesta);
    expect(tareas.length).toBe(1);
    expect(tareas[0].titulo).toBe('T');
  });

  it('parsearRespuestaIA extrae el JSON aunque haya texto extra', () => {
    const respuesta = 'Aquí están las tareas:\n[{"titulo": "T", "descripcion": "D", "area": "General", "priority": "Alta"}]\nEspero que te sirvan.';

    const tareas = parsearRespuestaIA(respuesta);
    expect(tareas.length).toBe(1);
    expect(tareas[0].titulo).toBe('T');
  });

  it('parsearRespuestaIA falla si no hay JSON válido', () => {
    expect(() => parsearRespuestaIA('Esto no es JSON')).toThrow();
  });

  it('parsearRespuestaIA falla si el JSON no es un array', () => {
    expect(() => parsearRespuestaIA('{"a": 1}')).toThrow();
  });

  it('parsearRespuestaIA filtra tareas sin título o descripción', () => {
    const respuesta = JSON.stringify([
      { titulo: 'Válida', descripcion: 'Desc', area: 'General', priority: 'Alta' },
      { titulo: '', descripcion: 'Desc', area: 'General', priority: 'Alta' },   // inválida
      { titulo: 'Sin desc', descripcion: '', area: 'General', priority: 'Alta' }, // inválida
    ]);

    const tareas = parsearRespuestaIA(respuesta);
    expect(tareas.length).toBe(1);
    expect(tareas[0].titulo).toBe('Válida');
  });

});

// ═══════════════════════════════════════════════════════════
// TEST DE INTEGRACIÓN REAL CON EL API DE GEMINI
// ═══════════════════════════════════════════════════════════

describe('IA — Integración real con API de Gemini', () => {
  
  it('debe conectarse al API de Gemini y generar una respuesta real', async () => {
    // Hacemos una petición real a la IA con tus credenciales
    const respuesta = await generarTareasConIA({
      titulo: 'Limpieza de playa',
      objetivo: 'Recoger residuos en la costa para cuidar el medio ambiente'
    });

    // Validamos que la respuesta sea un array de tareas (lo que devuelve la IA)
    expect(Array.isArray(respuesta)).toBe(true);
    expect(respuesta.length).toBeGreaterThan(0);
    
    // Validamos que cada tarea tenga las propiedades que esperamos
    respuesta.forEach((tarea) => {
      expect(tarea).toHaveProperty('titulo');
      expect(tarea).toHaveProperty('descripcion');
      expect(tarea).toHaveProperty('area');
      expect(tarea).toHaveProperty('priority');
    });

    console.log('La IA respondió con estas tareas:', respuesta);
  }, 60000); // 60 segundos de margen para que Gemini responda
});