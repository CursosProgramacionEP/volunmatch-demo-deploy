// Helper para construir URLs del backend
// Convierte rutas relativas como /uploads/... a URLs completas del servidor

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

/**
 * Construye la URL completa del backend a partir de una ruta relativa.
 * @param {string} path Ruta relativa (por ejemplo: /uploads/foto.jpg)
 * @returns {string|null} URL completa o null si no hay path
 */
export function backendUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}${path}`;
}

/**
 * Construye la URL con cache-buster (para forzar recarga).
 */
export function backendUrlWithVersion(path) {
    const url = backendUrl(path);
    if (!url) return null;
    return `${url}?v=${encodeURIComponent(path)}`;
}