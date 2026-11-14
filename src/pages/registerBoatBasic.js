import { createField } from '../components/formField.js';
import { registrationLayout } from '../components/registrationLayout.js';
import {
  createDraft,
  isLegalRegistrationAvailable,
  listBoatTypes,
} from '../services/fleetService.js';
import { clearDraft, setDraft } from '../state/registrationFlow.js';
import { openCancelRegistrationModal } from '../components/exitModals.js';
import { el } from '../ui/dom.js';
import { closeAllModals, openTechnicalErrorModal } from '../ui/modal.js';
import {
  MESSAGES,
  capacityError,
  legalRegistrationFormatError,
  nameError,
  normalize,
} from '../validation/registrationRules.js';

const KEYS = ['name', 'legal', 'type', 'capacity'];
const SERVER_FIELDS = {
  name: 'name',
  legal_registration: 'legal',
  type: 'type',
  max_capacity: 'capacity',
};
const TYPES_ERROR = 'No se pudieron cargar los tipos de embarcación. Inténtelo nuevamente.';
const SAVE_ERROR = {
  title: 'No se pudo guardar el registro',
  text: 'Ocurrió un problema técnico al guardar la información de la embarcación. Verifique su conexión a internet e inténtelo nuevamente.',
};

/** Paso 1 de 2: Datos Básicos (nombre, matrícula, tipo y capacidad). */
export function registerBoatBasicPage({ navigate }) {
  clearDraft();
  const state = {
    touched: new Set(),
    types: [],
    typesFailed: false,
    submitting: false,
    availability: { value: null, taken: false },
    server: {},
  };

  const nameInput = el('input', {
    id: 'boat-name',
    name: 'name',
    type: 'text',
    placeholder: 'Ej. Río Magdalena II',
    autocomplete: 'off',
  });
  const legalInput = el('input', {
    id: 'boat-legal-registration',
    name: 'legal_registration',
    type: 'text',
    placeholder: 'Ej. CP-05-XXXX-A',
    autocomplete: 'off',
  });
  const typeSelect = el(
    'select',
    { id: 'boat-type', name: 'type' },
    el(
      'option',
      { value: '', disabled: true, selected: true },
      'Seleccionar tipo (Lancha, Yate, etc.)',
    ),
  );
  const capacityInput = el('input', {
    id: 'boat-capacity',
    name: 'max_capacity',
    type: 'text',
    placeholder: 'Ej. 10',
    autocomplete: 'off',
  });
  const typesNotice = el('p', { class: 'field-notice', role: 'alert' });

  const fields = {
    name: createField({ label: 'Nombre de la embarcación', control: nameInput, wide: true }),
    legal: createField({ label: 'Matrícula legal', control: legalInput, wide: true }),
    type: createField({ label: 'Tipo de embarcación', control: typeSelect, after: typesNotice }),
    capacity: createField({ label: 'Capacidad máxima (pasajeros)', control: capacityInput }),
  };

  const selectedMax = () =>
    state.types.find((type) => type.code === typeSelect.value)?.max_capacity ?? null;

  function errorFor(key) {
    if (state.server[key]) return state.server[key];
    switch (key) {
      case 'name':
        return nameError(nameInput.value);
      case 'legal': {
        const value = normalize(legalInput.value);
        const format = legalRegistrationFormatError(value);
        if (format) return format;
        return state.availability.value === value && state.availability.taken
          ? MESSAGES.legalTaken
          : null;
      }
      case 'type':
        return typeSelect.value ? null : MESSAGES.required;
      default:
        return capacityError(capacityInput.value, selectedMax());
    }
  }

  /** Muestra el error del campo. "Obligatorio" solo aparece después de pasar por el campo. */
  function refresh(key) {
    const message = errorFor(key);
    const typeNeededByCapacity = key === 'type' && capacityInput.value.trim() !== '';
    const hidden =
      message === MESSAGES.required && !state.touched.has(key) && !typeNeededByCapacity;
    fields[key].setError(hidden ? null : message);
  }

  function touch(key) {
    state.touched.add(key);
    refresh(key);
  }

  // --- Verificación de la matrícula en tiempo real ---
  let timer = null;
  let checkId = 0;

  async function verifyLegal(value, onRetry) {
    const mine = ++checkId;
    try {
      const available = await isLegalRegistrationAvailable(value);
      if (mine === checkId) {
        state.availability = { value, taken: !available };
        refresh('legal');
      }
      return true;
    } catch {
      if (mine === checkId) {
        state.availability = { value: null, taken: false };
        openTechnicalErrorModal({ ...SAVE_ERROR, onClose: closeAllModals, onRetry });
      }
      return false;
    }
  }

  function scheduleVerification() {
    clearTimeout(timer);
    const value = normalize(legalInput.value);
    if (!value || legalRegistrationFormatError(value)) return;
    timer = setTimeout(() => {
      closeAllModals();
      verifyLegal(value, () => retryVerification(value));
    }, 350);
  }

  function retryVerification(value) {
    closeAllModals();
    verifyLegal(value, () => retryVerification(value));
  }

  // --- Tipos de embarcación ---
  async function loadTypes() {
    try {
      const types = await listBoatTypes();
      const selected = typeSelect.value;
      state.types = types;
      state.typesFailed = false;
      typesNotice.textContent = '';
      typeSelect.replaceChildren(
        typeSelect.firstElementChild,
        ...types.map((type) => el('option', { value: type.code }, type.name)),
      );
      typeSelect.value = selected;
    } catch {
      state.typesFailed = true;
      typesNotice.textContent = TYPES_ERROR;
    }
  }

  // --- Eventos de los campos ---
  function watch(key, input, extra = () => {}) {
    input.addEventListener('input', () => {
      delete state.server[key];
      refresh(key);
      extra();
    });
    input.addEventListener('blur', () => touch(key));
  }
  watch('name', nameInput);
  watch('legal', legalInput, () => scheduleVerification());
  watch('capacity', capacityInput, () => refresh('type'));
  typeSelect.addEventListener('change', () => {
    delete state.server.type;
    touch('type');
    refresh('capacity');
  });
  typeSelect.addEventListener('mousedown', () => {
    if (state.typesFailed) loadTypes();
  });
  typeSelect.addEventListener('focus', () => {
    if (state.typesFailed) loadTypes();
  });

  // --- Guardado ---
  const submitButton = el(
    'button',
    { type: 'button', class: 'btn btn-primary', onclick: () => submit() },
    'Siguiente',
    el('span', { class: 'arrow', 'aria-hidden': 'true', text: '›' }),
  );

  function setBusy(busy) {
    state.submitting = busy;
    submitButton.disabled = busy;
  }

  function applyServerErrors(error) {
    let applied = false;
    for (const { field, message } of error.errors ?? []) {
      const key = SERVER_FIELDS[field];
      if (key) {
        state.server[key] = message;
        refresh(key);
        applied = true;
      }
    }
    return applied;
  }

  async function submit() {
    if (state.submitting) return;
    clearTimeout(timer); // una verificación pendiente no debe cerrar el modal ni pisar el guardado
    closeAllModals();
    KEYS.forEach(touch);
    if (KEYS.some((key) => errorFor(key))) return;

    setBusy(true);
    try {
      const value = normalize(legalInput.value);
      if (state.availability.value !== value && !(await verifyLegal(value, () => submit()))) {
        return;
      }
      if (errorFor('legal')) {
        refresh('legal');
        return;
      }
      const draft = await createDraft({
        name: normalize(nameInput.value),
        legalRegistration: value,
        type: typeSelect.value,
        maxCapacity: Number(capacityInput.value.trim()),
      });
      setDraft(draft);
      navigate('/owner/boats/new/details');
    } catch (error) {
      if (!applyServerErrors(error)) {
        openTechnicalErrorModal({
          ...SAVE_ERROR,
          onClose: closeAllModals,
          onRetry: () => submit(),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const body = el(
    'form',
    { class: 'form-grid', novalidate: true, onsubmit: (event) => event.preventDefault() },
    fields.name.element,
    fields.legal.element,
    fields.type.element,
    fields.capacity.element,
  );
  /** Al seguir con el registro se limpian los mensajes de error y se conservan los datos. */
  function clearErrors() {
    state.touched.clear();
    state.server = {};
    KEYS.forEach((key) => fields[key].setError(null));
  }

  const cancelButton = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Cancelar',
    onclick: () =>
      openCancelRegistrationModal({
        onContinue: clearErrors,
        onConfirm: () => {
          clearTimeout(timer);
          clearDraft();
          navigate('/owner');
        },
      }),
  });

  loadTypes();
  return registrationLayout({
    step: 1,
    subtitle: 'Paso 1 de 2: Información general y datos legales del vehículo fluvial.',
    body,
    actions: [cancelButton, submitButton],
  });
}
