import { describe, expect, it } from 'vitest';
import {
  formatInitiativeDate,
  formatInitiativeDayMonth,
  splitSchedule,
} from '../../src/utils/fechas.js';

describe('utilidades de fechas', () => {
  it('formatea una fecha ISO sin cambiar el día', () => {
    expect(formatInitiativeDate('2026-01-15T00:00:00.000Z')).toBe('15 ene. 2026');
  });

  it('formatea el día y mes para una tarjeta', () => {
    expect(formatInitiativeDayMonth('2026-12-03')).toBe('03-dic.');
  });

  it('devuelve un texto de respaldo si la fecha no está definida', () => {
    expect(formatInitiativeDate(null)).toBe('Fecha por definir');
    expect(formatInitiativeDayMonth('sin fecha')).toBe('Fecha por definir');
  });

  it('separa el horario válido y maneja uno inválido', () => {
    expect(splitSchedule('09:30 - 11:00')).toEqual({ startTime: '09:30', endTime: '11:00' });
    expect(splitSchedule('horario pendiente')).toEqual({ startTime: '', endTime: '' });
  });
});
