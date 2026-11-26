import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Campo reutilizable con etiqueta, obligatoriedad, ayuda, error y control de visibilidad de contraseña.
 * Compatible con input, select o textarea.
 *
 * @param {{label: string, as?: 'input'|'select'|'textarea', options?: string[], error?: string, hint?: string, required?: boolean}} props Configuración del campo de formulario.
 * @returns {JSX.Element} Campo de formulario accesible y consistente.
 */
export function Field({
  label,
  as = "input",
  options = [],
  error = "",
  hint = "",
  required = false,
  ...props
}) {
  const Element = as;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = props.type === "password";
  const commonProps = {
    ...props,
    required,
    "aria-invalid": Boolean(error),
  };

  return (
    <label className={`field ${error ? "field--invalid" : ""}`}>
      <span>
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      {as === "select" ? (
        <select {...commonProps}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : isPassword ? (
        <span className="password-control">
          <input {...commonProps} type={showPassword ? "text" : "password"} />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      ) : (
        <Element {...commonProps} />
      )}
      {hint && <small className="field-hint">{hint}</small>}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
