import { el } from './dom.js';

const ICONS = { success: '✓', warning: '!', info: '☰', error: '!', delete: '✕' };

/** Cierra todos los modales abiertos. */
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.remove());
}

/**
 * Abre un modal. Según el spec no se cierra al hacer clic fuera ni con Esc: solo con sus botones
 * (y con la "X" cuando se pasa onClose).
 * buttons: [{ label, variant: 'primary' | 'secondary' | 'warning', onClick }]
 */
export function openModal({
  icon = 'info',
  tone = 'blue',
  title,
  text,
  content,
  buttons,
  onClose,
  stacked = false,
}) {
  closeAllModals();
  const buttonNodes = buttons.map((button) =>
    el('button', {
      type: 'button',
      class: `btn btn-${button.variant ?? 'primary'}`,
      text: button.label,
      onclick: button.onClick,
    }),
  );
  const closeButton = onClose
    ? el('button', {
        type: 'button',
        class: 'modal-close',
        'aria-label': 'Cerrar',
        text: '×',
        onclick: onClose,
      })
    : null;
  const dialog = el(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    closeButton,
    el('div', { class: `modal-icon tone-${tone}`, 'aria-hidden': 'true', text: ICONS[icon] }),
    el('h2', { class: 'modal-title', text: title }),
    text ? el('p', { class: 'modal-text', text }) : null,
    content,
    el(
      'div',
      { class: `modal-actions actions-${buttons.length}${stacked ? ' actions-stacked' : ''}` },
      buttonNodes,
    ),
  );
  const overlay = el('div', { class: 'modal-overlay' }, dialog);
  document.body.append(overlay);
  buttonNodes.at(-1)?.focus();
  return { element: overlay, close: () => overlay.remove() };
}

/** Modal de error técnico con "Cerrar" y "Reintentar" (el texto cambia según la acción). */
export function openTechnicalErrorModal({ title, text, onClose, onRetry }) {
  return openModal({
    icon: 'warning',
    tone: 'amber',
    title,
    text,
    buttons: [
      { label: 'Cerrar', variant: 'secondary', onClick: onClose },
      { label: 'Reintentar', variant: 'primary', onClick: onRetry },
    ],
  });
}
