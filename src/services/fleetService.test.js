import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../api/client.js';
import {
  completeRegistration,
  createDraft,
  DELETE_TIMEOUT_MS,
  deleteBoat,
  deleteDraft,
  EDIT_TIMEOUT_MS,
  editBoat,
  getBoat,
  getDraft,
  finishMaintenance,
  requestMaintenanceReview,
  isLegalRegistrationAvailable,
  MAINTENANCE_TIMEOUT_MS,
  listBoatTypes,
  listBoats,
  startMaintenance,
} from './fleetService.js';

afterEach(() => vi.clearAllMocks());

describe('fleetService', () => {
  it('listBoats y listBoatTypes devuelven el arreglo de la respuesta', async () => {
    apiRequest.mockResolvedValueOnce({ boats: [{ name: 'A' }] });
    apiRequest.mockResolvedValueOnce({ types: [{ code: 'YACHT' }] });

    expect(await listBoats()).toEqual([{ name: 'A' }]);
    expect(await listBoatTypes()).toEqual([{ code: 'YACHT' }]);
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/fleet/boats');
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/fleet/boat-types');
  });

  it('getBoat consulta la embarcación por su identificador', async () => {
    apiRequest.mockResolvedValue({ boat_id: 'b1' });

    expect(await getBoat('b1')).toEqual({ boat_id: 'b1' });
    expect(apiRequest).toHaveBeenCalledWith('/fleet/boats/b1');
  });

  it('deleteBoat envía DELETE con el plazo de 15 segundos', async () => {
    apiRequest.mockResolvedValue(null);

    await deleteBoat('b1');

    expect(DELETE_TIMEOUT_MS).toBe(15000);
    expect(apiRequest).toHaveBeenCalledWith('/fleet/boats/b1', {
      method: 'DELETE',
      timeoutMs: 15000,
    });
  });

  it('startMaintenance y finishMaintenance envían POST con el plazo de 15 segundos', async () => {
    apiRequest.mockResolvedValue({ boat_id: 'b1' });

    await startMaintenance('b1');
    await finishMaintenance('b1');

    expect(MAINTENANCE_TIMEOUT_MS).toBe(15000);
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/fleet/boats/b1/maintenance/start', {
      method: 'POST',
      timeoutMs: 15000,
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/fleet/boats/b1/maintenance/finish', {
      method: 'POST',
      timeoutMs: 15000,
    });
  });

  it('getDraft devuelve null cuando el backend responde 404', async () => {
    apiRequest.mockRejectedValue({ status: 404 });
    expect(await getDraft()).toBeNull();
  });

  it('getDraft propaga los demás errores', async () => {
    apiRequest.mockRejectedValue({ status: 500 });
    await expect(getDraft()).rejects.toEqual({ status: 500 });
  });

  it('createDraft envía los nombres de campo del backend', async () => {
    apiRequest.mockResolvedValue({ boat_id: 'b1' });

    await createDraft({
      name: 'Mar',
      legalRegistration: 'CP-01-2026-A',
      type: 'YACHT',
      maxCapacity: 8,
    });

    expect(apiRequest).toHaveBeenCalledWith('/fleet/boats/draft', {
      method: 'POST',
      body: { name: 'Mar', legal_registration: 'CP-01-2026-A', type: 'YACHT', max_capacity: 8 },
    });
  });

  it('deleteDraft usa DELETE', async () => {
    await deleteDraft();
    expect(apiRequest).toHaveBeenCalledWith('/fleet/boats/draft', { method: 'DELETE' });
  });

  it('la verificación codifica la matrícula en la dirección', async () => {
    apiRequest.mockResolvedValue({ available: false });

    expect(await isLegalRegistrationAvailable('CP-01-2026-A')).toBe(false);
    expect(apiRequest).toHaveBeenCalledWith(
      '/fleet/boats/legal-registration-availability?value=CP-01-2026-A',
    );
  });

  it('completeRegistration arma el formulario con la foto y los servicios', async () => {
    const photo = new File(['x'], 'foto.png');

    await completeRegistration('b1', {
      portName: 'Marina',
      latitude: 11.2408,
      longitude: -74.199,
      baseRate: '180000',
      photo,
      services: {
        lifeJackets: true,
        coolerWithIce: false,
        soundSystem: false,
        fishingGear: false,
        divingGear: true,
      },
    });

    const [path, options] = apiRequest.mock.calls[0];
    expect(path).toBe('/fleet/boats/b1/registration');
    expect(options.method).toBe('POST');
    const form = options.body;
    expect(form.get('port_name')).toBe('Marina');
    expect(form.get('latitude')).toBe('11.2408');
    expect(form.get('longitude')).toBe('-74.199');
    expect(form.get('base_rate')).toBe('180000');
    expect(form.get('life_jackets')).toBe('true');
    expect(form.get('diving_gear')).toBe('true');
    expect(form.get('sound_system')).toBe('false');
    expect(form.get('photo').name).toBe('foto.png');
  });

  it('editBoat envía PUT multipart con plazo de 15 s; la foto solo si cambió', async () => {
    apiRequest.mockResolvedValue({});
    const services = {
      lifeJackets: true,
      coolerWithIce: false,
      soundSystem: false,
      fishingGear: false,
      divingGear: true,
    };
    const base = {
      name: 'Mi Lancha',
      maxCapacity: '9',
      portName: 'Marina',
      latitude: 10.5,
      longitude: -75.5,
      baseRate: '200000',
      services,
    };

    await editBoat('b1', { ...base, photo: null });
    await editBoat('b1', { ...base, photo: new File(['x'], 'a.png') });

    expect(EDIT_TIMEOUT_MS).toBe(15000);
    const [path, options] = apiRequest.mock.calls[0];
    expect(path).toBe('/fleet/boats/b1');
    expect(options).toMatchObject({ method: 'PUT', timeoutMs: 15000 });
    const sent = Object.fromEntries(options.body.entries());
    expect(sent).toEqual({
      name: 'Mi Lancha',
      max_capacity: '9',
      port_name: 'Marina',
      latitude: '10.5',
      longitude: '-75.5',
      base_rate: '200000',
      life_jackets: 'true',
      cooler_with_ice: 'false',
      sound_system: 'false',
      fishing_gear: 'false',
      diving_gear: 'true',
    });
    expect(apiRequest.mock.calls[1][1].body.has('photo')).toBe(true);
  });

  it('requestMaintenanceReview envía POST a request-review con el plazo', async () => {
    apiRequest.mockResolvedValue(undefined);

    await requestMaintenanceReview('b 1');

    expect(apiRequest).toHaveBeenCalledWith('/fleet/boats/b%201/maintenance/request-review', {
      method: 'POST',
      timeoutMs: 15000,
    });
  });
});
