import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/components/comunes/Boton.jsx';
import { EmptyState } from '../../src/components/comunes/EstadoVacio.jsx';
import { Loader } from '../../src/components/comunes/Cargador.jsx';
import { Field } from '../../src/components/comunes/Campo.jsx';

describe('componentes comunes', () => {
  it('aplica la variante y las clases adicionales del botón', () => {
    const html = renderToStaticMarkup(createElement(
      Button,
      { variant: 'secondary', className: 'ancho-completo', type: 'submit' },
      'Guardar cambios',
    ));

    expect(html).toContain('class="button button--secondary ancho-completo"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('Guardar cambios');
  });

  it('muestra el estado vacío y permite omitir la acción', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, {
      title: 'Sin iniciativas',
      text: 'Prueba nuevamente más tarde.',
    }));

    expect(html).toContain('Sin iniciativas');
    expect(html).toContain('Prueba nuevamente más tarde.');
    expect(html).not.toContain('<button');
  });

  it('muestra el botón de acción opcional del estado vacío', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, {
      title: 'Sin resultados',
      text: 'Explora otras opciones.',
      action: () => {},
      actionLabel: 'Explorar',
    }));

    expect(html).toContain('<button');
    expect(html).toContain('Explorar');
  });

  it('presenta una etiqueta de carga configurable', () => {
    const html = renderToStaticMarkup(createElement(Loader, { label: 'Cargando perfil...' }));

    expect(html).toContain('class="loader"');
    expect(html).toContain('class="spinner"');
    expect(html).toContain('Cargando perfil...');
  });

  it('marca un campo obligatorio y muestra su ayuda', () => {
    const html = renderToStaticMarkup(createElement(Field, {
      label: 'Correo electrónico',
      type: 'email',
      required: true,
      hint: 'Usaremos este correo para iniciar sesión.',
    }));

    expect(html).toContain('required=""');
    expect(html).toContain('aria-invalid="false"');
    expect(html).toContain('Correo electrónico');
    expect(html).toContain('Usaremos este correo para iniciar sesión.');
  });

  it('muestra errores accesibles en un campo inválido', () => {
    const html = renderToStaticMarkup(createElement(Field, {
      label: 'Contraseña',
      type: 'password',
      error: 'La contraseña es obligatoria.',
    }));

    expect(html).toContain('class="field field--invalid"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('La contraseña es obligatoria.');
    expect(html).toContain('aria-label="Mostrar contraseña"');
  });
});
