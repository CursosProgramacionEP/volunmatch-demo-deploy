// Navegación simple basada en el "hash" de la URL (todo lo que va después del #).
// No se usa ninguna librería de rutas: la propia URL guarda en qué pantalla estamos.

import { useEffect, useState } from 'react';

// Lee la ruta actual desde la URL. Si no hay nada, la ruta por defecto es '/'.
export function getRoute() {
  return window.location.hash.replace(/^#/, '') || '/';
}

// Hook de React que mantiene la ruta actualizada cuando el usuario navega
// (adelante/atrás del navegador o al hacer clic en un enlace interno).
export function useRoute() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  return route;
}

// Cambia de pantalla actualizando el hash de la URL.
export function go(path) {
  window.location.hash = path;
}
