import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  FileCheck2,
  HeartHandshake,
  Leaf,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "../../components/autenticacion/Marca.jsx";
import { Button } from "../../components/comunes/Boton.jsx";
import { Modal } from "../../components/comunes/VentanaModal.jsx";
import { go } from "../../navigation/navegacion.js";

// Pantalla pública de inicio (landing page).
export function HomePage({ user }) {
  const [infoModal, setInfoModal] = useState(null);
  const goToSpace = () => go(user?.role === "company" ? "/company/dashboard" : "/volunteer/explore");
  const goToLogin = () => go("/auth");

  // Función mágica para hacer scroll sin cambiar de página
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="landing">
      <header className="landing-nav container">
        <Brand />

        <nav aria-label="Navegación principal">
          <button type="button" className="nav-link" onClick={() => scrollToSection("beneficios")}>Beneficios</button>
          <button type="button" className="nav-link" onClick={() => scrollToSection("como-funciona")}>Cómo funciona</button>
          <button type="button" className="nav-link" onClick={() => scrollToSection("comunidades")}>Comunidad</button>
        </nav>
        <Button variant="ghost" onClick={user ? goToSpace : goToLogin}>
          {user ? "Ir a mi espacio" : "Iniciar sesión"}
        </Button>
      </header>

      <section className="hero container">
        <div className="hero__copy">
          <span className="eyebrow">
            <Sparkles size={14} /> PLATAFORMA DE IMPACTO SOCIAL
          </span>
          <h1>
            Conecta tu propósito con <em>acciones que transforman</em>.
          </h1>
          <p>
            VolunMatch reúne a personas con ganas de aportar y organizaciones
            que impulsan iniciativas reales en su comunidad.
          </p>
          <div className="hero__actions">
            <Button onClick={user ? goToSpace : goToLogin} icon={ArrowRight}>
              {user ? "Ir a mi espacio" : "Comenzar ahora"}
            </Button>
          </div>

          <div className="social-proof">
            <div className="avatars">
              <span>AM</span>
              <span>LP</span>
              <span>RG</span>
            </div>
            <strong>+1,200 personas</strong>
            <small>ya generan impacto con VolunMatch</small>
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Personas colaborando en una iniciativa ambiental"
        >
          <div className="hero-visual__glow" />
          <div className="hero-visual__scene">
            <div className="scene-sun" />
            <div className="scene-city">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="scene-ground" />
            <div className="scene-person person-one">
              <i />
              <b />
            </div>
            <div className="scene-person person-two">
              <i />
              <b />
            </div>
            <div className="scene-person person-three">
              <i />
              <b />
            </div>
            <div className="scene-plant">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="floating-card floating-card--priority">
            <span>ACTIVIDAD ACTIVA</span>
            <b>Limpieza de ribera</b>
            <div>
              <i /> 12 voluntarios inscritos
            </div>
          </div>
          <div className="floating-card floating-card--impact">
            <span className="impact-icon">
              <Leaf size={19} />
            </span>
            <div>
              <b>126 horas</b>
              <small>de impacto esta semana</small>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN BENEFICIOS */}
      <section id="beneficios" className="ecosystem container">
        <p className="section-kicker">UNA RED CONECTADA</p>
        <h2>Todo lo necesario para colaborar mejor</h2>
        <p className="section-lead">
          Dos experiencias que se encuentran en un solo lugar, con procesos
          claros desde la convocatoria hasta el cierre de cada tarea.
        </p>
        <div className="benefit-grid">
          <article className="benefit-card">
            <span className="benefit-card__icon">
              <HeartHandshake size={25} />
            </span>
            <h3>Para voluntarios</h3>
            <p>
              Descubre causas cercanas, postula con confianza y lleva el
              seguimiento de tus actividades desde un tablero simple.
            </p>
            <ul>
              <li>Iniciativas por categoría</li>
              <li>Postulación y estado visible</li>
              <li>Tablero personal de tareas</li>
            </ul>
          </article>
          <article className="benefit-card">
            <span className="benefit-card__icon">
              <BriefcaseBusiness size={25} />
            </span>
            <h3>Para empresas</h3>
            <p>
              Publica convocatorias, gestiona postulaciones y sigue el avance de
              las tareas de cada iniciativa.
            </p>
            <ul>
              <li>Creación de iniciativas</li>
              <li>Revisión de postulantes</li>
              <li>Seguimiento Kanban</li>
            </ul>
          </article>
        </div>
      </section>

      {/* SECCIÓN CÓMO FUNCIONA */}
      <section id="como-funciona" className="how container">
        <p className="section-kicker">FLUJO </p>
        <h2>Una experiencia clara, de principio a fin</h2>
        <div className="steps">
          <article>
            <span>01</span>
            <h3>Crea tu cuenta</h3>
            <p>
              Regístrate como voluntario o empresa y accede al espacio que
              necesitas.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Conecta</h3>
            <p>
              Publica o explora iniciativas. La empresa revisa las
              postulaciones.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Actúa</h3>
            <p>Una vez aceptado, organiza tu aporte en el tablero de tareas.</p>
          </article>
        </div>
      </section>

      {/* SECCIÓN COMUNIDAD / CALL TO ACTION */}
      <section id="comunidades" className="call-to-action">
        <div className="container">
          <Leaf size={30} />
          <h2>Tu tiempo puede crear cambios visibles.</h2>
          <p>
            Únete a una comunidad que convierte las buenas intenciones en
            acciones organizadas.
          </p>
        </div>
      </section>

      {/* PIE DE PÁGINA */}
      <footer className="landing-footer container">
        <Brand compact />
        <span>© 2026 VolunMatch. Conectando acciones que importan.</span>
        <div className="landing-footer__links">
          <button type="button" className="nav-link" onClick={() => setInfoModal("privacy")}>Privacidad</button>
          <button type="button" className="nav-link" onClick={() => setInfoModal("terms")}>Términos</button>
          <button type="button" className="nav-link" onClick={() => setInfoModal("contact")}>Contacto</button>
        </div>
      </footer>
      {infoModal && <LandingInfoModal type={infoModal} onClose={() => setInfoModal(null)} />}
    </main>
  );
}

