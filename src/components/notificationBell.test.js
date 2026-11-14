import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/notificationService.js', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';
import {
  createNotificationBell,
  formatNotificationDate,
  parseVessel,
  splitReason,
  timeAgo,
} from './notificationBell.js';

const MESSAGE =
  'Tu embarcación Río Magdalena I (CP-05-1042-A) fue eliminada por un administrador el 3 de noviembre de 2026. Motivo: Fotos falsas';
const data = (overrides = {}) => ({
  notifications: [
    {
      notification_id: 'n1',
      type: 'VESSEL_DELETED',
      message: MESSAGE,
      read: false,
      created_at: '2026-11-04T02:15:00Z',
    },
    {
      notification_id: 'n2',
      type: 'VESSEL_DELETED',
      message: 'Otra',
      read: true,
      created_at: '2026-11-03T10:00:00Z',
    },
  ],
  unreadCount: 1,
  ...overrides,
});

let bell;
const q = (selector) => bell.querySelector(selector);

async function mount(response = data()) {
  listNotifications.mockResolvedValue(response);
  bell = createNotificationBell();
  document.body.append(bell);
  await vi.waitFor(() => expect(listNotifications).toHaveBeenCalled());
  await Promise.resolve();
}

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((node) => node.remove());
  bell?.remove();
  vi.clearAllMocks();
});

