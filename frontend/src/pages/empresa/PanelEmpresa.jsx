/**
 * @file CompanyDashboard.jsx
 * @description Panel principal de la empresa para gestionar iniciativas,
 * revisar postulaciones y visualizar estadísticas del tablero.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Check, CircleCheck, ClipboardList, FileClock, LayoutDashboard, Plus, Users } from 'lucide-react';
import { Loader } from '../../components/comunes/Cargador.jsx';
import { EmptyState } from '../../components/comunes/EstadoVacio.jsx';
import { Button } from '../../components/comunes/Boton.jsx';
import { ConfirmationModal } from '../../components/comunes/ModalConfirmacion.jsx';
import { Field } from '../../components/comunes/Campo.jsx';
import { Modal } from '../../components/comunes/VentanaModal.jsx';
import { Stat } from '../../components/aplicacion/Estadistica.jsx';
import { InitiativeCard } from '../../components/iniciativas/TarjetaIniciativa.jsx';
import { EditInitiativeModal } from '../../components/iniciativas/ModalEditarIniciativa.jsx';
import { api } from '../../services/cliente-api.js';
import { go } from '../../navigation/navegacion.js';
import { backendUrlWithVersion } from '../../services/urls.js';

/**
 * Muestra el panel principal de la empresa.
 *
 * Obtiene las iniciativas, las postulaciones y las estadísticas desde
 * el backend, permitiendo aceptar o rechazar postulaciones y acceder
 * a la gestión de cada iniciativa.
 *
 * @param {Object} props Propiedades del componente.
 * @param {string} props.token Token de autenticación de la empresa.
 * @param {Function} props.showNotice Función que muestra avisos temporales.
 * @returns {JSX.Element} Interfaz del panel de empresa.
 */
