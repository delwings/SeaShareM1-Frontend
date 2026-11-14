import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({
  getBoat: vi.fn(),
  deleteBoat: vi.fn(),
  startMaintenance: vi.fn(),
  finishMaintenance: vi.fn(),
  requestMaintenanceReview: vi.fn(),
}));

import {
  finishMaintenance,
  getBoat,
  requestMaintenanceReview,
  startMaintenance,
} from '../services/fleetService.js';
import { boatDetailPage } from './boatDetail.js';

const BOAT = {
  boat_id: 'b1',
  name: 'Río Magdalena I',
  legal_registration: 'CP-05-1042-A',
  type: 'MOTORBOAT',
  max_capacity: 12,
  status: 'AVAILABLE',
  photo_url: 'https://img.test/boat.png',
  base_rate: '180000.00',
  port: { name: 'Marina Fluvial Magdalena', latitude: '10.7450', longitude: '-74.7891' },
  services: {
    life_jackets: true,
    cooler_with_ice: true,
    sound_system: false,
    fishing_gear: false,
    diving_gear: false,
  },
  registered_at: '2026-11-05T14:30:15Z',
};

let page;
let navigate;
const q = (selector) => page.querySelector(selector);
const text = () => page.textContent;
const buttons = () => [...page.querySelectorAll('.detail-actions button')];
const button = (label) => buttons().find((b) => b.textContent === label);

async function mount(boat = BOAT) {
  getBoat.mockResolvedValue(boat);
  navigate = vi.fn();
  page = boatDetailPage({ navigate, params: { boatId: 'b1' } });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.detail-grid')).not.toBeNull());
}

async function mountFailing(error) {
  getBoat.mockRejectedValue(error);
  navigate = vi.fn();
  page = boatDetailPage({ navigate, params: { boatId: 'b1' } });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.detail-skeleton')).toBeNull());
}

afterEach(() => {
  page?.remove();
  vi.clearAllMocks();
});

describe('Ver Detalles: carga', () => {
  it('muestra un esqueleto mientras consulta y consulta la embarcación del enlace', async () => {
    let resolve;
    getBoat.mockReturnValue(new Promise((r) => (resolve = r)));
    page = boatDetailPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    document.body.append(page);

    expect(q('.detail-skeleton')).not.toBeNull();
    expect(q('.spinner')).toBeNull();
    expect(getBoat).toHaveBeenCalledWith('b1');

    resolve(BOAT);
    await vi.waitFor(() => expect(q('.detail-grid')).not.toBeNull());
    expect(q('.detail-skeleton')).toBeNull();
  });

  it('cada vez que se abre vuelve a consultar al servidor', async () => {
    await mount();
    page.remove();

    await mount();

    expect(getBoat).toHaveBeenCalledTimes(2);
  });
});

describe('Ver Detalles: información y formato', () => {
  beforeEach(() => mount());

  it('muestra todos los datos con el formato del spec', () => {
    expect(q('.page-title').textContent).toBe('Río Magdalena I');
    expect(text()).toContain('CP-05-1042-A');
    expect(text()).toContain('Lancha');
    expect(text()).toContain('12 pasajeros');
    expect(text()).toContain('$ 180.000');
    expect(page.querySelectorAll('.detail-value')[3].textContent).toBe('$ 180.000');
    expect(text()).toContain('Marina Fluvial Magdalena');
    const values = [...page.querySelectorAll('.detail-value')].map((n) => n.textContent);
    expect(values.slice(4)).toEqual(['Marina Fluvial Magdalena', '10.7450', '-74.7891']);
    expect(text()).not.toMatch(/por hora|por día|\/h/i);
  });

  it('usa las etiquetas del spec', () => {
    const labels = [...page.querySelectorAll('.detail-label')].map((n) => n.textContent);
    expect(labels).toEqual([
      'Matrícula Legal',
      'Tipo de Embarcación',
      'Capacidad máxima',
      'Tarifa base (COP)',
      'Puerto de atraque y ubicación GPS',
      'Latitud',
      'Longitud',
    ]);
    expect(q('.services-title').textContent).toBe('Servicios y Dotación Incluida');
  });

  it('el badge lleva el círculo y el nombre del estado', () => {
    expect(q('.chip .chip-dot')).not.toBeNull();
    expect(q('.chip').textContent).toBe('Disponible');
  });

  it('muestra los servicios base y solo los adicionales elegidos', () => {
    const rows = [...page.querySelectorAll('.service-row')];
    const items = (row) => [...row.querySelectorAll('li')].map((li) => li.textContent);
    expect(rows[0].querySelector('.service-row-label').textContent).toBe('Obligatorios (base):');
    expect(items(rows[0])).toEqual(['Capitán', 'Combustible']);
    expect(rows[1].querySelector('.service-row-label').textContent).toBe('Adicionales:');
    expect(items(rows[1])).toEqual(['Chalecos salvavidas', 'Nevera con hielo']);
  });

  it('la fotografía lleva el nombre de la embarcación como texto alternativo', () => {
    expect(q('.detail-photo img').getAttribute('alt')).toBe('Río Magdalena I');
  });

  it('no usa tooltips en ningún elemento', () => {
    expect(page.querySelectorAll('[title]').length).toBe(0);
  });
});

