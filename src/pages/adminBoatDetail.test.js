import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/adminFleetService.js', () => ({
  getAdminBoat: vi.fn(),
  deleteAdminBoat: vi.fn(),
  startAdminMaintenance: vi.fn(),
  finishAdminMaintenance: vi.fn(),
}));

import {
  deleteAdminBoat,
  finishAdminMaintenance,
  getAdminBoat,
  startAdminMaintenance,
} from '../services/adminFleetService.js';
import { adminBoatDetailPage } from './adminBoatDetail.js';

const BOAT = {
  boat_id: 'b1',
  name: 'Río Magdalena I',
  legal_registration: 'CP-05-1042-A',
  type: 'MOTORBOAT',
  max_capacity: 12,
  status: 'AVAILABLE',
  photo_url: null,
  base_rate: '180000.00',
  port: { name: 'Marina Fluvial Magdalena', latitude: '10.7452', longitude: '-74.7891' },
  services: { life_jackets: true, cooler_with_ice: true, sound_system: true },
  registered_at: '2026-11-05T14:30:15Z',
};

let page;
let navigate;
const q = (selector) => page.querySelector(selector);
const buttons = () => [...page.querySelectorAll('.detail-actions button')];

function typeReason(value) {
  const input = document.querySelector('.reason-input');
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function mount(boat = BOAT) {
  getAdminBoat.mockResolvedValue(boat);
  navigate = vi.fn();
  page = adminBoatDetailPage({ navigate, params: { boatId: 'b1' } });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.detail-grid')).not.toBeNull());
}

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((node) => node.remove());
  page?.remove();
  vi.clearAllMocks();
});

describe('Ver Detalles del administrador', () => {
  it('consulta la embarcación por la ruta del administrador', async () => {
    await mount();
    expect(getAdminBoat).toHaveBeenCalledWith('b1');
    expect(q('.page-title').textContent).toBe('Río Magdalena I');
  });

  it('no tiene el botón "Editar": solo mantenimiento y Eliminar', async () => {
    await mount();
    expect(buttons().map((b) => b.textContent)).toEqual(['Enviar a Mantenimiento', 'Eliminar']);
  });

  it('en mantenimiento el botón dice "Terminar Mantenimiento"', async () => {
    await mount({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });
    expect(buttons().map((b) => b.textContent)).toEqual(['Terminar Mantenimiento', 'Eliminar']);
  });

  it('si el mantenimiento lo inició el administrador, "Terminar" está habilitado', async () => {
    await mount({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });
    expect(buttons()[0].disabled).toBe(false);
  });

  it.each(['OWNER', null])(
    'si el mantenimiento lo inició %s, "Terminar" está deshabilitado y no abre nada',
    async (by) => {
      await mount({ ...BOAT, status: 'MAINTENANCE', maintenance_by: by });
      expect(buttons()[0].disabled).toBe(true);
      expect(buttons()[1].disabled).toBe(false);
      buttons()[0].click();
      expect(document.querySelector('.modal-overlay')).toBeNull();
    },
  );

  it('"Enviar a Mantenimiento" pide el motivo, envía y pasa a "Terminar Mantenimiento"', async () => {
    startAdminMaintenance.mockResolvedValue({
      ...BOAT,
      status: 'MAINTENANCE',
      maintenance_by: 'ADMIN',
    });
    await mount();

    buttons()[0].click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Enviar a Mantenimiento?');
    typeReason('Revisión de motor');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, enviar')
      .click();

    await vi.waitFor(() => expect(buttons()[0].textContent).toBe('Terminar Mantenimiento'));
    expect(startAdminMaintenance).toHaveBeenCalledWith('b1', 'Revisión de motor');
    expect(q('.chip').textContent).toContain('Mantenimiento');
    expect(buttons()[0].disabled).toBe(false);
  });

  it('"Terminar Mantenimiento" confirma y deja la embarcación Disponible', async () => {
    finishAdminMaintenance.mockResolvedValue({
      ...BOAT,
      status: 'AVAILABLE',
      maintenance_by: null,
    });
    await mount({ ...BOAT, status: 'MAINTENANCE', maintenance_by: 'ADMIN' });

    buttons()[0].click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Terminar Mantenimiento?');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, terminar')
      .click();

    await vi.waitFor(() => expect(buttons()[0].textContent).toBe('Enviar a Mantenimiento'));
    expect(finishAdminMaintenance).toHaveBeenCalledWith('b1');
  });

  it('"Eliminar" abre el mismo modal; al confirmar elimina y "Aceptar" vuelve a la tabla de flota', async () => {
    deleteAdminBoat.mockResolvedValue(undefined);
    await mount();

    buttons()[1].click();
    expect(document.querySelector('.modal-title').textContent).toBe('¿Eliminar embarcación?');
    typeReason('Fotos falsas');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, eliminar')
      .click();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title').textContent).toBe('¡Embarcación eliminada!'),
    );
    expect(deleteAdminBoat).toHaveBeenCalledWith('b1', 'Fotos falsas');
    document.querySelector('.modal-actions button').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('"Eliminar" con 404 muestra "Esta embarcación ya no existe" y lleva a la tabla de flota', async () => {
    deleteAdminBoat.mockRejectedValue({ status: 404 });
    await mount();

    buttons()[1].click();
    typeReason('Motivo');
    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Sí, eliminar')
      .click();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title').textContent).toBe(
        'Esta embarcación ya no existe',
      ),
    );
    document.querySelector('.modal-actions button').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it.each(['RESERVED', 'NAVIGATION'])('en %s mantenimiento está deshabilitado', async (status) => {
    await mount({ ...BOAT, status });
    expect(buttons()[0].disabled).toBe(true);
    expect(buttons()[1].disabled).toBe(true);
  });

  it('usa el subtítulo de servicios del administrador', async () => {
    await mount();
    expect(q('.services-section').textContent).toContain(
      'equipamiento adicional configurado por el propietario',
    );
  });

  it('no muestra datos del propietario', async () => {
    await mount();
    expect(page.textContent).not.toMatch(/Propietario/);
  });

  it('"Volver" regresa al listado del administrador', async () => {
    await mount();
    q('.detail-back').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('404: error sin reintento y vuelve al listado de flota', async () => {
    getAdminBoat.mockRejectedValue({ status: 404 });
    navigate = vi.fn();
    page = adminBoatDetailPage({ navigate, params: { boatId: 'x' } });
    document.body.append(page);
    await vi.waitFor(() => expect(q('.detail-error')).not.toBeNull());

    expect([...page.querySelectorAll('.detail-error button')].map((b) => b.textContent)).toEqual([
      'Volver',
    ]);
    q('.detail-error button').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });
});
