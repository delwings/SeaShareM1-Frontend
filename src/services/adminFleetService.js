import { apiRequest } from '../api/client.js';

const ADMIN_FLEET = '/admin/fleet';

/**
 * Listado global de embarcaciones. Los filtros son opcionales: ownerId, status y query (nombre o
 * cédula del propietario). Los vacíos no se envían.
 */
export async function listFleet({ ownerId, status, query } = {}) {
  const params = new URLSearchParams();
  if (ownerId) params.set('owner_id', ownerId);
  if (status) params.set('status', status);
  if (query?.trim()) params.set('q', query.trim());
  const suffix = params.size > 0 ? `?${params}` : '';
  const data = await apiRequest(`${ADMIN_FLEET}/boats${suffix}`);
  return data.boats;
}

/** Propietarios con embarcaciones registradas, para el filtro del listado. */
export async function listFleetOwners() {
  const data = await apiRequest(`${ADMIN_FLEET}/owners`);
  return data.owners;
}

/** Detalles de cualquier embarcación registrada. */
export function getAdminBoat(boatId) {
  return apiRequest(`${ADMIN_FLEET}/boats/${encodeURIComponent(boatId)}`);
}

/** Plazo máximo de la eliminación: pasados 15 segundos la solicitud se cancela. */
export const ADMIN_DELETE_TIMEOUT_MS = 15000;

/**
 * Elimina (lógicamente) cualquier embarcación registrada. El motivo es obligatorio: el servidor
 * lo incluye en el aviso que recibe el propietario.
 */
export function deleteAdminBoat(boatId, reason) {
  return apiRequest(`${ADMIN_FLEET}/boats/${encodeURIComponent(boatId)}`, {
    method: 'DELETE',
    body: { reason },
    timeoutMs: ADMIN_DELETE_TIMEOUT_MS,
  });
}

/** Plazo máximo del cambio de mantenimiento: pasados 15 segundos la solicitud se cancela. */
export const ADMIN_MAINTENANCE_TIMEOUT_MS = 15000;

/** Envía a mantenimiento cualquier embarcación Disponible; el motivo es obligatorio. */
export function startAdminMaintenance(boatId, reason) {
  return apiRequest(`${ADMIN_FLEET}/boats/${encodeURIComponent(boatId)}/maintenance/start`, {
    method: 'POST',
    body: { reason },
    timeoutMs: ADMIN_MAINTENANCE_TIMEOUT_MS,
  });
}

/** Termina el mantenimiento que inició el administrador. */
export function finishAdminMaintenance(boatId) {
  return apiRequest(`${ADMIN_FLEET}/boats/${encodeURIComponent(boatId)}/maintenance/finish`, {
    method: 'POST',
    timeoutMs: ADMIN_MAINTENANCE_TIMEOUT_MS,
  });
}
