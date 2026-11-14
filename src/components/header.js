import { logout } from '../services/authService.js';
import { el } from '../ui/dom.js';
import { createNotificationBell } from './notificationBell.js';
import { LOGO_SVG } from './logo.js';

const ROLE_LABELS = { OWNER: 'Propietario', ADMIN: 'Administrador' };
const MODULE_LABELS = {
  OWNER: 'Módulo de Gestión de Flota',
  ADMIN: 'Módulo de Administración General',
};

function initials(fullName) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** Barra superior: marca a la izquierda; usuario, rol y cierre de sesión a la derecha. */
export function renderHeader(user, navigate) {
  const logo = el('span', { class: 'brand-logo' });
  logo.innerHTML = LOGO_SVG;

  return el(
    'header',
    { class: 'app-header' },
    el(
      'div',
      { class: 'brand' },
      logo,
      el('strong', { class: 'brand-name', text: 'SeaShare' }),
      el('span', {
        class: 'brand-module',
        text: MODULE_LABELS[user.role] ?? MODULE_LABELS.OWNER,
      }),
    ),
    el(
      'div',
      { class: 'user' },
      createNotificationBell({
        heading: user.role === 'ADMIN' ? 'Notificaciones Administrativas' : undefined,
      }),
      el('span', { class: 'avatar', 'aria-hidden': 'true', text: initials(user.fullName) }),
      el(
        'div',
        { class: 'user-info' },
        el('span', { class: 'user-name', text: user.fullName }),
        el('span', { class: 'user-role', text: ROLE_LABELS[user.role] ?? user.role }),
      ),
      el('button', {
        type: 'button',
        class: 'btn-link',
        text: 'Cerrar sesión',
        onclick: () => {
          logout();
          navigate('/login');
        },
      }),
    ),
  );
}
