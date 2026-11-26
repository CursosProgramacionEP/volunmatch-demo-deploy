import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/** Resuelve la ubicación del módulo para cargar la configuración del backend. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// La ruta explícita permite iniciar el servidor desde cualquier directorio.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

/** Pool compartido de PostgreSQL; sus valores se pueden reemplazar con variables de entorno. */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'VolunMatch',
});

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error inesperado en PostgreSQL:', err.message);
});

export default pool;
