import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Users, Plus, ClipboardList } from "lucide-react";
import { Loader } from "../../components/comunes/Cargador.jsx";
import { EmptyState } from "../../components/comunes/EstadoVacio.jsx";
import { TaskCard } from "../../components/tablero/TarjetaTarea.jsx";
import { ModalNuevaTarea } from "./ModalNuevaTarea.jsx";
import { ConfirmationModal } from "../../components/comunes/ModalConfirmacion.jsx";
import { Button } from "../../components/comunes/Boton.jsx";
import { api } from "../../services/cliente-api.js";
import { go } from "../../navigation/navegacion.js";
import { statusMeta } from "../../constants/aplicacion.js";
import { ModalSugerenciasTareas } from "./ModalSugerenciasTareas.jsx";

const columns = ["pending", "in_progress", "done"];

export function KanbanPage({ token, user, initiativeId, showNotice }) {
  const [initiative, setInitiative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [updatingTask, setUpdatingTask] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);

  const isCompany = user?.role === "company";

  // 1. Función para cargar sin mostrar el loader (para que no parpadee la pantalla)
  const refreshBoard = () => {
    api
      .board(token, initiativeId)
      .then((response) => setInitiative(response.initiative))
      .catch((requestError) =>
        console.error("Error en auto-actualización", requestError),
      ); // No mostramos error en pantalla para no molestar
  };

  // 2. Función principal de carga (con loader, para la primera vez)
  const load = () => {
    setLoading(true);
    api
      .board(token, initiativeId)
      .then((response) => setInitiative(response.initiative))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };

  // 3. useEffect para la carga inicial
  useEffect(load, [token, initiativeId]);

  // 4. NUEVO useEffect para la actualización automática
  useEffect(() => {
    // Refrescamos cada 5 segundos (5000 ms)
    const intervalId = setInterval(refreshBoard, 5000);

    // Limpiamos el intervalo cuando el usuario sale de la página
    return () => clearInterval(intervalId);
  }, [token, initiativeId]);

  /** Actualiza una tarea y comunica al usuario el resultado de una acción confirmada. */
  async function updateTask(taskId, payload, successText = '') {
    setUpdatingTask(true);
    try {
      const response = await api.updateTask(token, initiative.id, taskId, payload);
      if (payload.claim) {
        const savedTask = response.task;
        setInitiative((current) => ({
          ...current,
          tasks: current.tasks.map((task) => task.id === taskId
            ? {
              ...task,
              status: 'pending',
              ownerId: savedTask.idvoluntario_asignado || user.id,
              ownerName: user.fullName,
              ownerPhotoUrl: user.fotoUrl || null,
              assignedAt: savedTask.fecha_asignacion || new Date().toISOString(),
            }
            : task),
        }));
      } else {
        load();
      }
      if (successText) showNotice({ text: successText });
      return true;
    } catch (requestError) {
      showNotice({ type: "error", text: requestError.message });
      return false;
    } finally {
      setUpdatingTask(false);
    }
  }

  async function onDrop(status) {
    if (!draggedId) return;

    // Bloquear arrastre si la tarea ya está finalizada
    const dragged = initiative.tasks.find((t) => t.id === draggedId);
    if (!isCompany && dragged && !dragged.ownerId) {
      if (status === "pending") setPendingMove({ task: dragged, claim: true });
      setDraggedId(null);
      return;
    }
    if (isCompany && dragged && !dragged.ownerId) {
      setDraggedId(null);
      return;
    }
    if (dragged?.status === "done" && status !== "done") {
      showNotice({
        type: "error",
        text: "No puedes mover una tarea finalizada.",
      });
      setDraggedId(null);
      return;
    }

    if (status === "done" && dragged.status !== "done") {
      setPendingMove({ task: dragged, status });
    } else {
      await updateTask(
        draggedId,
        { status },
        "El estado de la tarea fue actualizado.",
      );
    }
    setDraggedId(null);
  }

  /** Evita finalizar una tarea por accidente al requerir una confirmación explícita. */
  async function confirmPendingMove() {
    if (!pendingMove) return;
    const updated = await updateTask(
      pendingMove.task.id,
      { status: pendingMove.status },
      "Tarea marcada como finalizada.",
    );
    if (updated) setPendingMove(null);
  }

  async function handleCrearTarea(formData) {
    await api.createTask(token, initiative.id, formData);
    setShowNewTask(false);
    await load();
    showNotice({ type: "success", text: "Tarea creada correctamente." });
  }

  async function requestTaskSuggestions() {
    setSuggesting(true);
    try {
      const response = await api.suggestTasks(token, {
        initiativeId: initiative.id,
      });
      setSuggestions(response.tasks);
    } finally {
      setSuggesting(false);
    }
  }

  async function openTaskSuggestions() {
    try {
      await requestTaskSuggestions();
    } catch (requestError) {
      showNotice({ type: "error", text: requestError.message });
    }
  }

  async function addSuggestedTasks(tasks) {
    for (const task of tasks) await api.createTask(token, initiative.id, task);
    setSuggestions(null);
    await load();
    showNotice({
      type: "success",
      text: `Se agregaron ${tasks.length} tareas al tablero.`,
    });
  }

  /** Elimina una tarea solo después de que la empresa confirme la acción. */
  async function deleteTask() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteTask(token, initiative.id, pendingDelete.id);
      setPendingDelete(null);
      await load();
      showNotice({ text: "Tarea eliminada correctamente." });
    } catch (requestError) {
      showNotice({ type: "error", text: requestError.message });
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <section className="workspace-content">
        <Loader label="Cargando tablero..." />
      </section>
    );

  if (error || !initiative) {
    return (
      <section className="workspace-content">
        <EmptyState
          title="No puedes abrir este tablero"
          text={error || "Necesitas tener una postulación aceptada."}
          action={() =>
            go(
              user.role === "company"
                ? "/company/dashboard"
                : "/volunteer/activities",
            )
          }
          actionLabel="Volver"
        />
      </section>
    );
  }

  return (
    <section className="kanban-page">
      <header className="kanban-top">
        <button
          className="back-link"
          onClick={() =>
            go(
              user.role === "company"
                ? `/initiative/${initiative.id}`
                : "/volunteer/activities",
            )
          }
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <div>
          <p className="section-kicker">{initiative.category}</p>
          <h1>{initiative.title}</h1>
        </div>
        <span className="board-role">
          <Users size={17} />
          {isCompany ? "Vista de empresa" : "Voluntario"}
        </span>
      </header>

      <div className="kanban-guide">
        <Sparkles size={17} />
        {isCompany
          ? "Sigue el avance de las tareas asignadas a tu iniciativa."
          : "Arrastra una actividad a Pendiente para asignarla; después podrás moverla por el tablero."}
      </div>

      {/* 🆕 Botón "+ Agregar tarea" — solo visible para empresa */}
      {isCompany && (
        <div className="kanban-actions">
          <Button
            type="button"
            icon={Plus}
            onClick={() => setShowNewTask(true)}
          >
            Agregar tarea
          </Button>
          {/* EL BOTÓN DE AFUERA HA SIDO ELIMINADO */}
        </div>
      )}

      <div className="kanban-board kanban-board--with-activities">
        {columns.map((column) => {
          const tasks = initiative.tasks.filter(
            (task) => task.status === column && task.ownerId,
          );
          return (
            <section
              className="kanban-column"
              key={column}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(column)}
            >
              <header>
                <div>
                  <h2>{statusMeta[column].label}</h2>
                  <span>{tasks.length}</span>
                </div>
              </header>
              <div className="kanban-column__cards">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUser={user}
                    onDragStart={() => setDraggedId(task.id)}
                  />
                ))}
                {!tasks.length && (
                  <div className="drop-hint">Suelta una tarea aquí</div>
                )}
              </div>
            </section>
          );
        })}
        <aside
          className="kanban-backlog"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => setDraggedId(null)}
        >
          <header>
            <div>
              <ClipboardList size={18} />
              <h2>Actividades</h2>
              <span>
                {initiative.tasks.filter((task) => !task.ownerId).length}
              </span>
            </div>
          </header>
          <div className="activity-list">
            {initiative.tasks
              .filter((task) => !task.ownerId)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUser={user}
                  onDragStart={() => setDraggedId(task.id)}
                  canDelete={isCompany}
                  onDelete={() => setPendingDelete(task)}
                />
              ))}
            {!initiative.tasks.some((task) => !task.ownerId) && (
              <div className="activity-empty">
                No hay actividades disponibles.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* AQUÍ LE PASAMOS LAS FUNCIONES AL MODAL */}
      {showNewTask && (
        <ModalNuevaTarea
          onCrear={handleCrearTarea}
          onCancelar={() => setShowNewTask(false)}
          openTaskSuggestions={openTaskSuggestions}
          addSuggestedTasks={addSuggestedTasks}
          suggesting={suggesting}
          suggestions={suggestions}
          setSuggestions={setSuggestions}
        />
      )}
      
      {/* EL MODAL DE SUGERENCIAS SE ELIMINÓ DE AQUÍ PORQUE AHORA SE MUESTRA DESDE ADENTRO DEL FORMULARIO */}
      
      {pendingMove && (
        <ConfirmationModal
          title={
            pendingMove.claim ? "¿Asignar actividad?" : "¿Finalizar esta tarea?"
          }
          description={
            pendingMove.claim
              ? `La actividad “${pendingMove.task.title}” quedará asignada a tu perfil en Pendiente.`
              : `Confirmarás que ${pendingMove.task.title} está terminada. Después no podrá volver a una columna anterior.`
          }
          confirmLabel={
            pendingMove.claim ? "Sí, asignar actividad" : "Sí, finalizar"
          }
          icon={pendingMove.claim ? ClipboardList : Sparkles}
          busy={updatingTask}
          onCancel={() => setPendingMove(null)}
          onConfirm={async () => {
            if (pendingMove.claim) {
              const updated = await updateTask(
                pendingMove.task.id,
                { claim: true },
                "Actividad asignada a tu perfil. Ahora está en Pendiente.",
              );
              if (updated) setPendingMove(null);
            } else await confirmPendingMove();
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmationModal
          title="¿Eliminar esta tarea?"
          description={`Eliminarás “${pendingDelete.title}” de Actividades. Solo se pueden eliminar antes de que un voluntario las asigne.`}
          confirmLabel="Sí, eliminar tarea"
          variant="danger"
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={deleteTask}
        />
      )}
    </section>
  );
}
