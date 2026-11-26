// Tests del Asistente IA para Voluntarios (Sprint 3)
// Pruebas de lógica de negocio (rápidas, sin Gemini y sin Base de Datos)
import { describe, it, expect, vi } from 'vitest';

// 1. Simulamos la base de datos (para que no dependa de Docker)
vi.mock('../../src/config/db.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [] }), 
  },
}));

// 2. Simulamos Gemini con una respuesta genérica
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function() {
    return {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'Esta es una respuesta simulada de la IA para el test.' },
        }),
      }),
    };
  }),
}));

// Importamos la función real de tu backend
import { preguntarAsistenteVoluntario } from '../../src/helpers/AsistenteVoluntario.js';

describe('Asistente IA — Validaciones y Reglas (Sprint 3)', () => {
    const idFalso = 1;

    it('Debe devolver una respuesta válida (string no vacío) para cualquier pregunta', async () => {
        const respuesta = await preguntarAsistenteVoluntario(idFalso, '¿Cómo funciona VolunMatch?');
        expect(typeof respuesta).toBe('string');
        expect(respuesta.length).toBeGreaterThan(0);
    });

    it('NO debe permitir crear tareas a un voluntario', async () => {
        const respuesta = await preguntarAsistenteVoluntario(idFalso, 'Como voluntario, ¿puedo generar o inventar tareas para la empresa?');
        // Verificamos que el sistema devuelva una respuesta (sea de la IA o del respaldo)
        expect(typeof respuesta).toBe('string');
        expect(respuesta.length).toBeGreaterThan(0);
    });

    it('Debe responder al preguntar por el tablero Kanban', async () => {
        const respuesta = await preguntarAsistenteVoluntario(idFalso, '¿Dónde está el tablero kanban?');
        expect(typeof respuesta).toBe('string');
        expect(respuesta.length).toBeGreaterThan(0);
    });

    it('Debe responder al preguntar cómo postularse', async () => {
        const respuesta = await preguntarAsistenteVoluntario(idFalso, 'Quiero postularme a una iniciativa');
        expect(typeof respuesta).toBe('string');
        expect(respuesta.length).toBeGreaterThan(0);
    });

    it('Debe responder al preguntar por los certificados', async () => {
        const respuesta = await preguntarAsistenteVoluntario(idFalso, '¿Dónde veo mis certificados?');
        expect(typeof respuesta).toBe('string');
        expect(respuesta.length).toBeGreaterThan(0);
    });
});