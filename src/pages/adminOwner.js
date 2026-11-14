import { getOwner } from '../services/adminOwnerService.js';
import { orDash } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { formatPhone, ownerInitials } from '../ui/ownerFormat.js';

export const ERROR_TITLE = 'No se pudo cargar la información del propietario';
export const SUBTITLE = 'Propietario de Flota Fluvial';
const BACK_PATH = '/admin';

function infoCard(label, value, wide = false) {
  return el(
    'div',
    { class: `detail-card${wide ? ' detail-card-wide' : ''}` },
    el('span', { class: 'detail-label', text: label }),
    el('span', { class: 'detail-value', text: value }),
  );
}

function skeleton() {
  return el(
    'div',
    {
      class: 'owner-skeleton',
      role: 'status',
      'aria-label': 'Cargando la información del propietario',
    },
    el('div', { class: 'skeleton skeleton-owner-head' }),
    el(
      'div',
      { class: 'skeleton-cards' },
      [1, 2, 3].map(() => el('div', { class: 'skeleton skeleton-card' })),
    ),
  );
}

/** "Información del Propietario" del Administrador: solo lectura, consulta siempre al servidor. */
export function adminOwnerPage({ navigate, params }) {
  const content = el('div', { class: 'detail-content' });
  const goBack = () => navigate(BACK_PATH);
  const backButton = el(
    'button',
    { type: 'button', class: 'btn btn-secondary detail-back', onclick: goBack },
    el('span', { 'aria-hidden': 'true', text: '←' }),
    'Volver',
  );
  const page = el('main', { class: 'page' }, backButton, content);
  let attempt = 0;

  function showError({ canRetry }) {
    const buttons = [
      el('button', {
        type: 'button',
        class: canRetry ? 'btn btn-secondary' : 'btn btn-primary',
        text: 'Volver',
        onclick: goBack,
      }),
    ];
    if (canRetry) {
      buttons.push(
        el('button', {
          type: 'button',
          class: 'btn btn-primary',
          text: 'Reintentar',
          onclick: load,
        }),
      );
    }
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

  function showOwner(owner) {
    backButton.hidden = false;
    content.replaceChildren(
      el(
        'section',
        { class: 'owner-card' },
        el(
          'header',
          { class: 'owner-header' },
          el('span', {
            class: 'avatar owner-avatar',
            'aria-hidden': 'true',
            text: ownerInitials(owner.full_name),
          }),
          el(
            'div',
            {},
            el('h1', { class: 'page-title', text: orDash(owner.full_name) }),
            el('p', { class: 'page-subtitle', text: SUBTITLE }),
          ),
        ),
        el(
          'div',
          { class: 'detail-cards' },
          infoCard('Correo electrónico', orDash(owner.email)),
          infoCard('Teléfono de contacto', formatPhone(owner.phone)),
          infoCard('Documento de identidad', orDash(owner.document_number), true),
        ),
      ),
    );
  }

  async function load() {
    const mine = ++attempt;
    backButton.hidden = false;
    content.replaceChildren(skeleton());
    try {
      const owner = await getOwner(params.ownerId);
      if (mine === attempt) showOwner(owner);
    } catch (error) {
      if (mine !== attempt || error.status === 401) return;
      showError({ canRetry: ![400, 404].includes(error.status) });
    }
  }

  load();
  return page;
}
