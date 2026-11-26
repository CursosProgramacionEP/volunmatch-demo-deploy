import { useState, useEffect } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';

const opcionesTema = [
  { id: 'light', titulo: 'Tema claro', descripcion: 'Interfaz luminosa, ideal para espacios bien iluminados.', Icono: Sun },
  { id: 'dark', titulo: 'Tema oscuro', descripcion: 'Interfaz oscura para reducir el brillo en ambientes con poca luz.', Icono: Moon },
];

export function AppearanceSettingsPage({ user }) {
  // 1. Leemos el tema actual del navegador (o usamos 'light' por defecto)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('volunmatch-theme') || 'light';
  });

  const esEmpresa = user?.role === 'company';

  // 2. Función que cambia el tema y lo aplica al HTML
  function cambiarTema(nuevoTema) {
    setTheme(nuevoTema);
    localStorage.setItem('volunmatch-theme', nuevoTema);
    
    // ESTA ES LA LÍNEA MÁGICA QUE APLICA EL COLOR
    document.documentElement.setAttribute('data-theme', nuevoTema);
  }

  return (
    <section className="workspace-content appearance-settings">
      <div className="page-title appearance-settings__title">
        <div>
          <p className="section-kicker"><Palette size={14} /> PREFERENCIAS</p>
          <h1>Apariencia y tema</h1>
          <p>Personaliza la apariencia de VolunMatch para tu espacio de {esEmpresa ? 'empresa' : 'voluntariado'}.</p>
        </div>
      </div>

      <div className="appearance-card">
        <div className="appearance-card__heading">
          <div className="appearance-card__icon"><Palette size={19} /></div>
          <div>
            <h2>Tema de la aplicación</h2>
            <p>Elige cómo quieres ver VolunMatch. Puedes cambiar esta preferencia cuando quieras.</p>
          </div>
        </div>

        <div className="theme-options" role="radiogroup" aria-label="Tema de la aplicación">
          {opcionesTema.map(({ id, titulo, descripcion, Icono }) => (
            <button
              className={`theme-option ${theme === id ? 'theme-option--selected' : ''}`}
              type="button"
              key={id}
              onClick={() => cambiarTema(id)} // <-- LLAMAMOS A LA FUNCIÓN AQUÍ
            >
              <span className="theme-option__heading">
                <span className="theme-option__label"><Icono size={18} /> {titulo}</span>
                <span className="theme-option__check" aria-hidden="true">{theme === id && <Check size={14} />}</span>
              </span>
              <span className={`theme-preview theme-preview--${id}`} aria-hidden="true">
                <span className="theme-preview__sidebar"><i /><i /><i /></span>
                <span className="theme-preview__content">
                  <i />
                  <span><i /><i /></span>
                  <b />
                </span>
              </span>
              <span className="theme-option__description">{descripcion}</span>
            </button>
          ))}
        </div>

        <div className="appearance-actions">
          <span className="appearance-actions__status">
            <Check size={15} /> Tema {theme === 'dark' ? 'oscuro' : 'claro'} activo
          </span>
          <div className="appearance-actions__buttons">
            <button className="button button--ghost" type="button" onClick={() => cambiarTema('light')}>
              Restablecer valores
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}