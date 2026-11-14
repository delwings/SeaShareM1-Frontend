# SeaShareM1-Frontend

Frontend del Módulo 1 de SEA-SHARE: HTML, CSS y JavaScript puro con módulos ES nativos, sin frameworks ni empaquetador. Node.js se usa solo para las herramientas de desarrollo (ESLint, Prettier y Vitest).

## Requisitos

- Node.js 20 o superior
- VS Code con la extensión **Live Server**
- Backend `SeaShareM1` corriendo en `http://localhost:8081` (para que la página hable con él)

## Instalar dependencias

```bash
npm install
```

## Ejecutar en local

Los módulos ES **no funcionan abriendo `index.html` con doble clic**: hay que servir el sitio.

1. Abre esta carpeta en VS Code.
2. Clic derecho sobre `index.html` → **Open with Live Server**.
3. Se abre en `http://127.0.0.1:5500` (puerto 5500). Esos son los orígenes que el backend permite por CORS: `http://localhost:5500` y `http://127.0.0.1:5500`.

La dirección del backend se elige sola en `src/config.js`: en `localhost` o `127.0.0.1` usa `http://localhost:8081`; en cualquier otro sitio usa la dirección desplegada (pendiente de completar al desplegar en Render).

## Comandos

| Qué | Comando |
|---|---|
| Pruebas | `npm test` |
| Pruebas con informe de cobertura | `npm run test:coverage` (el informe queda en `coverage/`) |
| Análisis estático (ESLint) | `npm run lint` |
| Verificar el formato (Prettier) | `npm run format:check` |
| Aplicar el formato | `npm run format` |
| Todo junto: lint, formato y pruebas | `npm run check` |

## Estructura

```text
index.html
src/
├── config.js     # direcciones del backend (local y desplegada)
├── main.js       # punto de entrada
├── api/          # cliente HTTP centralizado: único lugar que habla con el backend
├── auth/         # estado de autenticación, sesión del usuario y rol
├── services/     # lógica sin acceso al DOM
├── components/   # elementos de interfaz reutilizables
├── pages/        # pantallas
├── routes/       # rutas y navegación según el rol
└── styles/       # hojas de estilo
```

Reglas: la lógica va en `services/`, separada del código que toca el DOM; solo `api/` habla con el backend; no se guardan secretos en el frontend.

## Estado

Esqueleto de T002, T004 y T007. El cliente HTTP, la autenticación y las rutas se agregan en T022.
