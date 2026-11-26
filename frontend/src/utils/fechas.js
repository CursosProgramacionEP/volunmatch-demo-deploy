/**
 * Convierte una fecha de la API a una fecha local sin desplazar el día por la
 * zona horaria. PostgreSQL entrega las columnas DATE como ISO a medianoche;
 * construirla desde año, mes y día evita que se muestre el día anterior.
 */
function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formatea fechas de iniciativas de forma consistente para la interfaz. */
export function formatInitiativeDate(value) {
  const date = parseDateOnly(value);
  if (!date) return "Fecha por definir";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Formato compacto para las tarjetas: solo día y mes. */
export function formatInitiativeDayMonth(value) {
  const date = parseDateOnly(value);
  if (!date) return "Fecha por definir";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

/** Recupera hora inicial y final desde el rango que almacena la iniciativa. */
export function splitSchedule(value) {
  const match = String(value || "").match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  return match ? { startTime: match[1], endTime: match[2] } : { startTime: "", endTime: "" };
}
