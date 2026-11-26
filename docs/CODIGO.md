# Documentación del código

El proyecto usa JSDoc en las funciones con reglas de negocio, llamadas a la API, páginas de React y componentes reutilizables. Cada bloque explica el propósito de la función y declara parámetros y valores de retorno cuando corresponde. El sitio HTML generado ya está disponible en `docs/api/index.html`.

No se documentan getters, setters ni funciones cuyo comentario solo repita su nombre.

## Generar el sitio HTML

Desde la raíz del repositorio ejecutar:

```bash
npm run docs:codigo
```

El comando descarga JSDoc de forma temporal y genera el sitio navegable en `docs/api/`.

## Módulos principales

- `backend/src/routes/autenticacion.rutas.js`: acceso, validaciones y recuperación de contraseña.
- `backend/src/services/correo.js`: envío SMTP de enlaces de recuperación de un solo uso.
- `backend/src/routes/iniciativas.rutas.js`: iniciativas, tablero, cancelación y reglas de acceso.
- `backend/src/routes/perfiles.rutas.js`: perfiles y certificaciones.
- `frontend/src/components/comunes/`: componentes reutilizables de campo, botón, aviso, modal y confirmación.
- `frontend/src/pages/`: flujos de autenticación, perfiles, iniciativas y Kanban.

El valor técnico `company` identifica a la organización y a su coordinador en
el backend; en la interfaz se presenta como perfil de coordinador.
