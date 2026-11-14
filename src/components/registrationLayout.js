import { el } from '../ui/dom.js';

function stepIndicator({ number, label, state }) {
  const marker = state === 'done' ? '✓' : String(number);
  return el(
    'div',
    { class: `step step-${state}` },
    el('span', { class: 'step-marker', 'aria-hidden': 'true', text: marker }),
    el('span', { class: 'step-label', text: label }),
  );
}

/** Tarjeta común de los dos pasos: título, indicador de progreso, contenido y botones. */
export function registrationLayout({ step, subtitle, body, actions }) {
  const first = stepIndicator({
    number: 1,
    label: 'Datos Básicos',
    state: step === 1 ? 'active' : 'done',
  });
  const second = stepIndicator({
    number: 2,
    label: 'Datos Complementarios',
    state: step === 2 ? 'active' : 'pending',
  });
  return el(
    'main',
    { class: 'page' },
    el(
      'section',
      { class: 'form-card' },
      el(
        'header',
        { class: 'form-card-header' },
        el(
          'div',
          {},
          el('h1', { class: 'form-title', text: 'Registrar Nueva Embarcación' }),
          el('p', { class: 'form-subtitle', text: subtitle }),
        ),
        el(
          'div',
          { class: 'steps', 'aria-label': 'Progreso del registro' },
          first,
          el('span', { class: `step-line${step === 2 ? ' is-done' : ''}` }),
          second,
        ),
      ),
      body,
      el('footer', { class: 'form-actions' }, actions),
    ),
  );
}
