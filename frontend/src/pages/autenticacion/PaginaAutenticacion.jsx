import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  HeartHandshake,
  Leaf,
  Eye,
  EyeOff,
} from "lucide-react";
import { Brand } from "../../components/autenticacion/Marca.jsx";
import { Button } from "../../components/comunes/Boton.jsx";
import { Field } from "../../components/comunes/Campo.jsx";
import { ConfirmationModal } from "../../components/comunes/ModalConfirmacion.jsx";
import { api } from "../../services/cliente-api.js";
import { go } from "../../navigation/navegacion.js";
import { categories } from "../../constants/aplicacion.js";
import { AlertTriangle } from "lucide-react";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Gestiona acceso, registro y solicitud de recuperación de contraseña.
 * @param {{onAuthenticated: Function, showNotice: Function}} props Acciones que actualizan la sesión y los avisos.
 * @returns {JSX.Element} Pantalla de autenticación de VolunMatch.
 */
export function AuthPage({
  onAuthenticated,
  onPasswordReset = () => {},
  showNotice,
  route = "/auth",
}) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("volunteer");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [recoverySent, setRecoverySent] = useState(false);
  const [registrationConfirmOpen, setRegistrationConfirmOpen] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    bio: "",
    companyName: "",
    ruc: "",
    sector: "Medio ambiente",
    customSector: "",
    contactName: "",
  });

  const isRegister = mode === "register";
  const isRecovery = mode === "recovery";
  const resetToken = useMemo(
    () => new URLSearchParams(route.split("?")[1] || "").get("token") || "",
    [route],
  );
  const isReset = route.startsWith("/reset-password");

  useEffect(() => {
    const params = new URLSearchParams(route.split("?")[1] || "");
    const requestedMode = params.get("mode");
    const requestedRole = params.get("role");
    if (route.startsWith("/auth")) setMode(requestedMode === "register" ? "register" : "login");
    if (["volunteer", "company"].includes(requestedRole)) setRole(requestedRole);
  }, [route]);

  function update(event) {
    const { name, value } = event.target;
    const nextValue =
      name === "phone" ? value.replace(/\D/g, "").slice(0, 9) : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
    if (name === "email") setEmailError("");

    // AGREGAR ESTA LÍNEA:
    if (name === "password") {
      setFieldErrors((current) => ({
        ...current,
        password:
          nextValue.length > 0 && nextValue.length < 6
            ? "La contraseña debe tener al menos 6 caracteres."
            : "",
      }));
    } else {
      setFieldErrors((current) => ({
        ...current,
        [name]: liveFieldError(name, nextValue),
      }));
    }
    setError("");
  }

  function validateEmail() {
    const nextError = emailPattern.test(form.email.trim())
      ? ""
      : "Ingresa un correo electrónico válido.";
    setEmailError(nextError);
    return !nextError;
  }

  function validateRegistration() {
    const nextErrors = {};
    const required =
      role === "volunteer"
        ? ["fullName", "phone", "email", "password"]
        : ["companyName", "ruc", "contactName", "sector", "email", "password"];
    required.forEach((name) => {
      if (!String(form[name] || "").trim())
        nextErrors[name] = "Este campo es obligatorio.";
    });

    if (
      role === "company" &&
      form.sector === "Otro" &&
      !form.customSector.trim()
    ) {
      nextErrors.customSector = "Por favor, especifica tu sector.";
    }

    ["fullName", "contactName", "phone", "ruc"].forEach((name) => {
      const message = liveFieldError(name, form[name]);
      if (message) nextErrors[name] = message;
    });
    if (
      role === "volunteer" &&
      !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/.test(form.fullName.trim())
    ) {
      nextErrors.fullName =
        nextErrors.fullName || "El nombre debe tener al menos 3 letras.";
    }
    if (
      role === "company" &&
      !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/.test(form.contactName.trim())
    ) {
      nextErrors.contactName =
        nextErrors.contactName ||
        "El nombre del responsable debe tener al menos 3 letras.";
    }
    if (!emailPattern.test(form.email.trim()))
      nextErrors.email = "Ingresa un correo electrónico válido.";
    if (form.password.length < 6)
      nextErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    setEmailError(nextErrors.email || "");
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (isRegister) {
      if (!validateRegistration()) return;
      setRegistrationConfirmOpen(true);
      return;
    }
    if (!validateEmail()) return;
    await authenticate();
  }

  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      const response = await api.login({
        email: form.email,
        password: form.password,
        role,
      });
      onAuthenticated(response);
      showNotice({ text: "Sesión iniciada correctamente." });
      go(
        response.user.role === "company"
          ? "/company/dashboard"
          : "/volunteer/explore",
      );
      } catch (requestError) {
      //  Si el backend nos bloquea por muchos intentos, abrimos el modal
      if (requestError.message.includes('Demasiados intentos')) {
        setBlockedModalOpen(true);
      } else {
        setError(
          !isRegister &&
            requestError.message === "Correo o contraseña incorrectos."
            ? "Correo o contraseña incorrectos. Revisa tus datos y verifica que elegiste el perfil correcto."
            : requestError.message,
        );
      }
    } finally{
      setBusy(false);
    }
  }

  async function register() {
    setBusy(true);
    setError("");
    try {
      // 1. Armamos los datos con el sector correcto
      const finalFormData = {
        ...form,
        sector: form.sector === "Otro" ? form.customSector : form.sector,
      };

      // 2. Enviamos finalFormData
      const response = await api.register({ ...finalFormData, role });

      onAuthenticated(response);
      setRegistrationConfirmOpen(false);
      showNotice({ text: "Tu cuenta fue creada. ¡Bienvenido a VolunMatch!" });
      go(
        response.user.role === "company"
          ? "/company/dashboard"
          : "/volunteer/explore",
      );
    } catch (requestError) {
      setRegistrationConfirmOpen(false);
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRecovery(event) {
    event.preventDefault();
    if (!validateEmail()) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.recoverPassword({ email: form.email });
      if (response.emailDeliveryConfigured === false) {
        setError(response.message);
        return;
      }
      setRecoverySent(true);
      showNotice({ text: response.message });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setEmailError("");
    setFieldErrors({});
    setRecoverySent(false);
  }

  function generatePassword() {
    const groups = [
      "ABCDEFGHJKLMNPQRSTUVWXYZ",
      "abcdefghijkmnopqrstuvwxyz",
      "23456789",
      "!@#$%*-_",
    ];
    const allCharacters = groups.join("");
    const getRandomIndex = (limit) => {
      const random = new Uint32Array(1);
      const ceiling = Math.floor(0x100000000 / limit) * limit;
      do {
        globalThis.crypto.getRandomValues(random);
      } while (random[0] >= ceiling);
      return random[0] % limit;
    };
    const password = [
      ...groups.map((group) => group[getRandomIndex(group.length)]),
      ...Array.from(
        { length: 12 },
        () => allCharacters[getRandomIndex(allCharacters.length)],
      ),
    ];
    for (let index = password.length - 1; index > 0; index -= 1) {
      const swapIndex = getRandomIndex(index + 1);
      [password[index], password[swapIndex]] = [
        password[swapIndex],
        password[index],
      ];
    }
    setForm((current) => ({ ...current, password: password.join("") }));
    setFieldErrors((current) => ({ ...current, password: "" }));
    setError("");
  }

  return (
    <main className="auth-page">
      <div className="auth-page__top">
        <Brand />
        <button className="link-button" onClick={() => go("/")}>
          <ArrowLeft size={16} /> Volver al inicio
        </button>
      </div>

      <section className="auth-shell">
        <AuthAside />
        <div className="auth-panel">
          {isReset ? (
            <ResetPasswordForm
              token={resetToken}
              busy={busy}
              error={error}
              onSubmit={async (password) => {
                setBusy(true);
                setError("");
                try {
                  const response = await api.resetPassword({
                    token: resetToken,
                    password,
                  });
                  onPasswordReset();
                  showNotice({ text: response.message });
                  go("/auth");
                } catch (requestError) {
                  setError(requestError.message);
                } finally {
                  setBusy(false);
                }
              }}
              onBack={() => go("/auth")}
            />
          ) : isRecovery ? (
            <RecoveryForm
              form={form}
              busy={busy}
              error={error}
              emailError={emailError}
              recoverySent={recoverySent}
              onChange={update}
              onBlur={validateEmail}
              onSubmit={submitRecovery}
              onBack={() => changeMode("login")}
            />
          ) : (
            <>
              <div className="auth-panel__heading">
                <p className="section-kicker">
                  {isRegister ? "ÚNETE A LA RED" : "BIENVENIDO DE NUEVO"}
                </p>
                <h2>
                  {isRegister ? "Crea tu cuenta" : "Ingresa a VolunMatch"}
                </h2>
                <p>
                  {isRegister
                    ? "Elige el perfil que representa tu participación."
                    : "Accede para continuar con tus iniciativas y tareas."}
                </p>
              </div>

              <div
                className="role-toggle"
                role="tablist"
                aria-label="Tipo de cuenta"
              >
                <button
                  type="button"
                  className={role === "volunteer" ? "active" : ""}
                  onClick={() => setRole("volunteer")}
                >
                  <HeartHandshake size={17} /> Voluntario
                </button>
                <button
                  type="button"
                  className={role === "company" ? "active" : ""}
                  onClick={() => setRole("company")}
                >
                  <BriefcaseBusiness size={17} /> Empresa
                </button>
              </div>
              {!isRegister && (
                <p className="auth-role-help">
                  Ingresarás como{" "}
                  <b>{role === "volunteer" ? "voluntario" : "empresa"}</b>.
                  Selecciona el perfil con el que registraste tu cuenta.
                </p>
              )}

              <form className="auth-form" onSubmit={submit} noValidate>
                {isRegister && role === "volunteer" && (
                  <>
                    <Field
                      label="Nombre y apellidos"
                      name="fullName"
                      placeholder="Ej. Ana García"
                      value={form.fullName}
                      onChange={update}
                      error={fieldErrors.fullName}
                      required
                    />
                    <div className="field-row">
                      <Field
                        label="Teléfono"
                        name="phone"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={9}
                        placeholder="987654321"
                        value={form.phone}
                        onChange={update}
                        error={fieldErrors.phone}
                        hint="Lo usaremos automáticamente al postularte."
                        required
                      />
                      <Field
                        label="Correo electrónico"
                        name="email"
                        type="email"
                        placeholder="ana@correo.com"
                        value={form.email}
                        onChange={update}
                        onBlur={validateEmail}
                        error={emailError || fieldErrors.email}
                        required
                      />
                    </div>
                    <Field
                      label="Cuéntanos brevemente de ti"
                      name="bio"
                      as="textarea"
                      placeholder="Tus intereses o experiencia como voluntario..."
                      value={form.bio}
                      onChange={update}
                    />
                  </>
                )}

                {isRegister && role === "company" && (
                  <>
                    <div className="field-row">
                      <Field
                        label="Razón social"
                        name="companyName"
                        placeholder="Nombre de la empresa"
                        value={form.companyName}
                        onChange={update}
                        error={fieldErrors.companyName}
                        required
                      />
                      <Field
                        label="RUC"
                        name="ruc"
                        inputMode="numeric"
                        placeholder="20601234567"
                        value={form.ruc}
                        onChange={update}
                        error={fieldErrors.ruc}
                        required
                      />
                    </div>
                    <Field
                      label="Nombre de contacto"
                      name="contactName"
                      placeholder="Persona responsable"
                      value={form.contactName}
                      onChange={update}
                      error={fieldErrors.contactName}
                      required
                    />
                    <div className="field-row">
                      <Field
                        label="Sector"
                        name="sector"
                        as="select"
                        value={form.sector}
                        onChange={update}
                        options={categories.slice(1).concat("Otro")}
                        required
                      />
                      <Field
                        label="Correo corporativo"
                        name="email"
                        type="email"
                        placeholder="contacto@empresa.com"
                        value={form.email}
                        onChange={update}
                        onBlur={validateEmail}
                        error={emailError || fieldErrors.email}
                        required
                      />
                    </div>
                    {form.sector === "Otro" && (
                      <Field
                        label="Especifica tu sector"
                        name="customSector"
                        placeholder="Ej. Tecnología, Salud, Deportes..."
                        value={form.customSector}
                        onChange={update}
                        error={fieldErrors.customSector}
                        required
                      />
                    )}
                  </>
                )}

                {!isRegister && (
                  <Field
                    label="Correo electrónico"
                    name="email"
                    type="email"
                    placeholder={
                      role === "volunteer"
                        ? "ana@volunmatch.pe"
                        : "empresa@volunmatch.pe"
                    }
                    value={form.email}
                    onChange={update}
                    onBlur={validateEmail}
                    error={emailError || fieldErrors.email}
                    required
                  />
                )}

                <Field
                  label="Contraseña"
                  name="password"
                  type={showPassword ? "text" : "password"} // <-- Hace que cambie
                  iconRight={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  }
                  placeholder={
                    isRegister ? "Crea una contraseña" : "Tu contraseña"
                  }
                  hint={isRegister ? "Mínimo 6 caracteres." : ""}
                  value={form.password}
                  onChange={update}
                  error={fieldErrors.password}
                  required
                />
                {isRegister && (
                  <button
                    type="button"
                    className="password-generator"
                    onClick={generatePassword}
                  >
                    Generar contraseña segura
                  </button>
                )}

                {!isRegister && (
                  <button
                    type="button"
                    className="forgot-password"
                    onClick={() => changeMode("recovery")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="auth-form__submit"
                  icon={ArrowRight}
                  disabled={busy}
                >
                  {busy
                    ? "Procesando..."
                    : isRegister
                      ? `Crear cuenta de ${role === "volunteer" ? "voluntario" : "empresa"}`
                      : "Iniciar sesión"}
                </Button>
              </form>

              <p className="auth-switch">
                {isRegister
                  ? "¿Ya tienes una cuenta?"
                  : "¿Aún no tienes cuenta?"}{" "}
                <button
                  type="button"
                  onClick={() => changeMode(isRegister ? "login" : "register")}
                >
                  {isRegister ? "Inicia sesión" : "Regístrate"}
                </button>
              </p>
            </>
          )}
        </div>
      </section>
      
      {registrationConfirmOpen && (
        <ConfirmationModal
          title={`¿Crear cuenta de ${role === "volunteer" ? "voluntario" : "empresa"}?`}
          description={`Revisa que tus datos estén correctos. Crearás una cuenta como ${role === "volunteer" ? "voluntario" : "empresa"} en VolunMatch.`}
          confirmLabel="Sí, crear cuenta"
          busy={busy}
          onCancel={() => setRegistrationConfirmOpen(false)}
          onConfirm={register}
        />
      )}
            {/* 🚨 MODAL DE BLOQUEO REUTILIZANDO EL COMPONENTE DEL SISTEMA */}
      {blockedModalOpen && (
        <ConfirmationModal
          title="Acceso bloqueado temporalmente"
          description="Hemos detectado múltiples intentos de inicio de sesión fallidos. Por tu seguridad, hemos bloqueado el acceso durante 2 minutos. Intenta de nuevo más tarde."
          confirmLabel="Entendido"
           variant="danger"
           icon={AlertTriangle}
          // NO pasamos onCancel para que no salga el botón "Volver"
          onConfirm={() => setBlockedModalOpen(false)}
        />
      )}

    </main>
  );
}

/** Devuelve errores que deben aparecer mientras se escribe en campos con formato fijo. */
function liveFieldError(name, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (
    ["fullName", "contactName"].includes(name) &&
    !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(value)
  ) {
    return "Este nombre solo admite letras y espacios.";
  }
  if (name === "phone" && !/^\d{9}$/.test(value))
    return "El teléfono debe tener exactamente 9 dígitos.";
  if (name === "ruc" && !/^\d{11}$/.test(value))
    return "El RUC debe tener exactamente 11 números.";
  return "";
}

function AuthAside() {
  return (
    <aside className="auth-aside">
      <Brand inverse />
      <div className="auth-aside__content">
        <span className="eyebrow eyebrow--light">
          <Leaf size={14} /> ACCIONES QUE SUMAN
        </span>
        <h1>El cambio se organiza mejor en equipo.</h1>
        <p>
          Encuentra iniciativas, conecta con personas comprometidas y aporta
          desde tus habilidades.
        </p>
      </div>
      <div className="auth-aside__numbers">
        <div>
          <b>+1,200</b>
          <span>voluntarios</span>
        </div>
        <div>
          <b>86</b>
          <span>iniciativas activas</span>
        </div>
      </div>
      <div className="auth-aside__art">
        <span className="art-hill art-hill--one" />
        <span className="art-hill art-hill--two" />
        <span className="art-leaf art-leaf--one" />
        <span className="art-leaf art-leaf--two" />
      </div>
    </aside>
  );
}

function RecoveryForm({
  form,
  busy,
  error,
  emailError,
  recoverySent,
  onChange,
  onBlur,
  onSubmit,
  onBack,
}) {
  return (
    <>
      <div className="auth-panel__heading">
        <p className="section-kicker">RECUPERAR ACCESO</p>
        <h2>¿Olvidaste tu contraseña?</h2>
        <p>
          Ingresa el correo registrado y te enviaremos las instrucciones para
          restablecerla.
        </p>
      </div>
      {recoverySent ? (
        <div className="recovery-success" role="status">
          <b>Solicitud enviada.</b>
          <span>
            Si la dirección está registrada, recibirás un enlace válido por 5
            minutos.
          </span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={form.email}
            onChange={onChange}
            onBlur={onBlur}
            error={emailError}
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="auth-form__submit" disabled={busy}>
            {busy ? "Enviando..." : "Enviar enlace de recuperación"}
          </Button>
        </form>
      )}
      <p className="auth-switch">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={15} /> Volver al inicio de sesión
        </button>
      </p>
    </>
  );
}

/** Formulario que consume el token de un solo uso enviado al correo del usuario. */
function ResetPasswordForm({ token, busy, error, onSubmit, onBack }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!token)
      return setLocalError(
        "El enlace de recuperación es inválido o está incompleto.",
      );
    if (password.length < 6)
      return setLocalError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirmation)
      return setLocalError("Las contraseñas no coinciden.");
    setLocalError("");
    onSubmit(password);
  }

  function updatePassword(event) {
    setPassword(event.target.value);
    setLocalError("");
  }

  function updateConfirmation(event) {
    setConfirmation(event.target.value);
    setLocalError("");
  }

  return (
    <>
      <div className="auth-panel__heading">
        <p className="section-kicker">NUEVA CONTRASEÑA</p>
        <h2>Restablece tu acceso</h2>
        <p>Elige una contraseña nueva de al menos 6 caracteres.</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field
          label="Nueva contraseña"
          name="reset-password"
          type="password"
          placeholder="Escribe tu nueva contraseña"
          hint="Mínimo 6 caracteres."
          value={password}
          onChange={updatePassword}
          error={
            password && password.length < 6
              ? "La contraseña debe tener al menos 6 caracteres."
              : ""
          }
          required
        />
        <Field
          label="Confirmar nueva contraseña"
          name="reset-confirmation"
          type="password"
          placeholder="Vuelve a escribir la contraseña"
          value={confirmation}
          onChange={updateConfirmation}
          error={
            confirmation && confirmation !== password
              ? "Las contraseñas no coinciden."
              : ""
          }
          required
        />
        {(localError || error) && (
          <p className="form-error" role="alert">
            {localError || error}
          </p>
        )}
        <Button type="submit" className="auth-form__submit" disabled={busy}>
          {busy ? "Actualizando..." : "Guardar nueva contraseña"}
        </Button>
      </form>
      <p className="auth-switch">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={15} /> Volver al inicio de sesión
        </button>
      </p>
    </>
  );
}
