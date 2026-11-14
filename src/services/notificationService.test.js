import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../api/client.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationService.js';

afterEach(() => vi.clearAllMocks());

describe('notificationService', () => {
  it('listNotifications devuelve la lista y el contador', async () => {
    apiRequest.mockResolvedValue({ notifications: [{ notification_id: 'n1' }], unread_count: 2 });

    expect(await listNotifications()).toEqual({
      notifications: [{ notification_id: 'n1' }],
      unreadCount: 2,
    });
    expect(apiRequest).toHaveBeenCalledWith('/notifications');
  });

  it('marca una como leída y todas', async () => {
    await markNotificationRead('n 1');
    await markAllNotificationsRead();

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/notifications/n%201/read', {
      method: 'PATCH',
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/notifications/read-all', { method: 'PATCH' });
  });
});
