import {
  finishMaintenance,
  requestMaintenanceReview,
  startMaintenance,
} from '../services/fleetService.js';
import { finishAdminMaintenance, startAdminMaintenance } from '../services/adminFleetService.js';
import { statusInfo } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { createReasonField } from '../ui/reasonField.js';
import { closeAllModals, openModal, openTechnicalErrorModal } from '../ui/modal.js';

export const MODES = {
  start: {
    call: startMaintenance,
    confirmTitle: '¿Enviar a Mantenimiento?',
    confirmText: 'La embarcación no recibirá reservas temporalmente.',
    confirmLabel: 'Sí, enviar',
    notAllowedTitle: 'No es posible enviar la embarcación a mantenimiento',
    notAllowedText: (label) =>
      `La embarcación pasó a estado ${label} mientras tanto. No es posible enviarla a mantenimiento.`,
    technicalTitle: 'No se pudo enviar a mantenimiento',
    technicalText:
      'Ocurrió un problema técnico al enviar la embarcación a mantenimiento. Verifique su conexión a internet e inténtelo nuevamente.',
  },
  finish: {
    call: finishMaintenance,
    confirmTitle: '¿Terminar Mantenimiento?',
    confirmText: 'La embarcación podrá recibir reservas nuevamente.',
    confirmLabel: 'Sí, terminar',
    notAllowedTitle: 'No es posible terminar el mantenimiento',
    notAllowedText: (label) =>
      `La embarcación pasó a estado ${label} mientras tanto. No es posible terminar el mantenimiento.`,
    technicalTitle: 'No se pudo terminar el mantenimiento',
    technicalText:
      'Ocurrió un problema técnico al terminar el mantenimiento. Verifique su conexión a internet e inténtelo nuevamente.',
  },
};

/** Variante del administrador: otras llamadas, el motivo al enviar y otro texto de confirmación. */
export const ADMIN_MODES = {
  start: {
    ...MODES.start,
    call: startAdminMaintenance,
    confirmText:
      'La embarcación no recibirá reservas temporalmente. Se enviará una notificación al propietario.',
  },
  finish: { ...MODES.finish, call: finishAdminMaintenance },
};
export const REASON_LABEL = 'Motivo del mantenimiento';
export const REASON_PLACEHOLDER = 'Describe la razón del mantenimiento (ej. revisión de motor...)';
export const REASON_REQUIRED = 'Escribe el motivo del mantenimiento.';
export const OWNER_STARTED_TITLE = 'Mantenimiento iniciado por el propietario';
export const OWNER_STARTED_TEXT =
  'El mantenimiento lo inició el propietario. Solo él puede terminarlo.';

export const GONE_TITLE = 'Esta embarcación ya no existe';
export const ADMIN_SUSPENDED_TITLE = 'Embarcación suspendida por el administrador';
export const ADMIN_SUSPENDED_TEXT =
  'Esta embarcación fue suspendida por el administrador. Solo él puede habilitarla de nuevo.';

/** Un botón de modal que, al pulsarse, deja deshabilitados a todos hasta que el modal cambia. */
function once(action) {
  return (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button
      .closest('.modal-actions')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    action();
  };
}

/**
 * Flujo "Enviar a Mantenimiento" / "Terminar mantenimiento" (propietario y administrador): confirmación, cambio
 * y, si sale bien, la pantalla se actualiza con la embarcación que devuelve el servidor (sin modal
 * de éxito). Ningún modal se cierra con Esc ni haciendo clic fuera. Sesión vencida (401): el
 * cliente HTTP redirige al inicio de sesión, aquí solo se cierran los modales.
 *   mode: 'start' | 'finish'; boat: { boat_id }; onChanged(boat): recibe la embarcación nueva;
 *   reload: vuelve a consultar el detalle; navigate: cambia de ruta; admin: flujo del
 *   administrador (motivo obligatorio al enviar, vuelve a la tabla de flota).
 */
