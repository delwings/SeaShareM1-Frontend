import { apiRequest } from '../api/client.js';

/** Las notificaciones recientes del propietario y cuántas siguen sin leer. */
export async function listNotifications() {
  const data = await apiRequest('/notifications');
  return { notifications: data.notifications, unreadCount: data.unread_count };
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiRequest('/notifications/read-all', { method: 'PATCH' });
}
