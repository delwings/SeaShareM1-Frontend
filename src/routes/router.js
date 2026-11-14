import { AUTH_EXPIRED_EVENT } from '../api/client.js';
import { getSession } from '../auth/session.js';
import { renderHeader } from '../components/header.js';
import { closeAllModals } from '../ui/modal.js';
import { resolveRoute, routes } from './routes.js';

export function navigate(path) {
  globalThis.location.hash = `#${path}`;
}

// Guardia de salida: una página con cambios sin guardar registra aquí cómo preguntar antes de irse.
//   confirmLeave(destino) -> true si puede irse; false si lo impide (y ella pregunta al usuario)
//   dispose() -> limpia lo que la página dejó registrado (por ejemplo, el aviso al cerrar la pestaña)
let guard = null;
let currentPath = null;
let restoringPath = false;

export function setNavigationGuard(next) {
  guard?.dispose?.();
  guard = next;
}

/** Arranca el enrutador por hash (#/ruta): dibuja la página que corresponde a cada dirección. */
export function startRouter(outlet) {
  function render() {
    const path = globalThis.location.hash.replace(/^#/, '');
    if (restoringPath) {
      restoringPath = false;
      return;
    }
    if (guard && currentPath !== null && path !== currentPath && !guard.confirmLeave(path)) {
      // Se queda en la página actual: se devuelve la dirección sin volver a dibujar.
      restoringPath = true;
      globalThis.location.hash = `#${currentPath}`;
      return;
    }
    const session = getSession();
    const result = resolveRoute(path, session, routes);
    if (result.redirect) {
      navigate(result.redirect);
      return;
    }
    closeAllModals();
    setNavigationGuard(null);
    currentPath = path;
    const page = result.route.render({
      navigate,
      session,
      params: result.params ?? {},
      setGuard: setNavigationGuard,
    });
    outlet.replaceChildren(...(session ? [renderHeader(session.user, navigate)] : []), page);
  }

  globalThis.addEventListener('hashchange', render);
  globalThis.addEventListener(AUTH_EXPIRED_EVENT, () => {
    // Sesión vencida: se va al inicio de sesión sin preguntar por cambios sin guardar (se pierden).
    setNavigationGuard(null);
    navigate('/login');
  });
  render();
}
