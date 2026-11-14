import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';
import { statusInfo } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { closeAllModals, openModal } from '../ui/modal.js';

export const REFRESH_MS = 60000;
export const TEXTS = {
  heading: 'Notificaciones',
  review: 'Revisar completamente',
  viewDetails: 'Ver detalles',
  reviewRequestSummary: 'El propietario ha solicitado la revisión de la embarcación.',
  maintenanceSummary:
    'El administrador ha enviado una notificación sobre el estado de la embarcación.',
  empty: 'No tienes notificaciones.',
  error: 'No se pudieron cargar las notificaciones.',
  retry: 'Reintentar',
  markAll: 'Marcar todas como leídas',
};

const BELL_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

const TYPE_INFO = {
  VESSEL_DELETED: { title: 'Embarcación eliminada', tone: 'red', icon: 'trash' },
  MAINTENANCE_NOTICE: { title: 'Mantenimiento', tone: 'amber', icon: 'wrench' },
  REVIEW_REQUEST: { title: 'Solicitud de revisión', tone: 'blue', icon: 'check' },
  VESSEL_AVAILABLE: { title: 'Embarcación disponible', tone: 'green', icon: 'check' },
};
const FALLBACK_INFO = { title: 'Notificación', tone: 'blue', icon: 'bell' };

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  trash: svg(
    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  ),
  wrench: svg(
    '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6 12.6 21 3 11.4l8.4-8.4 1.3 1.3a4 4 0 0 0 2 2z"/>',
  ),
  star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  bell: svg(
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  ),
};

/** Nombre y matrícula citados en el mensaje: «Tu embarcación X (CP-…) …». */
export function parseVessel(message) {
  const match = /embarcación (.+?) \(([^)]+)\)/.exec(message ?? '');
  return match ? { name: match[1], registration: match[2] } : { name: null, registration: null };
}

/** Ventana «Detalle de Notificación» del aviso de mantenimiento del administrador. */
export function openMaintenanceDetail(item) {
  const { name } = parseVessel(item.message);
  const { reason } = splitReason(item.message);
  const status = statusInfo('MAINTENANCE');
  openModal({
    icon: 'warning',
    tone: 'amber',
    title: 'Detalle de Notificación',
    text: 'Aviso enviado por el Administrador General',
    content: el(
      'div',
      { class: 'notice-detail' },
      el(
        'div',
        { class: 'notice-vessel' },
        el(
          'div',
          { class: 'notice-vessel-name' },
          el('span', { class: 'detail-label', text: 'Embarcación afectada' }),
          el('strong', { text: name ?? 'Tu embarcación' }),
        ),
        el(
          'span',
          { class: `chip chip-${status.tone}` },
          el('span', { class: 'chip-dot', 'aria-hidden': 'true' }),
          status.label,
        ),
      ),
      el('span', { class: 'notice-label', text: 'Motivo registrado por administración' }),
      el('blockquote', { class: 'notice-reason', text: `"${reason ?? item.message}"` }),
    ),
    buttons: [{ label: 'Entendido y cerrar', variant: 'primary', onClick: closeAllModals }],
    onClose: closeAllModals,
  });
}

/** Separa "… Motivo: texto" en el mensaje y el motivo, para mostrarlo destacado. */
export function splitReason(message) {
  const match = /^([\s\S]*?)\s*Motivo:\s*([\s\S]+)$/.exec(message ?? '');
  return match ? { text: match[1], reason: match[2] } : { text: message ?? '', reason: null };
}

/** "Hace 5 min", "Hace 2 h", "Ayer"; pasados dos días, la fecha completa en hora de Colombia. */
export function timeAgo(isoDate, now = Date.now()) {
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  if (hours < 48) return 'Ayer';
  return formatNotificationDate(isoDate);
}

/** "3 de noviembre de 2026, 9:15 p. m." en hora de Colombia. */
export function formatNotificationDate(isoDate) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

/**
 * Campana del propietario: contador de no leídas y panel con las notificaciones completas (con el
 * motivo). Se actualiza al abrir la pantalla, al abrir el panel y cada minuto. Al tocar una no
 * leída se marca como leída. Se cierra con Esc o al hacer clic fuera.
 */
