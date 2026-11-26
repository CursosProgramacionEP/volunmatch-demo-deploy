/**
 * @file HistoryPage.jsx
 * @description Página de historial del usuario autenticado.
 * Muestra y filtra las iniciativas de una empresa o las actividades/postulaciones
 * de un voluntario, permitiendo buscar por texto, estado y rango de fechas.
 *
 * @module pages/HistoryPage
 * @requires react
 * @requires lucide-react
 * @requires ../../components/comunes/Cargador.jsx
 * @requires ../../components/comunes/EstadoVacio.jsx
 * @requires ../../components/comunes/Boton.jsx
 * @requires ../../services/cliente-api.js
 * @requires ../../navigation/navegacion.js
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  Search,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { Loader } from "../../components/comunes/Cargador.jsx";
import { EmptyState } from "../../components/comunes/EstadoVacio.jsx";
import { Button } from "../../components/comunes/Boton.jsx";
import { Modal } from "../../components/comunes/VentanaModal.jsx";
import { api } from "../../services/cliente-api.js";
import { go } from "../../navigation/navegacion.js";
import { formatInitiativeDate } from "../../utils/fechas.js";

/**
 * Etiquetas legibles en español para cada estado del historial.
 * Se usa tanto en el `<select>` de filtros como en cada ítem del listado.
 *
 * @constant {Object<string, string>}
 */

const STATUS_LABELS = {
  active: "Activa",
  completed: "Finalizada",
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "No aceptado",
  cancelled: "Cancelada",
};

const COMPANY_FILTER_STATUS_KEYS = ["active", "completed", "cancelled"];
const VOLUNTEER_FILTER_STATUS_KEYS = [
  "pending",
  "completed",
  "accepted",
  "rejected",
  "cancelled",
];

/**
 * Consulta y filtra el historial de iniciativas de una empresa o voluntario.
 *
 * @component
 * @param {Object} props
 * @param {string} props.token - Token de sesión para autenticar las peticiones.
 * @param {Object} props.user  - Usuario autenticado (`role`: `'company'` o `'volunteer'`).
 * @returns {JSX.Element} Vista de historial con filtros de búsqueda, estado y fechas.
 */

