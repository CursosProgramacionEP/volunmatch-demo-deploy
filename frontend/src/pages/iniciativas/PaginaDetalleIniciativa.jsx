import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Leaf,
  MapPin,
  ShieldCheck,
  Users,
  UserRound,
  XCircle,
  Video,
} from "lucide-react";
import { Loader } from "../../components/comunes/Cargador.jsx";
import { EmptyState } from "../../components/comunes/EstadoVacio.jsx";
import { Button } from "../../components/comunes/Boton.jsx";
import { Field } from "../../components/comunes/Campo.jsx";
import { Modal } from "../../components/comunes/VentanaModal.jsx";
import { api } from "../../services/cliente-api.js";
import { go } from "../../navigation/navegacion.js";
import { formatInitiativeDate } from "../../utils/fechas.js";
import { backendUrlWithVersion } from "../../services/urls.js";

const initialForm = (user) => ({
  fullName: user.fullName || "",
  email: user.email || "",
  phone: String(user.phone || "")
    .replace(/\D/g, "")
    .slice(0, 9),
  schedule: "Mañana (08:00 AM - 12:00 PM)",
  saturday: true,
  sunday: false,
  motivation: "",
  experience: "",
  shirtSize: "M",
  restrictions: "",
  acceptedTerms: false,
});

const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{9}$/;

function applicationFieldError(name, value) {
  const normalized = String(value || "").trim();
  if (name === "fullName") {
    if (!normalized) return "Ingresa tu nombre completo.";
    return namePattern.test(normalized)
      ? ""
      : "El nombre solo admite letras y espacios (mínimo 3 letras).";
  }
  if (name === "email") {
    if (!normalized) return "Ingresa tu correo electrónico.";
    return emailPattern.test(normalized)
      ? ""
      : "Ingresa un correo electrónico válido.";
  }
  if (name === "phone") {
    if (!normalized) return "Ingresa tu teléfono o WhatsApp.";
    return phonePattern.test(normalized)
      ? ""
      : "Ingresa exactamente 9 dígitos, sin espacios ni símbolos.";
  }
  if (name === "motivation") {
    return normalized ? "" : "Cuéntanos tu motivación para postular.";
  }
  return "";
}

