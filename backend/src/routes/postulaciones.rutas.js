// Rutas de postulaciones, montadas en /api/applications
import { Router } from "express";
import pool from "../config/db.js";
import { auth } from "../middlewares/autenticacion.js";
import { notify } from "../helpers/notificaciones.js";
import {
  buscarPostulacion,
  crearPostulacion, 
  listarPostulacionesDeEmpresa,
  listarPostulacionesDeVoluntario,
  buscarPostulacionPorId,
  contarAceptadosDeIniciativa,
  actualizarEstadoPostulacion,
} from "../helpers/postulaciones.js";
import { descontarCupo } from "../helpers/iniciativas.js";
import { obtenerPerfilVoluntario } from "../helpers/perfiles.js";

export const applicationsRouter = Router();

/**
 * Crea una nueva postulación.
 * SOLUCIÓN CS-02: Ignoramos el nombre y correo del frontend. 
 * Usamos req.user (que viene del token JWT y la BD).
 *Validaciones de campos y mensajes genéricos.
 */
applicationsRouter.post("/", auth("volunteer"), async (req, res) => {
  try {
    const { idiniciativa, razon } = req.body;
    
    // Validaciones estrictas 
    if (!idiniciativa) {
      return res.status(400).json({ message: "El ID de la iniciativa es requerido." });
    }
    if (typeof razon !== "string" || razon.trim().length === 0 || razon.length > 500) {
      return res.status(400).json({ message: "La motivación es requerida y debe tener máximo 500 caracteres." });
    }

    // 1. El ID del voluntario viene SEGURO desde el token (middleware)
    const idvoluntario = req.user.id; 

    // 2. Verificamos si ya se postuló antes
    const existente = await buscarPostulacion({ idiniciativa, idvoluntario });
    if (existente) {
      return res.status(400).json({ message: "Ya te has postulado a esta iniciativa." });
    }

    // 3. Creamos la postulación.
    const nuevaPostulacion = await crearPostulacion({
      razon: razon.trim(),
      idvoluntario,
      idiniciativa,
    });

    // 4. Respondemos SIN exponer los IDs internos (Solución CS-02)
    return res.status(201).json({ 
      message: "Postulación registrada exitosamente.",
    });

  } catch (err) {
    console.error("Error interno al procesar postulación:", err.message);
    return res.status(500).json({ message: "Ocurrió un error al procesar la solicitud. Inténtalo de nuevo." });
  }
});

/**
 * GET /api/applications
 * Lista las postulaciones según el rol del usuario.
 */
applicationsRouter.get("/", auth(), async (req, res) => {
  try {
    const rows =
      req.user.role === "company"
        ? await listarPostulacionesDeEmpresa(req.user.id)
        : await listarPostulacionesDeVoluntario(req.user.id);

    const applications = rows.map((row) => ({
      id: row.id,
      razon: row.razon,
      status:
        row.estado === "aceptado"
          ? "accepted"
          : row.estado === "rechazado"
            ? "rejected"
            : "pending",
      volunteer: {
        id: row.idvoluntario || null,
        fullName: row.volunteer_name || "",
        email: row.volunteer_email || "",
        photoUrl: row.volunteer_photo_url || null,
      },
      initiative: {
        id: row.idiniciativa,
        title: row.initiative_title,
        category: row.initiative_category,
      },
    }));

    return res.json({ applications });
  } catch (err) {
    console.error("Error al listar postulaciones:", err.message);
    return res.status(500).json({ message: "Error al cargar postulaciones." });
  }
});

/**
 * PATCH /api/applications/:id
 * Acepta o rechaza una postulación (solo empresa dueña).
 */
applicationsRouter.patch("/:id", auth("company"), async (req, res) => {
  const { status } = req.body;
  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Estado no válido." });
  }

  const nuevoEstado = status === "accepted" ? "aceptado" : "rechazado";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const application = await buscarPostulacionPorId(req.params.id, client);
    if (!application) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No se encontró la postulación." });
    }
    if (application.idempresa !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "No tienes permiso sobre esta postulación." });
    }
    if (application.initiative_status === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "No puedes gestionar postulaciones de una iniciativa cancelada.",
      });
    }

    // Verificar y descontar cupos si se va a aceptar
    if (nuevoEstado === "aceptado" && application.estado !== "aceptado") {
      const totalAceptados = await contarAceptadosDeIniciativa(
        application.idiniciativa,
        client,
      );

      if (totalAceptados >= Number(application.numcupo)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "La iniciativa ya no tiene cupos disponibles." });
      }

      const cupoDescontado = await descontarCupo(
        application.idiniciativa,
        client,
      );
      if (!cupoDescontado) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Error: No se pudo descontar el cupo (ya no hay disponibles).",
        });
      }
    }

    await actualizarEstadoPostulacion(req.params.id, nuevoEstado, client);
    await client.query("COMMIT");

    if (application.estado !== nuevoEstado) {
      const accepted = status === "accepted";
      await notify(
        application.idvoluntario,
        "volunteer",
        accepted ? "application_accepted" : "application_rejected",
        accepted ? "Postulación aceptada" : "Postulación no seleccionada",
        accepted
          ? `La empresa aceptó tu postulación a "${application.titulo}".`
          : `La empresa actualizó el estado de tu postulación a "${application.titulo}".`,
        accepted ? `/kanban/${application.idiniciativa}` : "/volunteer/activities",
      );
      if (accepted) {
        void obtenerPerfilVoluntario(application.idvoluntario).catch((error) => console.error("Error al revisar insignias del voluntario:", error.message));
      }
    }

    return res.json({ application: { id: req.params.id, status } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error interno al actualizar postulación:", err.message);
    return res.status(500).json({ message: "Ocurrió un error al procesar la solicitud. Inténtalo de nuevo." });
  } finally {
    client.release();
  }
});

/**
 * GET /api/applications/verificar/:idIniciativa
 * Verifica si el voluntario ya se postuló a una iniciativa.
 */
applicationsRouter.get("/verificar/:idIniciativa", auth(), async (req, res) => {
  try {
    const { idIniciativa } = req.params;
    const idVoluntario = req.user.id;

    const existente = await buscarPostulacion({
      idiniciativa: idIniciativa,
      idvoluntario: idVoluntario,
    });

    return res.json({ yaPostulado: !!existente });
  } catch (err) {
    console.error("Error al verificar postulación:", err.message);
    return res.status(500).json({ message: "Error al verificar." });
  }
});