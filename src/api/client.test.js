import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '../auth/session.js';
import { API_BASE_URL, API_PREFIX } from '../config.js';
import { ApiError, AUTH_EXPIRED_EVENT, apiRequest } from './client.js';

function reply(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('llama a la URL completa y envía el token', async () => {
    const fetchMock = vi.fn(() => reply(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user: { role: 'OWNER' } });

    await apiRequest('/vessels');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}${API_PREFIX}/vessels`);
    expect(options.headers.Authorization).toBe('Bearer tok');
  });

  it('envía el cuerpo como JSON', async () => {
    const fetchMock = vi.fn(() => reply(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/x', { method: 'POST', body: { a: 1 }, auth: false });

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBe('{"a":1}');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('no fuerza Content-Type con FormData (lo pone el navegador)', async () => {
    const fetchMock = vi.fn(() => reply(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/x', { method: 'POST', body: new FormData() });

    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  it('convierte un error RFC 9457 en ApiError con errors y correlation_id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        reply(400, {
          title: 'Solicitud inválida',
          detail: 'La solicitud contiene datos inválidos.',
          errors: [{ field: 'password', message: 'La contraseña es obligatoria' }],
          correlation_id: 'abc',
        }),
      ),
    );

    const failure = await apiRequest('/x', { auth: false }).catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(400);
    expect(failure.errors).toHaveLength(1);
    expect(failure.correlationId).toBe('abc');
  });

  it('un 401 con sesión la borra y avisa que venció', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply(401, { title: 'No autorizado', detail: 'Token inválido.' })),
    );
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user: { role: 'OWNER' } });
    const listener = vi.fn();
    globalThis.addEventListener(AUTH_EXPIRED_EVENT, listener);

    await expect(apiRequest('/vessels')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledOnce();
    globalThis.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('un 401 del login (sin sesión) no dispara el aviso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply(401, { title: 'No autorizado', detail: 'Mal.' })),
    );
    const listener = vi.fn();
    globalThis.addEventListener(AUTH_EXPIRED_EVENT, listener);

    await expect(apiRequest('/auth/login', { auth: false })).rejects.toBeInstanceOf(ApiError);

    expect(listener).not.toHaveBeenCalled();
    globalThis.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('si no hay red lanza un ApiError con status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const failure = await apiRequest('/x').catch((error) => error);

    expect(failure.status).toBe(0);
    expect(failure.detail).toContain('No se pudo conectar');
  });

  it('guarda el estado actual que informa un 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply(409, { title: 'Conflicto', detail: 'x', current_status: 'RESERVED' })),
    );

    await expect(apiRequest('/x', { method: 'DELETE' })).rejects.toMatchObject({
      status: 409,
      currentStatus: 'RESERVED',
    });
  });

  it('guarda quién envió la embarcación a mantenimiento cuando el 409 lo informa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        reply(409, {
          title: 'Conflicto',
          detail: 'x',
          current_status: 'MAINTENANCE',
          maintenance_by: 'ADMIN',
        }),
      ),
    );

    await expect(apiRequest('/x', { method: 'POST' })).rejects.toMatchObject({
      maintenanceBy: 'ADMIN',
    });
  });

  it('con timeoutMs cancela la solicitud y la trata como fallo de conexión', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (url, { signal }) =>
            new Promise((resolve, reject) => {
              signal.addEventListener('abort', () =>
                reject(new DOMException('abort', 'AbortError')),
              );
            }),
        ),
      );

      const pending = apiRequest('/x', { method: 'DELETE', timeoutMs: 15000 });
      const outcome = expect(pending).rejects.toMatchObject({ status: 0, title: 'Tiempo agotado' });
      await vi.advanceTimersByTimeAsync(15000);

      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
