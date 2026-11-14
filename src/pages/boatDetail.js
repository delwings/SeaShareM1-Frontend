import { startDeleteBoat } from '../components/deleteBoatFlow.js';
import { startMaintenanceFlow, startReviewRequestFlow } from '../components/maintenanceFlow.js';
import { getBoat } from '../services/fleetService.js';
import {
  formatCapacity,
  formatCoordinate,
  formatRate,
  orDash,
  statusInfo,
  TYPE_NAMES,
} from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';

const ERROR_TITLE = 'No se pudo cargar la información de la embarcación';
const EDITABLE_STATUSES = ['AVAILABLE', 'MAINTENANCE'];
const DELETABLE_STATUSES = ['AVAILABLE', 'MAINTENANCE'];
// Enviar a mantenimiento o terminarlo solo se puede si no está Reservado ni En Navegación.
const MAINTENANCE_STATUSES = ['AVAILABLE', 'MAINTENANCE'];
const EXTRA_SERVICES = [
  ['life_jackets', 'Chalecos salvavidas'],
  ['cooler_with_ice', 'Nevera con hielo'],
  ['sound_system', 'Equipo de sonido'],
  ['fishing_gear', 'Equipo de pesca'],
  ['diving_gear', 'Equipo de buceo'],
];

// Imagen por defecto (fondo azul marino con una lancha sobre el agua) cuando la fotografía no está
// o no carga.
const BOAT_ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="300" fill="#0b1b33"/><path d="M0 195c60-22 110 10 200-6s140-14 200 4v107H0z" fill="#16355c"/><path d="M0 238c70-22 120 6 210-8s130-10 190 8v62H0z" fill="#1e3f8f"/><path d="M132 142l82-70 14 70z" fill="#e0f2fe"/><path d="M92 170l24-30h168l26 30c4 6 0 12-8 12H100c-8 0-12-6-8-12z" fill="#38bdf8"/></svg>`;

function icon(markup) {
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
}

function photoFallback() {
  return el(
    'div',
    { class: 'photo-fallback', role: 'img', 'aria-label': 'Imagen por defecto de embarcación' },
    icon(BOAT_ART),
    el('span', { class: 'photo-caption', text: 'Fotografía oficial de la embarcación' }),
  );
}

function photoCard(boat) {
  const frame = el('div', { class: 'detail-photo' });
  if (!boat.photo_url) {
    frame.append(photoFallback());
    return frame;
  }
  const image = el('img', { src: boat.photo_url, alt: boat.name ?? '' });
  image.addEventListener('error', () => frame.replaceChildren(photoFallback()));
  frame.append(image);
  return frame;
}

function infoCard(label, value, extraClass = '') {
  return el(
    'div',
    { class: `detail-card ${extraClass}`.trim() },
    el('span', { class: 'detail-label', text: label }),
    el('div', { class: 'detail-value' }, value),
  );
}

function chipRow(label, chips, tone, emptyText) {
  return el(
    'div',
    { class: 'service-row' },
    el('span', { class: 'service-row-label', text: label }),
    chips.length
      ? el(
          'ul',
          { class: 'service-list' },
          chips.map((name) => el('li', { class: `service-item service-${tone}`, text: name })),
        )
      : el('p', { class: 'detail-muted', text: emptyText }),
  );
}

function servicesSection(services, subtitle) {
  const chosen = EXTRA_SERVICES.filter(([key]) => services?.[key]).map(([, name]) => name);
  return el(
    'section',
    { class: 'services-section' },
    el('h2', { class: 'services-title', text: 'Servicios y Dotación Incluida' }),
    el('p', {
      class: 'detail-muted',
      text: subtitle,
    }),
    chipRow('Obligatorios (base):', ['Capitán', 'Combustible'], 'base'),
    chipRow('Adicionales:', chosen, 'extra', 'Sin servicios adicionales seleccionados'),
  );
}

/** Botón "Editar": deshabilitado en Reservado y En Navegación, sin tooltips (FR-024 de Detalles). */
function editButton(boat, onEdit) {
  return el('button', {
    type: 'button',
    class: 'btn btn-outline btn-edit',
    text: 'Editar',
    disabled: !EDITABLE_STATUSES.includes(boat.status),
    onclick: onEdit,
  });
}

function actionBar(boat, { onEdit, onMaintenance, onDelete }, view) {
  const finishing = boat.status === 'MAINTENANCE';
  // El propietario de una embarcación suspendida por el administrador no la termina: pide revisión.
  const reviewing = view.canRequestReview?.(boat) ?? false;
  let maintenance = finishing ? view.finishLabel : 'Enviar a Mantenimiento';
  if (reviewing) maintenance = 'Solicitar revisión';
  // Solo termina el mantenimiento quien lo inició: el otro rol ve el botón bloqueado.
  const maintenanceBlocked =
    !MAINTENANCE_STATUSES.includes(boat.status) ||
    (finishing && !reviewing && !view.canFinishMaintenance(boat)) ||
    // La revisión se pide una sola vez por mantenimiento: ya enviada, el botón queda bloqueado.
    (reviewing && boat.review_requested === true);
  return el(
    'div',
    { class: 'detail-actions' },
    // El Administrador no edita: sin onEdit no hay botón "Editar".
    onEdit ? editButton(boat, onEdit) : null,
    el('button', {
      type: 'button',
      class: 'btn btn-maintenance',
      text: maintenance,
      disabled: maintenanceBlocked,
      onclick: onMaintenance,
    }),
    el('button', {
      type: 'button',
      class: 'btn btn-danger',
      text: 'Eliminar',
      disabled: !DELETABLE_STATUSES.includes(boat.status),
      onclick: onDelete,
    }),
  );
}

function skeleton() {
  return el(
    'div',
    { class: 'detail-skeleton', role: 'status', 'aria-label': 'Cargando la embarcación' },
    el('div', { class: 'skeleton skeleton-photo' }),
    el(
      'div',
      { class: 'skeleton-cards' },
      [1, 2, 3, 4].map(() => el('div', { class: 'skeleton skeleton-card' })),
    ),
  );
}

const OWNER_VIEW = {
  loadBoat: (boatId) => getBoat(boatId),
  backPath: '/owner',
  errorBackLabel: 'Volver a Mis Embarcaciones',
  servicesSubtitle:
    'Servicios base obligatorios y equipamiento adicional seleccionado para el alquiler',
  finishLabel: 'Terminar mantenimiento',
  canFinishMaintenance: () => true,
  // Si el administrador lo suspendió, el propietario solo puede pedir que lo revise.
  canRequestReview: (boat) => boat.status === 'MAINTENANCE' && boat.maintenance_by === 'ADMIN',
  actions: (boat, { navigate, load, showBoat }) => ({
    onEdit: () => navigate(`/owner/boats/${encodeURIComponent(boat.boat_id)}/edit`),
    onMaintenance: () =>
      OWNER_VIEW.canRequestReview(boat)
        ? startReviewRequestFlow({ boat, onChanged: showBoat, reload: load, navigate })
        : startMaintenanceFlow({
            mode: boat.status === 'MAINTENANCE' ? 'finish' : 'start',
            boat,
            onChanged: showBoat,
            reload: load,
            navigate,
          }),
    onDelete: () => startDeleteBoat({ boat, navigate, reload: load }),
  }),
};

/**
 * Crea la pantalla "Ver Detalles": consulta siempre al servidor, sin datos guardados. La vista del
 * propietario y la del administrador comparten diseño; cambian de dónde se cargan los datos, a
 * dónde vuelve y qué botones traen.
 */
export function createBoatDetailPage(view) {
  return ({ navigate, params }) => buildDetailPage({ navigate, params }, view);
}

/** Pantalla "Ver Detalles" del propietario. */
export const boatDetailPage = createBoatDetailPage(OWNER_VIEW);

function buildDetailPage({ navigate, params }, view) {
  const content = el('div', { class: 'detail-content' });
  const goBack = () => navigate(view.backPath);
  const backButton = el(
    'button',
    { type: 'button', class: 'btn btn-secondary detail-back', onclick: goBack },
    el('span', { 'aria-hidden': 'true', text: '←' }),
    'Volver',
  );
  const page = el('main', { class: 'page' }, backButton, content);
  let attempt = 0;

  function showError({ canRetry }) {
    const buttons = canRetry
      ? [
          el('button', {
            type: 'button',
            class: 'btn btn-secondary',
            text: 'Volver',
            onclick: goBack,
          }),
          el('button', {
            type: 'button',
            class: 'btn btn-primary',
            text: 'Reintentar',
            onclick: load,
          }),
        ]
      : [
          el('button', {
            type: 'button',
            class: 'btn btn-primary',
            text: view.errorBackLabel,
            onclick: goBack,
          }),
        ];
    backButton.hidden = true;
    content.replaceChildren(
      el(
        'section',
        { class: 'detail-error', role: 'alert' },
        el('h1', { class: 'detail-error-title', text: ERROR_TITLE }),
        el('div', { class: 'detail-error-actions' }, buttons),
      ),
    );
  }

  function showBoat(boat) {
    const status = statusInfo(boat.status);
    backButton.hidden = false;
    content.replaceChildren(
      el(
        'header',
        { class: 'detail-header' },
        el(
          'div',
          { class: 'detail-title' },
          el('h1', { class: 'page-title', text: orDash(boat.name) }),
          el(
            'span',
            { class: `chip chip-${status.tone}` },
            el('span', { class: 'chip-dot', 'aria-hidden': 'true' }),
            orDash(status.label),
          ),
        ),
        actionBar(boat, view.actions(boat, { navigate, load, showBoat }), view),
      ),
      el(
        'div',
        { class: 'detail-grid' },
        el(
          'div',
          { class: 'detail-left' },
          photoCard(boat),
          servicesSection(boat.services, view.servicesSubtitle),
        ),
        el(
          'div',
          { class: 'detail-cards' },
          infoCard('Matrícula Legal', orDash(boat.legal_registration)),
          infoCard('Tipo de Embarcación', orDash(TYPE_NAMES[boat.type])),
          infoCard('Capacidad máxima', formatCapacity(boat.max_capacity)),
          infoCard('Tarifa base (COP)', formatRate(boat.base_rate), 'detail-rate'),
          infoCard(
            'Puerto de atraque y ubicación GPS',
            orDash(boat.port?.name),
            'detail-card-wide',
          ),
          infoCard('Latitud', formatCoordinate(boat.port?.latitude)),
          infoCard('Longitud', formatCoordinate(boat.port?.longitude)),
        ),
      ),
    );
  }

  async function load() {
    const mine = ++attempt;
    backButton.hidden = false;
    content.replaceChildren(skeleton());
    try {
      const boat = await view.loadBoat(params.boatId);
      if (mine === attempt) showBoat(boat);
    } catch (error) {
      if (mine !== attempt) return;
      // Sesión vencida: el cliente HTTP ya redirige al inicio de sesión; no se muestra error.
      if (error.status === 401) return;
      // 404 (no existe, es ajena o es borrador) y 400 (identificador mal formado): nada que reintentar.
      showError({ canRetry: ![400, 404].includes(error.status) });
    }
  }

  load();
  return page;
}
