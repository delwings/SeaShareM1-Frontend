import { apiRequest } from '../api/client.js';

const OWNERS = '/admin/owners';

/** Busca propietarios por nombre o cédula (mínimo 3 caracteres). Devuelve { owners, hasMore }. */
export async function searchOwners(query) {
  const data = await apiRequest(`${OWNERS}?${new URLSearchParams({ q: query.trim() })}`);
  return { owners: data.owners, hasMore: data.has_more };
}

/** Información de un propietario: nombre, documento, correo y teléfono. */
export function getOwner(ownerId) {
  return apiRequest(`${OWNERS}/${encodeURIComponent(ownerId)}`);
}
