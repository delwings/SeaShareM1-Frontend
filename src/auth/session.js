// Estado de autenticación: el token y el usuario de la sesión actual.
// Se guarda en sessionStorage (se borra al cerrar la pestaña). Si el navegador no deja usarlo,
// la sesión vive en memoria y la página sigue funcionando.
const KEY = 'seashare.session';
let memorySession = null;

function storage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Guarda la sesión que devuelve el login. */
export function saveSession({ accessToken, expiresInSeconds, user }) {
  const session = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000, user };
  memorySession = session;
  try {
    storage()?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento: queda solo en memoria.
  }
  return session;
}

/** Devuelve la sesión vigente, o null si no hay o ya venció (en ese caso la borra). */
export function getSession() {
  let session = memorySession;
  if (!session) {
    try {
      const raw = storage()?.getItem(KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch {
      session = null;
    }
  }
  if (!session || !session.accessToken || session.expiresAt <= Date.now()) {
    if (session) clearSession();
    return null;
  }
  memorySession = session;
  return session;
}

export function clearSession() {
  memorySession = null;
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
}

export function getToken() {
  return getSession()?.accessToken ?? null;
}

export function getUser() {
  return getSession()?.user ?? null;
}

export function hasRole(...roles) {
  const user = getUser();
  return Boolean(user) && roles.includes(user.role);
}
