import { ROLES, homePathFor } from '../auth/roles.js';
import { boatDetailPage } from '../pages/boatDetail.js';
import { adminBoatDetailPage } from '../pages/adminBoatDetail.js';
import { adminHomePage } from '../pages/adminHome.js';
import { adminOwnerPage } from '../pages/adminOwner.js';
import { editBoatPage } from '../pages/editBoat.js';
import { forbiddenPage } from '../pages/forbidden.js';
import { loginPage } from '../pages/login.js';
import { notFoundPage } from '../pages/notFound.js';
import { ownerHomePage } from '../pages/ownerHome.js';
import { registerBoatBasicPage } from '../pages/registerBoatBasic.js';
import { registerBoatDetailsPage } from '../pages/registerBoatDetails.js';

// Tabla de rutas. "public" no exige sesión; "roles" limita quién puede entrar.
// Cada funcionalidad nueva agrega aquí sus rutas.
export const routes = [
  { path: '/login', public: true, render: loginPage },
  { path: '/owner', roles: [ROLES.OWNER], render: ownerHomePage },
  { path: '/owner/boats/new', roles: [ROLES.OWNER], render: registerBoatBasicPage },
  { path: '/owner/boats/new/details', roles: [ROLES.OWNER], render: registerBoatDetailsPage },
  { path: '/owner/boats/:boatId/edit', roles: [ROLES.OWNER], render: editBoatPage },
  { path: '/owner/boats/:boatId', roles: [ROLES.OWNER], render: boatDetailPage },
  { path: '/admin', roles: [ROLES.ADMIN], render: adminHomePage },
  { path: '/admin/boats/:boatId', roles: [ROLES.ADMIN], render: adminBoatDetailPage },
  { path: '/admin/owners/:ownerId', roles: [ROLES.ADMIN], render: adminOwnerPage },
];

export const forbiddenRoute = { path: '/forbidden', render: forbiddenPage };
export const notFoundRoute = { path: '/404', render: notFoundPage };

/** Compara una dirección con el patrón de una ruta (":nombre" captura un tramo) y devuelve los parámetros. */
function matchPath(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (const [index, part] of patternParts.entries()) {
    if (part.startsWith(':')) {
      if (!pathParts[index]) return null;
      params[part.slice(1)] = decodeURIComponent(pathParts[index]);
    } else if (part !== pathParts[index]) {
      return null;
    }
  }
  return params;
}

/**
 * Decide qué hacer con una ruta según la sesión. Devuelve { route } para mostrarla
 * o { redirect } para mandar a otra. Es una función pura: no toca el navegador.
 */
export function resolveRoute(path, session, table = routes) {
  if (path === '/' || path === '') {
    return { redirect: session ? homePathFor(session.user.role) : '/login' };
  }
  let params = null;
  const route = table.find((candidate) => {
    params = matchPath(candidate.path, path);
    return params !== null;
  });
  if (!route) return { route: notFoundRoute };

  if (route.public) {
    return session && path === '/login'
      ? { redirect: homePathFor(session.user.role) }
      : { route, params };
  }
  if (!session) return { redirect: '/login' };
  if (route.roles && !route.roles.includes(session.user.role)) {
    return { route: forbiddenRoute };
  }
  return { route, params };
}
