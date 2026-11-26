import { describe, expect, it } from 'vitest';
import { serializeInitiative } from '../../src/helpers/serializers.js';

const initiativeVirtual = {
  idiniciativa: 88,
  idempresa: 4,
  nombreempresa: 'Organización de prueba',
  titulo: 'Taller virtual',
  descripcion: 'Una actividad a distancia',
  categoria: 'Educación',
  numcupo: 10,
  fechainicio: '2026-11-03',
  fechafin: '2026-11-04',
  requisito: 'Tener conexión',
  modalidad: 'Virtual',
  enlace_reunion: 'https://meet.google.com/abc-defg-hij',
  horario: '09:00 - 11:30',
  estado: 'activa',
};

describe('serialización de iniciativas virtuales', () => {
  it('conserva la modalidad virtual para que las tarjetas no la muestren como presencial', () => {
    const result = serializeInitiative(initiativeVirtual);

    expect(result.modalidad).toBe('virtual');
  });

  it('no expone el enlace de reunión sin autorización explícita', () => {
    const result = serializeInitiative(initiativeVirtual);

    expect(result.meetingUrl).toBe('');
  });

  it('incluye el enlace solamente cuando una ruta autorizada lo solicita', () => {
    const result = serializeInitiative(initiativeVirtual, [], {
      includeMeetingUrl: true,
    });

    expect(result.meetingUrl).toBe(initiativeVirtual.enlace_reunion);
  });

  it('incluye el horario y la lista de aceptados cuando la ruta ya autorizó a la empresa', () => {
    const members = [{ id: 12, fullName: 'Ana Pérez', email: 'ana@correo.pe' }];
    const result = serializeInitiative(initiativeVirtual, [], { members });

    expect(result.schedule).toBe('09:00 - 11:30');
    expect(result.members).toEqual(members);
  });
});
