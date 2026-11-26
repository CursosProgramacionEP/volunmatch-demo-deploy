import { useEffect, useRef, useState } from 'react';
import {
  Award,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Edit3,
  FileText,
  Mail,
  LockKeyhole,
  Medal,
  Phone,
  Save,
  Upload,
  UserRound,
  Users,
  Camera,
} from 'lucide-react';
import { Loader } from '../../components/comunes/Cargador.jsx';
import { EmptyState } from '../../components/comunes/EstadoVacio.jsx';
import { Button } from '../../components/comunes/Boton.jsx';
import { Field } from '../../components/comunes/Campo.jsx';
import { api } from '../../services/cliente-api.js';
import { go } from '../../navigation/navegacion.js';
import { categories } from '../../constants/aplicacion.js';
import { backendUrl, backendUrlWithVersion } from '../../services/urls.js';
import { formatInitiativeDate } from '../../utils/fechas.js';
/**
 * Documento vacío usado como valor inicial del formulario de certificaciones.
 * @constant {Object}
 * @property {string} title    - Nombre del documento.
 * @property {string} issuer   - Entidad emisora.
 * @property {string} issuedAt - Fecha de emisión (ISO string).
 * @property {File|null} file  - Archivo seleccionado localmente.
 */
const blankDocument = { title: '', issuer: '', issuedAt: '', file: null };

/**
 * Patrón que valida nombres de persona (solo letras y espacios, 3–100 caracteres).
 * @constant {RegExp}
 */
const personNamePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/;

/** @constant {RegExp} Patrón para teléfonos peruanos de 9 dígitos numéricos. */
const phonePattern = /^\d{9}$/;

/** @constant {RegExp} Patrón básico para correos electrónicos. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tamaño máximo permitido para un documento adjunto (10 MB).
 * @constant {number}
 */
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;



/**
 * Renderiza y actualiza el perfil del usuario autenticado.
 * Valida los campos editables y permite al voluntario adjuntar documentos
 * que los coordinadores podrán consultar desde su perfil público.
 *
 * @component
 * @param {Object}   props
 * @param {string}   props.token            - Token de sesión para autenticar las peticiones.
 * @param {Object}   props.user             - Usuario actualmente autenticado.
 * @param {Function} props.showNotice       - Callback para mostrar notificaciones al usuario.
 * @param {Function} props.onSessionUpdated - Callback invocado cuando el perfil cambia (actualiza la sesión).
 * @returns {JSX.Element} Página de perfil editable.
 */