export function createNotificationBell({ heading = TEXTS.heading } = {}) {
  let items = [];
  let unread = 0;
  let failed = false;

  const badge = el('span', { class: 'bell-badge' });
  badge.hidden = true;
  const button = el(
    'button',
    {
      type: 'button',
      class: 'bell-button',
      'aria-label': 'Notificaciones',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
    },
    badge,
  );
  button.insertAdjacentHTML('afterbegin', BELL_SVG);
  const panel = el('div', { class: 'bell-panel', role: 'region', 'aria-label': heading });
  panel.hidden = true;
  const root = el('div', { class: 'bell' }, button, panel);

  const isOpen = () => !panel.hidden;

  function renderBadge() {
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    button.setAttribute(
      'aria-label',
      unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones',
    );
  }

  function itemNode(item) {
    const info = TYPE_INFO[item.type] ?? FALLBACK_INFO;
    const review = item.type === 'MAINTENANCE_NOTICE';
    const request = item.type === 'REVIEW_REQUEST';
    const card = review || request;
    const { text, reason } = splitReason(item.message);
    const icon = el('span', { class: `bell-icon tone-${info.tone}`, 'aria-hidden': 'true' });
    icon.innerHTML = ICONS[info.icon];
    const title = card ? (parseVessel(item.message).name ?? info.title) : info.title;
    const body = el(
      'span',
      { class: 'bell-body' },
      el(
        'span',
        { class: 'bell-title-row' },
        el('strong', { class: 'bell-title', text: title }),
        item.read ? null : el('span', { class: 'bell-dot', 'aria-label': 'Sin leer' }),
      ),
      el('span', {
        class: 'bell-message',
        text: review ? TEXTS.maintenanceSummary : request ? TEXTS.reviewRequestSummary : text,
      }),
      !card && reason
        ? el(
            'span',
            { class: 'bell-reason' },
            el('span', { class: 'bell-reason-label', text: 'Motivo' }),
            el('span', { class: 'bell-reason-text', text: reason }),
          )
        : null,
      review
        ? el('button', {
            type: 'button',
            class: 'bell-review',
            text: TEXTS.review,
            onclick: (event) => {
              event.stopPropagation();
              read(item);
              openMaintenanceDetail(item);
            },
          })
        : null,
      request
        ? el('button', {
            type: 'button',
            class: 'bell-review',
            text: TEXTS.viewDetails,
            onclick: (event) => {
              event.stopPropagation();
              read(item);
              close();
              globalThis.location.hash = `#/admin/boats/${encodeURIComponent(item.vessel_id)}`;
            },
          })
        : null,
      el('span', {
        class: 'bell-date',
        title: formatNotificationDate(item.created_at),
        text: timeAgo(item.created_at),
      }),
    );
    const classes = `bell-item${item.read ? '' : ' is-unread'}`;
    return el(
      'li',
      {},
      card
        ? el('div', { class: classes }, icon, body)
        : el('button', { type: 'button', class: classes, onclick: () => read(item) }, icon, body),
    );
  }

  function emptyNode(message, retry) {
    const art = el('span', { class: 'bell-empty-art', 'aria-hidden': 'true' });
    art.innerHTML = ICONS.bell.replace('width="20" height="20"', 'width="30" height="30"');
    return el(
      'div',
      { class: 'bell-empty' },
      art,
      el('p', { text: message }),
      retry
        ? el('button', { type: 'button', class: 'btn-link', text: TEXTS.retry, onclick: refresh })
        : null,
    );
  }

  function renderPanel() {
    const header = el(
      'div',
      { class: 'bell-header' },
      el(
        'div',
        { class: 'bell-header-top' },
        el('strong', { class: 'bell-heading', text: heading }),
        unread > 0
          ? el('span', { class: 'bell-pill', text: `${unread} nueva${unread > 1 ? 's' : ''}` })
          : null,
      ),
      unread > 0
        ? el('button', {
            type: 'button',
            class: 'bell-mark-all',
            text: TEXTS.markAll,
            onclick: markAll,
          })
        : null,
    );
    let body;
    if (failed) body = emptyNode(TEXTS.error, true);
    else if (items.length === 0) body = emptyNode(TEXTS.empty, false);
    else body = el('ul', { class: 'bell-list' }, items.map(itemNode));
    panel.replaceChildren(header, body);
  }

  async function refresh() {
    try {
      const data = await listNotifications();
      items = data.notifications;
      unread = data.unreadCount;
      failed = false;
    } catch (error) {
      // 401: el cliente HTTP ya redirige al inicio de sesión. Otro error: solo se avisa si el
      // panel está abierto; la actualización silenciosa de fondo no molesta.
      if (error?.status === 401) return;
      failed = isOpen();
    }
    renderBadge();
    if (isOpen()) renderPanel();
  }

  async function read(item) {
    if (item.read) return;
    item.read = true;
    unread = Math.max(0, unread - 1);
    renderBadge();
    renderPanel();
    try {
      await markNotificationRead(item.notification_id);
    } catch {
      refresh();
    }
  }

  async function markAll() {
    items.forEach((item) => (item.read = true));
    unread = 0;
    renderBadge();
    renderPanel();
    try {
      await markAllNotificationsRead();
    } catch {
      refresh();
    }
  }

  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function open() {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    renderPanel();
    refresh();
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      close();
      button.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !event.composedPath().includes(root)) close();
  });

  refresh();
  const timer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(timer);
      return;
    }
    refresh();
  }, REFRESH_MS);

  return root;
}
