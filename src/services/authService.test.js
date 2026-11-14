import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession } from '../auth/session.js';
import { login, logout } from './authService.js';

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe('authService', () => {
  it('el login guarda la sesión con el usuario en camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 1800,
              user: { id: 'u1', full_name: 'Carlos Mejía', role: 'OWNER' },
            }),
        }),
      ),
    );

    const session = await login('1010000002', 'SeaShare2026!');

    expect(session.user).toEqual({ id: 'u1', fullName: 'Carlos Mejía', role: 'OWNER' });
    expect(getSession().accessToken).toBe('tok');
  });

  it('logout borra la sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              expires_in: 1800,
              user: { id: 'u1', full_name: 'C', role: 'OWNER' },
            }),
        }),
      ),
    );
    await login('1', 'x');

    logout();

    expect(getSession()).toBeNull();
  });
});
