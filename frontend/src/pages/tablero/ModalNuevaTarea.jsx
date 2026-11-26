import { useState } from 'react';
import { Button } from '../../components/comunes/Boton.jsx';
import { Field } from '../../components/comunes/Campo.jsx';
import { Modal } from '../../components/comunes/VentanaModal.jsx';
import { ModalSugerenciasTareas } from './ModalSugerenciasTareas.jsx';

export function ModalNuevaTarea({ 
  onCrear, 
  onCancelar, 
  openTaskSuggestions, 
  addSuggestedTasks, 
  suggesting, 
  suggestions, 
  setSuggestions 
}) {
  const [form, setForm] = useState({ title: '', area: 'General', description: '', priority: 'Media' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  function validate() {
    const nextErrors = {
      title: form.title.trim() ? '' : 'El nombre de la tarea es obligatorio.',
      area: form.area.trim() ? '' : 'El área es obligatoria.',
      description: form.description.trim() ? '' : 'Describe qué debe realizarse.',
      priority: form.priority ? '' : 'Selecciona una prioridad.',
    };
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onCrear(form);
    } catch (requestError) {
      setErrors({ form: requestError.message || 'No se pudo crear la tarea.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal onClose={onCancelar}>
        <form className="shared-modal-form" onSubmit={submit} noValidate>
          
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ paddingRight: '1rem' }}>
              <h2 style={{ marginBottom: '0.2rem' }}>Crear tarea</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                Los voluntarios aceptados podrán tomarla y moverla en el tablero.
              </p>
            </div>
            
            <button 
              type="button" 
              onClick={openTaskSuggestions}
              disabled={suggesting}
              style={{
                backgroundColor: suggesting ? '#f5f5f5' : '#e8f5e9',
                color: suggesting ? '#999' : '#2e7d32',
                border: `1px solid ${suggesting ? '#ddd' : '#2e7d32'}`,
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: suggesting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              {suggesting ? 'Generando...' : 'Tareas con IA ✨'}
            </button>
          </header>

          <div className="form-grid">
            <Field label="Nombre" name="title" value={form.title} onChange={update} error={errors.title} placeholder="Nombre de la tarea" required autoFocus />
            <Field label="Área" name="area" value={form.area} onChange={update} error={errors.area} placeholder="Ej. Logística" required />
          </div>
          
          <Field label="Descripción" name="description" as="textarea" value={form.description} onChange={update} error={errors.description} placeholder="¿Qué debe hacer el voluntario?" required />
          
          <Field label="Prioridad" name="priority" as="select" value={form.priority} onChange={update} error={errors.priority} options={['Baja', 'Media', 'Alta']} required />
          
          {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
          
          <footer className="form-footer">
            <Button type="button" variant="secondary" onClick={onCancelar}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear tarea'}</Button>
          </footer>
        </form>
      </Modal>

      {/* MODAL DE SUGERENCIAS IA */}
      {suggestions && (
        <ModalSugerenciasTareas
          tasks={suggestions}
          onCancel={() => setSuggestions(null)}
          onSelect={async (tareasSeleccionadas) => {
            // 1. Agregamos las tareas a la base de datos (tu función original)
            await addSuggestedTasks(tareasSeleccionadas);
            
            // 2. Cerramos SOLO el modal de la IA
            setSuggestions(null); 
            
            // NOTA: No llamamos a onCancelar() para que el formulario de "Crear Tarea" siga abierto.
          }}
          onRegenerate={openTaskSuggestions}
          busy={suggesting}
        />
      )}
    </>
  );
}