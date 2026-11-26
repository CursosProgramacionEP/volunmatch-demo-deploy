// Rutas de iniciativas, montadas en /api/initiatives
import { Router } from "express";
import pool from "../config/db.js";
import { auth } from "../middlewares/autenticacion.js";
import { notify } from "../helpers/notificaciones.js";
import { serializeInitiative } from "../helpers/serializers.js";
import { obtenerNombreEmpresa, obtenerPerfilVoluntario } from "../helpers/perfiles.js";
import { generarTareasConIA } from "../helpers/ia.js";
import {
  listarIniciativas,
  listarIniciativasDeEmpresa,
  buscarIniciativaPorId,
  crearIniciativa,
  cancelarIniciativa,
  obtenerStatsDashboard,
  obtenerAccesoVoluntario,
  obtenerValoracionesDeIniciativas,
  verificarAccesoResenas,
  listarResenasDeIniciativa,
  obtenerEstadoEdicionIniciativa,
  actualizarIniciativa,
  contarAceptadosEnIniciativa,
  obtenerPoliticaCancelacion,
  verificarCierreIniciativa,
  buscarCalificacionPendiente,
  obtenerEstadoPostulacion,
  crearSolicitudCancelacion,
  actualizarTareasDeIniciativa, 
} from "../helpers/iniciativas.js";
import {
  listarTareasDeIniciativas,
  listarTareasDeIniciativa,
  buscarTarea,
  crearTarea,
  eliminarTarea,
  tomarTarea,
  finalizarTarea,
  actualizarEstadoTarea,
  contarAceptadosPorIniciativa,
} from "../helpers/tareas.js";
import {
  buscarPostulacion,
  crearPostulacion,
  listarVoluntariosAceptados,
  listarDetallesVoluntariosAceptados,
  estaAceptado,
} from "../helpers/postulaciones.js";

export const initiativesRouter = Router();

const MODALIDADES_VALIDAS = new Set(["presencial", "virtual"]);

function normalizarModalidad(valor) {
  const modalidad = String(valor || "presencial").trim().toLowerCase();
  return MODALIDADES_VALIDAS.has(modalidad) ? modalidad : null;
}

