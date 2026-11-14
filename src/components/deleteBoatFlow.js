import { deleteBoat } from '../services/fleetService.js';
import { statusInfo } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { createReasonField } from '../ui/reasonField.js';
import { closeAllModals, openModal, openTechnicalErrorModal } from '../ui/modal.js';

export const CONFIRM_TITLE = '¿Eliminar embarcación?';
export const CONFIRM_TEXT =
  'Esta acción eliminará el registro de forma permanente y liberará su matrícula asociada en el sistema.';
export const CONFIRM_WARNING = 'Esta acción no se puede deshacer.';
export const REASON_LABEL = 'Motivo de la eliminación';
export const REASON_PLACEHOLDER = 'Explica al propietario por qué se elimina su embarcación';
export const REASON_REQUIRED = 'Escribe el motivo de la eliminación.';
export const SUCCESS_TITLE = '¡Embarcación eliminada!';
export const SUCCESS_TEXT = 'La embarcación ha sido eliminada del sistema.';
export const NOT_ALLOWED_TITLE = 'No es posible eliminar la embarcación';
export const GONE_TITLE = 'Esta embarcación ya no existe';
export const TECHNICAL_TITLE = 'No se pudo eliminar la embarcación';
export const TECHNICAL_TEXT =
  'Ocurrió un problema técnico al eliminar la embarcación. Verifique su conexión a internet e inténtelo nuevamente.';

/**
 * Un botón de modal que, al pulsarse, queda deshabilitado (sin spinner) hasta que el modal se
 * reemplaza por otro: así una sola solicitud sale aunque se pulse dos veces o se use Enter.
 */
function once(action, siblingsOf) {
  return (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    siblingsOf(button).forEach((sibling) => (sibling.disabled = true));
    action();
  };
}

const allButtons = (button) => [...button.closest('.modal-actions').querySelectorAll('button')];

/**
 * Flujo "Eliminar embarcación" (propietario y administrador, mismos modales): confirmación,
 * eliminación y modal de resultado.
 * Ningún modal se cierra con Esc ni haciendo clic fuera. Sesión vencida (401): el cliente HTTP
 * redirige al inicio de sesión, así que aquí solo se cierran los modales.
 *   boat: { boat_id }; navigate: cambia de ruta; reload: vuelve a consultar el detalle;
 *   remove(boatId, reason): llamada que elimina (por defecto la del propietario); listPath: a
 *   dónde lleva "Aceptar" (por defecto "Mis Embarcaciones"; el administrador usa su tabla de
 *   flota); askReason: pide un motivo obligatorio (administrador), que viaja a remove.
 */
export function startDeleteBoat({
  boat,
  navigate,
  reload,
  remove = deleteBoat,
  listPath = '/owner',
  askReason = false,
}) {
  let reason = '';
  const goToList = () => {
    closeAllModals();
    navigate(listPath);
  };

  async function run() {
    try {
      await (askReason ? remove(boat.boat_id, reason) : remove(boat.boat_id));
    } catch (error) {
      showFailure(error);
      return;
    }
    openModal({
      icon: 'success',
      tone: 'green',
      title: SUCCESS_TITLE,
      text: SUCCESS_TEXT,
      buttons: [{ label: 'Aceptar', variant: 'primary', onClick: goToList }],
    });
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
    if (error.status === 409 && error.currentStatus) {
      const label = statusInfo(error.currentStatus).label;
      openModal({
        icon: 'warning',
        tone: 'amber',
        title: NOT_ALLOWED_TITLE,
        text: `La embarcación pasó a estado ${label} mientras tanto. No es posible eliminarla.`,
        buttons: [
          {
            label: 'Recargar página',
            variant: 'primary',
            onClick: () => {
              closeAllModals();
              reload();
            },
          },
        ],
      });
      return;
    }
    // "Reintentar" repite la eliminación; queda deshabilitado mientras se repite.
    openTechnicalErrorModal({
      title: TECHNICAL_TITLE,
      text: TECHNICAL_TEXT,
      onClose: once(closeAllModals, allButtons),
      onRetry: once(run, allButtons),
    });
  }

  const reasonField = askReason
    ? createReasonField({
        label: REASON_LABEL,
        placeholder: REASON_PLACEHOLDER,
        requiredMessage: REASON_REQUIRED,
      })
    : null;
  const confirm = once(run, allButtons);

  openModal({
    icon: 'delete',
    tone: 'red',
    title: CONFIRM_TITLE,
    text: CONFIRM_TEXT,
    content: el(
      'div',
      { class: 'modal-extra' },
      reasonField?.node,
      el('p', { class: 'modal-warning', text: CONFIRM_WARNING }),
    ),
    buttons: [
      { label: 'Conservar', variant: 'secondary', onClick: once(closeAllModals, allButtons) },
      {
        label: 'Sí, eliminar',
        variant: 'delete',
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
