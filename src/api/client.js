import { API_BASE_URL, API_PREFIX } from '../config.js';
import { clearSession, getToken } from '../auth/session.js';

/** Evento que se emite cuando el backend rechaza el token (vencido o inválido). */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

/** Error de la API en el formato RFC 9457 del backend, o de red (status 0). */
export class ApiError extends Error {
  constructor({
    status,
    title,
    detail,
    errors = [],
    correlationId = null,
    currentStatus = null,
    maintenanceBy = null,
  }) {
    super(detail || title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.correlationId = correlationId;
    this.currentStatus = currentStatus;
    this.maintenanceBy = maintenanceBy;
  }
}

async function toApiError(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    // La respuesta no era JSON: se usa un mensaje genérico.
  }
  return new ApiError({
    status: response.status,
    title: body.title ?? 'Error',
    detail: body.detail ?? 'Ocurrió un error inesperado.',
    errors: Array.isArray(body.errors) ? body.errors : [],
    correlationId: body.correlation_id ?? response.headers?.get('X-Correlation-Id') ?? null,
    currentStatus: body.current_status ?? null,
    maintenanceBy: body.maintenance_by ?? null,
  });
}

/**
 * Llama a la API. Agrega el token cuando auth es true (por defecto), serializa el cuerpo como JSON
 * (o lo envía tal cual si es FormData, por ejemplo una foto) y convierte los errores en ApiError.
 */
export async function apiRequest(path, { method = 'GET', body, auth = true, timeoutMs } = {}) {
  const headers = { Accept: 'application/json' };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  // Con timeoutMs la solicitud se cancela si el servidor no responde a tiempo.
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller?.signal,
    });
  } catch {
    throw new ApiError({
      status: 0,
      title: controller?.signal.aborted ? 'Tiempo agotado' : 'Sin conexión',
      detail: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      globalThis.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw await toApiError(response);
  }
  return response.status === 204 ? null : response.json();
}