describe('Ver Detalles: casos particulares', () => {
  it('con una capacidad de 1 usa el singular', async () => {
    await mount({ ...BOAT, max_capacity: 1 });
    expect(text()).toContain('1 pasajero');
    expect(text()).not.toContain('1 pasajeros');
  });

  it('sin servicios adicionales lo indica', async () => {
    await mount({
      ...BOAT,
      services: {
        life_jackets: false,
        cooler_with_ice: false,
        sound_system: false,
        fishing_gear: false,
        diving_gear: false,
      },
    });
    expect(text()).toContain('Sin servicios adicionales seleccionados');
    expect(text()).toContain('Capitán');
    expect(text()).toContain('Combustible');
  });

  it('un dato vacío se ve como guion y el resto se muestra', async () => {
    await mount({ ...BOAT, legal_registration: null, base_rate: null, port: null });
    expect(text()).toContain('Río Magdalena I');
    expect(text()).toContain('Lancha');
    const values = [...page.querySelectorAll('.detail-value')].map((n) => n.textContent);
    expect(values[0]).toBe('—');
    expect(values[3]).toBe('—');
    expect(values.slice(4)).toEqual(['—', '—', '—']);
  });

  it('si la fotografía falla al cargar se muestra la imagen por defecto', async () => {
    await mount();
    q('.detail-photo img').dispatchEvent(new Event('error'));

    expect(q('.detail-photo img')).toBeNull();
    expect(q('.photo-fallback').getAttribute('aria-label')).toBe(
      'Imagen por defecto de embarcación',
    );
    expect(q('.photo-caption').textContent).toBe('Fotografía oficial de la embarcación');
    expect(q('.detail-cards')).not.toBeNull();
  });

  it('sin fotografía se muestra la imagen por defecto', async () => {
    await mount({ ...BOAT, photo_url: null });
    expect(q('.photo-fallback')).not.toBeNull();
  });

  it('muestra coordenadas con ceros de relleno', async () => {
    await mount({ ...BOAT, port: { name: 'Puerto', latitude: '11', longitude: '-74.5' } });
    const values = [...page.querySelectorAll('.detail-value')].map((n) => n.textContent);
    expect(values.slice(5)).toEqual(['11.0000', '-74.5000']);
  });
});

