/**
 * Botón reutilizable. "variant" cambia el estilo (primary, secondary, ghost, light)
 * e "icon" permite mostrar un ícono de lucide-react al final del texto.
 *
 * @param {{children: import('react').ReactNode, variant?: 'primary'|'secondary'|'ghost'|'light', className?: string, icon?: import('react').ElementType}} props Contenido, variante de estilo, clases adicionales e ícono opcional.
 * @returns {JSX.Element} Botón reutilizable con estilo e ícono opcional.
 */
export function Button({
  children,
  variant = "primary",
  className = "",
  icon: Icon,
  ...props
}) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {children}
      {Icon && <Icon size={17} strokeWidth={2.4} />}
    </button>
  );
}