describe('Campana de notificaciones', () => {
  it('muestra el contador de no leídas y el panel empieza cerrado', async () => {
    await mount();

    await vi.waitFor(() => expect(q('.bell-badge').hidden).toBe(false));
    expect(q('.bell-badge').textContent).toBe('1');
    expect(q('.bell-button').getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
    expect(q('.bell-panel').hidden).toBe(true);
  });

  it('sin no leídas no hay contador', async () => {
    await mount(data({ unreadCount: 0 }));
    await Promise.resolve();
    expect(q('.bell-badge').hidden).toBe(true);
  });

  it('al abrir muestra el mensaje completo con el motivo y la fecha en hora de Colombia', async () => {
    await mount();

    q('.bell-button').click();

    expect(q('.bell-title').textContent).toBe('Embarcación eliminada');
    expect(q('.bell-message').textContent).toContain('fue eliminada por un administrador');
    expect(q('.bell-message').textContent).not.toContain('Motivo');
    expect(q('.bell-reason-label').textContent).toBe('Motivo');
    expect(q('.bell-reason-text').textContent).toBe('Fotos falsas');
    expect(q('.bell-date').title).toBe(formatNotificationDate('2026-11-04T02:15:00Z'));
    expect(q('.bell-date').title).toContain('3 de noviembre de 2026');
    expect(q('.bell-item').classList.contains('is-unread')).toBe(true);
  });

  it('tocar una no leída la marca como leída y baja el contador', async () => {
    markNotificationRead.mockResolvedValue(undefined);
    await mount();
    q('.bell-button').click();

    q('.bell-item.is-unread').click();

    expect(markNotificationRead).toHaveBeenCalledWith('n1');
    expect(q('.bell-item.is-unread')).toBeNull();
    expect(q('.bell-dot')).toBeNull();
    expect(q('.bell-badge').hidden).toBe(true);
  });

  it('tocar una ya leída no llama al servidor', async () => {
    await mount();
    q('.bell-button').click();

    [...bell.querySelectorAll('.bell-item')][1].click();

    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it('"Marcar todas como leídas" las marca todas', async () => {
    markAllNotificationsRead.mockResolvedValue(undefined);
    await mount();
    q('.bell-button').click();

    q('.bell-mark-all').click();

    expect(markAllNotificationsRead).toHaveBeenCalled();
    expect(q('.bell-badge').hidden).toBe(true);
    expect(q('.bell-mark-all')).toBeNull();
  });

  it('sin notificaciones muestra el mensaje vacío', async () => {
    await mount({ notifications: [], unreadCount: 0 });
    q('.bell-button').click();
    expect(q('.bell-empty').textContent).toBe('No tienes notificaciones.');
  });

  it('si falla la carga con el panel abierto ofrece reintentar', async () => {
    await mount();
    listNotifications.mockRejectedValue({ status: 0 });

    q('.bell-button').click();
    await vi.waitFor(() =>
      expect(q('.bell-empty').textContent).toContain('No se pudieron cargar las notificaciones.'),
    );

    listNotifications.mockResolvedValue(data());
    q('.bell-empty button').click();
    await vi.waitFor(() => expect(q('.bell-message')).not.toBeNull());
  });

  it('se cierra con Esc y al hacer clic fuera, pero no al hacer clic dentro', async () => {
    await mount();
    q('.bell-button').click();

    q('.bell-panel').click();
    expect(q('.bell-panel').hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('.bell-panel').hidden).toBe(true);

    q('.bell-button').click();
    document.body.click();
    expect(q('.bell-panel').hidden).toBe(true);
  });
});

describe('Ayudas de la campana', () => {
  it('splitReason separa el motivo y deja intacto un mensaje sin motivo', () => {
    expect(splitReason('Hola. Motivo: porque sí')).toEqual({ text: 'Hola.', reason: 'porque sí' });
    expect(splitReason('Sin motivo')).toEqual({ text: 'Sin motivo', reason: null });
  });

  it('timeAgo usa tiempos relativos y luego la fecha completa', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(timeAgo('2026-11-05T11:59:50Z', now)).toBe('Ahora mismo');
    expect(timeAgo('2026-11-05T11:55:00Z', now)).toBe('Hace 5 min');
    expect(timeAgo('2026-11-05T09:00:00Z', now)).toBe('Hace 3 h');
    expect(timeAgo('2026-11-04T09:00:00Z', now)).toBe('Ayer');
    expect(timeAgo('2026-11-01T09:00:00Z', now)).toContain('noviembre de 2026');
  });
});

describe('Aviso de mantenimiento del administrador', () => {
  const NOTICE = {
    notification_id: 'm1',
    type: 'MAINTENANCE_NOTICE',
    read: false,
    created_at: '2026-11-04T02:15:00Z',
    message:
      'Tu embarcación Atlántico Star (CP-12-0891-B) fue enviada a mantenimiento por un administrador el 3 de noviembre de 2026. Motivo: Se requiere revisión técnica del sistema de propulsión.',
  };

  it('parseVessel extrae el nombre y la matrícula', () => {
    expect(parseVessel(NOTICE.message)).toEqual({
      name: 'Atlántico Star',
      registration: 'CP-12-0891-B',
    });
    expect(parseVessel('otro')).toEqual({ name: null, registration: null });
  });

  it('muestra el nombre, el resumen y "Revisar completamente", sin el motivo en la lista', async () => {
    await mount({ notifications: [NOTICE], unreadCount: 1 });

    q('.bell-button').click();

    expect(q('.bell-title').textContent).toBe('Atlántico Star');
    expect(q('.bell-message').textContent).toBe(
      'El administrador ha enviado una notificación sobre el estado de la embarcación.',
    );
    expect(q('.bell-review').textContent).toBe('Revisar completamente');
    expect(q('.bell-reason')).toBeNull();
  });

  it('"Revisar completamente" marca como leída y abre el detalle con el motivo', async () => {
    markNotificationRead.mockResolvedValue(undefined);
    await mount({ notifications: [NOTICE], unreadCount: 1 });
    q('.bell-button').click();

    q('.bell-review').click();

    const modal = document.querySelector('.modal');
    expect(modal.querySelector('.modal-title').textContent).toBe('Detalle de Notificación');
    expect(modal.textContent).toContain('Aviso enviado por el Administrador General');
    expect(modal.textContent).toContain('Atlántico Star');
    expect(modal.textContent).toContain('Mantenimiento');
    expect(modal.querySelector('.notice-reason').textContent).toBe(
      '"Se requiere revisión técnica del sistema de propulsión."',
    );
    expect(markNotificationRead).toHaveBeenCalledWith('m1');

    modal.querySelector('.modal-actions button').click();
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('la ventana también se cierra con la X', async () => {
    markNotificationRead.mockResolvedValue(undefined);
    await mount({ notifications: [NOTICE], unreadCount: 1 });
    q('.bell-button').click();
    q('.bell-review').click();

    document.querySelector('.modal-close').click();

    expect(document.querySelector('.modal')).toBeNull();
  });
});

describe('Campana del administrador: solicitud de revisión', () => {
  const REQUEST = {
    notification_id: 'r1',
    vessel_id: 'v-77',
    type: 'REVIEW_REQUEST',
    read: false,
    created_at: '2026-11-12T15:00:00Z',
    message:
      'El propietario solicitó la revisión de la embarcación Atlántico Star (CP-12-0891-B) el 12 de noviembre de 2026.',
  };

  it('usa el título recibido y muestra nombre, resumen y "Ver detalles"', async () => {
    listNotifications.mockResolvedValue({ notifications: [REQUEST], unreadCount: 1 });
    bell = createNotificationBell({ heading: 'Notificaciones Administrativas' });
    document.body.append(bell);
    await vi.waitFor(() => expect(q('.bell-badge').hidden).toBe(false));

    q('.bell-button').click();

    expect(q('.bell-heading').textContent).toBe('Notificaciones Administrativas');
    expect(q('.bell-title').textContent).toBe('Atlántico Star');
    expect(q('.bell-message').textContent).toBe(
      'El propietario ha solicitado la revisión de la embarcación.',
    );
    expect(q('.bell-review').textContent).toBe('Ver detalles');
  });

  it('"Ver detalles" marca como leída, cierra el panel y abre el detalle de la embarcación', async () => {
    markNotificationRead.mockResolvedValue(undefined);
    listNotifications.mockResolvedValue({ notifications: [REQUEST], unreadCount: 1 });
    bell = createNotificationBell({ heading: 'Notificaciones Administrativas' });
    document.body.append(bell);
    await vi.waitFor(() => expect(q('.bell-badge').hidden).toBe(false));
    q('.bell-button').click();

    q('.bell-review').click();

    expect(markNotificationRead).toHaveBeenCalledWith('r1');
    expect(globalThis.location.hash).toBe('#/admin/boats/v-77');
    expect(q('.bell-panel').hidden).toBe(true);
  });
});