describe('Ver Detalles: botones del propietario', () => {
  it('muestra Editar, el botón de mantenimiento y Eliminar, en ese orden', async () => {
    await mount();
    expect(buttons().map((b) => b.textContent)).toEqual([
      'Editar',
      'Enviar a Mantenimiento',
      'Eliminar',
    ]);
  });

  it.each(['AVAILABLE', 'MAINTENANCE'])('Editar está habilitado en %s', async (status) => {
    await mount({ ...BOAT, status });
    expect(button('Editar').disabled).toBe(false);
  });

  it.each(['RESERVED', 'NAVIGATION'])('Editar está deshabilitado en %s', async (status) => {
    await mount({ ...BOAT, status });
    expect(button('Editar').disabled).toBe(true);
  });

  it.each(['AVAILABLE', 'MAINTENANCE'])(
    'Eliminar está habilitado en %s y abre la confirmación',
    async (status) => {
      await mount({ ...BOAT, status });
      expect(button('Eliminar').disabled).toBe(false);

      button('Eliminar').click();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Eliminar embarcación?');
      document.querySelector('.modal-overlay').remove();
    },
  );

  it.each(['RESERVED', 'NAVIGATION'])(
    'Eliminar está deshabilitado en %s y no abre nada',
    async (status) => {
      await mount({ ...BOAT, status });
      expect(button('Eliminar').disabled).toBe(true);

      button('Eliminar').click();

      expect(document.querySelector('.modal-overlay')).toBeNull();
    },
  );

  it('en mantenimiento el botón pasa a "Terminar mantenimiento" en el mismo lugar', async () => {
    await mount({ ...BOAT, status: 'MAINTENANCE' });
    expect(buttons().map((b) => b.textContent)).toEqual([
      'Editar',
      'Terminar mantenimiento',
      'Eliminar',
    ]);
    expect(q('.chip').textContent).toBe('Mantenimiento');
  });

  it.each([
    ['RESERVED', 'Reservado'],
    ['NAVIGATION', 'En Navegación'],
  ])('en %s el botón de mantenimiento es "Enviar a Mantenimiento"', async (status, label) => {
    await mount({ ...BOAT, status });
    expect(button('Enviar a Mantenimiento')).not.toBeUndefined();
    expect(button('Enviar a Mantenimiento').disabled).toBe(true);
    expect(q('.chip').textContent).toBe(label);
  });

  it('enviar a mantenimiento: confirma y la pantalla pasa a En Mantenimiento sin recargar', async () => {
    await mount();
    startMaintenance.mockResolvedValue({ ...BOAT, status: 'MAINTENANCE' });

    button('Enviar a Mantenimiento').click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Enviar a Mantenimiento?');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, enviar')
      .click();

    await vi.waitFor(() => expect(q('.chip').textContent).toBe('Mantenimiento'));
    expect(button('Terminar mantenimiento')).not.toBeUndefined();
    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(getBoat).toHaveBeenCalledTimes(1);
  });

  it('terminar mantenimiento: confirma y la embarcación vuelve a Disponible', async () => {
    await mount({ ...BOAT, status: 'MAINTENANCE' });
    finishMaintenance.mockResolvedValue({ ...BOAT, status: 'AVAILABLE' });

    button('Terminar mantenimiento').click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Terminar Mantenimiento?');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, terminar')
      .click();

    await vi.waitFor(() => expect(q('.chip').textContent).toBe('Disponible'));
    expect(button('Enviar a Mantenimiento')).not.toBeUndefined();
  });
});

