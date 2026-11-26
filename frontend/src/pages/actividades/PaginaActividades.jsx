import { useEffect, useState } from 'react';
import { CalendarDays, CalendarRange, Users, Clock3, XCircle, Star, Video } from 'lucide-react';
import { Loader } from '../../components/comunes/Cargador.jsx';
import { EmptyState } from '../../components/comunes/EstadoVacio.jsx';
import { Button } from '../../components/comunes/Boton.jsx'; 
import { api } from '../../services/cliente-api.js';
import { go } from '../../navigation/navegacion.js';
import { Modal } from '../../components/comunes/VentanaModal.jsx';
import { formatInitiativeDayMonth } from '../../utils/fechas.js';

/**
 * Página que muestra las actividades a las que el voluntario se ha postulado.
 *
 * Obtiene las actividades desde la API al cargar el componente y muestra
 * diferentes acciones según el estado de la postulación.
 *
 * @param {Object} props Propiedades del componente.
 * @param {string} props.token Token de autenticación del usuario.
 * @returns {JSX.Element} Interfaz de la página de actividades.
 */

export function ActivitiesPage({ token }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingActivity, setRatingActivity] = useState(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState('');

  /**
   * Carga las actividades del voluntario cuando el componente se monta
   * o cuando cambia el token de autenticación.
   */

  useEffect(() => {
    api.activities(token, { activeOnly: true })
      .then((response) => {
        setActivities(response.activities);
        setRatingActivity((current) => current || response.activities.find((activity) => activity.ratingPending) || null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function openRating(activity) {
    setScore(0);
    setComment('');
    setRatingError('');
    setRatingActivity(activity);
  }

  async function submitRating(event) {
    event.preventDefault();
    if (!score || !ratingActivity) {
      setRatingError('Selecciona de 1 a 5 estrellas para continuar.');
      return;
    }
    setRatingBusy(true);
    setRatingError('');
    try {
      await api.rateActivity(token, ratingActivity.id, { score, comment });
      setActivities((current) => current.map((activity) => activity.id === ratingActivity.id
        ? { ...activity, ratingPending: false, ratingScore: score }
        : activity));
      setRatingActivity(null);
    } catch (error) {
      setRatingError(error.message);
    } finally {
      setRatingBusy(false);
    }
  }

  return (
    <section className="workspace-content activities-page">
      <div className="page-title">
        <div>
          <p className="section-kicker">TU PARTICIPACIÓN</p>
          <h1>Mis actividades</h1>
          <p>Aquí aparecen las iniciativas activas a las que te has postulado.</p>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : activities.length ? (
        <div className="initiative-grid">
          {activities.map((activity) => (
            <article className="company-initiative-card" key={activity.id}>
              
              {/* --- INICIO DE LA MODIFICACIÓN PARA LA IMAGEN --- */}
              <div
                className={`company-initiative-card__top cover--${activity.cover}`}
                style={{ position: 'relative', overflow: 'hidden', minHeight: '150px' }}
              >
                {activity.imagen ? (
                  <img 
                    src={activity.imagen} 
                    alt={activity.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} 
                  />
                ) : (
                  <span>{activity.category}</span>
                )}
              </div>
              {/* --- FIN DE LA MODIFICACIÓN --- */}

              <div>
                <p className="company-label">Empresa: {activity.companyName}</p>
                <h3>{activity.title}</h3>
                <p>{activity.summary}</p>
                <div className="initiative-card__meta">
                  <span><CalendarDays size={15} />{formatInitiativeDayMonth(activity.date)} — {formatInitiativeDayMonth(activity.endDate)}</span>
                  {activity.modalidad === 'virtual' && activity.schedule && (
                    <span><Clock3 size={15} />{activity.schedule}</span>
                  )}
                  <span title={`${Math.max(Number(activity.quota) - Number(activity.joinedCount), 0)} cupos disponibles`}>
                    <Users size={15} />{activity.joinedCount}/{activity.quota} · {Math.max(Number(activity.quota) - Number(activity.joinedCount), 0)} disponibles
                  </span>
                </div>

                {/* Renderizado condicional del botón según el estado de la postulación */}
                {activity.ratingPending ? (
                  <Button onClick={() => openRating(activity)} icon={Star}>Valorar experiencia</Button>
                ) : activity.applicationStatus === 'accepted' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                    {activity.modalidad === 'virtual' && activity.meetingUrl && (
                      <a
                        href={activity.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--primary"
                        style={{ textDecoration: 'none' }}
                      >
                        <Video size={17} /> Unirse a la reunión
                      </a>
                    )}
                    <Button variant={activity.modalidad === 'virtual' ? 'secondary' : 'primary'} onClick={() => go(`/kanban/${activity.id}`)}>
                      Ver tablero Kanban
                    </Button>
                  </div>
                ) : activity.applicationStatus === "pending" ? (
                  <Button variant="secondary" disabled>
                    <Clock3 size={16} /> Pendiente de aprobación
                  </Button>
                ) : activity.applicationStatus === "rejected" ? (
                  <Button variant="secondary" disabled>
                    <XCircle size={16} /> Postulación rechazada
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tienes actividades activas"
          text="Las iniciativas finalizadas puedes consultarlas en Mi historial. Explora otras iniciativas para encontrar nuevas oportunidades."
          action={() => go("/volunteer/explore")}
          actionLabel="Explorar iniciativas"
        />
      )}
      {ratingActivity && (
        <Modal onClose={() => setRatingActivity(null)}>
          <form className="rating-modal" onSubmit={submitRating}>
            <span className="rating-modal__icon"><Star size={20} fill="currentColor" /></span>
            <h2>Valora tu experiencia</h2>
            <p>Tu opinión ayudará a mejorar futuras actividades y reconocerá tu esfuerzo en <b>{ratingActivity.title}</b> con {ratingActivity.companyName}.</p>
            <section className="rating-modal__score">
              <b>NIVEL DE SATISFACCIÓN</b>
              <small>Selecciona de 1 a 5 estrellas según tu satisfacción general</small>
              <div className="rating-stars" role="group" aria-label="Nivel de satisfacción">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" className={value <= score ? 'active' : ''} onClick={() => setScore(value)} aria-label={`${value} estrellas`} aria-pressed={score === value}>
                    <Star size={27} fill="currentColor" />
                  </button>
                ))}
              </div>
              <span className="rating-modal__badge">{score ? `${score} de 5 · ${score >= 4 ? '¡Excelente!' : 'Gracias por compartir!'}` : 'Elige tu puntuación'}</span>
            </section>
            <label className="field">
              <span>Recomendaciones o comentarios <small>Opcional</small></span>
              <textarea maxLength={300} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Cuéntanos qué tal fue tu experiencia, qué destacarías o qué se podría mejorar para la próxima jornada..." />
              <small className="rating-modal__counter">{comment.length}/300</small>
            </label>
            {ratingError && <small className="field-error" role="alert">{ratingError}</small>}
            <footer className="rating-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setRatingActivity(null)}>Cancelar</Button>
              <Button type="submit" disabled={ratingBusy}>{ratingBusy ? 'Enviando...' : '✓ Enviar valoración'}</Button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
