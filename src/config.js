// Direcciones del backend. No son secretos.
export const API_URLS = {
  local: 'http://localhost:8081',
  // [POR DEFINIR] Se completa al desplegar el backend en Render.
  deployed: 'https://CAMBIAR-POR-LA-URL-DE-RENDER.onrender.com',
};

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

/**
 * Elige la dirección del backend según dónde se abrió la página:
 * en localhost (o 127.0.0.1, que es lo que usa Live Server) usa la local;
 * en cualquier otro lugar usa la desplegada.
 */
export function resolveApiBaseUrl(hostname) {
  return LOCAL_HOSTNAMES.includes(hostname) ? API_URLS.local : API_URLS.deployed;
}

export const API_BASE_URL = resolveApiBaseUrl(globalThis.location?.hostname ?? '');
export const API_PREFIX = '/api/v1';
