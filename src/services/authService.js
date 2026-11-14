import { apiRequest } from '../api/client.js';
import { clearSession, saveSession } from '../auth/session.js';

/** Inicia sesión con documento y contraseña; guarda el token y devuelve la sesión. */
export async function login(documentNumber, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: { document_number: documentNumber, password },
  });
  return saveSession({
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
    user: { id: data.user.id, fullName: data.user.full_name, role: data.user.role },
  });
}

export function logout() {
  clearSession();
}