function esEnlaceDeReunionValido(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function obtenerHorarioVirtual(horaInicio, horaFin) {
  const start = String(horaInicio || "").trim();
  const end = String(horaFin || "").trim();
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  if (!timePattern.test(start) || !timePattern.test(end) || end <= start) {
    return null;
  }
  return `${start} - ${end}`;
}

function contarPalabras(valor) {
  const texto = String(valor || "").trim();
  return texto ? texto.split(/\s+/).length : 0;
}

/** GET /api/initiatives */
initiativesRouter.get("/", auth(), async (req, res) => {
  const search = String(req.query.search || "").toLowerCase().trim();
  const category = String(req.query.category || "").toLowerCase().trim();
  const isVolunteer = req.user.role === "volunteer";

  try {
    const rows = await listarIniciativas({
      search,
      category,
      excludeVolunteerId: isVolunteer ? req.user.id : null,
      companyId: req.user.role === "company" ? req.user.id : null,
    });
    const ids = rows.map((r) => r.idiniciativa);
    const [tareasPorIniciativa, aceptadosPorIniciativa] = await Promise.all([
      listarTareasDeIniciativas(ids),
      contarAceptadosPorIniciativa(ids),
    ]);

    return res.json({
      initiatives: rows.map((row) =>
        serializeInitiative(row, tareasPorIniciativa[row.idiniciativa] || [], {
          joinedCount: aceptadosPorIniciativa[row.idiniciativa] || 0,
        }),
      ),
    });
  } catch (err) {
    console.error("Error al listar iniciativas:", err.message);
    return res.status(500).json({ message: "Error al obtener las iniciativas." });
  }
});

/** POST /api/initiatives/task-suggestions */
initiativesRouter.post("/task-suggestions", auth("company"), async (req, res) => {
  try {
    const { initiativeId, initiative } = req.body;
    const existingTasks = Array.isArray(req.body.existingTasks) ? [...req.body.existingTasks] : [];
    if (req.body.existingTasks !== undefined && !Array.isArray(req.body.existingTasks)) {
      return res.status(400).json({ message: "La lista de tareas existentes no es válida." });
    }
    let context = initiative;
    if (initiativeId) {
      const savedInitiative = await buscarIniciativaPorId(initiativeId);
      if (!savedInitiative || savedInitiative.idempresa !== req.user.id) {
        return res.status(404).json({ message: "No se encontró la iniciativa o no eres su dueño." });
      }
      context = {
        title: savedInitiative.titulo,
        category: savedInitiative.categoria,
        summary: savedInitiative.descripcion,
      };
      const savedTasks = await listarTareasDeIniciativa(initiativeId);
      existingTasks.push(...savedTasks.map((task) => ({ title: task.titulo })));
    }
    if (!context?.title?.trim() || !context?.summary?.trim()) {
      return res.status(400).json({ message: "Completa el nombre y la descripción de la iniciativa para generar tareas." });
    }
    const tareas = await generarTareasConIA(
      {
        titulo: String(context.title).trim(),
        objetivo: String(context.summary).trim(),
        categoria: context.category ? String(context.category).trim() : null,
        tareasExistentes: existingTasks.map((t) => String(t.title || t).trim()).filter(Boolean),
      },
      4,
    );
    const tasks = tareas.map((t) => ({ title: t.titulo, description: t.descripcion, area: t.area, priority: t.priority }));
    return res.json({ tasks });
  } catch (err) {
    console.error("Error al generar sugerencias de tareas:", err.message);
    if (err.message.includes("Timeout")) return res.status(504).json({ message: "La IA tardó demasiado en responder. Intenta de nuevo." });
    if (err.message.includes("GEMINI_API_KEY")) return res.status(500).json({ message: "La IA no está configurada correctamente." });
    // ✅ Mensaje genérico (Merly)
    return res.status(500).json({ message: "Ocurrió un error al generar las sugerencias. Inténtalo de nuevo." });
  }
});

/** GET /api/initiatives/:id/reviews */
initiativesRouter.get("/:id/reviews", auth(), async (req, res) => {
  const initiativeId = Number(req.params.id);
  if (!Number.isInteger(initiativeId) || initiativeId < 1)
    return res.status(400).json({ message: "El identificador de la iniciativa no es válido." });
  try {
    const initiative = await verificarAccesoResenas(initiativeId, req.user.id);
    if (!initiative) return res.status(404).json({ message: "No se encontró la iniciativa." });
    if (!initiative.cerrada) return res.status(409).json({ message: "Las reseñas estarán disponibles cuando finalice la iniciativa." });
    if (req.user.role === "company" && initiative.idempresa !== req.user.id)
      return res.status(403).json({ message: "No tienes permiso para ver estas reseñas." });
    if (req.user.role === "volunteer" && !initiative.voluntario_aceptado)
      return res.status(403).json({ message: "Solo los voluntarios aceptados pueden ver las reseñas de esta iniciativa." });
    const reviews = await listarResenasDeIniciativa(initiativeId);
    return res.json({ reviews });
  } catch (err) {
    console.error("Error al cargar reseñas de iniciativa:", err.message);
    return res.status(500).json({ message: "No se pudieron cargar las reseñas." });
  }
});

/** GET /api/initiatives/mine */
initiativesRouter.get("/mine", auth("company"), async (req, res) => {
  try {
    const rows = await listarIniciativasDeEmpresa(req.user.id, { soloActivas: req.query.activeOnly === "true" });
    const ids = rows.map((r) => r.idiniciativa);
    const [tareasPorIniciativa, aceptadosPorIniciativa, valoracionesPorIniciativa] = await Promise.all([
      listarTareasDeIniciativas(ids),
      contarAceptadosPorIniciativa(ids),
      obtenerValoracionesDeIniciativas(ids),
    ]);
    return res.json({
      initiatives: rows.map((row) =>
        serializeInitiative(row, tareasPorIniciativa[row.idiniciativa] || [], {
          joinedCount: aceptadosPorIniciativa[row.idiniciativa] || 0,
          includeMeetingUrl: true,
          ratingAverage: valoracionesPorIniciativa[row.idiniciativa]?.puntaje_promedio ?? null,
          ratingCount: valoracionesPorIniciativa[row.idiniciativa]?.cantidad_valoraciones || 0,
          ratingComment: valoracionesPorIniciativa[row.idiniciativa]?.comentario_reciente || "",
        }),
      ),
    });
  } catch (err) {
    console.error("Error al listar mis iniciativas:", err.message);
    return res.status(500).json({ message: "Error al obtener tus iniciativas." });
  }
});

/** GET /api/initiatives/dashboard */
initiativesRouter.get("/dashboard", auth("company"), async (req, res) => {
  try {
    const stats = await obtenerStatsDashboard(req.user.id);
    return res.json({ stats });
  } catch (err) {
    console.error("Error al cargar dashboard:", err.message);
    return res.status(500).json({ message: "Error al cargar el dashboard." });
  }
});

/** POST /api/initiatives */
initiativesRouter.post("/", auth("company"), async (req, res) => {
  const { title, category, summary, date, endDate, location, quota, requirements, tasks, imagen, modalidad, meetingUrl, startTime, endTime } = req.body;

  const cleanTitle = String(title || "").trim();
  const cleanSummary = String(summary || "").trim();
  const cleanLocation = String(location || "").trim();
  const cleanCategory = String(category || "").trim();
  const cleanModalidad = normalizarModalidad(modalidad);
  const cleanMeetingUrl = String(meetingUrl || "").trim();
  const virtualSchedule = obtenerHorarioVirtual(startTime, endTime);
  const quotaNumber = Number(quota);
  const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,80}$/;
  const startDate = new Date(date);
  const finishDate = new Date(endDate);
  const cleanRequirements = Array.isArray(requirements) ? requirements.map((item) => String(item || "").trim()) : [];
  const cleanTasks = Array.isArray(tasks) ? tasks.map((task) => ({
        title: String(task?.title || "").trim(),
        description: String(task?.description || "").trim(),
        area: String(task?.area || "").trim(),
        priority: String(task?.priority || "").trim(),
      })) : [];

  if (!cleanTitle || !cleanSummary || !cleanCategory || !date || !endDate || !quota)
    return res.status(400).json({ message: "Completa todos los campos obligatorios de la iniciativa." });
  if (!cleanModalidad) return res.status(400).json({ message: "Selecciona una modalidad válida para la iniciativa." });
  if (cleanModalidad === "presencial" && !cleanLocation) return res.status(400).json({ message: "Indica el lugar de la actividad presencial." });
  if (cleanModalidad === "virtual" && (!cleanMeetingUrl || !esEnlaceDeReunionValido(cleanMeetingUrl)))
    return res.status(400).json({ message: "Ingresa un enlace válido de Zoom, Google Meet u otra plataforma (http:// o https://)." });
  if (cleanModalidad === "virtual" && !virtualSchedule)
    return res.status(400).json({ message: "Indica una hora de inicio y una hora de fin válidas para la reunión virtual." });
  if (cleanTitle.length > 80) return res.status(400).json({ message: "El nombre puede tener como máximo 80 caracteres." });
  if (!namePattern.test(cleanTitle)) return res.status(400).json({ message: "El nombre debe tener al menos 3 letras y no incluir números ni símbolos." });
  if (contarPalabras(cleanSummary) > 80)
    return res.status(400).json({ message: "La descripción puede tener como máximo 80 palabras." });
  if (!Number.isInteger(quotaNumber) || quotaNumber <= 0) return res.status(400).json({ message: "El cupo debe ser un número entero mayor que cero." });
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(finishDate.getTime()) || finishDate < startDate)
    return res.status(400).json({ message: "La fecha de fin debe ser igual o posterior a la fecha de inicio." });
  if (!cleanRequirements.length || cleanRequirements.some((requirement) => !requirement))
    return res.status(400).json({ message: "Agrega y completa al menos un requisito." });
  if (!cleanTasks.length || cleanTasks.some((task) => !task.title || !task.description || !task.area || !["Alta", "Media", "Baja"].includes(task.priority)))
    return res.status(400).json({ message: "Crea al menos una tarea y completa su nombre, área, descripción y prioridad." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const requisitoTexto = cleanRequirements.join("\n");

    const row = await crearIniciativa(
      {
        idempresa: req.user.id, titulo: cleanTitle, descripcion: cleanSummary, categoria: cleanCategory,
        numcupo: quotaNumber, fechainicio: date, fechafin: endDate, requisito: requisitoTexto,
        lugar: cleanModalidad === "presencial" ? cleanLocation : null, imagen: imagen || null,
        modalidad: cleanModalidad, enlaceReunion: cleanModalidad === "virtual" ? cleanMeetingUrl : null,
        horario: cleanModalidad === "virtual" ? virtualSchedule : null,
      },
      client,
    );

    const insertedTasks = [];
    for (const task of cleanTasks) {
      const t = await crearTarea({ titulo: task.title, descripcion: task.description, idiniciativa: row.idiniciativa, area: task.area, priority: task.priority }, client);
      insertedTasks.push(t);
    }
    row.nombreempresa = await obtenerNombreEmpresa(req.user.id, client);
    await client.query("COMMIT");
    return res.status(201).json({ initiative: serializeInitiative(row, insertedTasks) });
  } catch (err) {
    await client.query("ROLLBACK");
    // ✅ Mensaje genérico (Merly)
    console.error("Error interno al crear iniciativa:", err.message);
    return res.status(500).json({ message: "No se pudo crear la iniciativa. Verifica los datos e inténtalo de nuevo." });
  } finally {
    client.release();
  }
});

