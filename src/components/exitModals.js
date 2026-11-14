import { closeAllModals, openModal } from '../ui/modal.js';

export const CANCEL_TITLE = '¿Cancelar registro?';
export const CANCEL_TEXT =
  'Los datos ingresados hasta el momento se perderán y no se guardará ninguna embarcación.';
export const SUSPEND_TITLE = '¿Suspender registro?';
export const SUSPEND_TEXT =
  'Los datos de identificación básica (Paso 1) se almacenarán de forma temporal en estado borrador, permitiendo reanudar el proceso de registro en futuras sesiones.';

/**
 * Confirmación al cancelar desde el paso 1. Solo se cierra con sus botones.
 * onContinue: el propietario sigue en el formulario; onConfirm: abandona el registro.
 */
export function openCancelRegistrationModal({ onContinue, onConfirm }) {
  return openModal({
    icon: 'warning',
    tone: 'amber',
    title: CANCEL_TITLE,
    text: CANCEL_TEXT,
    buttons: [
      {
        label: 'Continuar registro',
        variant: 'secondary',
        onClick: () => {
          closeAllModals();
          onContinue();
        },
      },
      {
        label: 'Sí, cancelar',
        variant: 'warning',
        onClick: () => {
          closeAllModals();
          onConfirm();
        },
      },
    ],
  });
}

/** Confirmación al cancelar desde el paso 2: el borrador del paso 1 se conserva. */
export function openSuspendRegistrationModal({ onContinue, onConfirm }) {
  return openModal({
    icon: 'warning',
    tone: 'amber',
    title: SUSPEND_TITLE,
    text: SUSPEND_TEXT,
    buttons: [
      {
        label: 'Continuar registro',
        variant: 'secondary',
        onClick: () => {
          closeAllModals();
          onContinue();
        },
      },
      {
        label: 'Salir',
        variant: 'primary',
        onClick: () => {
          closeAllModals();
          onConfirm();
        },
      },
    ],
  });
}
