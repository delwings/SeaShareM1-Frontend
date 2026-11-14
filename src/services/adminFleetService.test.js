import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../api/client.js';
import {
  deleteAdminBoat,
  finishAdminMaintenance,
  getAdminBoat,
  listFleet,
  listFleetOwners,
  startAdminMaintenance,
} from './adminFleetService.js';

afterEach(() => vi.clearAllMocks());

describe('adminFleetService', () => {
  it('listFleet sin filtros no agrega parámetros y devuelve el arreglo', async () => {
    apiRequest.mockResolvedValue({ boats: [{ boat_id: 'b1' }] });

    expect(await listFleet()).toEqual([{ boat_id: 'b1' }]);
    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats');
  });

  it('listFleet envía solo los filtros con valor, con el texto recortado', async () => {
    apiRequest.mockResolvedValue({ boats: [] });

    await listFleet({ ownerId: 'o1', status: '', query: '  Gómez ' });

    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats?owner_id=o1&q=G%C3%B3mez');
  });

  it('listFleetOwners devuelve los propietarios', async () => {
    apiRequest.mockResolvedValue({ owners: [{ owner_id: 'o1' }] });

    expect(await listFleetOwners()).toEqual([{ owner_id: 'o1' }]);
    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/owners');
  });

  it('getAdminBoat consulta el detalle por identificador', async () => {
    apiRequest.mockResolvedValue({ boat_id: 'b 1' });

    await getAdminBoat('b 1');

    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats/b%201');
  });

  it('deleteAdminBoat envía DELETE con el motivo y el plazo de 15 segundos', async () => {
    apiRequest.mockResolvedValue(undefined);

    await deleteAdminBoat('b 1', 'Fotos falsas');

    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats/b%201', {
      method: 'DELETE',
      body: { reason: 'Fotos falsas' },
      timeoutMs: 15000,
    });
  });

  it('startAdminMaintenance envía POST con el motivo y el plazo', async () => {
    apiRequest.mockResolvedValue({});

    await startAdminMaintenance('b 1', 'Motor');

    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats/b%201/maintenance/start', {
      method: 'POST',
      body: { reason: 'Motor' },
      timeoutMs: 15000,
    });
  });

  it('finishAdminMaintenance envía POST sin cuerpo', async () => {
    apiRequest.mockResolvedValue({});

    await finishAdminMaintenance('b1');

    expect(apiRequest).toHaveBeenCalledWith('/admin/fleet/boats/b1/maintenance/finish', {
      method: 'POST',
      timeoutMs: 15000,
    });
  });
});