/** PATCH /api/initiatives/:id */
initiativesRouter.patch("/:id", auth("company"), async (req, res) => {
  const initiativeId = Number(req.params.id);
  if (!Number.isInteger(initiativeId) || initiativeId < 1)
    return res.status(400).json({ message: "El identificador de la iniciativa no es válido." });

    //  NUEVA MEDIDA DE SEGURIDAD: Validar que el ID del body coincida con el de la URL (IDOR)
  if (req.body.id && Number(req.body.id) !== initiativeId) {
    return res.status(403).json({ message: "No autorizado: El ID del formulario no coincide con el recurso solicitado." });
  }

  const title = String(req.body.title || "").trim();
  const summary = String(req.body.summary || "").trim();
  const category = String(req.body.category || "").trim();
  const location = String(req.body.location || "").trim();
  const modalidad = normalizarModalidad(req.body.modalidad);
  const meetingUrl = String(req.body.meetingUrl || "").trim();
  const virtualSchedule = obtenerHorarioVirtual(req.body.startTime, req.body.endTime);
  const date = String(req.body.date || "").slice(0, 10);
  const endDate = String(req.body.endDate || "").slice(0, 10);
  const quota = Number(req.body.quota);
  const imagen = req.body.imagen;
  const requirements = Array.isArray(req.body.requirements)
    ? req.body.requirements.map((item) => String(item || "").trim()).filter(Boolean)
    : String(req.body.requirements || "").split("\n").map((item) => item.trim()).filter(Boolean);
  const tasks = req.body.tasks === undefined ? null : Array.isArray(req.body.tasks)
        ? req.body.tasks.map((task) => ({
            id: task?.id == null || task.id === "" ? null : Number(task.id),
            title: String(task?.title || "").trim(),
            description: String(task?.description || "").trim(),
            area: String(task?.area || "").trim(),
            priority: String(task?.priority || "").trim(),
          }))
        : false;
  const validCategories = ["Medio ambiente", "Educación", "Asistencia social", "Salud", "Cultura", "Deporte", "Tecnología"];
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };

  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,250}$/.test(title)) return res.status(400).json({ message: "El nombre debe tener al menos 3 letras y no incluir números ni símbolos." });
  if (!summary || !validCategories.includes(category) || !validDate(date) || !validDate(endDate) || !Number.isInteger(quota) || quota <= 0 || !requirements.length)
    return res.status(400).json({ message: "Revisa los campos obligatorios, fechas, cupos y requisitos." });
  if (!modalidad) return res.status(400).json({ message: "Selecciona una modalidad válida para la iniciativa." });
  if (modalidad === "presencial" && !location) return res.status(400).json({ message: "Indica el lugar de la actividad presencial." });
  if (modalidad === "virtual" && (!meetingUrl || !esEnlaceDeReunionValido(meetingUrl)))
    return res.status(400).json({ message: "Ingresa un enlace válido de Zoom, Google Meet u otra plataforma (http:// o https://)." });
  if (modalidad === "virtual" && !virtualSchedule)
    return res.status(400).json({ message: "Indica una hora de inicio y una hora de fin válidas para la reunión virtual." });
  if (endDate < date) return res.status(400).json({ message: "La fecha de fin debe ser igual o posterior a la fecha de inicio." });
  if (tasks === false || (tasks && tasks.some((task) => !task.title || !task.description || !task.area || !["Alta", "Media", "Baja"].includes(task.priority))))
    return res.status(400).json({ message: "Completa el nombre, área, descripción y prioridad de cada tarea." });
  if (tasks && new Set(tasks.map((task) => task.id).filter(Boolean)).size !== tasks.filter((task) => task.id).length)
    return res.status(400).json({ message: "No repitas tareas existentes en la lista." });
  if (tasks && tasks.some((task) => task.id && (!Number.isInteger(task.id) || task.id < 1)))
    return res.status(400).json({ message: "Una de las tareas seleccionadas no es válida." });

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    
    const current = await buscarIniciativaPorId(initiativeId, client);
    if (!current || current.idempresa !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No se encontró la iniciativa o no tienes permiso para editarla." });
    }
    const closure = await obtenerEstadoEdicionIniciativa(initiativeId, client);
    if (current.estado !== "activa" || closure.cerrada) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Solo puedes editar iniciativas que todavía están activas." });
    }

    const currentTasks = await listarTareasDeIniciativa(initiativeId, client);
    const hasAdvances = currentTasks.some((task) => ["en_proceso", "finalizado"].includes(task.estado));
    
    const tasksChanged = tasks !== null && (() => {
        const existing = currentTasks.map((task) => ({ id: Number(task.idtarea), title: task.titulo || "", description: task.descripcion || "", area: task.area || "", priority: task.priority || "Media" })).sort((a, b) => a.id - b.id);
        const submitted = tasks.map((task) => ({ id: task.id, title: task.title, description: task.description, area: task.area, priority: task.priority })).sort((a, b) => (a.id || Number.MAX_SAFE_INTEGER) - (b.id || Number.MAX_SAFE_INTEGER));
        return JSON.stringify(existing) !== JSON.stringify(submitted);
      })();
    
    const dateChanged = date !== String(current.fechainicio).slice(0, 10) || endDate !== String(current.fechafin).slice(0, 10);
    const locationChanged = modalidad === "presencial" && location !== String(current.lugar || "");
    const modalityChanged = modalidad !== normalizarModalidad(current.modalidad);
    const meetingUrlChanged = (modalidad === "virtual" ? meetingUrl : "") !== String(current.enlace_reunion || "");
    const scheduleChanged = (modalidad === "virtual" ? virtualSchedule : "") !== String(current.horario || "");
    const quotaChanged = quota !== Number(current.numcupo);
    const requirementsChanged = requirements.join("\n") !== String(current.requisito || "").split("\n").map((item) => item.trim()).filter(Boolean).join("\n");
    const titleChanged = title !== current.titulo;
    const summaryChanged = summary !== current.descripcion;
    const categoryChanged = category !== current.categoria;

    if (closure.inicia_en_menos_de_24h && !hasAdvances) {
      if (dateChanged || locationChanged || modalityChanged || meetingUrlChanged || scheduleChanged || quotaChanged || requirementsChanged || titleChanged || categoryChanged || tasksChanged) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Falta menos de 24 horas para iniciar. Solo puedes corregir la descripción de la iniciativa." });
      }
    } else if (hasAdvances) {
      if (dateChanged || locationChanged || modalityChanged || meetingUrlChanged || scheduleChanged || quotaChanged || requirementsChanged || tasksChanged) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "La iniciativa tiene tareas en proceso o finalizadas. Solo puedes modificar información general, sin alterar fechas, cupos, requisitos ni tareas." });
      }
    }

    const acceptedTotal = await contarAceptadosEnIniciativa(initiativeId, client);
    if (quota < acceptedTotal) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `El cupo no puede ser menor que los ${acceptedTotal} voluntarios ya aceptados.` });
    }

    if (tasks) {
      try {
        await actualizarTareasDeIniciativa(tasks, initiativeId, client);
      } catch (error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: error.message });
      }
    }

    await actualizarIniciativa(
      initiativeId, req.user.id,
      {
        titulo: title, categoria: category, descripcion: summary, fechainicio: date, fechafin: endDate,
        lugar: modalidad === "presencial" ? location : null, numcupo: quota, requisito: requirements.join("\n"),
        imagen, modalidad, enlaceReunion: modalidad === "virtual" ? meetingUrl : null,
        horario: modalidad === "virtual" ? virtualSchedule : null,
      },
      client
    );

    const updated = await buscarIniciativaPorId(initiativeId, client);
    const updatedTasks = await listarTareasDeIniciativa(initiativeId, client);
    await client.query("COMMIT");
    return res.json({ initiative: serializeInitiative(updated, updatedTasks, { joinedCount: acceptedTotal }) });
  } catch (err) {
    if (transactionOpen) await client.query("ROLLBACK");
    // ✅ Mensaje genérico (Merly)
    console.error("Error interno al editar iniciativa:", err.message);
    return res.status(500).json({ message: "No se pudo guardar la iniciativa. Inténtalo de nuevo." });
  } finally {
    client?.release();
  }
});

