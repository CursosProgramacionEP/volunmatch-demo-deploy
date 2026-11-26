import { useEffect } from 'react';
import { go } from '../../navigation/navegacion.js';

/**
 * Envuelve una página para restringir el acceso según el rol del usuario.
 * Si no está logueado, va al login. Si el rol no coincide, va a su panel correcto.
 */
export function RutaProtegida({ user, rolRequerido, children }) {
  useEffect(() => {
    if (!user) {
      go('/auth');
      return;
    }
    if (rolRequerido && user.role !== rolRequerido) {
      // Si es voluntario intentando entrar a empresa, lo mandamos a explorar
      // Si es empresa intentando entrar a voluntario, lo mandamos a su dashboard
      if (user.role === 'company') {
        go('/company/dashboard');
      } else {
        go('/volunteer/explore');
      }
    }
  }, [user, rolRequerido]);

  // Mientras redirige, no mostramos nada para evitar parpadeos
  if (!user || (rolRequerido && user.role !== rolRequerido)) {
    return null;
  }

  return children;
}