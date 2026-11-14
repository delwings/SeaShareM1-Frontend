import { el } from './dom.js';

export const REASON_MAX = 300;

/**
 * Campo de texto "Motivo ..." para los modales del administrador: obligatorio, hasta 300
 * caracteres, con contador. Devuelve el nodo y sus ayudas (value ya recortado, showError, focus).
 */
export function createReasonField({ label, placeholder, requiredMessage }) {
  const input = el('textarea', {
    class: 'reason-input',
    rows: '3',
    maxlength: String(REASON_MAX),
    placeholder,
    'aria-label': label,
  });
  const counter = el('span', { class: 'reason-counter', text: `0/${REASON_MAX}` });
  const error = el('p', { class: 'field-error', role: 'alert' });
  input.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/${REASON_MAX}`;
    input.classList.remove('is-invalid');
    error.textContent = '';
  });
  return {
    node: el(
      'div',
      { class: 'reason-field' },
      el('label', { class: 'field-label', text: label }, input),
      el('div', { class: 'reason-footer' }, error, counter),
    ),
    requiredMessage,
    value: () => input.value.trim(),
    showError: (message = requiredMessage) => {
      error.textContent = message;
      input.classList.add('is-invalid');
      input.focus();
    },
    focus: () => input.focus(),
  };
}