export function startMaintenanceFlow({ mode, boat, onChanged, reload, navigate, admin = false }) {
  const texts = (admin ? ADMIN_MODES : MODES)[mode];
  const askReason = admin && mode === 'start';
  let reason = '';
  const goToList = () => {
    closeAllModals();
    navigate(admin ? '/admin' : '/owner');
  };
  const reloadDetail = () => {
    closeAllModals();
    reload();
  };

  async function run() {
    let updated;
    try {
      updated = await (askReason ? texts.call(boat.boat_id, reason) : texts.call(boat.boat_id));
    } catch (error) {
      showFailure(error);
      return;
    }
    closeAllModals();
    onChanged(updated);
  }

  function showFailure(error) {
    if (error.status === 401) {
      closeAllModals();
      return;
    }
    if (error.status === 404) {
      openModal({
        icon: 'info',
        tone: 'blue',
        title: GONE_TITLE,
        buttons: [{ label: 'Aceptar', variant: 'primary', onClick: goToList }],
      });
      return;
    }
    if (error.status === 409) {
      const lock =
        mode === 'finish' && error.maintenanceBy === (admin ? 'OWNER' : 'ADMIN')
          ? admin
            ? { title: OWNER_STARTED_TITLE, text: OWNER_STARTED_TEXT }
            : { title: ADMIN_SUSPENDED_TITLE, text: ADMIN_SUSPENDED_TEXT }
          : null;
      openModal({
        icon: 'warning',
        tone: 'amber',
        title: lock ? lock.title : texts.notAllowedTitle,
        text: lock ? lock.text : texts.notAllowedText(statusInfo(error.currentStatus).label),
        buttons: [
          {
            label: lock ? 'Aceptar' : 'Recargar página',
            variant: 'primary',
            onClick: reloadDetail,
          },
        ],
      });
      return;
    }
    openTechnicalErrorModal({
      title: texts.technicalTitle,
      text: texts.technicalText,
      onClose: once(closeAllModals),
      onRetry: once(run),
    });
  }

  const reasonField = askReason
    ? createReasonField({
        label: REASON_LABEL,
        placeholder: REASON_PLACEHOLDER,
        requiredMessage: REASON_REQUIRED,
      })
    : null;
  const confirm = once(run);

  openModal({
    icon: 'warning',
    tone: 'amber',
    title: texts.confirmTitle,
    text: texts.confirmText,
    content: reasonField ? el('div', { class: 'modal-extra' }, reasonField.node) : null,
    buttons: [
      { label: 'Cancelar', variant: 'secondary', onClick: once(closeAllModals) },
      {
        label: texts.confirmLabel,
        variant: 'warning',
        onClick: (event) => {
          if (reasonField) {
            reason = reasonField.value();
            if (!reason) {
              reasonField.showError();
              return;
            }
          }
          confirm(event);
        },
      },
    ],
  });
  reasonField?.focus();
}

export const REVIEW_TITLE = '¿Enviar a revisión?';
export const REVIEW_TEXT = 'Se enviará una notificación al administrador.';
export const REVIEW_SENT_TITLE = 'Solicitud enviada';
export const REVIEW_SENT_TEXT = 'El administrador revisará tu embarcación y te avisará.';

/**
 * "Solicitar revisión" del propietario sobre una embarcación que el administrador envió a
 * mantenimiento: confirma, avisa al administrador y deja la pantalla igual (sigue en
 * Mantenimiento). Nunca cierra un modal con Esc ni haciendo clic fuera.
 */
export function startReviewRequestFlow({ boat, onChanged, reload, navigate }) {
  const goToList = () => {
    closeAllModals();
    navigate('/owner');
  };
  const reloadDetail = () => {
    closeAllModals();
    reload();
  };

  async function run() {
    try {
      await requestMaintenanceReview(boat.boat_id);
    } catch (error) {
      showFailure(error);
      return;
    }
    // Se pide una sola vez: la pantalla queda con el botón bloqueado sin esperar otra consulta.
    onChanged?.({ ...boat, review_requested: true });
    openModal({
      icon: 'info',
      tone: 'blue',
      title: REVIEW_SENT_TITLE,
      text: REVIEW_SENT_TEXT,
      buttons: [{ label: 'Aceptar', variant: 'primary', onClick: closeAllModals }],
    });
  }

  function showFailure(error) {
    if (error.status === 401) {
      closeAllModals();
    } else if (error.status === 404) {
      openModal({
        icon: 'info',
        tone: 'blue',
        title: GONE_TITLE,
        buttons: [{ label: 'Aceptar', variant: 'primary', onClick: goToList }],
      });
    } else if (error.status === 409) {
      openModal({
        icon: 'warning',
        tone: 'amber',
        title: 'No es posible solicitar la revisión',
        text: 'El estado de la embarcación cambió mientras tanto.',
        buttons: [{ label: 'Recargar página', variant: 'primary', onClick: reloadDetail }],
      });
    } else {
      openTechnicalErrorModal({
        title: 'No se pudo enviar la solicitud',
        text: 'Ocurrió un problema técnico al enviar la solicitud. Verifique su conexión a internet e inténtelo nuevamente.',
        onClose: once(closeAllModals),
        onRetry: once(run),
      });
    }
  }

  openModal({
    icon: 'warning',
    tone: 'amber',
    title: REVIEW_TITLE,
    text: REVIEW_TEXT,
    buttons: [
      { label: 'Cancelar', variant: 'secondary', onClick: once(closeAllModals) },
      { label: 'Sí, enviar', variant: 'warning', onClick: once(run) },
    ],
  });
}