/** PATCH /api/initiatives/:id/cancel */
initiativesRouter.patch("/:id/cancel", auth("company"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const iniciativa = await buscarIniciativaPorId(req.params.id, client);
    if (!iniciativa || iniciativa.idempresa !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No se encontró la iniciativa o no tienes permiso para cancelarla." });
    }
    if (iniciativa.estado === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Esta iniciativa ya está cancelada." });
    }
    const cancellation = await obtenerPoliticaCancelacion(iniciativa.idiniciativa, client);
    if (cancellation.finished) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "No es posible cancelar una iniciativa finalizada." });
    }
    if (cancellation.has_locked_tasks) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "No se puede cancelar la iniciativa porque tiene tareas en proceso o finalizadas." });
    }
    if (Number(cancellation.accepted_count) > 0 && cancellation.starts_within_24h) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "La cancelación normal está bloqueada por la proximidad del inicio. Solicita una excepción justificada." });
    }
    const reason = String(req.body?.reason || "").trim();
    if (Number(cancellation.accepted_count) > 0 && reason.length < 5) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Indica el motivo de cancelación para notificar a los voluntarios." });
    }
    await cancelarIniciativa({ idiniciativa: iniciativa.idiniciativa, idempresa: req.user.id }, client);
    await client.query("COMMIT");
    
    const voluntarios = await listarVoluntariosAceptados(iniciativa.idiniciativa);
    await Promise.all(voluntarios.map(({ idvoluntario }) =>
        notify(idvoluntario, "volunteer", "initiative_cancelled", "Iniciativa cancelada",
          `La iniciativa "${iniciativa.titulo}" fue cancelada por la empresa.${reason ? ` Motivo: ${reason}` : ""}`, "/volunteer/activities")
      )
    );
    return res.json({ message: "La iniciativa fue cancelada.", initiative: { id: iniciativa.idiniciativa, status: "cancelled" } });
  } catch (err) {
    await client.query("ROLLBACK");
    // ✅ Mensaje genérico (Merly)
    console.error("Error interno al cancelar iniciativa:", err.message);
    return res.status(500).json({ message: "No se pudo cancelar la iniciativa. Inténtalo de nuevo." });
  } finally {
    client.release();
  }
});

