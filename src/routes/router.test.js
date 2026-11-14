import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/session.js', () => ({
  getSession: vi.fn(() => ({ user: { role: 'OWNER', full_name: 'Ana Pérez' } })),
  getToken: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('../components/header.js', () => ({
  renderHeader: () => document.createElement('header'),
}));

let renderCalls;
vi.mock('./routes.js', () => ({
  routes: [],
  resolveRoute: (path) => ({
    route: {
      render: ({ setGuard }) => {
        renderCalls.push({ path, setGuard });
        const page = document.createElement('main');
        page.textContent = path;
        return page;
      },
    },
    params: {},
  }),
}));

import { AUTH_EXPIRED_EVENT } from '../api/client.js';
import { setNavigationGuard, startRouter } from './router.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 15));
const outlet = document.createElement('div');

// El enrutador se arranca una sola vez, como en la aplicación real.
beforeAll(() => {
  renderCalls = [];
  globalThis.location.hash = '#/owner/boats/b1/edit';
  startRouter(outlet);
});

beforeEach(async () => {
  setNavigationGuard(null);
  globalThis.location.hash = '#/owner/boats/b1/edit';
  await tick();
  renderCalls = [];
  globalThis.location.hash = '#/owner/boats/b1/edit';
  globalThis.dispatchEvent(new Event('hashchange'));
  await tick();
});

afterEach(() => setNavigationGuard(null));

describe('guardia de navegación', () => {
  it('sin guardia cambia de ruta normalmente', async () => {
    globalThis.location.hash = '#/owner';
    await tick();

    expect(outlet.textContent).toContain('/owner');
  });

  it('si la guardia lo impide, se queda y devuelve la dirección sin redibujar', async () => {
    const confirmLeave = vi.fn(() => false);
    renderCalls.at(-1).setGuard({ confirmLeave, dispose: vi.fn() });
    const rendered = renderCalls.length;

    globalThis.location.hash = '#/owner';
    await tick();

    expect(confirmLeave).toHaveBeenCalledWith('/owner');
    expect(globalThis.location.hash).toBe('#/owner/boats/b1/edit');
    expect(renderCalls).toHaveLength(rendered);
  });

  it('si la guardia lo permite, cambia y la limpia (dispose)', async () => {
    const dispose = vi.fn();
    renderCalls.at(-1).setGuard({ confirmLeave: () => true, dispose });

    globalThis.location.hash = '#/owner';
    await tick();

    expect(dispose).toHaveBeenCalled();
    expect(outlet.textContent).toContain('/owner');
  });

  it('con la sesión vencida va al inicio de sesión sin preguntar', async () => {
    const confirmLeave = vi.fn(() => false);
    renderCalls.at(-1).setGuard({ confirmLeave, dispose: vi.fn() });

    globalThis.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    await tick();

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(globalThis.location.hash).toBe('#/login');
  });
});
