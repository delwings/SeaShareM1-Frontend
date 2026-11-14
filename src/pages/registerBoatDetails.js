import { createField } from '../components/formField.js';
import { openSuspendRegistrationModal } from '../components/exitModals.js';
import { createMapPicker } from '../components/mapPicker.js';
import { registrationLayout } from '../components/registrationLayout.js';
import { completeRegistration, getDraft } from '../services/fleetService.js';
import { getUser } from '../auth/session.js';
import { clearProgress, loadProgress, saveProgress } from '../state/draftProgress.js';
import { clearDraft, getCurrentDraft, setDraft } from '../state/registrationFlow.js';
import { el } from '../ui/dom.js';
import { closeAllModals, openModal, openTechnicalErrorModal } from '../ui/modal.js';
import {
  MESSAGES,
  normalize,
  photoError,
  portNameError,
  rateError,
} from '../validation/registrationRules.js';

const KEYS = ['port', 'coordinates', 'rate', 'photo'];
const SERVER_FIELDS = {
  port_name: 'port',
  latitude: 'coordinates',
  longitude: 'coordinates',
  base_rate: 'rate',
  photo: 'photo',
};
const SERVICES = [
  ['lifeJackets', 'Chalecos salvavidas'],
  ['coolerWithIce', 'Nevera con hielo'],
  ['soundSystem', 'Equipo de sonido'],
  ['fishingGear', 'Equipo de pesca'],
  ['divingGear', 'Equipo de buceo'],
];
const SAVE_ERROR = {
  title: 'No se pudo guardar el registro',
  text: 'Ocurrió un problema técnico al guardar la información de la embarcación. Verifique su conexión a internet e inténtelo nuevamente.',
};

/** Paso 2 de 2: Datos Complementarios. Si no hay borrador en memoria lo pide al backend. */
export function registerBoatDetailsPage({ navigate }) {
  const holder = el('div', { class: 'page-holder' });
  const draft = getCurrentDraft();
  if (draft) {
    holder.append(buildForm(draft, navigate));
  } else {
    loadDraft(holder, navigate);
  }
  return holder;
}

async function loadDraft(holder, navigate) {
  try {
    const draft = await getDraft();
    if (!draft) {
      navigate('/owner');
      return;
    }
    setDraft(draft);
    holder.append(buildForm(draft, navigate));
  } catch {
    navigate('/owner');
  }
}