export function CompanyDashboard({ token, showNotice }) {
  const [initiatives, setInitiatives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null); // NUEVO: Estado para los contadores reales
  const [loading, setLoading] = useState(true);
  const [pendingDiscard, setPendingDiscard] = useState(null);
  const [responding, setResponding] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState(null);
  const [pendingInitiativeCancel, setPendingInitiativeCancel] = useState(null);
  const [cancellingInitiative, setCancellingInitiative] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  function getCancellationState(initiative) {
    const now = Date.now();
    const start = new Date(`${String(initiative.date).slice(0, 10)}T00:00:00-05:00`).getTime();
    const end = new Date(`${String(initiative.endDate).slice(0, 10)}T23:59:59-05:00`).getTime();
    const hasVolunteers = Number(initiative.joinedCount || 0) > 0;
    const hasLockedTasks = (initiative.tasks || []).some((task) => task.status === 'in_progress' || task.status === 'done');
    if (initiative.status === 'completed' || (Number.isFinite(end) && end <= now)) return 'finished';
    if (hasLockedTasks) return 'tasks_locked';
    if (!hasVolunteers) return 'direct';
    if (Number.isFinite(start) && start > now && start - now < 24 * 60 * 60 * 1000) return 'within_24h';
    return 'with_volunteers';
  }

  /**
     * Carga la información del panel de la empresa.
     *
     * Obtiene de forma simultánea las iniciativas, las postulaciones
     * y las estadísticas desde el backend para actualizar la interfaz.
     *
     * @returns {void}
     */
  const load = () => {
    setLoading(true);
    // NUEVO: Ahora cargamos también el dashboard
    Promise.all([
      api.myInitiatives(token, { activeOnly: true }),
      api.applications(token),
      api.dashboard(token) // <--- Llamada a la nueva ruta del backend
    ])
      .then(([initiativeData, applicationData, dashboardData]) => {
        setInitiatives(initiativeData.initiatives);
        setApplications(applicationData.applications);
        setStats(dashboardData.stats); // Guardamos los contadores del backend
      })
      .catch((error) => showNotice({ type: 'error', text: error.message }))
      .finally(() => setLoading(false));
  };

  /**
  * Ejecuta la carga inicial del panel cuando el componente se monta
  * o cuando cambia el token de autenticación.
  */

  useEffect(load, [token]);

  /**
     * Responde una postulación de un voluntario.
     *
     * Envía al backend la decisión de aceptar o rechazar la solicitud,
     * muestra un aviso y recarga los datos del panel.
     *
     * @param {number|string} id Identificador de la postulación.
     * @param {"accepted"|"rejected"} status Estado que se asignará a la postulación.
     * @returns {Promise<void>} Promesa que finaliza cuando la respuesta es procesada.
     */
  async function respond(id, status) {
    setResponding(true);
    try {
      await api.respondApplication(token, id, status);
      showNotice({
        text: status === 'accepted'
          ? 'Postulación aceptada. El tablero ya está habilitado para el voluntario.'
          : 'Postulación rechazada.',
      });
      load(); // Esto recarga los datos y actualiza los contadores automáticamente
      return true;
    } catch (error) {
      showNotice({ type: 'error', text: error.message });
      return false;
    } finally {
      setResponding(false);
    window.location.reload(); 
    }
  }

  async function editInitiative(initiative) {
    try {
      // La vista de detalle aplica la autorización de la empresa antes de
      // entregar el enlace privado de una iniciativa virtual.
      const response = await api.initiative(token, initiative.id);
      setEditingInitiative(response.initiative);
    } catch (error) {
      showNotice({ type: 'error', text: error.message });
    }
  }

  async function cancelInitiative() {
    if (!pendingInitiativeCancel) return;
    setCancellingInitiative(true);
    try {
      await api.cancelInitiative(token, pendingInitiativeCancel.id, cancellationReason);
      setPendingInitiativeCancel(null);
      setCancellationReason('');
      showNotice({ text: 'La iniciativa fue cancelada y se conservará en el historial.' });
      load();
    } catch (error) {
      showNotice({ type: 'error', text: error.message });
    } finally {
      setCancellingInitiative(false);
    }
  }

  async function requestCancellationException() {
    if (!pendingInitiativeCancel) return;
    setCancellingInitiative(true);
    try {
      const response = await api.requestInitiativeCancellation(token, pendingInitiativeCancel.id, cancellationReason);
      setPendingInitiativeCancel(null);
      setCancellationReason('');
      showNotice({ text: response.message });
    } catch (error) {
      showNotice({ type: 'error', text: error.message });
    } finally {
      setCancellingInitiative(false);
    }
  }
// Postulaciones que aún no han sido revisadas por la empresa.
const pending = applications.filter((application) => application.status === 'pending');
  return (
    <section className="workspace-content company-dashboard">
      <div className="page-title page-title--split">
        <div>
          <p className="section-kicker">PANEL DE EMPRESA</p>
          <h1>Mis iniciativas</h1>
          <p>Gestiona convocatorias y responde a las personas que quieren sumarse.</p>
        </div>
        <Button onClick={() => go('/company/new')} icon={Plus}>Nueva iniciativa</Button>
      </div>

      <div className="stats-grid">
        {/* Usamos los datos del backend si están disponibles, si no, mostramos 0 */}
        <Stat
          icon={LayoutDashboard}
          label="Iniciativas activas"
          value={stats ? stats.totalInitiatives : initiatives.length}
        />
        <Stat
          icon={Users}
          label="Voluntarios aceptados"
          value={stats ? stats.acceptedVolunteers : 0}
        />
        <Stat
          icon={ClipboardList}
          label="Tareas creadas"
          value={stats ? stats.totalTasks : 0}
        />
        <Stat
          icon={FileClock}
          label="Postulaciones por revisar"
          value={stats ? stats.pendingApplications : pending.length}
          highlight
        />
      </div>

      {loading ? (
        <Loader />
      ) : (
        <>
          <section className="review-section">
            <div className="section-head">
              <div>
                <h2>Postulaciones recientes</h2>
                <p>Revisa cada solicitud para habilitar el acceso al tablero Kanban.</p>
              </div>
              <span className="count-pill">{pending.length} pendientes</span>
            </div>

            {pending.length ? (
              <div className="application-list">
                {pending.map((application) => (
                  <article className="application-row" key={application.id}>
                    <div className="avatar-large">
                      {application.volunteer.photoUrl ? (
                        <img
                          className="avatar-large__image"
                          src={backendUrlWithVersion(application.volunteer.photoUrl)}
                          alt={`Foto de ${application.volunteer.fullName}`}
                        />
                      ) : (
                        application.volunteer.fullName.split(' ').map((name) => name[0]).slice(0, 2).join('')
                      )}
                    </div>
                    <div className="application-row__main">
                      <b>{application.volunteer.fullName}</b>
                      <span>{application.volunteer.email}</span>
                      <small>Postuló a <strong>{application.initiative.title}</strong></small>
                    </div>
                    <div className="application-row__actions">
                      <Button variant="ghost" onClick={() => go(`/volunteer/profile/${application.volunteer.id}`)}>Ver perfil</Button>
                      <Button variant="secondary" onClick={() => setPendingDiscard(application)}>Descartar</Button>
                      <Button onClick={() => respond(application.id, 'accepted')} icon={Check}>Aceptar</Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-inline">
                <CircleCheck size={22} />
                No hay postulaciones pendientes por revisar.
              </div>
            )}
          </section>

          <section className="company-initiative-section">
            <div className="section-head">
              <div>
                <h2>Iniciativas publicadas</h2>
                <p>Abre una iniciativa para ver sus detalles y tareas.</p>
              </div>
            </div>

            {initiatives.length ? (
              <div className="initiative-grid company-card-grid">
                {initiatives.map((initiative) => (
                  <InitiativeCard
                    key={initiative.id}
                    initiative={initiative}
                    actionLabel="Ver iniciativa"
                    actionVariant="secondary"
                    isCompany
                    onOpen={() => go(`/initiative/${initiative.id}`)}
                    onEdit={editInitiative}
                    onCancel={setPendingInitiativeCancel}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No tienes iniciativas activas"
                text="Las iniciativas finalizadas ya no aparecen en esta lista. Puedes consultar el historial o publicar una nueva convocatoria."
                action={() => go('/company/new')}
                actionLabel="Crear iniciativa"
              />
            )}
          </section>
        </>
      )}
      {pendingDiscard && (
        <ConfirmationModal
          title="¿Descartar esta postulación?"
          description={`La postulación de ${pendingDiscard.volunteer.fullName} para ${pendingDiscard.initiative.title} será descartada.`}
          confirmLabel="Sí, descartar"
          variant="danger"
          busy={responding}
          onCancel={() => setPendingDiscard(null)}
          onConfirm={async () => {
            if (await respond(pendingDiscard.id, 'rejected')) setPendingDiscard(null);
          }}
        />
      )}
      {pendingInitiativeCancel && (
        (() => {
          const state = getCancellationState(pendingInitiativeCancel);
          const exceptionRequired = state === 'within_24h';
          const description = {
            direct: 'Puedes cancelar esta iniciativa. La acción quedará registrada en el historial.',
            with_volunteers: 'La cancelación notificará a los voluntarios inscritos. Indica el motivo.',
            within_24h: 'La cancelación normal está bloqueada por la proximidad del inicio. Puedes solicitar una excepción justificada.',
            tasks_locked: 'No se puede cancelar la iniciativa porque tiene tareas en proceso o finalizadas.',
            finished: 'No es posible cancelar una iniciativa finalizada.',
          }[state];
          return (
            <Modal onClose={cancellingInitiative ? undefined : () => { setPendingInitiativeCancel(null); setCancellationReason(''); }}>
              <form className="initiative-cancel-form" onSubmit={(event) => { event.preventDefault(); exceptionRequired ? requestCancellationException() : cancelInitiative(); }}>
                <p className="section-kicker">GESTIÓN DE INICIATIVA</p>
                <h2>{state === 'finished' ? 'Iniciativa finalizada' : state === 'tasks_locked' ? 'Cancelación no disponible' : exceptionRequired ? 'Solicitar excepción' : '¿Cancelar esta iniciativa?'}</h2>
                <p>{description}</p>
                {state === 'with_volunteers' && (
                  <Field label="Motivo de cancelación" as="textarea" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} minLength={5} maxLength={1000} required />
                )}
                {exceptionRequired && (
                  <Field label="Justificación de la excepción" as="textarea" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} minLength={10} maxLength={1000} required hint="La solicitud será evaluada. Enviarla no cancela la iniciativa." />
                )}
                <footer className="form-footer">
                  <Button type="button" variant="secondary" disabled={cancellingInitiative} onClick={() => { setPendingInitiativeCancel(null); setCancellationReason(''); }}>Volver</Button>
                  {state !== 'finished' && state !== 'tasks_locked' && <Button type="submit" variant="danger" disabled={cancellingInitiative || ((state === 'with_volunteers' || exceptionRequired) && cancellationReason.trim().length < (exceptionRequired ? 10 : 5))}>{cancellingInitiative ? 'Procesando...' : exceptionRequired ? 'Solicitar excepción' : state === 'with_volunteers' ? 'Continuar con la cancelación' : 'Cancelar iniciativa'}</Button>}
                </footer>
              </form>
            </Modal>
          );
        })()
      )}
      {editingInitiative && (
        <EditInitiativeModal
          token={token}
          initiative={editingInitiative}
          showNotice={showNotice}
          onClose={() => setEditingInitiative(null)}
          onSaved={(updated) => {
            setInitiatives((current) => current.map((item) => item.id === updated.id ? updated : item));
            setEditingInitiative(null);
          }}
        />
      )}
    </section>
  );
}