function LandingInfoModal({ type, onClose }) {
  const content = {
    privacy: {
      icon: ShieldCheck,
      kicker: "TU INFORMACIÓN",
      title: "Privacidad",
      body: "VolunMatch usa tus datos de cuenta para identificarte, gestionar postulaciones, iniciativas y comunicaciones necesarias dentro de la plataforma.",
      points: ["Tu correo y teléfono no se muestran públicamente.", "Las empresas solo ven los datos necesarios de participantes aceptados.", "Puedes solicitar la actualización de tus datos desde tu perfil."],
    },
    terms: {
      icon: FileCheck2,
      kicker: "USO RESPONSABLE",
      title: "Términos de uso",
      body: "La plataforma promueve colaboraciones respetuosas, transparentes y orientadas al impacto social entre voluntarios y organizaciones.",
      points: ["Publica convocatorias veraces y con información clara.", "Respeta los compromisos, horarios y lineamientos acordados.", "No compartas enlaces de reuniones ni datos de otros participantes fuera de la iniciativa."],
    },
  };

  if (type === "contact") return <ContactModal onClose={onClose} />;
  const item = content[type];
  const Icon = item.icon;
  return (
    <Modal onClose={onClose}>
      <section className="landing-info-modal" aria-labelledby="landing-info-title">
        <span className="landing-info-modal__icon"><Icon size={23} /></span>
        <p className="section-kicker">{item.kicker}</p>
        <h2 id="landing-info-title">{item.title}</h2>
        <p>{item.body}</p>
        <ul>{item.points.map((point) => <li key={point}>{point}</li>)}</ul>
      </section>
    </Modal>
  );
}

function ContactModal({ onClose }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  function update({ target }) {
    setForm((current) => ({ ...current, [target.name]: target.value }));
  }

  function submit(event) {
    event.preventDefault();
    const subject = encodeURIComponent(`[VolunMatch] ${form.subject}`);
    const body = encodeURIComponent(`Nombre: ${form.name}\nCorreo: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:soporte@volunmatch.pe?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <Modal onClose={onClose}>
      <section className="landing-info-modal" aria-labelledby="contact-modal-title">
        <span className="landing-info-modal__icon"><Mail size={23} /></span>
        <p className="section-kicker">ESTAMOS PARA AYUDARTE</p>
        <h2 id="contact-modal-title">Contacto</h2>
        <p>Cuéntanos tu consulta. Al enviarla, se abrirá tu aplicación de correo con el mensaje preparado.</p>
        <form className="landing-contact-form" onSubmit={submit}>
          <label><span>Nombre</span><input name="name" value={form.name} onChange={update} required /></label>
          <label><span>Correo</span><input name="email" type="email" value={form.email} onChange={update} required /></label>
          <label><span>Asunto</span><input name="subject" value={form.subject} onChange={update} required /></label>
          <label><span>Mensaje</span><textarea name="message" value={form.message} onChange={update} required /></label>
          {sent && <small className="landing-contact-form__notice">Tu mensaje está listo en la aplicación de correo.</small>}
          <Button type="submit" icon={Mail}>Preparar correo</Button>
        </form>
      </section>
    </Modal>
  );
}