export function HistoryPage({ token, user, rateInitiativeId = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reviewItem, setReviewItem] = useState(null);
  const [ratingItem, setRatingItem] = useState(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [ratingNotice, setRatingNotice] = useState("");
  const handledRatingNotification = useRef(null);

  useEffect(() => {
    const request =
      user.role === "company"
        ? api.myInitiatives(token)
        : api.activities(token);
    request
      .then((response) =>
        setItems(
          user.role === "company" ? response.initiatives : response.activities,
        ),
      )
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token, user.role]);

  useEffect(() => {
    if (!rateInitiativeId || user.role !== "volunteer" || handledRatingNotification.current === rateInitiativeId) return;
    const item = rateInitiativeId === 'pending'
      ? items.find((activity) => activity.ratingPending)
      : items.find((activity) => String(activity.id) === String(rateInitiativeId));
    if (!item) return;
    handledRatingNotification.current = rateInitiativeId;
    if (item.ratingPending) {
      openRating(item);
    } else if (item.ratingAvailable || item.ratingScore) {
      setReviewItem(item);
    }
  }, [items, rateInitiativeId, user.role]);

  const records = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        historyStatus: statusOf(item, user.role),
      })),
    [items, user.role],
  );
  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const matchesText =
          `${item.title} ${item.category} ${item.companyName || ""}`
            .toLowerCase()
            .includes(query.toLowerCase().trim());
        const matchesStatus = status === "all" || item.historyStatus === status;
        const date = new Date(item.date);
        const matchesFrom = !from || date >= new Date(`${from}T00:00:00`);
        const matchesTo = !to || date <= new Date(`${to}T23:59:59`);
        return matchesText && matchesStatus && matchesFrom && matchesTo;
      }),
    [records, query, status, from, to],
  );

  /**
   * Restablece todos los filtros (búsqueda, estado y rango de fechas).
   *
   * @returns {void}
   */

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setFrom("");
    setTo("");
  }

  function openRating(item) {
    setRatingItem(item);
    setRatingScore(0);
    setRatingComment("");
    setRatingError("");
    setRatingNotice("");
  }

  async function submitRating(event) {
    event.preventDefault();
    if (!ratingScore || !ratingItem) {
      setRatingError("Selecciona de 1 a 5 estrellas para continuar.");
      return;
    }
    setRatingBusy(true);
    setRatingError("");
    try {
      const response = await api.rateActivity(token, ratingItem.id, { score: ratingScore, comment: ratingComment });
      setItems((current) => current.map((item) => item.id === ratingItem.id
        ? { ...item, ratingPending: false, ratingAvailable: true, ratingScore, ratingComment }
        : item));
      setRatingNotice(response.message || 'Tu valoración quedó registrada. El certificado se enviará a tu correo electrónico.');
      setRatingItem(null);
    } catch (requestError) {
      setRatingError(requestError.message);
    } finally {
      setRatingBusy(false);
    }
  }

  const roleTitle =
    user.role === "company"
      ? "Historial de iniciativas"
      : "Mi historial de voluntariado";
  const roleText =
    user.role === "company"
      ? "Consulta tus convocatorias activas, finalizadas o canceladas."
      : "Revisa tus postulaciones y actividades registradas.";
  const filterStatusKeys =
    user.role === "company"
      ? COMPANY_FILTER_STATUS_KEYS
      : VOLUNTEER_FILTER_STATUS_KEYS;

  return (
    <section className="workspace-content history-page">
      <div className="page-title">
        <div>
          <p className="section-kicker">TRAYECTORIA Y SEGUIMIENTO</p>
          <h1>{roleTitle}</h1>
          <p>{roleText}</p>
        </div>
        <span className="page-title__badge">
          <Clock3 size={18} />
          {filtered.length} registros
        </span>
      </div>
      <section className="history-filters">
        <label className="search-box">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar iniciativas..."
          />
        </label>
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            {filterStatusKeys.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <Button variant="secondary" icon={Filter} onClick={clearFilters}>
          Limpiar
        </Button>
      </section>
      {loading ? (
        <Loader label="Cargando historial..." />
      ) : error ? (
        <EmptyState title="No pudimos cargar el historial" text={error} />
      ) : filtered.length ? (
        <>
          {ratingNotice && <div className="empty-inline"><CheckCircle2 size={20} />{ratingNotice}</div>}
          <div className="history-list">
            {filtered.map((item) => (
              <HistoryItem
                item={item}
                key={item.id}
                role={user.role}
                onOpenReviews={setReviewItem}
                onRate={openRating}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No encontramos resultados"
          text="Ajusta los filtros o registra nuevas actividades."
          action={clearFilters}
          actionLabel="Limpiar filtros"
        />
      )}
      {reviewItem && (
        <ReviewsModal
          item={reviewItem}
          token={token}
          onClose={() => setReviewItem(null)}
        />
      )}
      {ratingItem && (
        <VolunteerRatingModal
          item={ratingItem}
          score={ratingScore}
          comment={ratingComment}
          busy={ratingBusy}
          error={ratingError}
          onScore={setRatingScore}
          onComment={setRatingComment}
          onClose={() => !ratingBusy && setRatingItem(null)}
          onSubmit={submitRating}
        />
      )}
    </section>
  );
}

/**
 * Renderiza una tarjeta de historial con estado, datos de la iniciativa
 * y un botón para ir al detalle.
 *
 * @param {Object} props
 * @param {Object} props.item - Registro enriquecido con `historyStatus`.
 * @param {'company'|'volunteer'} props.role - Rol del usuario para decidir qué metadatos mostrar.
 * @returns {JSX.Element} Ítem del historial.
 */

function HistoryItem({ item, role, onOpenReviews, onRate }) {
  const label = STATUS_LABELS[item.historyStatus] || "Activa";
  const ratingScore = role === "company" ? Number(item.ratingAverage) : Number(item.ratingScore);
  const ratingComment = role === "company" ? item.ratingSummaryComment : item.ratingComment;
  const hasRating = role === "company" ? Boolean(item.ratingAverage) : Boolean(item.ratingScore);
  return (
    <article className="history-item">
      <span className={`history-status history-status--${item.historyStatus}`}>
        {statusIcon(item.historyStatus)} {label}
      </span>
      <div className="history-item__main">
        <p className="company-label">
          {role === "company" ? item.category : `Empresa: ${item.companyName}`}
        </p>
        <h2>{item.title}</h2>
        <p>{item.summary}</p>
        <div>
          <span>
            <CalendarDays size={15} />
            Inicio: {formatInitiativeDate(item.date)}
          </span>
          <span>
            <CalendarRange size={15} />
            Fin: {formatInitiativeDate(item.endDate)}
          </span>
          <span>
            <MapPin size={15} />
            {item.location || "Lugar por definir"}
          </span>
          {role === "company" && (
            <span>
              <Users size={15} />
              Cupo: {item.quota}
            </span>
          )}
        </div>
        {hasRating && (
          <div className={`history-rating${ratingComment ? "" : " history-rating--only-score"}`}>
            {ratingComment && <p>“{ratingComment}”</p>}
            <div className="history-rating__score" aria-label={`${role === "company" ? "Promedio recibido" : "Valoración enviada"}: ${ratingScore.toFixed(1)} de 5 estrellas`}>
              <span aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill="currentColor" className={star <= Math.round(ratingScore) ? "is-filled" : ""} />
                ))}
              </span>
              <b>{ratingScore.toFixed(1)}</b>
            </div>
          </div>
        )}
      </div>
      <div className="history-item__actions">
        {item.historyStatus === "completed" ? (
          <Button variant="secondary" onClick={() => role === "volunteer" && item.ratingPending ? onRate(item) : onOpenReviews(item)}>
            {role === "volunteer" && item.ratingPending ? "Calificar" : "Reseña"}
          </Button>
        ) : role === "volunteer" && item.applicationStatus === "accepted" && item.status !== "cancelled" ? (
          <Button variant="secondary" onClick={() => go(`/initiative/${item.id}`)}>Ver detalles</Button>
        ) : (
          <Button variant="secondary" onClick={() => go(`/initiative/${item.id}`)}>Ver detalles</Button>
        )}
      </div>
    </article>
  );
}

