import { describe, expect, it } from 'vitest';
import { forbiddenRoute, notFoundRoute, resolveRoute } from './routes.js';

const owner = { user: { role: 'OWNER' } };
const admin = { user: { role: 'ADMIN' } };

describe('resolveRoute', () => {
  it('sin sesión, la raíz y las rutas protegidas mandan al login', () => {
    expect(resolveRoute('/', null)).toEqual({ redirect: '/login' });
    expect(resolveRoute('/owner', null)).toEqual({ redirect: '/login' });
  });

  it('el login es público para quien no tiene sesión', () => {
    expect(resolveRoute('/login', null).route.path).toBe('/login');
  });

  it('con sesión, la raíz y el login mandan al inicio de su rol', () => {
    expect(resolveRoute('/', owner)).toEqual({ redirect: '/owner' });
    expect(resolveRoute('/login', admin)).toEqual({ redirect: '/admin' });
  });

  it('cada rol entra a su página', () => {
    expect(resolveRoute('/owner', owner).route.path).toBe('/owner');
    expect(resolveRoute('/admin', admin).route.path).toBe('/admin');
  });

  it('un rol no entra a la página de otro', () => {
    expect(resolveRoute('/admin', owner).route).toBe(forbiddenRoute);
    expect(resolveRoute('/owner', admin).route).toBe(forbiddenRoute);
  });

  it('una ruta que no existe muestra la página 404', () => {
    expect(resolveRoute('/no-existe', owner).route).toBe(notFoundRoute);
  });

  it('una ruta con parámetro entrega el valor de ese tramo', () => {
    const result = resolveRoute('/owner/boats/abc-123', owner);

    expect(result.route.path).toBe('/owner/boats/:boatId');
    expect(result.params).toEqual({ boatId: 'abc-123' });
  });

  it('las rutas fijas ganan sobre las que tienen parámetro', () => {
    expect(resolveRoute('/owner/boats/new', owner).route.path).toBe('/owner/boats/new');
  });

  it('el detalle de una embarcación solo es para el propietario', () => {
    expect(resolveRoute('/owner/boats/abc-123', admin).route).toBe(forbiddenRoute);
    expect(resolveRoute('/owner/boats/abc-123', null)).toEqual({ redirect: '/login' });
  });
});
