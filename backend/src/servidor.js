// Punto de entrada de la API de VolunMatch.
import express from "express";
import cors from "cors";
import helmet from "helmet"; // ✅ Importación única
import { PORT } from "./config/entorno.js";

import { authRouter } from "./routes/autenticacion.rutas.js";
import { initiativesRouter } from "./routes/iniciativas.rutas.js";
import { applicationsRouter } from "./routes/postulaciones.rutas.js";
import { activitiesRouter } from "./routes/actividades.rutas.js";
import { profilesRouter } from "./routes/perfiles.rutas.js";
import { notificationsRouter } from "./routes/notificaciones.rutas.js";
import { reportsRouter } from "./routes/reportes.rutas.js";
import { iaRouter } from "./routes/ia.rutas.js";
import { asistenteRouter } from "./routes/asistente.rutas.js";
import pool from "./config/db.js";
import { procesarCierresDeIniciativas } from "./helpers/cierreIniciativas.js";

const app = express();

// 1. Middleware de seguridad
app.use(helmet());

// 2. CORS configurado con los orígenes de tu compañera Y tu validación estricta
const allowedOrigins = [
  "http://64.181.207.220",
  "http://localhost:5173", // Frontend local (Vite)
  "http://localhost:3000", // Frontend local (alternativo)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir peticiones sin origen (Postman/Insomnia) en desarrollo
      if (!origin) return callback(null, true);

      // Validar si el origen está en la lista permitida
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(
          new Error("CORS no permitido para este origen."),
          false,
        );
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/uploads", express.static("uploads"));

// Rutas de la API
app.use("/api/auth", authRouter);
app.use("/api/initiatives", initiativesRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/ia", iaRouter);
app.use("/api/asistente", asistenteRouter);

// Ruta de prueba
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS ahora");
    res.json({ ok: true, hora: result.rows[0].ahora });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Manejador de errores
app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(500)
    .json({ message: "Ocurrió un error inesperado en el servidor." });
});

app.listen(PORT, () => {
  console.log(`VolunMatch API listo en http://localhost:${PORT}`);
  let procesando = false;
  const revisarCierres = async () => {
    if (procesando) return;
    procesando = true;
    try {
      await procesarCierresDeIniciativas();
    } catch (error) {
      console.error("Error al procesar cierres de iniciativas:", error.message);
    } finally {
      procesando = false;
    }
  };
  void revisarCierres();
  const temporizador = setInterval(revisarCierres, 60_000);
  temporizador.unref();
});
