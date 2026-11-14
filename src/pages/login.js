import { login } from '../services/authService.js';
import { homePathFor } from '../auth/roles.js';
import { LOGO_SVG } from '../components/logo.js';
import { el } from '../ui/dom.js';

function field(labelText, name, type, id) {
  const input = el('input', { id, name, type, required: true });
  const label = el('label', { class: 'field-label', for: id, text: labelText });
  return { wrapper: el('div', { class: 'field' }, label, input), input };
}

/** Pantalla de inicio de sesión: puerta de entrada del sistema, centrada, con la marca arriba. */
export function loginPage({ navigate }) {
  const logo = el('span', { class: 'login-logo' });
  logo.innerHTML = LOGO_SVG;

  const documentField = field('Número de documento', 'document_number', 'text', 'login-document');
  documentField.input.inputMode = 'numeric';
  documentField.input.autocomplete = 'username';
  documentField.input.placeholder = 'Solo números';
  const passwordField = field('Contraseña', 'password', 'password', 'login-password');
  passwordField.input.autocomplete = 'current-password';
  passwordField.input.placeholder = 'Tu contraseña';

  const error = el('p', { class: 'form-error', role: 'alert' });
  const submit = el('button', {
    type: 'submit',
    class: 'btn btn-primary btn-large login-submit',
    text: 'Entrar',
  });

  const form = el('form', { class: 'login-form', novalidate: true });
  form.append(documentField.wrapper, passwordField.wrapper, error, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const documentNumber = documentField.input.value.trim();
    if (!/^\d{1,18}$/.test(documentNumber)) {
      error.textContent = 'El número de documento debe tener solo dígitos.';
      return;
    }
    submit.disabled = true;
    try {
      const session = await login(documentNumber, passwordField.input.value);
      navigate(homePathFor(session.user.role));
    } catch (failure) {
      error.textContent = failure.detail ?? 'No se pudo iniciar sesión.';
    } finally {
      submit.disabled = false;
    }
  });

  return el(
    'main',
    { class: 'login' },
    el(
      'section',
      { class: 'login-card' },
      el(
        'div',
        { class: 'login-brand' },
        logo,
        el('strong', { class: 'login-name', text: 'SeaShare' }),
        el('span', { class: 'login-module', text: 'Módulo de Gestión de Flota' }),
      ),
      el('h1', { class: 'login-title', text: 'Iniciar sesión' }),
      el('p', { class: 'login-lead', text: 'Ingresa con tu número de documento y tu contraseña.' }),
      form,
    ),
  );
}
