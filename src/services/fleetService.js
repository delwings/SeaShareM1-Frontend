import { apiRequest } from '../api/client.js';

const BOATS = '/fleet/boats';

/** Embarcaciones registradas del propietario (sin borradores), la más reciente primero. */
export async function listBoats() {
  const data = await apiRequest(BOATS);
  return data.boats;
}

/** Tipos de embarcación con su capacidad máxima. */
export async function listBoatTypes() {
  const data = await apiRequest('/fleet/boat-types');
  return data.types;
}

/** Detalles de una embarcación registrada del propietario. */
export function getBoat(boatId) {
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}`);
}

/** Plazo máximo de la eliminación: pasados 15 segundos la solicitud se cancela. */
export const DELETE_TIMEOUT_MS = 15000;

/** Elimina (lógicamente) una embarcación registrada del propietario. */
export function deleteBoat(boatId) {
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}`, {
    method: 'DELETE',
    timeoutMs: DELETE_TIMEOUT_MS,
  });
}

/** Plazo máximo del cambio de mantenimiento: pasados 15 segundos la solicitud se cancela. */
export const MAINTENANCE_TIMEOUT_MS = 15000;

/** Envía la embarcación a mantenimiento (sin motivo). Devuelve la embarcación actualizada. */
export function startMaintenance(boatId) {
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}/maintenance/start`, {
    method: 'POST',
    timeoutMs: MAINTENANCE_TIMEOUT_MS,
  });
}

/** Termina el mantenimiento y deja la embarcación Disponible. Devuelve la embarcación. */
export function finishMaintenance(boatId) {
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}/maintenance/finish`, {
    method: 'POST',
    timeoutMs: MAINTENANCE_TIMEOUT_MS,
  });
}

/** Plazo máximo del guardado de la edición: pasados 15 segundos la solicitud se cancela. */
export const EDIT_TIMEOUT_MS = 15000;

/**
 * Edita los datos de una embarcación registrada. La foto solo se envía si cambió (si no, el
 * servidor conserva la actual). Una sola solicitud, con plazo de 15 segundos.
 */
export function editBoat(boatId, data) {
  const form = new FormData();
  form.append('name', data.name);
  form.append('max_capacity', data.maxCapacity);
  form.append('port_name', data.portName);
  form.append('latitude', String(data.latitude));
  form.append('longitude', String(data.longitude));
  form.append('base_rate', data.baseRate);
  form.append('life_jackets', String(data.services.lifeJackets));
  form.append('cooler_with_ice', String(data.services.coolerWithIce));
  form.append('sound_system', String(data.services.soundSystem));
  form.append('fishing_gear', String(data.services.fishingGear));
  form.append('diving_gear', String(data.services.divingGear));
  if (data.photo) form.append('photo', data.photo);
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}`, {
    method: 'PUT',
    body: form,
    timeoutMs: EDIT_TIMEOUT_MS,
  });
}

/** Borrador del propietario, o null si no tiene. */
export async function getDraft() {
  try {
    return await apiRequest(`${BOATS}/draft`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** Paso 1: guarda los datos básicos y deja la embarcación en borrador. */
export function createDraft({ name, legalRegistration, type, maxCapacity }) {
  return apiRequest(`${BOATS}/draft`, {
    method: 'POST',
    body: {
      name,
      legal_registration: legalRegistration,
      type,
      max_capacity: maxCapacity,
    },
  });
}

export function deleteDraft() {
  return apiRequest(`${BOATS}/draft`, { method: 'DELETE' });
}

/** Dice si la matrícula está libre. */
export async function isLegalRegistrationAvailable(value) {
  const data = await apiRequest(
    `${BOATS}/legal-registration-availability?value=${encodeURIComponent(value)}`,
  );
  return data.available;
}

/** Paso 2: completa el registro enviando el formulario con la foto. */
export function completeRegistration(boatId, details) {
  const form = new FormData();
  form.append('port_name', details.portName);
  form.append('latitude', String(details.latitude));
  form.append('longitude', String(details.longitude));
  form.append('base_rate', details.baseRate);
  form.append('life_jackets', String(details.services.lifeJackets));
  form.append('cooler_with_ice', String(details.services.coolerWithIce));
  form.append('sound_system', String(details.services.soundSystem));
  form.append('fishing_gear', String(details.services.fishingGear));
  form.append('diving_gear', String(details.services.divingGear));
  form.append('photo', details.photo);
  return apiRequest(`${BOATS}/${boatId}/registration`, { method: 'POST', body: form });
}

/** El propietario pide al administrador que revise su embarcación suspendida. Responde 204. */
export function requestMaintenanceReview(boatId) {
  return apiRequest(`${BOATS}/${encodeURIComponent(boatId)}/maintenance/request-review`, {
    method: 'POST',
    timeoutMs: MAINTENANCE_TIMEOUT_MS,
  });
}