export function InitiativeDetailPage({
  token,
  user,
  initiativeId,
  showNotice,
}) {
  const [initiative, setInitiative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("detail");
  const [form, setForm] = useState(() => initialForm(user));
  const [applicationErrors, setApplicationErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [yaPostulado, setYaPostulado] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user.fullName || "",
      email: current.email || user.email || "",
      phone:
        current.phone ||
        String(user.phone || "")
          .replace(/\D/g, "")
          .slice(0, 9),
    }));
  }, [user.email, user.fullName, user.phone]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setInitiative(null);
    setYaPostulado(false);
    Promise.all([
      api.initiative(token, initiativeId),
      api
        .verificarPostulacion(token, initiativeId)
        .catch(() => ({ yaPostulado: false })),
    ])
      .then(([initiativeRes, verificacionRes]) => {
        setInitiative(initiativeRes.initiative);
        if (verificacionRes.yaPostulado) {
          setYaPostulado(true);
        }
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token, initiativeId]);

  function updateForm({ target }) {
    const value =
      target.type === "checkbox"
        ? target.checked
        : target.name === "phone"
          ? target.value.replace(/\D/g, "").slice(0, 9)
          : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
    setApplicationErrors((current) => {
      const next = { ...current };
      if (["fullName", "email", "phone", "motivation"].includes(target.name)) {
        next[target.name] = applicationFieldError(target.name, value);
      }
      if (target.name === "saturday" || target.name === "sunday") {
        const otherDay =
          target.name === "saturday" ? form.sunday : form.saturday;
        next.days =
          value || otherDay ? "" : "Selecciona por lo menos un día disponible.";
      }
      if (target.name === "acceptedTerms") {
        next.acceptedTerms = value
          ? ""
          : "Debes aceptar los lineamientos para continuar.";
      }
      return next;
    });
  }

  function validateApplication() {
    const nextErrors = {
      fullName: applicationFieldError("fullName", form.fullName),
      email: applicationFieldError("email", form.email),
      phone: applicationFieldError("phone", form.phone),
      motivation: applicationFieldError("motivation", form.motivation),
      days:
        form.saturday || form.sunday
          ? ""
          : "Selecciona por lo menos un día disponible.",
      acceptedTerms: form.acceptedTerms
        ? ""
        : "Debes aceptar los lineamientos para continuar.",
    };
    setApplicationErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!validateApplication()) return;
    setBusy(true);
    try {
      await api.apply(token, initiative.id, form);
      setInitiative((current) => ({
        ...current,
        applicationStatus: "pending",
      }));
      setYaPostulado(true);
      setStep("success");
    } catch (requestError) {
      showNotice({ type: "error", text: requestError.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="workspace-content">
        <Loader />
      </section>
    );
  if (error || !initiative)
    return (
      <section className="workspace-content">
        <EmptyState
          title="No pudimos abrir esta iniciativa"
          text={error || "Vuelve a explorar las iniciativas disponibles."}
          action={() => go(user.role === "company" ? "/company/dashboard" : "/volunteer/explore")}
        />
      </section>
    );

  const canBoard =
    initiative.isMember ||
    initiative.applicationStatus === "accepted" ||
    (user.role === "company" && initiative.companyId === user.id);
  const available = Math.max(initiative.quota - initiative.joinedCount, 0);
  const isCancelled = initiative.status === "cancelled";
  const isOwner = user.role === "company" && initiative.companyId === user.id;
  const acceptedMembers = initiative.members || [];

  const isVirtual = initiative.modalidad?.toLowerCase() === "virtual";
  const canAccessVirtualMeeting =
    isVirtual &&
    Boolean(initiative.meetingUrl) &&
    (canBoard ||
      (user.role === "company" && initiative.companyId === user.id));

  if (step === "form")
    return (
      <ApplicationForm
        initiative={initiative}
        available={available}
        form={form}
        errors={applicationErrors}
        busy={busy}
        onChange={updateForm}
        onSubmit={submitApplication}
        onCancel={() => setStep("detail")}
      />
    );

  return (
    <section className="workspace-content initiative-detail">
      <button
        className="back-link"
        onClick={() =>
          go(
            user.role === "company"
              ? "/company/dashboard"
              : "/volunteer/explore",
          )
        }
      >
        <ArrowLeft size={18} /> Regresar
      </button>
      <article className="initiative-detail__card">
        <header>
          <div>
            {user.role === "volunteer" ? (
              <button
                className="company-profile-link"
                onClick={() => go(`/company/profile/${initiative.companyId}`)}
              >
                <Building2 size={15} /> Empresa: {initiative.companyName}
              </button>
            ) : (
              <p className="company-label">Empresa: {initiative.companyName}</p>
            )}
            <h1>{initiative.title}</h1>
          </div>
          <span className="category-chip">{initiative.category}</span>
        </header>
        <div className="initiative-detail__content">
          <div>
            <section>
              <h2>Información básica</h2>
              <p className="info-panel">{initiative.summary}</p>
              <div className="info-lines">
                <span>
                  <CalendarDays size={20} />
                  Inicio: {formatInitiativeDate(initiative.date)}
                </span>

                <span>
                  <CalendarRange size={20} />
                  Finaliza: {formatInitiativeDate(initiative.endDate)}
                </span>

                <span>
                  {isVirtual ? <Video size={20} /> : <MapPin size={20} />}
                  Modalidad:{" "}
                  <b style={{ textTransform: "capitalize" }}>
                    {initiative.modalidad || "presencial"}
                  </b>
                </span>

                {isVirtual ? (
                  <div className="initiative-detail__virtual-info">
                    <span>
                      <Clock3 size={20} /> Horario: {initiative.schedule || "Por definir"}
                    </span>
                    {canAccessVirtualMeeting ? (
                      <a
                        href={initiative.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--primary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          textDecoration: "none",
                        }}
                      >
                        <Video size={18} /> Unirse a la reunión virtual
                      </a>
                    ) : (
                      <span>
                        <Clock3 size={20} /> El enlace se habilitará cuando la
                        empresa acepte tu postulación.
                      </span>
                    )}
                  </div>
                ) : (
                  <span>
                    <MapPin size={20} />
                    Lugar: {initiative.location}
                  </span>
                )}
              </div>
            </section>
            <section>
              <h2>Requisitos</h2>
              <ul className="requirements">
                {initiative.requirements.map((requirement) => (
                  <li key={requirement}>
                    <CheckCircle2 size={17} />
                    {requirement}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div>
            <div
              className={`detail-visual cover--${initiative.cover}`}
              style={{ position: "relative", overflow: "hidden" }}
            >
              {initiative.imagen ? (
                <img
                  src={initiative.imagen}
                  alt={initiative.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                />
              ) : (
                <>
                  <div className="cover-art">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="detail-visual__caption">
                    <Leaf size={28} /> Acciones que dejan huella
                  </span>
                </>
              )}
            </div>
            <p className="detail-capacity">
              <Users size={16} /> {available} cupos disponibles
            </p>
          </div>
        </div>
        {isOwner && (
          <section className="participants-access" aria-label="Participantes aceptados">
            <div>
              <p className="section-kicker">EQUIPO CONFIRMADO</p>
              <h2>Participantes de la iniciativa</h2>
              <p>Consulta a las personas que ya tienen un cupo confirmado.</p>
            </div>
            <Button variant="secondary" onClick={() => setParticipantsOpen(true)} icon={Users}>
              Ver participantes ({acceptedMembers.length})
            </Button>
          </section>
        )}
        <footer>
          {isCancelled ? (
            <span className="initiative-cancelled">
              <XCircle size={17} /> Iniciativa cancelada
            </span>
          ) : canBoard ? (
            <Button
              onClick={() => go(`/kanban/${initiative.id}`)}
              icon={ArrowRight}
            >
              Ir al tablero Kanban
            </Button>
          ) : yaPostulado || initiative.applicationStatus === "pending" ? (
            <Button disabled variant="secondary">
              <Clock3 size={17} /> Pendiente
            </Button>
          ) : user.role === "volunteer" ? (
            <Button onClick={() => setStep("form")} icon={HeartHandshake}>
              Postularse
            </Button>
          ) : null}
        </footer>
      </article>
      {step === "success" && (
        <SuccessModal
          initiative={initiative}
          form={form}
          onClose={() => setStep("detail")}
        />
      )}
      {participantsOpen && <ParticipantsModal members={acceptedMembers} onClose={() => setParticipantsOpen(false)} />}
    </section>
  );
}

function ParticipantsModal({ members, onClose }) {
  return (
    <Modal onClose={onClose}>
      <section className="participants-modal" aria-labelledby="participants-modal-title">
        <p className="section-kicker">EQUIPO CONFIRMADO</p>
        <h2 id="participants-modal-title">Participantes aceptados</h2>
        <p className="participants-modal__lead">Estas personas ya cuentan con un cupo en la iniciativa.</p>
        {members.length ? (
          <ul className="participants-modal__list">
            {members.map((member) => (
              <li key={member.id} className="participants-modal__item">
                <span className="participants-modal__avatar">
                  {member.photoUrl ? (
                    <img src={backendUrlWithVersion(member.photoUrl)} alt={`Foto de ${member.fullName || "Voluntario"}`} />
                  ) : (
                    String(member.fullName || "Voluntario").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")
                  )}
                </span>
                <span className="participants-modal__info">
                  <b>{member.fullName || "Voluntario"}</b>
                  <small>{member.email}</small>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="participants-modal__profile"
                  onClick={() => {
                    onClose();
                    go(`/volunteer/profile/${member.id}`);
                  }}
                  icon={UserRound}
                >
                  Ver perfil
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="participants-modal__empty"><Users size={20} /> Aún no hay participantes aceptados.</div>
        )}
      </section>
    </Modal>
  );
}

function ApplicationForm({
  initiative,
  available,
  form,
  errors,
  busy,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section className="workspace-content application-page">
      <button className="back-link" onClick={onCancel}>
        <ArrowLeft size={18} /> Volver a iniciativa
      </button>
      <header className="application-page__head">
        <div>
          <span className="category-chip category-chip--soft">
            {initiative.category}
          </span>
          <h1>Postulación: {initiative.title}</h1>
          <p>
            Completa tus datos para enviar tu postulación a{" "}
            {initiative.companyName}.
          </p>
        </div>
        <span className="capacity-chip">
          <i /> {available} cupos restantes disponibles
        </span>
      </header>
      <div className="application-layout">
<form className="application-form" onSubmit={onSubmit} noValidate>          <FormSection
            number="1"
            title="Datos personales y de contacto"
            text="Información vinculada a tu cuenta para esta postulación."
          >
            <Field
              label="Nombre completo"
              name="fullName"
              value={form.fullName}
              onChange={onChange}
              error={errors.fullName}
              readOnly
              required
            />
            <div className="form-grid">
              <Field
                label="Correo electrónico"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                error={errors.email}
                readOnly
                required
              />
              <Field
                label="Teléfono / WhatsApp de tu cuenta"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={9}
                minLength={9}
                value={form.phone}
                readOnly
                placeholder="Regístralo en tu perfil"
                error={errors.phone}
                required
              />
            </div>
          </FormSection>
          <FormSection
            number="2"
            title="Disponibilidad horaria"
            text="Selecciona el turno y los días en que te comprometes a participar."
          >
            <div className="schedule-options">
              {[
                "Mañana (08:00 AM - 12:00 PM)",
                "Tarde (02:00 PM - 06:00 PM)",
              ].map((option) => (
                <label
                  className={`schedule-option ${form.schedule === option ? "selected" : ""}`}
                  key={option}
                >
                  <input
                    type="radio"
                    name="schedule"
                    value={option}
                    checked={form.schedule === option}
                    onChange={onChange}
                  />
                  <b>
                    Turno {option.startsWith("Mañana") ? "mañana" : "tarde"}
                  </b>
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <p className="form-label">
              Días disponibles para la jornada inicial
            </p>
            <div
              className={`day-options ${errors.days ? "day-options--invalid" : ""}`}
              role="group"
              aria-label="Días disponibles"
            >
              <label>
                <input
                  type="checkbox"
                  name="saturday"
                  checked={form.saturday}
                  onChange={onChange}
                />{" "}
                Sábado
              </label>
              <label>
                <input
                  type="checkbox"
                  name="sunday"
                  checked={form.sunday}
                  onChange={onChange}
                />{" "}
                Domingo
              </label>
            </div>
            {errors.days && (
              <small className="field-error" role="alert">
                {errors.days}
              </small>
            )}
          </FormSection>
          <FormSection
            number="3"
            title="Motivación y experiencia"
            text="Cuéntale a la organización tus motivaciones para unirte."
          >
            <Field
              label="¿Por qué te gustaría participar en esta iniciativa?"
              as="textarea"
              name="motivation"
              value={form.motivation}
              onChange={onChange}
              placeholder="Comparte brevemente tu motivación..."
              error={errors.motivation}
              required
            />
            <label className="field">
              <span>
                ¿Tienes experiencia previa en voluntariados similares?
                (Opcional)
              </span>
              <textarea
                name="experience"
                value={form.experience}
                onChange={onChange}
                placeholder="Menciona si participaste antes en actividades similares."
              />
            </label>
          </FormSection>
          <FormSection
            number="4"
            title="Logística y requerimientos"
            text="Esta información ayuda a preparar tu jornada de voluntariado."
          >
            <div className="form-grid">
              <label className="field">
                <span>Talla de camiseta / polo</span>
                <select
                  name="shirtSize"
                  value={form.shirtSize}
                  onChange={onChange}
                >
                  {["XS", "S", "M", "L", "XL"].map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Restricción dietética o médica</span>
                <input
                  name="restrictions"
                  value={form.restrictions}
                  onChange={onChange}
                  placeholder="Ej. vegetariano, alergias..."
                />
              </label>
            </div>
            <label
              className={`terms-check ${errors.acceptedTerms ? "terms-check--invalid" : ""}`}
            >
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={form.acceptedTerms}
                onChange={onChange}
              />
              <span>
                <em aria-hidden="true">*</em> He leído y acepto los{" "}
                <b>lineamientos de participación y código de conducta</b>. Me
                comprometo a asistir puntualmente al turno confirmado.
              </span>
            </label>
            {errors.acceptedTerms && (
              <small className="field-error" role="alert">
                {errors.acceptedTerms}
              </small>
            )}
          </FormSection>
          <footer className="application-form__footer">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" icon={ArrowRight} disabled={busy}>
              {busy ? "Enviando..." : "Enviar postulación"}
            </Button>
          </footer>
        </form>
        <InitiativeSummary initiative={initiative} />
      </div>
    </section>
  );
}

function FormSection({ number, title, text, children }) {
  return (
    <section className="application-form__section">
      <header>
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function InitiativeSummary({ initiative }) {
  return (
    <aside className="application-summary">
      <div className={`application-summary__cover cover--${initiative.cover}`}>
        <div className="cover-art">
          <i />
          <i />
          <i />
        </div>
        <span>{initiative.category}</span>
      </div>
      <div className="application-summary__body">
        <p>Iniciativa seleccionada</p>
        <h2>{initiative.title}</h2>
        <small>
          Empresa organizadora: <b>{initiative.companyName}</b>
        </small>
        <hr />
        <div>
          <CalendarDays size={16} />
          <span>
            <small>Inicio</small>
            {formatInitiativeDate(initiative.date)}
          </span>
        </div>
        <div>
          <CalendarRange size={16} />
          <span>
            <small>Fin</small>
            {formatInitiativeDate(initiative.endDate)}
          </span>
        </div>
        <div>
          <MapPin size={16} />
          <span>
            <small>Lugar</small>
            {initiative.location}
          </span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>
            <small>Certificación</small>Horas válidas de voluntariado
          </span>
        </div>
      </div>
    </aside>
  );
}

function SuccessModal({ initiative, form, onClose }) {
  const days = [form.saturday && "Sábado", form.sunday && "Domingo"]
    .filter(Boolean)
    .join(" y ");
  return (
    <Modal onClose={onClose}>
      <div className="success-modal success-modal--application">
        <span className="success-icon">
          <CheckCircle2 size={34} />
        </span>
        <h2>¡Te has registrado correctamente!</h2>
        <p>
          Tu postulación a <b>{initiative.title}</b> ha sido recibida con éxito.
          Podrás revisar el estado de tu solicitud desde Mis actividades.
        </p>
        <div className="success-details">
          <span>
            Turno seleccionado <b>{form.schedule}</b>
          </span>
          <span>
            Días <b>{days}</b>
          </span>
          <span>
            Organización <b>{initiative.companyName}</b>
          </span>
        </div>
        <div className="success-actions">
          <Button onClick={() => go("/volunteer/activities")} icon={ArrowRight}>
            Ir a mis actividades
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Ver detalles
          </Button>
        </div>
      </div>
    </Modal>
  );
}
