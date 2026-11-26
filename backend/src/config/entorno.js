// Variables de configuración del servidor.
// Se leen de las variables de entorno (archivo .env) y, si no existen,
// se usan valores por defecto para que el proyecto funcione en modo demo.

import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3001;

// Validación estricta para JWT_SECRET
if (!process.env.JWT_SECRET) {
    console.error("❌ ERROR CRÍTICO: La variable JWT_SECRET no está definida.");
    console.error("Asegúrate de configurarla en tu archivo .env o en los Secrets de GitHub.");
    process.exit(1); // Detiene la aplicación
}

export const JWT_SECRET = process.env.JWT_SECRET;