/** POST /api/initiatives/:id/cancel-request */
initiativesRouter.post("/:id/cancel-request", auth("company"), async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 10)
    return res.status(400).json({ message: "Describe la justificación con al menos 10 caracteres." });
  try {
    const initiative = await buscarIniciativaPorId(req.params.id);
    if (!initiative || initiative.idempresa !== req.user.id)
      return res.status(404).json({ message: "No se encontró la iniciativa o no tienes permiso para solicitar la excepción." });
    const policy = await obtenerPoliticaCancelacion(initiative.idiniciativa);
    if (!policy || policy.finished)
      return res.status(409).json({ message: "No es posible solicitar una excepción para una iniciativa finalizada." });
    if (policy.has_locked_tasks)
      return res.status(409).json({ message: "No se puede solicitar la cancelación porque la iniciativa tiene tareas en proceso o finalizadas." });
    const needsException = Number(policy.accepted_count) > 0 && policy.starts_within_24h;
    if (!needsException)
      return res.status(409).json({ message: "Esta iniciativa puede cancelarse mediante la cancelación normal." });
    await crearSolicitudCancelacion(initiative.idiniciativa, req.user.id, reason);
    return res.status(202).json({ message: "La solicitud de excepción fue registrada para su evaluación." });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ message: "Ya existe una solicitud de excepción pendiente para esta iniciativa." });
    // ✅ Mensaje genérico (Merly)
    console.error("Error interno al solicitar excepción de cancelación:", err.message);
    return res.status(500).json({ message: "No se pudo registrar la solicitud. Inténtalo de nuevo." });
  }
});

