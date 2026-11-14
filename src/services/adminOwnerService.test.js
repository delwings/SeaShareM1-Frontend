import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../api/client.js';
import { getOwner, searchOwners } from './adminOwnerService.js';

afterEach(() => vi.clearAllMocks());

describe('adminOwnerService', () => {
  it('searchOwners envía el texto recortado y devuelve owners y hasMore', async () => {
    apiRequest.mockResolvedValue({ owners: [{ owner_id: 'o1' }], has_more: true });

    const result = await searchOwners('  Gómez ');

    expect(apiRequest).toHaveBeenCalledWith('/admin/owners?q=G%C3%B3mez');
    expect(result).toEqual({ owners: [{ owner_id: 'o1' }], hasMore: true });
  });

  it('getOwner consulta por identificador', async () => {
    apiRequest.mockResolvedValue({ owner_id: 'o 1' });

    await getOwner('o 1');

    expect(apiRequest).toHaveBeenCalledWith('/admin/owners/o%201');
  });
});
