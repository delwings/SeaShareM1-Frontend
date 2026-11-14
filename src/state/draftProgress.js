// Avance del paso 2 del registro: lo que el propietario ya escribió (puerto, coordenadas, tarifa y
// servicios) para devolvérselo igual si cancela o sale y retoma el borrador. Se guarda en el
// navegador, por usuario y por borrador. La fotografía no se guarda: hay que volver a elegirla.
const PREFIX = 'seashare.draftProgress';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const keyOf = (userId, boatId) => `${PREFIX}.${userId}.${boatId}`;

/** Guarda el avance; si todo está vacío, borra el anterior en lugar de guardar un registro vacío. */
export function saveProgress(userId, boatId, progress) {
  if (!userId || !boatId) return;
  const empty =
    !progress.portName &&
    !progress.rate &&
    !progress.point &&
    !Object.values(progress.services ?? {}).some(Boolean);
  try {
    if (empty) storage()?.removeItem(keyOf(userId, boatId));
    else storage()?.setItem(keyOf(userId, boatId), JSON.stringify(progress));
  } catch {
    // Sin almacenamiento: el registro sigue funcionando, solo no se conserva el avance.
  }
}

/** Devuelve el avance guardado o null (también si está dañado o no tiene la forma esperada). */
export function loadProgress(userId, boatId) {
  if (!userId || !boatId) return null;
  try {
    const raw = storage()?.getItem(keyOf(userId, boatId));
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return null;
    const { latitude, longitude } = data.point ?? {};
    return {
      portName: typeof data.portName === 'string' ? data.portName : '',
      rate: typeof data.rate === 'string' ? data.rate : '',
      point:
        Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
      services: data.services && typeof data.services === 'object' ? data.services : {},
    };
  } catch {
    return null;
  }
}

export function clearProgress(userId, boatId) {
  if (!userId || !boatId) return;
  try {
    storage()?.removeItem(keyOf(userId, boatId));
  } catch {
    // Nada que borrar.
  }
}
