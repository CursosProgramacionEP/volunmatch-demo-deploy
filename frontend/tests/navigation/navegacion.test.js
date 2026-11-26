import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRoute, go } from '../../src/navigation/navegacion.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navegación por hash', () => {
  it('usa la página principal cuando el hash está vacío', () => {
    vi.stubGlobal('window', { location: { hash: '' } });

    expect(getRoute()).toBe('/');
  });

  it('lee la ruta actual desde el hash', () => {
    vi.stubGlobal('window', { location: { hash: '#/volunteer/profile' } });

    expect(getRoute()).toBe('/volunteer/profile');
  });

  it('cambia el hash al navegar a otra página', () => {
    const windowMock = { location: { hash: '#/' } };
    vi.stubGlobal('window', windowMock);

    go('/volunteer/activities');

    expect(windowMock.location.hash).toBe('/volunteer/activities');
  });

  it('conserva rutas con parámetros de búsqueda', () => {
    vi.stubGlobal('window', { location: { hash: '#/initiatives?category=Salud' } });

    expect(getRoute()).toBe('/initiatives?category=Salud');
  });
});