function VolunteerRatingModal({ item, score, comment, busy, error, onScore, onComment, onClose, onSubmit }) {
  return (
    <Modal onClose={onClose}>
      <form className="rating-modal" onSubmit={onSubmit}>
        <span className="rating-modal__icon"><Star size={20} fill="currentColor" /></span>
        <h2>Valora tu experiencia</h2>
        <p>Cuéntanos cómo fue tu participación en <b>{item.title}</b> con {item.companyName}.</p>
        <section className="rating-modal__score">
          <b>NIVEL DE SATISFACCIÓN</b>
          <small>Selecciona de 1 a 5 estrellas</small>
          <div className="rating-stars" role="group" aria-label="Nivel de satisfacción">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" className={value <= score ? 'active' : ''} onClick={() => onScore(value)} aria-label={`${value} estrellas`} aria-pressed={score === value}>
                <Star size={27} fill="currentColor" />
              </button>
            ))}
          </div>
          <span className="rating-modal__badge">{score ? `${score} de 5 estrellas` : 'Elige tu puntuación'}</span>
        </section>
        <label className="field">
          <span>Comentario <small>Opcional</small></span>
          <textarea maxLength={300} value={comment} onChange={(event) => onComment(event.target.value)} placeholder="Comparte qué destacarías o qué se podría mejorar..." />
          <small className="rating-modal__counter">{comment.length}/300</small>
        </label>
        {error && <small className="field-error" role="alert">{error}</small>}
        <footer className="rating-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Enviando...' : 'Enviar valoración'}</Button>
        </footer>
      </form>
    </Modal>
  );
}

function ReviewsModal({ item, token, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.initiativeReviews(token, item.id)
      .then((response) => {
        if (active) setReviews(response.reviews || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [item.id, token]);

  return (
    <Modal onClose={onClose}>
      <section className="reviews-modal">
        <p className="section-kicker">RESEÑAS DE LA INICIATIVA</p>
        <h2>{item.title}</h2>
        {loading ? (
          <Loader label="Cargando reseñas..." />
        ) : error ? (
          <p className="reviews-modal__message" role="alert">{error}</p>
        ) : reviews.length ? (
          <div className="reviews-modal__list">
            {reviews.map((review) => (
              <article className="reviews-modal__item" key={review.id}>
                <div className="reviews-modal__meta">
                  <span aria-label={`${review.score} de 5 estrellas`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        fill="currentColor"
                        className={star <= review.score ? "is-filled" : ""}
                      />
                    ))}
                  </span>
                  <b>{review.score}.0</b>
                  <time>{formatDate(review.createdAt)}</time>
                </div>
                <p>{review.comment?.trim() || "Sin comentario escrito."}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="reviews-modal__message">Aún no hay reseñas para esta iniciativa.</p>
        )}
      </section>
    </Modal>
  );
}

/**
 * Normaliza el estado de una iniciativa o postulación a uno de los valores
 * de `STATUS_LABELS`, según el rol del usuario.
 *
 * @param {Object} item - Iniciativa o actividad.
 * @param {'company'|'volunteer'} role - Rol del usuario.
 * @returns {'active'|'completed'|'pending'|'accepted'|'rejected'|'cancelled'} Estado normalizado.
 */

function statusOf(item, role) {
  if (item.status === "cancelled") return "cancelled";
  if (role === "volunteer") {
    if (["pending", "rejected"].includes(item.applicationStatus)) {
      return item.applicationStatus;
    }
    if (item.status === "completed" || item.ratingAvailable || item.ratingScore) return "completed";
    if (item.applicationStatus === "accepted") return "accepted";
    return item.applicationStatus || "pending";
  }
  if (item.status === "completed" || item.ratingScore) return "completed";
  if (item.status === "done") return "completed";
  return "active";
}

/**
 * Devuelve el icono de lucide-react correspondiente a un estado del historial.
 *
 * @param {string} status - Estado normalizado (`completed`, `accepted`, `cancelled`, `rejected`, etc.).
 * @returns {JSX.Element} Icono representativo del estado.
 */

function statusIcon(status) {
  if (status === "completed" || status === "accepted")
    return <CheckCircle2 size={14} />;
  if (status === "cancelled" || status === "rejected")
    return <XCircle size={14} />;
  return <Clock3 size={14} />;
}

/**
 * Formatea una fecha al formato local `es-PE` (día, mes abreviado y año).
 *
 * @param {string|Date} value - Fecha a formatear.
 * @returns {string} Fecha formateada o `'Sin fecha'` si el valor es nulo o inválido.
 */

function formatDate(value) {
  return formatInitiativeDate(value);
}