/** GET /api/initiatives/:id */
initiativesRouter.get("/:id", auth(), async (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) < 1) {
    return res.status(404).json({ message: "No se encontró la iniciativa o no está disponible." });
  }
  try {
    const initiative = await buscarIniciativaPorId(req.params.id);
    if (!initiative) return res.status(404).json({ message: "No se encontró la iniciativa o no está disponible." });
    const isOwner = req.user.role === "company" && initiative.idempresa === req.user.id;
    if (req.user.role === "company" && !isOwner) {
      return res.status(404).json({ message: "No se encontró la iniciativa o no está disponible." });
    }
    if (req.user.role === "volunteer") {
      const cerrada = await verificarCierreIniciativa(initiative.idiniciativa);
      if (initiative.estado !== "activa" || cerrada) {
        return res.status(404).json({ message: "No se encontró la iniciativa o ya no está disponible." });
      }
    }
    const [tareas, joinedCount, members] = await Promise.all([
      listarTareasDeIniciativa(req.params.id),
      contarAceptadosEnIniciativa(initiative.idiniciativa),
      isOwner ? listarDetallesVoluntariosAceptados(initiative.idiniciativa) : Promise.resolve([]),
    ]);
    let applicationStatus = null;
    if (req.user.role === "volunteer") {
      const estado = await obtenerEstadoPostulacion(initiative.idiniciativa, req.user.id);
      const statusMap = { pendiente: "pending", aceptado: "accepted", rechazado: "rejected" };
      applicationStatus = statusMap[estado] || null;
    }
    return res.json({
      initiative: serializeInitiative(initiative, tareas, {
        applicationStatus,
        joinedCount,
        members,
        includeMeetingUrl: applicationStatus === "accepted" || isOwner,
      }),
    });
  } catch (err) {
    console.error("Error al ver iniciativa:", err.message);
    return res.status(500).json({ message: "Error al obtener la iniciativa." });
  }
});

