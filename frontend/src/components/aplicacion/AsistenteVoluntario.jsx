import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { api } from '../../services/cliente-api.js';

const sugerencias = [
  '🌟 Soy nuevo, ¿cómo empiezo?',
  '🔍 ¿Cómo me postulo a una iniciativa?',
  '🎓 ¿Dónde veo mis certificados?',
];

export function VolunteerAssistant({ token }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      text: '¡Hola! 🌟 Soy Voly, tu asistente de VolunMatch. Estoy aquí para ayudarte a encontrar la iniciativa perfecta, revisar tus tareas o resolver cualquier duda. ¿Por dónde te gustaría empezar hoy?' 
    },
  ]);
  
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function sendQuestion(value = question) {
    const text = value.trim();
    if (!text || sending) return;

    const nuevoMensaje = { role: 'user', text };
    const historialActual = [...messages, nuevoMensaje];

    setMessages(historialActual);
    setQuestion('');
    setSending(true);

    try {
      const { respuesta } = await api.askVolunteerAssistant(token, text, historialActual);
      setMessages((current) => [...current, { role: 'assistant', text: respuesta }]);
    } catch (error) {
      setMessages((current) => [
        ...current, 
        { role: 'assistant', text: error.message || 'No pude responder ahora. Inténtalo de nuevo en unos minutos.' }
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="volunteer-assistant">
      {open && (
        <section className="volunteer-assistant__panel" aria-label="Asistente IA para voluntarios" style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
       

         <header style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            padding: '10px 20px', // Menos padding vertical
            background: 'linear-gradient(135deg, #0b5532ee, #08753d)',
            minHeight: '70px', // Altura fija de la barra
          }}>
            <div style={{ 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginTop: '-25px', // 🚨 Lo subimos
              marginBottom: '-25px' // 🚨 Lo bajamos (esto hace que el GIF sea más grande sin estirar la barra)
            }}>
              <img 
                src="/qntm.gif" 
                alt="Voly" 
                style={{ 
                  width: '90px', // 🚨 Tamaño grande
                  height: '90px', 
                  objectFit: 'contain',
                  // 🚨 FILTRO: Hace que el morado se vuelva verde y le da sombra
                  filter: 'hue-rotate(140deg) drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' 
                }} 
              />
              <span style={{ 
                position: 'absolute', 
                bottom: '20px', 
                right: '5px', 
                width: '16px', 
                height: '16px', 
                backgroundColor: '#22c55e', 
                border: '2px solid #06351f', 
                borderRadius: '50%' 
              }}></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '800', fontSize: '18px', lineHeight: '1.2', color: '#ffffff' }}>Voly Assistant</span>
              <span style={{ fontSize: '13px', color: '#91e7ae', fontWeight: '600' }}>En línea</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </header>
          
          <div className="volunteer-assistant__messages" aria-live="polite" style={{ background: '#f7faf8' }}>
            {messages.map((message, index) => (
              <div className={`volunteer-assistant__message volunteer-assistant__message--${message.role}`} key={`${index}-${message.role}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {message.text
                    .replace(/\*\*(.*?)\*\*/g, '$1')
                    .replace(/^\* /gm, '• ')
                    .replace(/^- /gm, '• ')}
                </p>
              </div>
            ))}
            {sending && (
              <div className="volunteer-assistant__typing" role="status">
                <span className="volunteer-assistant__typing-dots" aria-hidden="true"><i /><i /><i /></span> 
                Voly está escribiendo...
              </div>
            )}
            {messages.length === 1 && !sending && (
              <div className="volunteer-assistant__suggestions">
                <p style={{ fontSize: '11px', color: '#8696a0', marginBottom: '4px', marginLeft: '4px' }}>Preguntas frecuentes:</p>
                {sugerencias.map((item) => (
                  <button type="button" key={item} onClick={() => sendQuestion(item)}>{item}</button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
          
                    <form className="volunteer-assistant__form" onSubmit={(e) => { e.preventDefault(); sendQuestion(); }} style={{ background: '#ffffff', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              value={question} 
              onChange={(e) => setQuestion(e.target.value)} 
              placeholder="Escribe tu mensaje..." 
              style={{ flex: 1, borderRadius: '99px', border: '1px solid #d1d5db', padding: '12px 16px', outline: 'none' }} 
            />
            {/* 🚨 BOTÓN DE ENVIAR TIPO PROA (CÍRCULO VERDE) */}
            <button 
              type="submit" 
              disabled={!question.trim() || sending} 
              style={{ 
                background: '#08753d', // Verde de tu marca
                color: '#ffffff', 
                borderRadius: '50%', 
                width: '42px', 
                height: '42px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: 'none', 
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
            {/* 🚨 BOTÓN FLOTANTE ESTILO PROA CON ZOOM AL AVATAR */}
      {!open && (
        <button 
          className="volunteer-assistant__launcher" 
          type="button" 
          aria-label="Abrir asistente IA" 
          onClick={() => setOpen(true)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px', 
            
            backgroundColor: '#ffffff', 
            borderRadius: '99px', 
            border: '2px solid #e2e8f0', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', 
            padding: '4px 24px 4px 4px', 
            
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            zIndex: 1000,
            position: 'fixed',
            bottom: '30px', 
            right: '30px',
            height: '80px'
          }}
        >
          <>
            {/* 🚨 EL AVATAR CON ZOOM FORZADO */}
            <div style={{ 
              width: '70px', 
              height: '70px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'hidden', 
              borderRadius: '50%'
            }}>
              <img 
                src="/qntm.gif" 
                alt="Voly" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain', 
                  transform: 'scale(1.8)', 
                  filter: 'hue-rotate(140deg) drop-shadow(0px 4px 8px rgba(0,0,0,0.2))' 
                }} 
              />
            </div>
          
          </>
        </button>
      )}
    </div>
  );
}