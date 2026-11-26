import { useState } from "react";
import { ArrowLeft, Calendar, Plus, Send, Sparkles, X, Image as ImageIcon, Eye, Trash2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { es } from "date-fns/locale";
import { Button } from "../../components/comunes/Boton.jsx";
import { Field } from "../../components/comunes/Campo.jsx";
import { ConfirmationModal } from "../../components/comunes/ModalConfirmacion.jsx";
import { api } from "../../services/cliente-api.js";
import { go } from "../../navigation/navegacion.js";
import { categories } from "../../constants/aplicacion.js";
import { ModalSugerenciasTareas } from "../tablero/ModalSugerenciasTareas.jsx";
import { Modal } from "../../components/comunes/VentanaModal.jsx";

const lettersPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,80}$/;

function wordCount(value) {
  const text = String(value || "").trim();
  return text ? text.split(/\s+/).length : 0;
}

function emptyTask() { return { title: "", description: "", area: "", priority: "Media" }; }
function toISOString(date) {
  if (!date) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function validateTask(task) {
  return {
    title: task.title.trim() ? "" : "El nombre de la tarea es obligatorio.",
    area: task.area.trim() ? "" : "El área es obligatoria.",
    description: task.description.trim() ? "" : "Describe qué debe realizarse.",
    priority: task.priority ? "" : "Selecciona una prioridad.",
  };
}

export function NewInitiativePage({ token, showNotice }) {
  const [form, setForm] = useState({
    title: "", category: "Medio ambiente", summary: "", date: "", endDate: "",
    location: "", quota: "", requirements: [""], tasks: [emptyTask()],
    modalidad: "presencial",
    meetingUrl: "",
    startTime: "",
    endTime: "",
  });

  const [imagen, setImagen] = useState(null);
  const [verImagen, setVerImagen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  function handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setImagen(reader.result); };
    reader.readAsDataURL(file);
  }

  function fieldError(name, value, current = form) {
    const text = String(value || "").trim();
    if (name === "title") {
      if (!text) return "El nombre de la iniciativa es obligatorio.";
      if (text.length > 80) return "El nombre puede tener como máximo 80 caracteres.";
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(text)) return "No se permiten números ni símbolos en este nombre.";
      if (!lettersPattern.test(text)) return "Escribe al menos 3 letras.";
    }
    if (name === "summary" && !text) return "Describe el objetivo de la iniciativa.";
    if (name === "summary" && wordCount(text) > 80)
      return "La descripción puede tener como máximo 80 palabras.";
    if (name === "location" && current.modalidad === "presencial" && !text)
      return "Indica el lugar de la actividad.";
    if (name === "meetingUrl" && current.modalidad === "virtual") {
      if (!text) return "Ingresa el enlace de la reunión virtual.";
      try {
        const url = new URL(text);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        return "Escribe un enlace válido que empiece con http:// o https://.";
      }
    }
    if (name === "startTime" && current.modalidad === "virtual") {
      if (!text) return "Indica la hora de inicio.";
      if (current.endTime && text >= current.endTime) return "La hora de inicio debe ser anterior a la de fin.";
    }
    if (name === "endTime" && current.modalidad === "virtual") {
      if (!text) return "Indica la hora de fin.";
      if (current.startTime && text <= current.startTime) return "La hora de fin debe ser posterior a la de inicio.";
    }
    if (name === "quota") {
      if (!text) return "Indica el cupo de voluntarios.";
      if (!Number.isInteger(Number(text)) || Number(text) <= 0) return "El cupo debe ser un número entero mayor que cero.";
    }
    if (name === "date" && !value) return "Selecciona la fecha de inicio.";
    if (name === "endDate") {
      if (!value) return "Selecciona la fecha de fin.";
      if (current.date && value < current.date) return "La fecha de fin debe ser igual o posterior a la de inicio.";
    }
    return "";
  }

  function update(event) {
    const { name, value } = event.target;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    setErrors((current) => ({ ...current, [name]: ["title", "summary"].includes(name) ? fieldError(name, value, nextForm) : "" }));
    setError("");
    setSuggestionError("");
  }

  function validateField(name) { setErrors((current) => ({ ...current, [name]: fieldError(name, form[name]) })); }

  function updateDate(name, value) {
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    setErrors((current) => ({ ...current, [name]: fieldError(name, value, nextForm), ...(name === "date" ? { endDate: nextForm.endDate ? fieldError("endDate", nextForm.endDate, nextForm) : current.endDate } : {}) }));
  }

  function updateTask(index, field, value) {
    const nextTasks = form.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, [field]: value } : task);
    setForm((current) => ({ ...current, tasks: nextTasks }));
    setErrors((current) => ({ ...current, tasks: current.tasks?.map((taskErrors, taskIndex) => taskIndex === index ? { ...taskErrors, [field]: "" } : taskErrors) }));
    setError("");
  }

  function validateTaskField(index, field) {
    const message = validateTask(form.tasks[index])[field];
    setErrors((current) => ({ ...current, tasks: form.tasks.map((task, taskIndex) => taskIndex === index ? { ...(current.tasks?.[taskIndex] || {}), [field]: message } : current.tasks?.[taskIndex] || {}) }));
  }

  function updateRequirement(index, value) {
    setForm((current) => ({ ...current, requirements: current.requirements.map((item, itemIndex) => itemIndex === index ? value : item) }));
    setErrors((current) => ({ ...current, requirementItems: (current.requirementItems || []).map((item, itemIndex) => itemIndex === index ? "" : item) }));
  }

  function validateRequirement(index) {
    const message = form.requirements[index].trim() ? "" : "El requisito es obligatorio.";
    setErrors((current) => ({ ...current, requirementItems: form.requirements.map((item, itemIndex) => itemIndex === index ? message : current.requirementItems?.[itemIndex] || "") }));
  }

  const addRequirement = () => setForm((current) => ({ ...current, requirements: [...current.requirements, ""] }));
  const removeRequirement = (index) => { if (form.requirements.length === 1) return; setForm((current) => ({ ...current, requirements: current.requirements.filter((_, itemIndex) => itemIndex !== index) })); };
  const addTaskAfter = (index) => setForm((current) => ({
    ...current,
    tasks: [...current.tasks.slice(0, index + 1), emptyTask(), ...current.tasks.slice(index + 1)],
  }));
  const removeTask = (index) => { if (form.tasks.length === 1) return; setForm((current) => ({ ...current, tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index) })); };

  async function requestTaskSuggestions() {
    if (!form.title.trim() || !form.summary.trim()) {
      const message = "Primero completa el nombre y el objetivo/descripción de la iniciativa para recibir tareas relacionadas.";
      setSuggestionError(message);
      throw new Error(message);
    }
    setSuggesting(true);
    setSuggestionError("");
    try {
      const response = await api.suggestTasks(token, {
        initiative: { title: form.title, category: form.category, summary: form.summary },
        existingTasks: form.tasks.filter((task) => task.title.trim()).map((task) => ({ title: task.title })),
      });
      setSuggestions(response.tasks);
    } finally { setSuggesting(false); }
  }

  async function openTaskSuggestions() {
    try { await requestTaskSuggestions(); } catch (requestError) { setSuggestionError(requestError.message); }
  }

  function addSuggestedTasks(tasks) {
    if (!tasks.length) return;
    setForm((current) => ({ ...current, tasks: [...current.tasks.filter((task) => task.title.trim() || task.description.trim() || task.area.trim()), ...tasks] }));
    setSuggestions(null);
  }

  function validate() {
    const nextErrors = {
      title: fieldError("title", form.title), summary: fieldError("summary", form.summary), location: fieldError("location", form.location), meetingUrl: fieldError("meetingUrl", form.meetingUrl), startTime: fieldError("startTime", form.startTime), endTime: fieldError("endTime", form.endTime), quota: fieldError("quota", form.quota), date: fieldError("date", form.date), endDate: fieldError("endDate", form.endDate),
      requirementItems: form.requirements.map((item) => item.trim() ? "" : "El requisito es obligatorio."),
      tasks: form.tasks.map(validateTask),
    };
    setErrors(nextErrors);
    const hasTaskErrors = nextErrors.tasks.some((task) => Object.values(task).some(Boolean));
    const hasRequirementErrors = nextErrors.requirementItems.some(Boolean);
    return !hasTaskErrors && !hasRequirementErrors && !["title", "summary", "location", "meetingUrl", "startTime", "endTime", "quota", "date", "endDate"].some((name) => nextErrors[name]);
  }

  function requestPublication(event) {
    event.preventDefault();
    if (!validate()) { setError("Completa todos los campos obligatorios marcados con * antes de continuar."); return; }
    setConfirmOpen(true);
  }

  async function createInitiative() {
    setBusy(true);
    setError("");
    try {
      const response = await api.createInitiative(token, { ...form, imagen: imagen, date: toISOString(form.date), endDate: toISOString(form.endDate) });
      setConfirmOpen(false);
      showNotice({ text: "Iniciativa publicada correctamente." });
      go(`/initiative/${response.initiative.id}`);
    } catch (requestError) {
      setConfirmOpen(false);
      setError(requestError.message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <section className="workspace-content new-initiative">
        <button className="back-link" onClick={() => go("/company/dashboard")}><ArrowLeft size={18} /> Volver a mis iniciativas</button>
        <div className="form-page-head">
          <p className="section-kicker">NUEVA CONVOCATORIA</p>
          <h1>Publica una iniciativa</h1>
          <p>Los campos marcados con <b>*</b> son obligatorios. Añade al menos una tarea para organizar el trabajo inicial.</p>
        </div>

        <form className="initiative-form" onSubmit={requestPublication} noValidate>
          <section>
            <h2>Información de la iniciativa</h2>
            <div style={{ marginBottom: "1.5rem", marginTop: "1rem" }}>
              <span style={{ display: "block", fontWeight: "600", fontSize: "0.9rem", marginBottom: "0.5rem", color: "#374151" }}>Imagen de portada</span>
              <div style={{ border: "2px dashed #d1d5db", borderRadius: "8px", padding: "1.5rem", textAlign: "center", backgroundColor: "#f9fafb", position: "relative" }}>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} id="new-file-upload" />
                {!imagen ? (
                  <label htmlFor="new-file-upload" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", color: "#6b7280" }}>
                    <div style={{ backgroundColor: "#e8f5e9", padding: "8px", borderRadius: "50%", color: "#2e7d32" }}><ImageIcon size={20} /></div>
                    <div><span style={{ color: "#2e7d32", fontWeight: "600" }}>Haz clic aquí</span> para subir una imagen</div>
                    <span style={{ fontSize: "0.8rem" }}>PNG, JPG o JPEG (Máx. 2MB)</span>
                  </label>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "#374151" }}>Hemos subido tu archivo</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#e9f1e8", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e9f1e8", width: "100%", boxSizing: "border-box", textAlign: "left" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: "600", fontSize: "0.85rem", color: "#1f2937" }}>imagen-iniciativa.jpg</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>Imagen cargada correctamente</p>
                      </div>
                      <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                        <button type="button" onClick={() => setVerImagen(true)} style={{ background: "none", border: "none", color: "#3d6b2b", cursor: "pointer", display: "flex", padding: 0 }} title="Ver imagen"><Eye size={20} /></button>
                        <button type="button" onClick={() => setImagen("")} style={{ background: "none", border: "none", color: "#3d6b2b", cursor: "pointer", display: "flex", padding: 0 }} title="Eliminar imagen"><Trash2 size={20} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="new-initiative__countable-field">
              <Field label="Nombre de la iniciativa" name="title" maxLength={80} placeholder="Ej. Jornada de limpieza comunitaria" value={form.title} onChange={update} onBlur={() => validateField("title")} error={errors.title} required />
              <small className="field-counter">{form.title.length}/80 caracteres</small>
            </div>
            <div className="form-grid">
              <Field label="Categoría" name="category" as="select" value={form.category} onChange={update} options={categories.slice(1)} required />
              <Field label="Cupo de voluntarios" name="quota" type="number" min="1" placeholder="Ej. 25" value={form.quota} onChange={update} onBlur={() => validateField("quota")} error={errors.quota} required />
            </div>

            <div className="form-grid new-initiative__modality">
              <Field label="Modalidad" name="modalidad" as="select" value={form.modalidad} onChange={update} options={["presencial", "virtual"]} required />
              {form.modalidad === "presencial" ? (
                <Field label="Lugar" name="location" placeholder="Ej. Parque Zonal, distrito" value={form.location} onChange={update} onBlur={() => validateField("location")} error={errors.location} required />
              ) : (
                <Field label="Enlace de reunión virtual" name="meetingUrl" type="url" placeholder="https://meet.google.com/..." value={form.meetingUrl} onChange={update} onBlur={() => validateField("meetingUrl")} error={errors.meetingUrl}  required />
              )}
            </div>
            {form.modalidad === "virtual" && (
              <div className="form-grid">
                <Field label="Hora de inicio" name="startTime" type="time" value={form.startTime} onChange={update} onBlur={() => validateField("startTime")} error={errors.startTime} required />
                <Field label="Hora de fin" name="endTime" type="time" min={form.startTime || undefined} value={form.endTime} onChange={update} onBlur={() => validateField("endTime")} error={errors.endTime} required />
              </div>
            )}

            <div className="new-initiative__countable-field">
              <Field label="Objetivo y descripción" name="summary" as="textarea" placeholder="Describe el propósito de la iniciativa..." value={form.summary} onChange={update} onBlur={() => validateField("summary")} error={errors.summary} required />
              <small className="field-counter">{wordCount(form.summary)}/80 palabras</small>
            </div>

            <h2 className="new-initiative__subheading">Fecha</h2>
            <div className="form-grid">
              <DateField label="Inicio de la iniciativa" value={form.date} error={errors.date} onChange={(value) => updateDate("date", value)} onBlur={() => validateField("date")} />
              <DateField label="Fin de la iniciativa" value={form.endDate} error={errors.endDate} onChange={(value) => updateDate("endDate", value)} onBlur={() => validateField("endDate")} />
            </div>
          </section>

          <section>
            <div className="form-section-head">
              <div><h2>Requisitos <em>*</em></h2><p>Indica al menos un requisito para participar.</p></div>
              <button type="button" className="add-link" onClick={addRequirement}><Plus size={16} /> Agregar requisito</button>
            </div>
            {form.requirements.map((requirement, index) => (
              <label className={`editable-row ${errors.requirementItems?.[index] ? "editable-row--invalid" : ""}`} key={`requirement-${index}`}>
                <input value={requirement} onChange={(event) => updateRequirement(index, event.target.value)} onBlur={() => validateRequirement(index)} placeholder="Ej. Disponibilidad de 4 horas" aria-invalid={Boolean(errors.requirementItems?.[index])} required />
                {form.requirements.length > 1 && (<button type="button" aria-label="Eliminar requisito" onClick={() => removeRequirement(index)}><X size={16} /></button>)}
                {errors.requirementItems?.[index] && (<small className="field-error" role="alert">{errors.requirementItems[index]}</small>)}
              </label>
            ))}
          </section>

          <section>
            <div className="form-section-head">
              <div><h2>Tareas iniciales <em>*</em></h2><p>Debes crear al menos una tarea y completar todos sus datos.</p></div>
              <div className="task-actions">
                <button type="button" className="add-link add-link--ai" onClick={openTaskSuggestions} disabled={suggesting}><Sparkles size={16} /> {suggesting ? "Generando..." : "Sugerir con IA"}</button>
              </div>
            </div>
            {suggestionError && (<p className="form-error" role="alert">{suggestionError}</p>)}
            {form.tasks.map((task, index) => (
              <div className="task-editor" key={`task-${index}`}>
                <div className="task-editor__head">
                  <span>Tarea {index + 1}</span>
                </div>
                <div className="form-grid">
                  <Field label="Nombre" value={task.title} onChange={(event) => updateTask(index, "title", event.target.value)} onBlur={() => validateTaskField(index, "title")} error={errors.tasks?.[index]?.title} placeholder="Nombre de la tarea" required />
                  <Field label="Área" value={task.area} onChange={(event) => updateTask(index, "area", event.target.value)} onBlur={() => validateTaskField(index, "area")} error={errors.tasks?.[index]?.area} placeholder="Ej. Logística" required />
                </div>
                <Field label="Descripción" as="textarea" value={task.description} onChange={(event) => updateTask(index, "description", event.target.value)} onBlur={() => validateTaskField(index, "description")} error={errors.tasks?.[index]?.description} placeholder="¿Qué debe hacer el voluntario?" required />
                <Field label="Prioridad" as="select" value={task.priority} onChange={(event) => updateTask(index, "priority", event.target.value)} onBlur={() => validateTaskField(index, "priority")} error={errors.tasks?.[index]?.priority} options={["Alta", "Media", "Baja"]} required />
                <div className="task-editor__add">
                  {form.tasks.length > 1 && (<button type="button" className="task-editor__remove" onClick={() => removeTask(index)}><X size={16} /> Quitar</button>)}
                  <button type="button" className="add-link" onClick={() => addTaskAfter(index)}><Plus size={16} /> Agregar tarea</button>
                </div>
              </div>
            ))}
          </section>

          {error && (<p className="form-error" role="alert">{error}</p>)}
          <footer className="form-footer">
            <Button variant="secondary" type="button" onClick={() => go("/company/dashboard")}>Cancelar</Button>
            <Button type="submit" icon={Send} disabled={busy}>{busy ? "Validando..." : "Publicar iniciativa"}</Button>
          </footer>
        </form>
        {confirmOpen && (<ConfirmationModal title="¿Crear esta iniciativa?" description="La convocatoria y sus tareas iniciales quedarán visibles para recibir postulaciones." confirmLabel="Sí, crear iniciativa" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={createInitiative} />)}
        {suggestions && (<ModalSugerenciasTareas tasks={suggestions} onCancel={() => setSuggestions(null)} onSelect={addSuggestedTasks} onRegenerate={requestTaskSuggestions} busy={suggesting} />)}
      </section>

      {verImagen && (
        <Modal onClose={() => setVerImagen(false)}>
          <div style={{ padding: "1rem", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Vista previa de la imagen</h3>
            <img src={imagen} alt="Vista previa" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "8px", objectFit: "contain" }} />
            <div style={{ marginTop: "1rem" }}><Button onClick={() => setVerImagen(false)}>Cerrar</Button></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function DateField({ label, value, error, onChange, onBlur }) {
  return (
    <label className={`field ${error ? "field--invalid" : ""}`}>
      <span>{label} <em aria-hidden="true">*</em></span>
      <div className="datepicker-wrapper">
        <DatePicker
          selected={value || null}
          onChange={onChange}
          onBlur={onBlur}
          dateFormat="dd/MM/yyyy"
          locale={es}
          placeholderText="Selecciona la fecha"
          className={`datepicker-input ${error ? "input-error" : ""}`}
          showIcon
          icon={<Calendar size={18} />}
        />
      </div>
      {error && (<small className="field-error" role="alert">{error}</small>)}
    </label>
  );
}
