import { HeartHandshake } from "lucide-react";
import { go } from "../../navigation/navegacion.js";

/**
 * Muestra el logotipo y el nombre de VolunMatch. Al hacer clic, redirige al inicio.
 *
 * @param {{compact?: boolean, inverse?: boolean}} props Configuración del logotipo.
 * @returns {JSX.Element} Botón de marca reutilizable.
 */
export function Brand({ compact = false, inverse = false }) {
  // Logo + nombre de VolunMatch. Al hacer clic, vuelve al inicio.
  return (
    <button
      className={`brand ${inverse ? "brand--inverse" : ""}`}
      onClick={() => go("/")}
      aria-label="Ir al inicio de VolunMatch"
    >
      <span className="brand__mark">
        <HeartHandshake size={compact ? 20 : 24} strokeWidth={2.5} />
      </span>
      <span>VolunMatch</span>
    </button>
  );
}
