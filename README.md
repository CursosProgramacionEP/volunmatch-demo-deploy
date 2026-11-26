> **Demo de despliegue — Curso Integrador I (UTP).** Copia del proyecto VolunMatch, usada en clase para mostrar cómo publicar un sistema full-stack con servicios gratuitos.
>
> | Pieza | Servicio | URL |
> |---|---|---|
> | Frontend (React + Vite) | Vercel | https://volunmatch-demo.vercel.app |
> | Backend (Node + Express) | Render | https://volunmatch-api.onrender.com/api/test-db |
> | Base de datos (PostgreSQL) | Neon | — |
>
> Los commits posteriores a la copia muestran los cambios necesarios para desplegar (`DATABASE_URL` con SSL, CORS con `FRONTEND_URL`, script SQL compatible con Neon).

# 🐘 VolunMatch — Proyecto Integrador

Sistema de gestión de voluntariado que conecta **empresas/organizaciones** 
con **voluntarios** para publicar, postular y dar seguimiento a iniciativas 
sociales mediante un tablero Kanban interactivo.
pruebbb
---

## 🎯 Descripción

VolunMatch permite:
- **Empresas/ONGs**: publicar iniciativas, revisar postulaciones, gestionar tareas y ver reportes.
- **Voluntarios**: explorar iniciativas, postularse, mover tareas en el Kanban y construir su historial.

---

## 🛠️ Stack y versiones

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | React + Vite | React 18 / Vite 6 |
| **Backend** | Node.js + Express | Node 24 / Express 4 |
| **Base de datos** | PostgreSQL | 18.6 |
| **Contenedores** | Docker | Última estable |
| **Autenticación** | JWT + bcrypt | — |
| **Correo** | Nodemailer (SMTP) | — |
| **Lenguaje** | JavaScript (ES Modules) | — |

---

## 📋 Requisitos previos

- **Node.js** (v20 o superior, se recomienda v24)
- **pnpm** (gestor de paquetes del proyecto)
- **Git** (para clonar el repositorio)
- **pgAdmin** (se instala junto con PostgreSQL)

Para instalar pnpm:
```bash
npm install -g pnpm
```
## 🚀 Cómo levantar el proyecto

### 1. Clonar el repositorio

Si no tienes Git instalado en VS Code, puedes instalarlo con:

```powershell
winget install --id Git.Git -e --source winget
```

```bash
git clone https://github.com/CursosProgramacionEP/proyecto-integrador-sistemas-proyecto-final-huancaszuleika.git
cd proyecto-integrador-sistemas-proyecto-final-huancaszuleika
```

### 2. Verificar Node.js
```bash
node --version
```
Si no lo tienes, descarga el instalador de Node.js, guárdalo en tu disco local y ejecútalo.

### 3. Instalar dependencias
```bash
npm install
```

### 4. Instalar pnpm globalmente
```bash
npm install -g pnpm
```

## 5 Configurar el archivo .env
- Copia el archivo backend/.env.example.
- Renómbralo a backend/.env.
- En el campo DB_PASSWORD, coloca la contraseña de tu PostgreSQL local.

Ejemplo: DB_PASSWORD=admin


## 6. Abrir PostgreSQL (pgAdmin)
- Abre pgAdmin.
- Conéctate al servidor PostgreSQL local con tu contraseña.
- Haz clic derecho en "Databases" → "Create" → "Database...".
- Nombre: VolunMatch (con V y M mayúsculas).
- Guarda los cambios.

## 7. Ejecutar el script de la base de datos
- En pgAdmin, haz clic derecho sobre la base VolunMatch.
- Selecciona "Query Tool" (o "CREATE Script").
- Abre el archivo del repositorio: database/volunmatch_datos.sql, copia todo el contenido 
(ctrl A ctrl C) y pégalo en query tool.
- Ejecuta el script con F5.

## 8. Levantar el proyecto
Abre una terminal nueva (Command Prompt) en la raíz del proyecto y ejecuta uno de los siguientes comandos:
```bash
pnpm dev
```
o
```bash
npm run dev
```
o
```bash
npx npm dev
```

## 9. Acceder al sistema
Una vez que la terminal muestre que el servidor está listo, abre tu navegador y dirígete a:

Frontend: http://localhost:5173

## ❓ Problemas comunes
- ECONNREFUSED 5432	: PostgreSQL no está corriendo. Inicia el servicio en Windows.
- password authentication failed:	La contraseña del .env no coincide con la de PostgreSQL.
- database "VolunMatch" does not exist:	No creaste la base de datos. Ejecuta el Paso 6.
- relation "voluntario" does not exist:	No importaste el esquema. Ejecuta el Paso 7.
- pnpm: command not found: Ejecuta npm install -g pnpm.


## 👥 Equipo
Equipo del proyecto VolunMatch (Curso Integrador I).

## Link de figma 
https://www.figma.com/design/fq1zzeC77frbJSAuEocsFs/Voluntariado?node-id=0-1&p=f&t=Dhj6PzLER92tr3Gf-0 