/** POST /api/initiatives/:id/applications */
initiativesRouter.post("/:id/applications", auth("volunteer"), async (req, res) => {
  const { motivation, saturday, sunday, acceptedTerms } = req.body;
  const initiativeId = req.params.id;
  
  // ✅ Validaciones estrictas (Merly)
  if (!/^\d{9}$/.test(String(req.user.telefono || "").trim()))
    return res.status(409).json({ message: "Completa un teléfono de 9 dígitos en tu perfil antes de postularte." });
  if (typeof motivation !== "string" || !motivation.trim() || motivation.length > 500)
    return res.status(400).json({ message: "La motivación es requerida y debe tener máximo 500 caracteres." });
  if (typeof saturday !== "boolean" && typeof sunday !== "boolean")
    return res.status(400).json({ message: "Los días de disponibilidad deben ser válidos." });
  if (!saturday && !sunday)
    return res.status(400).json({ message: "Selecciona por lo menos un día disponible." });
  if (acceptedTerms !== true)
    return res.status(400).json({ message: "Debes aceptar los lineamientos de participación." });

  try {
    const iniciativa = await buscarIniciativaPorId(initiativeId);
    if (!iniciativa) return res.status(404).json({ message: "No se encontró la iniciativa." });
    if (iniciativa.estado === "cancelada") return res.status(409).json({ message: "No puedes postular a una iniciativa cancelada." });
    const cerrada = await verificarCierreIniciativa(initiativeId);
    if (cerrada || iniciativa.estado === "finalizada")
      return res.status(409).json({ message: "No puedes postular a una iniciativa que ya cerró." });
    const pendiente = await buscarCalificacionPendiente(req.user.id, iniciativa.idempresa);
    if (pendiente)
      return res.status(409).json({ message: `Tienes una calificación pendiente (${pendiente.titulo}). Envíala antes de postularte a otra iniciativa de esta empresa.`, pendingInitiative: pendiente.titulo });
    const existente = await buscarPostulacion({ idiniciativa: initiativeId, idvoluntario: req.user.id });
    if (existente) return res.status(409).json({ message: "Ya te postulaste a esta iniciativa." });
    const postulacion = await crearPostulacion({ razon: motivation.trim(), idvoluntario: req.user.id, idiniciativa: initiativeId });
    
    void notify(iniciativa.idempresa, "company", "application_received", "Nueva postulación",
        `${req.user.fullName} se postuló a "${iniciativa.titulo}".`, "/company/dashboard"
      ).catch((notificationError) => console.error("Error al notificar nueva postulación:", notificationError.message));
      
    return res.status(201).json({ message: "Postulación registrada exitosamente." });  
  } catch (err) {
    if (err.code === "42P01" && err.message?.includes("valoracion_iniciativa")) {
      console.error("Falta la tabla valoracion_iniciativa en la base de datos.");
      return res.status(503).json({ message: "Servicio temporalmente no disponible." });
    }
    // ✅ Mensaje genérico (Merly)
    console.error("Error interno al postular:", err.message);
    return res.status(500).json({ message: "Ocurrió un error al procesar la solicitud. Inténtalo de nuevo." });
  }
});

/** GET /api/initiatives/:id/board */
initiativesRouter.get("/:id/board", auth(), async (req, res) => {
  try {
    const iniciativa = await buscarIniciativaPorId(req.params.id);
    if (!iniciativa) return res.status(404).json({ message: "No se encontró la iniciativa." });
    const canAccessBoard = req.user.role === "company"
        ? iniciativa.idempresa === req.user.id
        : await estaAceptado({ idiniciativa: iniciativa.idiniciativa, idvoluntario: req.user.id });
    if (!canAccessBoard)
      return res.status(403).json({ message: "No tienes acceso al tablero de esta iniciativa." });
    const tareas = await listarTareasDeIniciativa(req.params.id);
    return res.json({ initiative: serializeInitiative(iniciativa, tareas, { includeMeetingUrl: true }) });
  } catch (err) {
    console.error("Error al obtener tablero:", err.message);
    return res.status(500).json({ message: "Error al obtener el tablero." });
  }
});

/** POST /api/initiatives/:initiativeId/tasks */
initiativesRouter.post("/:initiativeId/tasks", auth("company"), async (req, res) => {
  const { initiativeId } = req.params;
  const { title, description, area, priority } = req.body;
  if (!title?.trim() || !description?.trim() || !area?.trim() || !["Alta", "Media", "Baja"].includes(priority))
    return res.status(400).json({ message: "Completa el nombre, área, descripción y prioridad de la tarea." });
  try {
    const iniciativa = await buscarIniciativaPorId(initiativeId);
    if (!iniciativa || iniciativa.idempresa !== req.user.id)
      return res.status(404).json({ message: "No se encontró la iniciativa o no eres su dueño." });
    const cerrada = await verificarCierreIniciativa(initiativeId);
    if (iniciativa.estado !== "activa" || cerrada)
      return res.status(409).json({ message: "No puedes agregar tareas a una iniciativa que ya cerró o fue cancelada." });
    const tarea = await crearTarea({
      titulo: title.trim(), descripcion: description.trim(), idiniciativa: initiativeId, area: area.trim(), priority,
    });
    return res.status(201).json({ task: tarea });
  } catch (err) {
    console.error("Error al crear tarea:", err.message);
    return res.status(500).json({ message: "Error al crear la tarea." });
  }
});