export function ProfilePage({ token, user, showNotice, onSessionUpdated }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingBadge, setSavingBadge] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [addingDocument, setAddingDocument] = useState(false);
  const [document, setDocument] = useState(blankDocument);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.myProfile(token)
      .then(({ profile: nextProfile }) => {
        if (!active) return;
        setProfile(nextProfile);
        setForm(profileToForm(nextProfile));
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: profileFieldError(profile.role, name, value) }));
    setError('');
  }

  function validateProfile() {
    const nextErrors = {};
    if (profile.role === 'volunteer') {
      nextErrors.fullName = profileFieldError('volunteer', 'fullName', form.fullName)
        || (!personNamePattern.test(form.fullName.trim()) ? 'El nombre debe tener al menos 3 letras.' : '');
      nextErrors.email = emailPattern.test(form.email.trim()) ? '' : 'Ingresa un correo electrónico válido.';
      nextErrors.phone = profileFieldError('volunteer', 'phone', form.phone)
        || (!form.phone.trim() ? 'El teléfono es obligatorio.' : '');
    } else {
      nextErrors.companyName = form.companyName.trim() ? '' : 'Este campo es obligatorio.';
      nextErrors.contactName = profileFieldError('company', 'contactName', form.contactName)
        || (!personNamePattern.test(form.contactName.trim()) ? 'El responsable debe tener al menos 3 letras.' : '');
      nextErrors.email = emailPattern.test(form.email.trim()) ? '' : 'Ingresa un correo electrónico válido.';
      nextErrors.sector = form.sector.trim() ? '' : 'Selecciona un sector.';
    }
    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!validateProfile()) {
      setError('Completa los campos obligatorios marcados con * antes de guardar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.updateMyProfile(token, form);
      setProfile(response.profile);
      setForm(profileToForm(response.profile));
      setEditing(false);
      onSessionUpdated(response.profile);
      showNotice({ text: 'Cambios guardados correctamente.' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  /** Uploads either the volunteer image or the company logo for the current profile. */
  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError('');
    try {
      const response = profile.role === 'company'
        ? await api.uploadCompanyLogo(token, file)
        : await api.uploadVolunteerPhoto(token, file);
      const imageKey = profile.role === 'company' ? 'logoUrl' : 'fotoUrl';
      setProfile((current) => ({ ...current, [imageKey]: response[imageKey] }));
      onSessionUpdated({ ...user, [imageKey]: response[imageKey] });
      showNotice({ text: 'Imagen actualizada correctamente.' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /** Persists a volunteer document and adds it to the profile without a full reload. */
  async function saveDocument(event) {
    event.preventDefault();
    const file = document.file;
    if (!file) {
      setError('Adjunta un archivo PDF, JPG o PNG.');
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      setError('El archivo no puede superar los 10 MB.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.uploadCertification(token, file, document);
      setProfile((current) => ({
        ...current,
        certifications: [response.certification, ...(current.certifications || [])],
      }));
      api.myProfile(token).then(({ profile: refreshedProfile }) => setProfile(refreshedProfile)).catch(() => {});
      setDocument(blankDocument);
      setAddingDocument(false);
      showNotice({ text: 'Documento cargado correctamente.' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function equipBadge(badgeKey) {
    setSavingBadge(true);
    try {
      const response = await api.equipBadge(token, badgeKey);
      setProfile(response.profile);
      onSessionUpdated(response.profile);
      const equipped = response.profile.equippedBadge;
      showNotice({ text: equipped ? `La insignia “${equipped.name}” ya aparece en tu foto de perfil.` : 'Quitaste la insignia de tu foto de perfil.' });
    } catch (requestError) {
      showNotice({ type: 'error', text: requestError.message });
    } finally {
      setSavingBadge(false);
    }
  }

  if (loading) return <section className="workspace-content"><Loader label="Cargando perfil..." /></section>;
  if (error && !profile) return <section className="workspace-content"><EmptyState title="No pudimos cargar tu perfil" text={error} /></section>;

  return (
    <section className="workspace-content profile-page">
      <ProfileHeader profile={profile} editable={!editing} onEdit={() => setEditing(true)} onImageClick={() => fileInputRef.current?.click()} />
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} hidden />
      {editing ? (
        <ProfileForm
          profile={profile}
          form={form}
          error={error}
          fieldErrors={fieldErrors}
          saving={saving}
          uploadingImage={uploadingImage}
          onImageChange={handlePhotoChange}
          onChange={updateForm}
          onCancel={() => {
            setEditing(false);
            setForm(profileToForm(profile));
            setError('');
            setFieldErrors({});
          }}
          onSubmit={saveProfile}
        />
      ) : (
        <ProfileContent
          profile={profile}
          addingDocument={addingDocument}
          document={document}
          error={error}
          saving={saving}
          onAddDocument={() => setAddingDocument(true)}
          onCancelDocument={() => {
            setAddingDocument(false);
            setDocument(blankDocument);
            setError('');
          }}
          onDocumentChange={(event) => setDocument((current) => ({ ...current, [event.target.name]: event.target.value }))}
          onDocumentSubmit={saveDocument}
          onEquipBadge={equipBadge}
          savingBadge={savingBadge}
        />
      )}
    </section>
  );
}

/**
 * Shows an organization profile to a volunteer before or while joining an initiative.
 *
 * @param {{token: string, companyId: string}} props Request credentials and organization id.
 * @returns {JSX.Element} Read-only company profile.
 */
export function CompanyPublicProfilePage({ token, companyId }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.companyProfile(token, companyId)
      .then(({ profile: nextProfile }) => setProfile(nextProfile))
      .catch((requestError) => setError(requestError.message));
  }, [token, companyId]);

  if (!profile && !error) return <section className="workspace-content"><Loader label="Cargando perfil de empresa..." /></section>;
  if (error) return <section className="workspace-content"><EmptyState title="No pudimos abrir este perfil" text={error} action={() => go('/volunteer/explore')} actionLabel="Volver a explorar" /></section>;

  return <section className="workspace-content profile-page"><ProfileHeader profile={profile} /><ProfileContent profile={profile} /></section>;
}

/**
 * Shows a volunteer profile to the coordinator that manages that volunteer's application.
 * Documents are read-only here; only their owner can attach new files.
 *
 * @param {{token: string, volunteerId: string}} props Request credentials and volunteer id.
 * @returns {JSX.Element} Read-only volunteer profile.
 */
export function VolunteerPublicProfilePage({ token, volunteerId }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.volunteerProfile(token, volunteerId)
      .then(({ profile: nextProfile }) => setProfile(nextProfile))
      .catch((requestError) => setError(requestError.message));
  }, [token, volunteerId]);

  if (!profile && !error) return <section className="workspace-content"><Loader label="Cargando perfil de voluntario..." /></section>;
  if (error) return <section className="workspace-content"><EmptyState title="No pudimos abrir este perfil" text={error} action={() => go('/company/dashboard')} actionLabel="Volver al panel" /></section>;

  return <section className="workspace-content profile-page"><ProfileHeader profile={profile} /><ProfileContent profile={profile} /></section>;
}

function profileToForm(profile) {
  return profile.role === 'volunteer'
    ? { fullName: profile.fullName, email: profile.email, phone: profile.phone, bio: profile.bio }
    : { companyName: profile.companyName, contactName: profile.contactName, email: profile.email, sector: profile.sector };
}

/** Displays common identity, contact, and image information for both kinds of profiles. */
function ProfileHeader({ profile, editable = false, onEdit, onImageClick }) {
  const company = profile.role === 'company';
  const name = company ? profile.companyName : profile.fullName;
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  const imageField = company ? profile.logoUrl : profile.fotoUrl;
  const imageSrc = backendUrlWithVersion(imageField);

  return (
    <header className="profile-hero">
      <div className="profile-hero__avatar-wrap">
        <button
          className={`profile-hero__avatar ${editable ? 'profile-hero__avatar--editable' : ''}`}
          type="button"
          onClick={editable ? onImageClick : undefined}
          aria-label={editable ? `Cambiar ${company ? 'logo' : 'foto de perfil'}` : undefined}
          title={editable ? `Cambiar ${company ? 'logo' : 'foto'}` : undefined}
        >
          {imageSrc ? <img src={imageSrc} alt={name} className="profile-hero__avatar-img" /> : initials}
          {editable && <span className="profile-hero__camera"><Camera size={14} /></span>}
        </button>
      </div>
      
      <div className="profile-hero__info">
        <div className="profile-hero__title">
          <h1>{name}</h1>
          <span className="profile-hero__badge">
            <span className="profile-hero__badge-dot" />
            {company ? 'Organización verificada' : 'Perfil de voluntario'}
          </span>
        </div>
        
        {/* Solo mostramos la meta información básica aquí (correo, teléfono, fecha) */}
        <div className="profile-hero__meta">
          <span><Mail size={15} /> {profile.email}</span>
          {!company && profile.phone && <span><Phone size={15} /> {profile.phone}</span>}
          {company && <span><UserRound size={15} /> {profile.contactName || 'Responsable sin registrar'}</span>}
          {profile.createdAt && <span><CalendarDays size={15} /> Miembro desde {formatDate(profile.createdAt)}</span>}
        </div>
      </div>

      {editable && <Button className="profile-hero__edit" icon={Edit3} onClick={onEdit}>Editar perfil</Button>}
    </header>
  );
}

/** Selects the public content layout appropriate for a volunteer or a company profile. */
function ProfileContent({ profile, addingDocument = false, document = blankDocument, error = '', saving = false, onAddDocument, onCancelDocument, onDocumentChange, onDocumentSubmit, onEquipBadge, savingBadge = false }) {
  if (profile.role === 'company') return <CompanyProfileContent profile={profile} />;
  return <VolunteerProfileContent profile={profile} addingDocument={addingDocument} document={document} error={error} saving={saving} onAddDocument={onAddDocument} onCancelDocument={onCancelDocument} onDocumentChange={onDocumentChange} onDocumentSubmit={onDocumentSubmit} onEquipBadge={onEquipBadge} savingBadge={savingBadge} />;
}

/** Renders a volunteer's track record and the documents available to coordinators. */
/** Renders a volunteer's track record, skills, and the documents available to coordinators. */
function VolunteerProfileContent({ profile, addingDocument, document, error, saving, onAddDocument, onCancelDocument, onDocumentChange, onDocumentSubmit, onEquipBadge, savingBadge }) {
  const documents = profile.certifications || [];
  const canManageDocuments = typeof onAddDocument === 'function';
  const badges = profile.badges || [];
  const canEquipBadges = typeof onEquipBadge === 'function';

  // Datos de prueba para las habilidades
  return (
    <div className="profile-grid">
      <div className="profile-col-main">
        <section className="profile-stats-grid" aria-label="Estadísticas de voluntariado">
          <ProfileStat icon={Users} value={profile.acceptedInitiatives || 0} label="Iniciativas aceptadas" />
          <ProfileStat icon={CheckCircle2} value={profile.completedTasks || 0} label="Tareas completadas" />
          <ProfileStat icon={Award} value={documents.length} label="Documentos cargados" />
        </section>

        <section className="profile-section">
          <h2>Sobre el voluntario</h2>
          <p className="profile-section__text">{profile.bio || 'Aún no hay una presentación personal registrada.'}</p>
        </section>

        <section className="profile-section profile-badges" aria-labelledby="profile-badges-title">
          <header className="profile-section__head">
            <div>
              <h2 id="profile-badges-title"><Medal size={20} /> Mis insignias</h2>
              <p className="profile-section__desc">Insignias desbloqueadas y próximos logros por alcanzar.</p>
            </div>
            <span className="count-pill">{badges.filter((badge) => badge.unlocked).length}/{badges.length}</span>
          </header>
          <div className="badges-grid">
            {badges.map((badge) => (
              <article className={`badge-card${badge.unlocked ? ' badge-card--unlocked' : ' badge-card--locked'}${badge.equipped ? ' badge-card--equipped' : ''}`} key={badge.key}>
                <span className={`badge-card__ribbons badge-card__ribbons--${badge.key}`} aria-hidden="true" />
                <span className={`badge-card__icon badge-card__icon--${badge.key}`} aria-hidden="true">
                  <span className="badge-card__symbol">{badge.unlocked ? badge.icon : <LockKeyhole size={20} />}</span>
                </span>
                <b>{badge.name}</b>
                <small>{badge.unlocked ? badge.description : `${badge.description} (${badge.progressLabel})`}</small>
                {!badge.unlocked && <span className="badge-card__progress" role="meter" aria-label={`Progreso para ${badge.name}`} aria-valuemin="0" aria-valuemax={badge.goal} aria-valuenow={badge.progress}><span style={{ width: `${Math.round((badge.progress / badge.goal) * 100)}%` }} /></span>}
                {badge.equipped && <span className="badge-card__status">✦ Equipada en tu foto</span>}
                {badge.unlocked && !badge.equipped && <span className="badge-card__status badge-card__status--earned">Insignia obtenida</span>}
                {canEquipBadges && badge.unlocked && (
                  <button type="button" className="badge-card__action" disabled={savingBadge} onClick={() => onEquipBadge(badge.equipped ? null : badge.key)}>
                    {badge.equipped ? 'Quitar de la foto' : 'Usar en mi foto'}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      <aside className="profile-col-side">
        <section className="profile-section profile-documents">
          <header className="profile-section__head">
            <div>
              <h2><FileText size={20} /> Documentos</h2>
              <p className="profile-section__desc">Certificados y constancias que respaldan la participación del voluntario.</p>
            </div>
            <span className="count-pill">{documents.length}</span>
          </header>
          {addingDocument ? (
            <DocumentForm document={document} error={error} saving={saving} onChange={onDocumentChange} onCancel={onCancelDocument} onSubmit={onDocumentSubmit} />
          ) : (
            <>
              {documents.length ? <div className="certification-list">{documents.map((item) => <DocumentItem key={item.id} item={item} />)}</div> : <p className="profile-empty">Aún no hay documentos cargados.</p>}
              {canManageDocuments && <button className="doc-upload" type="button" onClick={onAddDocument}><span>+</span><small>Subir documento (PDF, JPG o PNG)</small></button>}
            </>
          )}
        </section>
        {canManageDocuments && <div className="doc-note"><span className="doc-note__icon">ⓘ</span><p>Los documentos se conservan en tu perfil y quedan visibles para los coordinadores de las iniciativas a las que postules.</p></div>}
      </aside>
    </div>
  );
}

/** Displays a compact metric using the same palette as the dashboard statistic component. */
function ProfileStat({ icon: Icon, value, label }) {
  return <article className="stat-box"><span className="stat-box__icon stat-box__icon--green"><Icon size={21} /></span><small>{label}</small><b>{value}</b></article>;
}

/** Displays public organization data and links to its active initiatives. */
function CompanyProfileContent({ profile }) {
  const initiatives = profile.initiatives || [];
  return (
    <div className="profile-layout">
      <section className="profile-card profile-card--main">
        <h2><Building2 size={20} /> Datos de la organización</h2>
        <div className="profile-details">
          <span><Mail size={17} />{profile.email}</span>
          <span><UserRound size={17} />Responsable: {profile.contactName}</span>
          <span><CheckCircle2 size={17} />RUC: {profile.ruc}</span>
          <span><Award size={17} />Sector: {profile.sector}</span>
        </div>
      </section>
      <section className="profile-card profile-card--main company-profile-initiatives">
        <div className="profile-section-head"><div><h2><Users size={20} /> Iniciativas publicadas</h2><p>Convocatorias vinculadas a esta organización.</p></div></div>
        {initiatives.length ? <div className="profile-initiative-list">{initiatives.map((initiative) => <article key={initiative.id}><span className="category-chip">{initiative.category}</span><div><h3>{initiative.title}</h3><p>{initiative.summary}</p><small><CalendarDays size={14} /> Inicio: {formatInitiativeDate(initiative.date)} <CalendarRange size={14} /> Fin: {formatInitiativeDate(initiative.endDate)} · {initiative.location}</small></div><Button variant="secondary" onClick={() => go(`/initiative/${initiative.id}`)}>Ver iniciativa</Button></article>)}</div> : <p className="profile-empty">No hay iniciativas activas para mostrar.</p>}
      </section>
    </div>
  );
}

/** Provides the form for editing either a volunteer or a coordinator profile. */
function ProfileForm({ profile, form, error, fieldErrors, saving, uploadingImage, onImageChange, onChange, onCancel, onSubmit }) {
  const volunteer = profile.role === 'volunteer';
  const name = profile.companyName || profile.fullName;
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  const imageField = volunteer ? profile.fotoUrl : profile.logoUrl;
  const imageSrc = backendUrlWithVersion(imageField);

  return (
    <form className="profile-card profile-form" onSubmit={onSubmit} noValidate>
      <h2>{volunteer ? 'Editar datos personales' : 'Editar datos de coordinador'}</h2>
      <div className="profile-image-editor">
        <span>{volunteer ? 'Foto de perfil' : 'Logotipo de la empresa'}</span>
        <div className="profile-image-editor__content">
          <span className="profile-image-editor__preview">{imageSrc ? <img src={imageSrc} alt="Vista previa" /> : initials}</span>
          <label className="button button--secondary profile-image-editor__button"><Upload size={17} />{uploadingImage ? 'Subiendo...' : 'Cambiar imagen'}<input type="file" accept="image/png,image/jpeg" onChange={onImageChange} disabled={uploadingImage} hidden /></label>
          <small>Formatos permitidos: JPG o PNG. Máximo 5 MB.</small>
        </div>
      </div>
      {volunteer ? <><Field label="Nombre y apellidos" name="fullName" value={form.fullName} onChange={onChange} error={fieldErrors.fullName} required /><div className="form-grid"><Field label="Correo electrónico" name="email" type="email" value={form.email} onChange={onChange} error={fieldErrors.email} required /><Field label="Teléfono" name="phone" inputMode="numeric" maxLength={9} placeholder="987654321" value={form.phone} onChange={onChange} error={fieldErrors.phone} hint="Solo números, exactamente 9 dígitos." required /></div><Field label="Biografía" name="bio" as="textarea" value={form.bio} onChange={onChange} /></> : <><div className="form-grid"><Field label="Nombre de empresa" name="companyName" value={form.companyName} onChange={onChange} error={fieldErrors.companyName} required /><Field label="Responsable" name="contactName" value={form.contactName} onChange={onChange} error={fieldErrors.contactName} required /></div><div className="form-grid"><Field label="Correo corporativo" name="email" type="email" value={form.email} onChange={onChange} error={fieldErrors.email} required /><Field label="Sector" name="sector" as="select" value={form.sector} onChange={onChange} error={fieldErrors.sector} options={categories.slice(1).concat('Otro')} required /></div></>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-footer"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" icon={Save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button></footer>
    </form>
  );
}

function profileFieldError(role, name, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  if ((name === 'fullName' || (role === 'company' && name === 'contactName')) && !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(value)) return 'Este nombre solo admite letras y espacios.';
  if (name === 'phone' && !phonePattern.test(value)) return 'El teléfono debe tener exactamente 9 dígitos.';
  return '';
}

/** Collects the metadata and a local PDF/image file before document upload. */
function DocumentForm({ document, error, saving, onChange, onCancel, onSubmit }) {
  const fileInputRef = useRef(null);
  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onChange({ target: { name: 'file', value: file } });
  }
  return (
    <form className="certification-form" onSubmit={onSubmit} noValidate>
      <Field label="Nombre del documento" name="title" value={document.title} onChange={onChange} placeholder="Ej. Certificado de voluntariado" required />
      <Field label="Entidad emisora (opcional)" name="issuer" value={document.issuer} onChange={onChange} placeholder="Ej. Fundación Verde" />
      <Field label="Fecha de emisión (opcional)" name="issuedAt" type="date" value={document.issuedAt} onChange={onChange} />
      <div className="field"><span>Archivo (PDF, JPG o PNG) <em>*</em></span><button type="button" className="cert-file-upload" onClick={() => fileInputRef.current?.click()}>{document.file ? <><FileText size={22} /><b>{document.file.name}</b><small>Haz clic para cambiar el archivo</small></> : <><Upload size={22} /><b>Seleccionar documento</b><small>Máximo 10 MB</small></>}</button><input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg" onChange={handleFileChange} hidden /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-footer"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Subiendo...' : 'Guardar documento'}</Button></footer>
    </form>
  );
}

/** Links a persisted document to its hosted file while preserving safe external navigation. */
function DocumentItem({ item }) {
  const isPdf = item.documentUrl?.toLowerCase().endsWith('.pdf');
  const docUrl = backendUrl(item.documentUrl);
  return <article><span className="certification-icon"><Award size={18} /></span><div><b>{item.title}</b><small>{item.issuer || 'Entidad no especificada'}{item.issuedAt ? ` · ${formatDate(item.issuedAt)}` : ''}</small></div>{docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="cert-download"><FileText size={14} /> {isPdf ? 'Abrir PDF' : 'Ver'}</a>}</article>;
}

function formatDate(value) {
  if (!value) return 'Fecha por definir';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Fecha por definir';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