function buildForm(draft, navigate) {
  const state = {
    touched: new Set(),
    submitting: false,
    point: null,
    photo: null,
    photoError: null,
    previewUrl: null,
    server: {},
  };
  const userId = getUser()?.id;
  const saved = loadProgress(userId, draft.boat_id);
  let finished = false;

  const portInput = el('input', {
    id: 'port-name',
    name: 'port_name',
    type: 'text',
    placeholder: 'Ej. Marina Magdalena',
    autocomplete: 'off',
  });
  const latitudeInput = el('input', {
    id: 'port-latitude',
    name: 'latitude',
    type: 'text',
    readonly: true,
  });
  const longitudeInput = el('input', {
    id: 'port-longitude',
    name: 'longitude',
    type: 'text',
    readonly: true,
  });
  const rateInput = el('input', {
    id: 'base-rate',
    name: 'base_rate',
    type: 'text',
    placeholder: 'Ej. 180000',
    autocomplete: 'off',
  });
  const fileInput = el('input', {
    id: 'boat-photo',
    name: 'photo',
    type: 'file',
    accept: 'image/png,image/jpeg',
    class: 'visually-hidden',
  });

  // Coordenadas: dos campos de solo lectura con un mismo mensaje debajo.
  const coordinatesError = el('p', { class: 'field-error', role: 'alert' });
  const coordinates = el(
    'div',
    { class: 'field field-wide' },
    el(
      'div',
      { class: 'form-grid inner-grid' },
      el(
        'div',
        {},
        el('label', { class: 'field-label', for: 'port-latitude', text: 'Latitud' }),
        latitudeInput,
      ),
      el(
        'div',
        {},
        el('label', { class: 'field-label', for: 'port-longitude', text: 'Longitud' }),
        longitudeInput,
      ),
    ),
    coordinatesError,
  );

  const map = createMapPicker({
    initialPoint: saved?.point ?? null,
    onSelect: ({ latitude, longitude }) => {
      state.point = { latitude, longitude };
      latitudeInput.value = String(latitude);
      longitudeInput.value = String(longitude);
      delete state.server.coordinates;
      refresh('coordinates');
    },
  });

  // Fotografía
  const photoMessage = el('p', { class: 'field-error', role: 'alert' });
  const dropzone = el('div', { class: 'dropzone' });
  const attachButton = el(
    'label',
    { class: 'dropzone-button', for: 'boat-photo' },
    '+ Adjuntar imagen de la embarcación',
  );
  const photoField = el(
    'div',
    { class: 'field field-wide' },
    el('span', { class: 'field-label', text: 'Fotografía oficial' }),
    dropzone,
    fileInput,
    photoMessage,
  );

  function renderDropzone() {
    if (state.photo && state.previewUrl) {
      dropzone.classList.add('has-preview');
      dropzone.replaceChildren(
        el('img', {
          class: 'preview',
          src: state.previewUrl,
          alt: 'Vista previa de la embarcación',
        }),
        el('button', {
          type: 'button',
          class: 'preview-remove',
          'aria-label': 'Quitar imagen',
          text: '×',
          onclick: removePhoto,
        }),
        attachButton,
      );
    } else {
      dropzone.classList.remove('has-preview');
      dropzone.replaceChildren(
        attachButton,
        el('span', { class: 'dropzone-hint', text: 'PNG, JPG hasta 10MB' }),
      );
    }
  }

  function setPreview(file) {
    if (state.previewUrl) globalThis.URL.revokeObjectURL?.(state.previewUrl);
    state.photo = file;
    state.previewUrl = file ? (globalThis.URL.createObjectURL?.(file) ?? '') : null;
  }

  function removePhoto() {
    setPreview(null);
    state.touched.add('photo');
    state.photoError = null;
    renderDropzone();
    refresh('photo');
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const problem = await photoError(file);
    state.touched.add('photo');
    delete state.server.photo;
    if (problem) {
      state.photoError = problem;
    } else {
      state.photoError = null;
      setPreview(file);
      renderDropzone();
    }
    refresh('photo');
  });

  function errorFor(key) {
    if (state.server[key]) return state.server[key];
    switch (key) {
      case 'port':
        return portNameError(portInput.value);
      case 'coordinates':
        return state.point ? null : MESSAGES.coordinatesRequired;
      case 'rate':
        return rateError(rateInput.value);
      default:
        return state.photoError ?? (state.photo ? null : MESSAGES.required);
    }
  }

  function show(key, message) {
    if (key === 'port') fieldsByKey.port.setError(message);
    if (key === 'rate') fieldsByKey.rate.setError(message);
    if (key === 'coordinates') coordinatesError.textContent = message ?? '';
    if (key === 'photo') photoMessage.textContent = message ?? '';
    if (key === 'photo') dropzone.classList.toggle('is-invalid', Boolean(message));
  }

  /** Un error de "obligatorio" o de coordenadas solo se muestra después de intentar o de salir. */
  function refresh(key) {
    const message = errorFor(key);
    const quiet =
      (message === MESSAGES.required || message === MESSAGES.coordinatesRequired) &&
      !state.touched.has(key);
    show(key, quiet ? null : message);
  }

  const fieldsByKey = {
    port: createField({ label: 'Puerto', control: portInput, wide: true }),
    rate: createField({ label: 'Tarifa base (COP)', control: rateInput, wide: true }),
  };
  for (const [key, input] of [
    ['port', portInput],
    ['rate', rateInput],
  ]) {
    input.addEventListener('input', () => {
      delete state.server[key];
      refresh(key);
    });
    input.addEventListener('blur', () => {
      state.touched.add(key);
      refresh(key);
    });
  }

  // Servicios
  const checks = Object.fromEntries(
    SERVICES.map(([key]) => [
      key,
      el('input', { type: 'checkbox', name: key, id: `service-${key}` }),
    ]),
  );
  const servicesColumn = el(
    'div',
    { class: 'services' },
    el('h2', { class: 'section-label', text: 'Servicios base obligatorios (incluidos)' }),
    el('p', {
      class: 'section-note',
      text: 'Estos servicios vienen predeterminados y no se pueden remover.',
    }),
    el(
      'div',
      { class: 'base-services' },
      el('span', { class: 'base-service', text: 'Capitán (Obligatorio)' }),
      el('span', { class: 'base-service', text: 'Combustible (Obligatorio)' }),
    ),
    el('h2', { class: 'section-label', text: 'Seleccionar servicios adicionales' }),
    SERVICES.map(([key, label]) =>
      el(
        'label',
        { class: 'check', for: `service-${key}` },
        checks[key],
        el('span', { text: label }),
      ),
    ),
  );

  // Guardado
  const saveButton = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: 'Guardar Registro',
    onclick: () => submit(),
  });

  function setBusy(busy) {
    state.submitting = busy;
    saveButton.disabled = busy;
  }

  function applyServerErrors(error) {
    let applied = false;
    for (const { field, message } of error.errors ?? []) {
      const key = SERVER_FIELDS[field];
      if (key) {
        state.server[key] = message;
        state.touched.add(key);
        refresh(key);
        applied = true;
      }
    }
    return applied;
  }

  function draftGone() {
    finished = true;
    stopWatching();
    clearProgress(userId, draft.boat_id);
    clearDraft();
    openModal({
      icon: 'warning',
      tone: 'amber',
      title: 'El borrador ya no existe',
      buttons: [
        {
          label: 'Aceptar',
          variant: 'primary',
          onClick: () => {
            closeAllModals();
            navigate('/owner');
          },
        },
      ],
    });
  }

  function succeeded() {
    finished = true;
    stopWatching();
    clearProgress(userId, draft.boat_id);
    clearDraft();
    openModal({
      icon: 'success',
      tone: 'green',
      title: '¡Embarcación registrada!',
      text: 'El nuevo vehículo fluvial ha sido registrado con éxito y se encuentra disponible en tu flota.',
      buttons: [
        {
          label: 'Aceptar',
          variant: 'primary',
          onClick: () => {
            closeAllModals();
            navigate('/owner');
          },
        },
      ],
    });
  }

  async function submit() {
    if (state.submitting) return;
    closeAllModals();
    KEYS.forEach((key) => {
      state.touched.add(key);
      refresh(key);
    });
    if (KEYS.some((key) => errorFor(key))) return;

    setBusy(true);
    try {
      await completeRegistration(draft.boat_id, {
        portName: normalize(portInput.value),
        latitude: state.point.latitude,
        longitude: state.point.longitude,
        baseRate: rateInput.value.trim(),
        photo: state.photo,
        services: Object.fromEntries(SERVICES.map(([key]) => [key, checks[key].checked])),
      });
      succeeded();
    } catch (error) {
      if (error.status === 404) {
        draftGone();
      } else if (!applyServerErrors(error)) {
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

  const left = el(
    'div',
    { class: 'column' },
    el('span', { class: 'field-label', text: 'Puerto de atraque (selección en mapa)' }),
    map.element,
    fieldsByKey.port.element,
    coordinates,
    fieldsByKey.rate.element,
    photoField,
  );
  renderDropzone();

  // Retomar el borrador: los campos vuelven como se dejaron (la foto hay que elegirla de nuevo).
  if (saved) {
    portInput.value = saved.portName;
    rateInput.value = saved.rate;
    if (saved.point) {
      state.point = saved.point;
      latitudeInput.value = String(saved.point.latitude);
      longitudeInput.value = String(saved.point.longitude);
    }
    for (const [key] of SERVICES) checks[key].checked = saved.services[key] === true;
  }

  /** Guarda lo escrito hasta ahora; no hace nada una vez registrada o descartada la embarcación. */
  function persist() {
    if (finished) return;
    saveProgress(userId, draft.boat_id, {
      portName: portInput.value,
      rate: rateInput.value,
      point: state.point,
      services: Object.fromEntries(SERVICES.map(([key]) => [key, checks[key].checked])),
    });
  }
  function stopWatching() {
    globalThis.removeEventListener?.('hashchange', leave);
    globalThis.removeEventListener?.('pagehide', persist);
  }
  function leave() {
    persist();
    stopWatching();
  }
  // Salir sin cancelar (otra pantalla o cerrar la pestaña) también conserva el avance.
  globalThis.addEventListener?.('hashchange', leave);
  globalThis.addEventListener?.('pagehide', persist);

  /** Al seguir con el registro se limpian los mensajes de error y se conservan los datos. */
  function clearErrors() {
    state.touched.clear();
    state.server = {};
    state.photoError = null;
    for (const key of ['port', 'coordinates', 'rate', 'photo']) show(key, null);
  }

  const cancelButton = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Cancelar',
    onclick: () =>
      openSuspendRegistrationModal({
        onContinue: clearErrors,
        onConfirm: () => {
          leave();
          clearDraft();
          navigate('/owner');
        },
      }),
  });

  return registrationLayout({
    step: 2,
    subtitle: 'Paso 2 de 2: Puerto de atraque, tarifa, servicios y fotografía oficial.',
    body: el(
      'form',
      { class: 'two-columns', novalidate: true, onsubmit: (e) => e.preventDefault() },
      left,
      servicesColumn,
    ),
    actions: [cancelButton, saveButton],
  });
}
