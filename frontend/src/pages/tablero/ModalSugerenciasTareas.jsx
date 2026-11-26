import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../../components/comunes/Boton.jsx';
import { Modal } from '../../components/comunes/VentanaModal.jsx';

/** Permite revisar y escoger qué recomendaciones generadas se agregarán al tablero. */
export function ModalSugerenciasTareas({ tasks, onCancel, onSelect, onRegenerate, busy = false }) {
  const [selected, setSelected] = useState(() => tasks.map((_, index) => index));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isBusy = busy || saving;

  async function addSelected() {
    setError('');
    setSaving(true);
    try {
      await onSelect(selected.map((index) => tasks[index]));
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron agregar las tareas.');
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setError('');
    try {
      await onRegenerate();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <Modal onClose={isBusy ? undefined : onCancel}>
      <div className="suggestions-modal">
        <header>
          <span className="suggestions-modal__icon"><Sparkles size={22} /></span>
          <h2>Tareas sugeridas con IA</h2>
          <p>Revisa las propuestas y elige cuáles quieres agregar. Puedes generar otras sugerencias.</p>
        </header>
        <div className="suggestions-list">
          {tasks.map((task, index) => (
            <label className="suggestion-card" key={`${task.title}-${index}`}>
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={(event) => setSelected((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))}
              />
              <span className="suggestion-card__content">
                <strong>{task.title}</strong>
                <span>{task.description}</span>
                <small>{task.area} · Prioridad {task.priority}</small>
              </span>
            </label>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-footer">
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={regenerate} disabled={isBusy}>{busy ? 'Generando...' : 'Ver otras sugerencias'}</Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isBusy}>Cancelar</Button>
          <Button type="button" onClick={addSelected} disabled={!selected.length || isBusy}>{saving ? 'Agregando...' : `Agregar seleccionadas (${selected.length})`}</Button>
        </footer>
      </div>
    </Modal>
  );
}