describe('Ver Detalles: navegación y errores', () => {
  it('"Volver" lleva a Mis Embarcaciones', async () => {
    await mount();
    q('.detail-back').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('una embarcación inexistente, ajena o en borrador solo muestra el error y su botón', async () => {
    await mountFailing({ status: 404 });

    expect(q('.detail-error').getAttribute('role')).toBe('alert');
    expect(q('.detail-error-title').textContent).toBe(
      'No se pudo cargar la información de la embarcación',
    );
    expect(q('.detail-grid')).toBeNull();
    expect(q('.detail-back').hidden).toBe(true);
    const labels = [...page.querySelectorAll('.detail-error-actions button')].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Volver a Mis Embarcaciones']);

    page.querySelector('.detail-error-actions button').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('un identificador mal formado (400) se trata como inexistente', async () => {
    await mountFailing({ status: 400 });
    const labels = [...page.querySelectorAll('.detail-error-actions button')].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Volver a Mis Embarcaciones']);
  });

  it('un fallo de red ofrece Reintentar y Volver, y Reintentar repite la consulta', async () => {
    await mountFailing({ status: 0 });
    const labels = [...page.querySelectorAll('.detail-error-actions button')].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Volver', 'Reintentar']);

    getBoat.mockResolvedValue(BOAT);
    [...page.querySelectorAll('.detail-error-actions button')]
      .find((b) => b.textContent === 'Reintentar')
      .click();
    expect(q('.detail-skeleton')).not.toBeNull();
    await vi.waitFor(() => expect(q('.detail-grid')).not.toBeNull());

    expect(getBoat).toHaveBeenCalledTimes(2);
  });

  it('un fallo del servidor también permite reintentar', async () => {
    await mountFailing({ status: 500 });
    expect(page.querySelectorAll('.detail-error-actions button').length).toBe(2);
  });

  it('una sesión vencida no muestra el error de red (el cliente redirige al login)', async () => {
    getBoat.mockRejectedValue({ status: 401 });
    page = boatDetailPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    document.body.append(page);

    await vi.waitFor(() => expect(getBoat).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(q('.detail-error')).toBeNull();
  });

  it('Editar habilitado lleva al formulario de edición de esa embarcación', async () => {
    await mount();

    button('Editar').click();

    expect(navigate).toHaveBeenCalledWith('/owner/boats/b1/edit');
  });

  it.each(['RESERVED', 'NAVIGATION'])(
    'en %s Editar está deshabilitado, sin tooltip, y no navega',
    async (status) => {
      await mount({ ...BOAT, status });

      expect(button('Editar').disabled).toBe(true);
      expect(q('[role="tooltip"]')).toBeNull();
      expect(q('[title]')).toBeNull();
      button('Editar').click();
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

describe('Mantenimiento iniciado por el administrador', () => {
  const mountOwner = async (boat) => {
    getBoat.mockResolvedValue(boat);
    page = boatDetailPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    document.body.append(page);
    await vi.waitFor(() => expect(page.querySelector('.detail-grid')).not.toBeNull());
    return [...page.querySelectorAll('.detail-actions button')];
  };

  it('el propietario ve "Solicitar revisión" habilitado en lugar de "Terminar mantenimiento"', async () => {
    const buttons = await mountOwner({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });

    expect(buttons.map((b) => b.textContent)).toEqual(['Editar', 'Solicitar revisión', 'Eliminar']);
    expect(buttons[1].disabled).toBe(false);
  });

  it('"Solicitar revisión" abre "¿Enviar a revisión?" y avisa al administrador', async () => {
    requestMaintenanceReview.mockResolvedValue(undefined);
    const buttons = await mountOwner({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });

    buttons[1].click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Enviar a revisión?');
    expect(document.querySelector('.modal').textContent).toContain(
      'Se enviará una notificación al administrador.',
    );
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, enviar')
      .click();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title').textContent).toBe('Solicitud enviada'),
    );
    expect(requestMaintenanceReview).toHaveBeenCalledWith('b1');
    expect(finishMaintenance).not.toHaveBeenCalled();
  });

  it('tras enviar la solicitud el botón queda deshabilitado', async () => {
    requestMaintenanceReview.mockResolvedValue(undefined);
    const buttons = await mountOwner({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });

    buttons[1].click();
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, enviar')
      .click();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title').textContent).toBe('Solicitud enviada'),
    );
    const after = [...page.querySelectorAll('.detail-actions button')];
    expect(after[1].textContent).toBe('Solicitar revisión');
    expect(after[1].disabled).toBe(true);
  });

  it('si la revisión ya fue solicitada, al abrir la pantalla el botón está deshabilitado', async () => {
    const buttons = await mountOwner({
      ...BOAT,
      status: 'MAINTENANCE',
      maintenance_by: 'ADMIN',
      review_requested: true,
    });

    expect(buttons[1].textContent).toBe('Solicitar revisión');
    expect(buttons[1].disabled).toBe(true);
  });

  it.each(['OWNER', null])('con origen %s sigue diciendo "Terminar mantenimiento"', async (by) => {
    const buttons = await mountOwner({ ...BOAT, status: 'MAINTENANCE', maintenance_by: by });

    expect(buttons[1].textContent).toBe('Terminar mantenimiento');
    expect(buttons[1].disabled).toBe(false);
  });
});
