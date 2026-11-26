import { useState } from 'react';
import { X, Image as ImageIcon, Eye, Trash2 } from 'lucide-react'; 
import { categories } from '../../constants/aplicacion.js';
import { Button } from '../comunes/Boton.jsx';
import { Field } from '../comunes/Campo.jsx';
import { Modal } from '../comunes/VentanaModal.jsx';
import { api } from '../../services/cliente-api.js';
import { splitSchedule } from '../../utils/fechas.js';

export function EditInitiativeModal({ token, initiative, onClose, onSaved, showNotice }) {
  const { startTime, endTime } = splitSchedule(initiative.schedule);
  const now = Date.now();
  const startTimestamp = new Date(`${String(initiative.date || '').slice(0, 10)}T00:00:00-05:00`).getTime();
  const endTimestamp = new Date(`${String(initiative.endDate || '').slice(0, 10)}T23:59:59-05:00`).getTime();
  const isFinished = initiative.status === 'completed' || (Number.isFinite(endTimestamp) && endTimestamp <= now);
  const hasAdvances = (initiative.tasks || []).some((task) => task.status === 'in_progress' || task.status === 'done');
  const startsWithin24h = Number.isFinite(startTimestamp) && startTimestamp > now && startTimestamp - now < 24 * 60 * 60 * 1000;
  const editMode = isFinished ? 'blocked' : hasAdvances ? 'informational' : startsWithin24h ? 'limited' : 'full';
  const canEditDescription = editMode !== 'blocked';
  const canEditInformational = editMode === 'full' || editMode === 'informational';
  const canEditOperational = editMode === 'full';

  const [form, setForm] = useState({
    title: initiative.title || '',
    category: initiative.category || categories[1],
    summary: initiative.summary || '',
    date: String(initiative.date || '').slice(0, 10),
    endDate: String(initiative.endDate || '').slice(0, 10),
    location: initiative.location || '',
    modalidad: initiative.modalidad || 'presencial',
    meetingUrl: initiative.meetingUrl || '',
    startTime,
    endTime,
    quota: String(initiative.quota || ''),
    requirements: (initiative.requirements || []).join('\n'),
    tasks: (initiative.tasks || []).filter((task) => (
      String(task.title || '').trim() ||
      String(task.description || '').trim() ||
      String(task.area || '').trim()
    )).map((task) => ({
      id: task.id,
      ownerId: task.ownerId || null,
      status: task.status || 'pending',
      title: task.title || '',
      description: task.description || '',
      area: task.area || '',
      priority: task.priority || 'Media',
    })),
  });

  // ESTADOS DE LA IMAGEN
  const [imagen, setImagen] = useState(initiative.imagen || null);
  const [saving, setSaving] = useState(false);
  const [verImagen, setVerImagen] = useState(false);

  // FUNCIÓN PARA LEER LA IMAGEN
  function handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagen(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function updateForm({ target }) {
    setForm((current) => ({ ...current, [target.name]: target.value }));
  }

  function updateTask(index, field, value) {
    setForm((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, [field]: value } : task),
    }));
  }

  function removeTask(index) {
    setForm((current) => ({
      ...current,
      tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.updateInitiative(token, initiative.id, {
        ...form,
        quota: Number(form.quota),
        requirements: form.requirements.split('\n').map((item) => item.trim()).filter(Boolean),
        tasks: form.tasks,
        imagen: imagen,
      });
      onSaved(response.initiative);
      showNotice({ text: 'Los cambios de la iniciativa se guardaron correctamente.' });
    } catch (error) {
      showNotice({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal onClose={() => !saving && onClose()}>
        <form className="initiative-edit-form" onSubmit={save}>
          <p className="section-kicker">EDITAR INICIATIVA</p>
          <h2>{editMode === 'blocked' ? 'Edición bloqueada' : editMode === 'limited' ? 'Edición limitada' : editMode === 'informational' ? 'Protege los avances' : 'Corrige los datos de tu iniciativa'}</h2>
          <p>{editMode === 'blocked'
            ? 'La iniciativa ya finalizó y sus datos se conservan como registro de la actividad.'
            : editMode === 'limited'
              ? 'Falta menos de 24 horas para iniciar. Solo puedes corregir la descripción; fecha, lugar, cupo y demás datos importantes están bloqueados.'
              : editMode === 'informational'
                ? 'Hay tareas en proceso o completadas. Puedes actualizar información general, pero no cambiar fechas, lugar, cupo, requisitos ni tareas.'
                : 'Puedes editar los datos y las tareas de la iniciativa.'}</p>

          {/* BLOQUE DE IMAGEN */}
          {canEditDescription && (
            <div style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
              <span style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#374151' }}>
                Imagen de portada
              </span>
              
              <div style={{ border: '2px dashed #e9f1e8', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', backgroundColor: '#f9fafb', position: 'relative' }}>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} id="edit-file-upload" />
                
                {!imagen ? (
                  <label htmlFor="edit-file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#6b7280' }}>
                    <div style={{ backgroundColor: '#e8f5e9', padding: '8px', borderRadius: '50%', color: '#2e7d32' }}>
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <span style={{ color: '#2e7d32', fontWeight: '600' }}>Haz clic aquí</span> para subir una imagen
                    </div>
                    <span style={{ fontSize: '0.8rem' }}>PNG, JPG o JPEG (Máx. 2MB)</span>
                  </label>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
                      Hemos subido tu archivo
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e9f1e8', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e9f1e8', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '0.85rem', color: '#1f2937' }}>
                          imagen-iniciativa.jpg
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                          Imagen cargada correctamente
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => setVerImagen(true)} 
                          style={{ background: 'none', border: 'none', color: '#3d6b2b', cursor: 'pointer', display: 'flex', padding: 0 }}
                          title="Ver imagen"
                        >
                          <Eye size={20} />
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={() => setImagen("")} 
                          style={{ background: 'none', border: 'none', color: '#3d6b2b', cursor: 'pointer', display: 'flex', padding: 0 }}
                          title="Eliminar imagen"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Field label="Nombre de la iniciativa" name="title" value={form.title} onChange={updateForm} minLength={3} maxLength={250} required disabled={!canEditInformational} />
          <div className="form-grid">
            <Field label="Categoría" name="category" as="select" value={form.category} onChange={updateForm} options={categories.slice(1)} required disabled={!canEditInformational} />
            <Field label="Cupo de voluntarios" name="quota" type="number" min={initiative.joinedCount || 1} value={form.quota} onChange={updateForm} required disabled={!canEditOperational} />
          </div>
          <Field label="Objetivo y descripción" name="summary" as="textarea" value={form.summary} onChange={updateForm} required disabled={!canEditDescription} />
          <div className="form-grid">
            <Field label="Fecha de inicio" name="date" type="date" value={form.date} onChange={updateForm} required disabled={!canEditOperational} />
            <Field label="Fecha de fin" name="endDate" type="date" min={form.date} value={form.endDate} onChange={updateForm} required disabled={!canEditOperational} />
          </div>
          <div className="form-grid">
            <Field label="Modalidad" name="modalidad" as="select" value={form.modalidad} onChange={updateForm} options={['presencial', 'virtual']} required disabled={!canEditOperational} />
            {form.modalidad === 'virtual' ? (
              <Field label="Enlace de reunión virtual" name="meetingUrl" type="url" placeholder="https://meet.google.com/..." value={form.meetingUrl} onChange={updateForm}  required disabled={!canEditOperational} />
            ) : (
              <Field label="Lugar" name="location" value={form.location} onChange={updateForm} required disabled={!canEditOperational} />
            )}
          </div>
          {form.modalidad === 'virtual' && (
            <div className="form-grid">
              <Field label="Hora de inicio" name="startTime" type="time" value={form.startTime} onChange={updateForm} required disabled={!canEditOperational} />
              <Field label="Hora de fin" name="endTime" type="time" min={form.startTime || undefined} value={form.endTime} onChange={updateForm} required disabled={!canEditOperational} />
            </div>
          )}
          <Field label="Requisitos (uno por línea)" name="requirements" as="textarea" value={form.requirements} onChange={updateForm} required disabled={!canEditOperational} />
          
          <section className="initiative-edit-tasks">
            <div className="form-section-head">
              <div><h2>Tareas iniciales</h2><p>{canEditOperational ? 'Corrige las tareas asociadas a esta iniciativa.' : 'Las tareas están bloqueadas en este nivel de edición.'}</p></div>
            </div>
            {form.tasks.map((task, index) => (
              <div className="task-editor" key={task.id || `new-${index}`}>
                <div className="task-editor__head">
                  <span>Tarea {index + 1}</span>
                  {(
                    (!task.ownerId && task.status === 'pending') ||
                    (!task.title.trim() && !task.description.trim() && !task.area.trim())
                  ) && canEditOperational && <button type="button" onClick={() => removeTask(index)}><X size={16} /> Quitar</button>}
                </div>
                <div className="form-grid">
                  <Field label="Nombre" value={task.title} onChange={(event) => updateTask(index, 'title', event.target.value)} required disabled={!canEditOperational} />
                  <Field label="Área" value={task.area} onChange={(event) => updateTask(index, 'area', event.target.value)} required disabled={!canEditOperational} />
                </div>
                <Field label="Descripción" as="textarea" value={task.description} onChange={(event) => updateTask(index, 'description', event.target.value)} required disabled={!canEditOperational} />
                <Field label="Prioridad" as="select" value={task.priority} onChange={(event) => updateTask(index, 'priority', event.target.value)} options={['Alta', 'Media', 'Baja']} required disabled={!canEditOperational} />
                {(task.ownerId || task.status !== 'pending') && <small className="field-hint">{canEditOperational ? 'Esta tarea ya está asignada o empezó; puedes corregir sus datos, pero no quitarla.' : 'Esta tarea está protegida y no se puede modificar en este nivel de edición.'}</small>}
              </div>
            ))}
            {!form.tasks.length && <p className="field-hint">{canEditOperational ? 'Agrega al menos una tarea inicial.' : 'Esta iniciativa no tiene tareas registradas.'}</p>}
          </section>
          <footer className="form-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            {!isFinished && <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>}
          </footer>
        </form>
      </Modal>

      {/* MODAL PARA VER LA IMAGEN EN GRANDE */}
      {verImagen && (
        <Modal onClose={() => setVerImagen(false)}>
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Vista previa de la imagen</h3>
            <img src={imagen} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }} />
            <div style={{ marginTop: '1rem' }}>
              <Button onClick={() => setVerImagen(false)}>Cerrar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
