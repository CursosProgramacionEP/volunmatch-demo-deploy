// Cliente HTTP de la aplicación: aquí se concentran TODAS las llamadas a la API.
// Cada pantalla usa estas funciones en lugar de escribir "fetch" directamente.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

//  1. Función para el stream usando el TICKET (Solo se declara una vez)
export const notificationStreamUrl = (ticket) =>
  `${API_URL}/notifications/stream?ticket=${encodeURIComponent(ticket)}`;

// Función interna que arma la petición, agrega el token de sesión (si existe)
async function request(path, options = {}, token) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Verifica que la API esté ejecutándose e inténtalo nuevamente.",
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message || "No se pudo completar la solicitud.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  // Autenticación
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  recoverPassword: (payload) =>
    request("/auth/recover-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: (token) => request("/auth/me", {}, token),

  askVolunteerAssistant: (token, pregunta, historial = [], rutaActual = null) =>
    request(
      "/asistente/preguntar",
      {
        method: "POST",
        body: JSON.stringify({ pregunta, historial, rutaActual }),
      },
      token,
    ),

  // Notificaciones
  notifications: (token) => request("/notifications", {}, token),
  markNotificationRead: (token, id) =>
    request(`/notifications/${id}/read`, { method: "PATCH" }, token),

  // 2. Nueva función para pedir el ticket (Dentro del objeto api)
  getNotificationTicket: (token) =>
    request("/notifications/ticket", { method: "POST" }, token),

  // Iniciativas
  initiatives: (token, params = {}) =>
    request(`/initiatives?${new URLSearchParams(params)}`, {}, token),
  initiative: (token, id) => request(`/initiatives/${id}`, {}, token),
  initiativeReviews: (token, id) =>
    request(`/initiatives/${id}/reviews`, {}, token),
  myInitiatives: (token, params = {}) =>
    request(`/initiatives/mine?${new URLSearchParams(params)}`, {}, token),
  createInitiative: (token, payload) =>
    request(
      "/initiatives",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  updateInitiative: (token, id, payload) =>
    request(
      `/initiatives/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token,
    ),
  suggestTasks: (token, payload) =>
    request(
      "/initiatives/task-suggestions",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  cancelInitiative: (token, id, reason = "") =>
    request(
      `/initiatives/${id}/cancel`,
      { method: "PATCH", body: JSON.stringify({ reason }) },
      token,
    ),
  requestInitiativeCancellation: (token, id, reason) =>
    request(
      `/initiatives/${id}/cancel-request`,
      { method: "POST", body: JSON.stringify({ reason }) },
      token,
    ),
  board: (token, id) => request(`/initiatives/${id}/board`, {}, token),
  updateTask: (token, initiativeId, taskId, payload) =>
    request(
      `/initiatives/${initiativeId}/tasks/${taskId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token,
    ),
  deleteTask: (token, initiativeId, taskId) =>
    request(
      `/initiatives/${initiativeId}/tasks/${taskId}`,
      { method: "DELETE" },
      token,
    ),

  createTask: (token, initiativeId, payload) =>
    request(
      `/initiatives/${initiativeId}/tasks`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),

  // Dashboard de empresa (contadores)
  dashboard: (token) => request("/initiatives/dashboard", {}, token),

  // Postulaciones
  apply: (token, id, payload = {}) =>
    request(
      `/initiatives/${id}/applications`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  applications: (token) => request("/applications", {}, token),
  respondApplication: (token, id, status) =>
    request(
      `/applications/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
    ),

  // Verificar si el voluntario ya se postuló a una iniciativa
  verificarPostulacion: (token, idIniciativa) =>
    request(`/applications/verificar/${idIniciativa}`, {}, token),

  // Actividades del voluntario
  activities: (token, params = {}) =>
    request(`/activities?${new URLSearchParams(params)}`, {}, token),
  rateActivity: (token, id, payload) =>
    request(
      `/activities/${id}/rating`,
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),

  // Perfiles
  myProfile: (token) => request("/profiles/me", {}, token),
  updateMyProfile: (token, payload) =>
    request(
      "/profiles/me",
      { method: "PATCH", body: JSON.stringify(payload) },
      token,
    ),
  addCertification: (token, payload) =>
    request(
      "/profiles/me/certifications",
      { method: "POST", body: JSON.stringify(payload) },
      token,
    ),
  companyProfile: (token, id) => request(`/profiles/company/${id}`, {}, token),
  volunteerProfile: (token, id) =>
    request(`/profiles/volunteer/${id}`, {}, token),
  equipBadge: (token, badgeKey) =>
    request(
      "/profiles/me/badges/equipped",
      { method: "PATCH", body: JSON.stringify({ badgeKey }) },
      token,
    ),

  uploadCompanyLogo: async (token, file) => {
    const formData = new FormData();
    formData.append("logo", file);
    const response = await fetch(`${API_URL}/profiles/me/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al subir logo");
    return data;
  },
  uploadVolunteerPhoto: async (token, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const response = await fetch(`${API_URL}/profiles/me/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al subir foto");
    return data;
  },

  uploadCertification: async (token, file, data = {}) => {
    const formData = new FormData();
    formData.append("certification", file);
    if (data.title) formData.append("title", data.title);
    if (data.issuer) formData.append("issuer", data.issuer);
    if (data.issuedAt) formData.append("issuedAt", data.issuedAt);
    const response = await fetch(
      `${API_URL}/profiles/me/certifications/upload`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );
    const responseData = await response.json();
    if (!response.ok)
      throw new Error(
        responseData.message || "Error al subir la certificación.",
      );
    return responseData;
  },
};
