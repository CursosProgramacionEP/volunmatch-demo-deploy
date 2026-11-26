/**
 * Muestra el indicador de carga compartido que se utiliza mientras las páginas asíncronas recuperan datos.
 *
 * @param {{label?: string}} props Texto de estado accesible.
 * @returns {JSX.Element} Spinner centrado y etiqueta descriptiva.
 */
export function Loader({ label = "Cargando..." }) {
  return (
    <div className="loader">
      <span className="spinner" />
      {label}
    </div>
  );
}
