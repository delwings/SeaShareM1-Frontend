import { el } from '../ui/dom.js';

/**
 * Campo de formulario: etiqueta, control y el mensaje de error debajo.
 * "after" es contenido extra que va entre el control y el mensaje.
 */
export function createField({ label, control, after = null, wide = false }) {
  const error = el('p', { class: 'field-error', role: 'alert' });
  const element = el(
    'div',
    { class: wide ? 'field field-wide' : 'field' },
    el('label', { class: 'field-label', for: control.id, text: label }),
    control,
    after,
    error,
  );
  return {
    element,
    control,
    setError(message) {
      error.textContent = message ?? '';
      control.classList.toggle('is-invalid', Boolean(message));
      control.setAttribute('aria-invalid', String(Boolean(message)));
    },
  };
}
