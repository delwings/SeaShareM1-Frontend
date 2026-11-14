import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession, getToken, getUser, hasRole, saveSession } from './session.js';

const user = { id: 'u1', fullName: 'Carlos', role: 'OWNER' };

afterEach(() => {
  vi.useRealTimers();
  clearSession();
});

describe('session', () => {
  it('guarda y devuelve la sesión', () => {
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user });
    expect(getToken()).toBe('tok');
    expect(getUser()).toEqual(user);
  });

  it('sin sesión devuelve null', () => {
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('descarta la sesión cuando el token venció', () => {
    vi.useFakeTimers();
    saveSession({ accessToken: 'tok', expiresInSeconds: 60, user });
    vi.advanceTimersByTime(61_000);
    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem('seashare.session')).toBeNull();
  });

  it('recupera la sesión desde sessionStorage', () => {
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user });
    expect(JSON.parse(sessionStorage.getItem('seashare.session')).accessToken).toBe('tok');
  });

  it('hasRole compara con el rol del usuario', () => {
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user });
    expect(hasRole('OWNER')).toBe(true);
    expect(hasRole('ADMIN')).toBe(false);
  });

  it('clearSession la borra', () => {
    saveSession({ accessToken: 'tok', expiresInSeconds: 1800, user });
    clearSession();
    expect(getSession()).toBeNull();
  });
});
