import { deleteDraft, getDraft, listBoats } from '../services/fleetService.js';
import { clearDraft, setDraft } from '../state/registrationFlow.js';
import { statusInfo, TYPE_NAMES } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { closeAllModals, openModal, openTechnicalErrorModal } from '../ui/modal.js';

const COLUMNS = ['Nombre de la embarcación', 'Matrícula', 'Tipo', 'Estado operativo', 'Acciones'];

function statusChip(status) {
  const info = statusInfo(status);
  return el(
    'span',
    { class: `chip chip-${info.tone}` },
    el('span', { class: 'chip-dot', 'aria-hidden': 'true' }),
    info.label,
  );
}

function boatRow(boat, navigate) {
  return el(
    'tr',
    {},
    el(
      'td',
      { class: 'cell-name' },
      boat.name,
      boat.is_new ? el('span', { class: 'badge-new', text: 'NUEVA' }) : null,
    ),
    el('td', { class: 'cell-muted', text: boat.legal_registration }),
    el('td', { class: 'cell-muted', text: TYPE_NAMES[boat.type] ?? boat.type }),
    el('td', {}, statusChip(boat.status)),
    el(
      'td',
      { class: 'cell-actions' },
      el('button', {
        type: 'button',
        class: 'btn btn-outline',
        text: 'Ver Detalles',
        onclick: () => navigate(`/owner/boats/${boat.boat_id}`),
      }),
    ),
  );
}

function boatTable(boats, navigate) {
  return el(
    'table',
    { class: 'boats-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        COLUMNS.map((name) => el('th', { text: name })),
      ),
    ),
    el(
      'tbody',
      {},
      boats.map((boat) => boatRow(boat, navigate)),
    ),
  );
}

/** Lista "Mis Embarcaciones Registradas" y entrada al registro (con detección de borrador). */
export function ownerHomePage({ navigate }) {
  const card = el('section', { class: 'table-card' });
  const registerButton = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary btn-large',
      onclick: () => startRegistration(),
    },
    el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' }),
    'Registrar Nueva Embarcación',
  );

  const page = el(
    'main',
    { class: 'page' },
    el(
      'div',
      { class: 'page-header' },
      el(
        'div',
        {},
        el('h1', { class: 'page-title', text: 'Mis Embarcaciones Registradas' }),
        el('p', {
          class: 'page-subtitle',
          text: 'Gestiona el estado operativo y consulta los detalles de tus vehículos fluviales',
        }),
      ),
      registerButton,
    ),
    card,
  );

  async function loadBoats() {
    card.replaceChildren(el('p', { class: 'table-message', text: 'Cargando embarcaciones…' }));
    try {
      const boats = await listBoats();
      card.replaceChildren(
        boats.length > 0
          ? boatTable(boats, navigate)
          : el('p', { class: 'table-message', text: 'Aún no tienes embarcaciones registradas' }),
      );
    } catch (error) {
      card.replaceChildren(
        el(
          'div',
          { class: 'table-message' },
          el('p', { text: error.detail ?? 'No se pudieron cargar tus embarcaciones.' }),
          el('button', {
            type: 'button',
            class: 'btn btn-secondary',
            text: 'Reintentar',
            onclick: loadBoats,
          }),
        ),
      );
    }
  }

  function loadError(onClose) {
    openTechnicalErrorModal({
      title: 'No se pudo cargar el registro pendiente',
      text: 'Ocurrió un problema técnico al cargar el borrador. Verifique su conexión a internet e inténtelo nuevamente.',
      onClose,
      onRetry: () => startRegistration(),
    });
  }

  async function startRegistration() {
    closeAllModals();
    try {
      const draft = await getDraft();
      if (draft) {
        showDraftModal(draft);
      } else {
        clearDraft();
        navigate('/owner/boats/new');
      }
    } catch {
      loadError(closeAllModals);
    }
  }

  function showDraftModal(draft) {
    openModal({
      icon: 'info',
      title: 'Borrador detectado',
      stacked: true,
      text: 'Tienes un registro incompleto guardado bajo el nombre:',
      content: el(
        'div',
        {},
        el('p', { class: 'draft-name', text: `"${draft.name}"` }),
        el('p', { class: 'modal-question', text: '¿Cómo deseas continuar?' }),
      ),
      onClose: closeAllModals,
      buttons: [
        {
          label: 'Empezar un registro nuevo',
          variant: 'secondary',
          onClick: () => confirmDiscard(draft),
        },
        {
          label: 'Continuar registro pendiente',
          variant: 'primary',
          onClick: () => continueDraft(draft),
        },
      ],
    });
  }

  async function continueDraft(draft) {
    closeAllModals();
    try {
      const fresh = await getDraft();
      if (!fresh) {
        clearDraft();
        navigate('/owner/boats/new');
        return;
      }
      setDraft(fresh);
      navigate('/owner/boats/new/details');
    } catch {
      openTechnicalErrorModal({
        title: 'No se pudo cargar el registro pendiente',
        text: 'Ocurrió un problema técnico al cargar el borrador. Verifique su conexión a internet e inténtelo nuevamente.',
        onClose: () => showDraftModal(draft),
        onRetry: () => continueDraft(draft),
      });
    }
  }

  function confirmDiscard(draft) {
    openModal({
      icon: 'warning',
      tone: 'amber',
      title: '¿Iniciar nuevo registro?',
      content: el(
        'p',
        { class: 'modal-text' },
        'Si inicias un formulario nuevo, el borrador actual ',
        el('strong', { class: 'highlight', text: 'se eliminará de forma permanente' }),
        ' y no podrás recuperar la información diligenciada.',
      ),
      buttons: [
        { label: 'Regresar', variant: 'secondary', onClick: () => showDraftModal(draft) },
        { label: 'Sí, eliminar y empezar', variant: 'warning', onClick: () => discardDraft(draft) },
      ],
    });
  }

  async function discardDraft(draft) {
    closeAllModals();
    try {
      await deleteDraft();
      clearDraft();
      navigate('/owner/boats/new');
    } catch {
      openTechnicalErrorModal({
        title: 'No se pudo eliminar el borrador',
        text: 'Ocurrió un problema técnico al eliminar el borrador. Verifique su conexión a internet e inténtelo nuevamente.',
        onClose: () => showDraftModal(draft),
        onRetry: () => discardDraft(draft),
      });
    }
  }

  loadBoats();
  return page;
}