/** DELETE /api/initiatives/:initiativeId/tasks/:taskId */
initiativesRouter.delete("/:initiativeId/tasks/:taskId", auth("company"), async (req, res) => {
  try {
    const deletedId = await eliminarTarea({
      idtarea: req.params.taskId, idiniciativa: req.params.initiativeId, idempresa: req.user.id,
    });
    if (!deletedId)
      return res.status(404).json({ message: "No se encontró la tarea o no tienes permiso para eliminarla." });
    return res.json({ message: "Tarea eliminada.", taskId: deletedId });
  } catch (err) {
    console.error("Error al eliminar tarea:", err.message);
    return res.status(500).json({ message: "No se pudo eliminar la tarea." });
  }
});

/** PATCH /api/initiatives/:initiativeId/tasks/:taskId */
initiativesRouter.patch("/:initiativeId/tasks/:taskId", auth("volunteer"), async (req, res) => {
  const { status, claim, finish } = req.body;
  const { initiativeId, taskId } = req.params;
  const idvoluntario = req.user.id;
  const statusMap = { pending: "pendiente", in_progress: "en_proceso", done: "finalizado" };
  try {
    const tarea = await buscarTarea(taskId, initiativeId);
    if (!tarea) return res.status(404).json({ message: "No se encontró la tarea." });
    const info = await obtenerAccesoVoluntario(initiativeId, idvoluntario);
    if (!info || info.estado !== "activa" || info.cerrada)
      return res.status(409).json({ message: "No puedes modificar tareas de una iniciativa que ya cerró o fue cancelada." });
    if (info.application_status !== "aceptado")
      return res.status(403).json({ message: "Solo los voluntarios aceptados pueden gestionar tareas." });
    if (tarea.estado === "finalizado") {
      if (finish === true) return res.status(409).json({ message: "Esta tarea ya está finalizada." });
      if (claim === true) return res.status(409).json({ message: "Esta tarea ya fue finalizada, no se puede tomar." });
      if (status && statusMap[status] !== "finalizado") return res.status(409).json({ message: "Esta tarea ya está finalizada y no se puede mover." });
      if (status && statusMap[status] === "finalizado") return res.json({ task: tarea });
    }
    let changedTask;
    if (claim === true) {
      if (tarea.idvoluntario_asignado && tarea.idvoluntario_asignado !== idvoluntario)
        return res.status(409).json({ message: "Esta tarea ya fue tomada por otro voluntario." });
      changedTask = await tomarTarea({ idtarea: taskId, idvoluntario });
    } else if (finish === true) {
      if (tarea.idvoluntario_asignado !== idvoluntario)
        return res.status(403).json({ message: "Solo el voluntario que tomó la tarea puede finalizarla." });
      changedTask = await finalizarTarea({ idtarea: taskId, idvoluntario });
    } else {
      const nuevoEstado = statusMap[status] || status;
      if (!["pendiente", "en_proceso", "finalizado"].includes(nuevoEstado))
        return res.status(400).json({ message: "Estado no válido." });
      if (tarea.estado === "finalizado" && nuevoEstado !== "finalizado")
        return res.status(409).json({ message: "Esta tarea ya está finalizada y no se puede mover." });
      if (tarea.idvoluntario_asignado !== idvoluntario)
        return res.status(403).json({ message: "Primero debes tomar esta tarea para actualizar su estado." });
      changedTask = await actualizarEstadoTarea({ idtarea: taskId, estado: nuevoEstado, idvoluntario });
    }
    void notify(info.idempresa, "company", finish === true || status === "done" ? "task_completed" : "task_updated",
        finish === true || status === "done" ? "Tarea finalizada" : "Tarea actualizada",
        `${req.user.fullName} ${finish === true || status === "done" ? "finalizó" : claim === true ? "tomó" : "actualizó"} "${tarea.titulo}" en "${info.titulo}".`,
        `/kanban/${initiativeId}`
      );
    if (finish === true || status === "done") {
      void obtenerPerfilVoluntario(idvoluntario).catch((error) => console.error("Error al revisar insignias del voluntario:", error.message));
    }
    return res.json({ task: changedTask });
  } catch (err) {
    console.error("Error al actualizar tarea:", err.message);
    return res.status(500).json({ message: "Error al actualizar la tarea." });
  }
});