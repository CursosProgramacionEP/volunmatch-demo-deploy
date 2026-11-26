/**
 * Muestra una métrica del panel de control con el lenguaje visual compartido de VolunMatch.
 *
 * @param {{icon: import('react').ElementType, label: string, value: string|number, highlight?: boolean}} props Configuración de la métrica.
 * @returns {JSX.Element} Tarjeta de estadística reutilizable.
 */
export function Stat({ icon: Icon, label, value, highlight }) {
  return (
    <article className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
      <span>
        <Icon size={22} />
      </span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </article>
  );
}
