import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, notificationStreamUrl } from '../../src/services/cliente-api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente de API', () => {
  it('envía token y JSON al crear una valoración', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rating: { score: 5 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.rateActivity('token-prueba', 42, { score: 5, comment: 'Muy bien' }))
      .resolves.toEqual({ rating: { score: 5 } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/activities/42/rating',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-prueba',
        }),
        body: JSON.stringify({ score: 5, comment: 'Muy bien' }),
      }),
    );
  });

  it('convierte errores de la API en Error con el mensaje del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'No autorizado' }),
    }));

    await expect(api.myProfile('token-invalido')).rejects.toThrow('No autorizado');
  });

  it('usa un mensaje genérico cuando la respuesta de error no incluye JSON válido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new SyntaxError('JSON inválido'); },
    }));

    await expect(api.myProfile('token-prueba')).rejects.toThrow('No se pudo completar la solicitud.');
  });

  it('traduce los errores de red a un mensaje entendible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));

    await expect(api.login({ email: 'persona@test.com', password: 'clave' }))
      .rejects.toThrow('No se pudo conectar con el servidor.');
  });

  it('envía credenciales al iniciar sesión sin añadir un token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'nuevo-token' }) });
    vi.stubGlobal('fetch', fetchMock);
    const datos = { email: 'persona@test.com', password: 'clave-segura' };

    await expect(api.login(datos)).resolves.toEqual({ token: 'nuevo-token' });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(datos),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('codifica los filtros de iniciativas en la URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ initiatives: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.initiatives('token-prueba', { category: 'Salud y bienestar', activeOnly: 'true' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3001/api/initiatives?category=Salud+y+bienestar&activeOnly=true',
    );
  });

  it('envía un formulario multipart para subir el logo sin fijar Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logoUrl: '/logo.png' }) });
    vi.stubGlobal('fetch', fetchMock);
    const image = new Blob(['imagen'], { type: 'image/png' });

    await expect(api.uploadCompanyLogo('token-prueba', image)).resolves.toEqual({ logoUrl: '/logo.png' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/profiles/me/logo');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Authorization: 'Bearer token-prueba' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('logo')).toBeInstanceOf(Blob);
  });

  it('incluye los metadatos opcionales al subir una certificación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ certification: { id: 4 } }) });
    vi.stubGlobal('fetch', fetchMock);
    const document = new Blob(['pdf'], { type: 'application/pdf' });

    await api.uploadCertification('token-prueba', document, {
      title: 'Primeros auxilios',
      issuer: 'Cruz Roja',
      issuedAt: '2026-10-15',
    });

    const form = fetchMock.mock.calls[0][1].body;
    expect(form.get('certification')).toBeInstanceOf(Blob);
    expect(form.get('title')).toBe('Primeros auxilios');
    expect(form.get('issuer')).toBe('Cruz Roja');
    expect(form.get('issuedAt')).toBe('2026-10-15');
  });

  it('permite aplicar a una iniciativa sin datos adicionales', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ application: { id: 9 } }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.apply('token-prueba', 18);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/api/initiatives/18/applications');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-prueba' },
    });
  });

    it('codifica el ticket en la URL del flujo de notificaciones', () => {
    expect(notificationStreamUrl('ticket con espacios'))
      .toBe('http://localhost:3001/api/notifications/stream?ticket=ticket%20con%20espacios');
  });
});
