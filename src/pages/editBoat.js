import { createField } from '../components/formField.js';
import { createMapPicker } from '../components/mapPicker.js';
import { editBoat, getBoat } from '../services/fleetService.js';
import { statusInfo, TYPE_NAMES } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';
import { closeAllModals, openModal, openTechnicalErrorModal } from '../ui/modal.js';
import {
  capacityError,
  MESSAGES,
  nameError,
  normalizeName,
  photoError,
  portNameError,
  rateError,
} from '../validation/registrationRules.js';

export const EDITABLE_STATUSES = ['AVAILABLE', 'MAINTENANCE'];
export const TYPE_LIMITS = { MOTORBOAT: 10, YACHT: 20, CATAMARAN: 30, SAILBOAT: 12 };

export const TEXTS = {
  loadError: 'No se pudo cargar la información de la embarcación',
  notEditable: 'Esta embarcación no se puede editar en su estado actual.',
  noPermission: 'No tienes permiso para editar esta embarcación.',
  notFoundOrForeign: 'Esta embarcación no existe o no tienes permiso para editarla.',
  mapError: 'No se pudo cargar el mapa interactivo en este momento.',
  invalidLocation: 'Selección de ubicación inválida. Por favor, marca un punto válido en el mapa.',
  photoHint: 'PNG, JPG hasta 10 MB (Recomendado 400 × 400 px)',
  savedTitle: '¡Cambios guardados!',
  savedText: 'La información de tu embarcación ha sido actualizada exitosamente en el sistema.',
  discardTitle: '¿Descartar cambios?',
  discardText:
    'Tienes modificaciones sin guardar que se perderán. ¿Estás seguro de que deseas volver sin guardar?',
  failTitle: 'No se pudieron guardar los cambios',
  technicalTitle: 'No se pudo guardar los cambios',
  technicalText:
    'Ocurrió un problema técnico al guardar la información de la embarcación. Verifique su conexión a internet e inténtelo nuevamente.',
  goneTitle: 'Esta embarcación ya no existe.',
};

const SERVICES = [
  ['lifeJackets', 'life_jackets', 'Chalecos salvavidas'],
  ['coolerWithIce', 'cooler_with_ice', 'Nevera con hielo'],
  ['soundSystem', 'sound_system', 'Equipo de sonido'],
  ['fishingGear', 'fishing_gear', 'Equipo de pesca'],
  ['divingGear', 'diving_gear', 'Equipo de buceo'],
];
const SERVER_FIELDS = {
  name: 'name',
  max_capacity: 'capacity',
  base_rate: 'rate',
  port_name: 'port',
  latitude: 'coordinates',
  longitude: 'coordinates',
  coordinates: 'coordinates',
  photo: 'photo',
};
// Orden en que se revisan los campos (y a cuál va el foco si hay varios con error).
const KEYS = ['name', 'capacity', 'rate', 'port', 'coordinates', 'photo'];

const LOCK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#94a3b8" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM10 7a2 2 0 1 1 4 0v2h-4V7z"/></svg>';

function svg(markup) {
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
}

/** Un botón de modal queda deshabilitado tras pulsarse, para que salga una sola solicitud. */
function once(action) {
  return (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button
      .closest('.modal-actions')
      ?.querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    action();
  };
}

/** En la edición el mensaje de "obligatorio" es el corto de esta pantalla. */
const localize = (message) => (message === MESSAGES.required ? MESSAGES.editRequired : message);

/** Texto que se selecciona completo al enfocar; un segundo clic ubica el cursor. */
function autoselect(input) {
  let justFocused = false;
  input.addEventListener('focus', () => {
    justFocused = true;
    input.select();
  });
  input.addEventListener('mouseup', (event) => {
    if (justFocused) event.preventDefault();
    justFocused = false;
  });
  input.addEventListener('blur', () => {
    justFocused = false;
  });
}

/** Pantalla "Editar Información de Embarcación" del propietario. */
export function editBoatPage({ navigate, params, setGuard = () => {} }) {
  const detailPath = `/owner/boats/${encodeURIComponent(params.boatId)}`;
  const goDetail = () => navigate(detailPath);
  const content = el('div', { class: 'edit-content' });
  const page = el('main', { class: 'page' }, content);
  let attempt = 0;

  function showScreen(title, buttons, { role = 'alert' } = {}) {
    content.replaceChildren(
      el(
        'section',
        { class: 'detail-error', role },
        el('h1', { class: 'detail-error-title', text: title }),
        el('div', { class: 'detail-error-actions' }, buttons),
      ),
    );
  }

  const backToDetail = () =>
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Volver a Ver Detalles',
      onclick: goDetail,
    });

  function skeleton() {
    return el(
      'div',
      { class: 'detail-skeleton', role: 'status', 'aria-label': 'Cargando la embarcación' },
      el('div', { class: 'skeleton skeleton-photo' }),
      el(
        'div',
        { class: 'skeleton-cards' },
        [1, 2, 3, 4].map(() => el('div', { class: 'skeleton skeleton-card' })),
      ),
    );
  }

  async function load() {
    const mine = ++attempt;
    setGuard(null);
    content.replaceChildren(skeleton());
    try {
      const boat = await getBoat(params.boatId);
      if (mine !== attempt) return;
      if (!EDITABLE_STATUSES.includes(boat.status)) {
        showScreen(TEXTS.notEditable, [backToDetail()]);
        return;
      }
      content.replaceChildren(buildForm(boat, { navigate, goDetail, reload: load, setGuard }));
    } catch (error) {
      if (mine !== attempt) return;
      // Sesión vencida: el cliente HTTP ya redirige al inicio de sesión.
      if (error.status === 401) return;
      // 404 (no existe o es de otro propietario) y 400 (identificador mal formado): sin reintento.
      if ([400, 403, 404].includes(error.status)) {
        showScreen(TEXTS.notFoundOrForeign, [backToDetail()]);
        return;
      }
      showScreen(TEXTS.loadError, [
        backToDetail(),
        el('button', {
          type: 'button',
          class: 'btn btn-secondary',
          text: 'Reintentar',
          onclick: load,
        }),
      ]);
    }
  }

  load();
  return page;
}

function buildForm(boat, { navigate, goDetail, reload, setGuard }) {
  const typeLimit = TYPE_LIMITS[boat.type] ?? null;
  const original = {
    name: normalizeName(boat.name),
    capacity: String(boat.max_capacity),
    rate: String(boat.base_rate ?? '').split('.')[0],
    port: normalizeName(boat.port?.name),
    point: {
      latitude: Number(boat.port?.latitude),
      longitude: Number(boat.port?.longitude),
    },
    services: Object.fromEntries(
      SERVICES.map(([key, api]) => [key, Boolean(boat.services?.[api])]),
    ),
  };
  const state = {
    point: { ...original.point },
    photoKind: boat.photo_url ? 'original' : 'none',
    photo: null,
    previewUrl: null,
    photoRejected: null,
    server: {},
    submitting: false,
    saved: false,
    discarded: false,
  };

  // ---- Campos de texto ----
  const nameInput = el('input', {
    id: 'edit-name',
    name: 'name',
    type: 'text',
    value: original.name,
    autocomplete: 'off',
  });
  const capacityInput = el('input', {
    id: 'edit-capacity',
    name: 'max_capacity',
    type: 'text',
    inputmode: 'numeric',
    value: original.capacity,
    autocomplete: 'off',
  });
  const rateInput = el('input', {
    id: 'edit-rate',
    name: 'base_rate',
    type: 'text',
    inputmode: 'numeric',
    value: original.rate,
    autocomplete: 'off',
  });
  const portInput = el('input', {
    id: 'edit-port',
    name: 'port_name',
    type: 'text',
    value: original.port,
    autocomplete: 'off',
  });
  const latitudeInput = el('input', {
    id: 'edit-latitude',
    name: 'latitude',
    type: 'text',
    readonly: true,
    value: String(original.point.latitude),
  });
  const longitudeInput = el('input', {
    id: 'edit-longitude',
    name: 'longitude',
    type: 'text',
    readonly: true,
    value: String(original.point.longitude),
  });

  const fields = {
    name: createField({ label: 'Nombre de la embarcación', control: nameInput, wide: true }),
    capacity: createField({ label: 'Capacidad máxima (pasajeros)', control: capacityInput }),
    rate: createField({ label: 'Tarifa base (COP)', control: rateInput }),
    port: createField({ label: 'Puerto', control: portInput, wide: true }),
  };

  const coordinatesError = el('p', {
    class: 'field-error',
    role: 'alert',
    id: 'edit-coords-error',
  });
  const coordinates = el(
    'div',
    { class: 'field field-wide' },
    el(
      'div',
      { class: 'form-grid inner-grid' },
      el(
        'div',
        {},
        el('label', { class: 'field-label', for: 'edit-latitude', text: 'Latitud' }),
        latitudeInput,
      ),
      el(
        'div',
        {},
        el('label', { class: 'field-label', for: 'edit-longitude', text: 'Longitud' }),
        longitudeInput,
      ),
    ),
    coordinatesError,
  );

  const map = createMapPicker({
    initialPoint: Number.isFinite(original.point.latitude) ? original.point : null,
    errorMessage: TEXTS.mapError,
    onInvalid: () => {
      state.server.coordinates = TEXTS.invalidLocation;
      update();
    },
    onSelect: ({ latitude, longitude }) => {
      state.point = { latitude, longitude };
      latitudeInput.value = String(latitude);
      longitudeInput.value = String(longitude);
      delete state.server.coordinates;
      update();
    },
  });

  // ---- Fotografía ----
  const fileInput = el('input', {
    id: 'edit-photo',
    name: 'photo',
    type: 'file',
    accept: 'image/png,image/jpeg',
    class: 'visually-hidden',
  });
  const photoMessage = el('p', { class: 'field-error', role: 'alert', id: 'edit-photo-error' });
  const photoFrame = el('div', { class: 'edit-photo' });
  const changeButton = el('label', {
    class: 'edit-photo-change',
    for: 'edit-photo',
    text: 'Cambiar fotografía',
  });

  function currentPhotoSrc() {
    return state.photoKind === 'new' ? state.previewUrl : boat.photo_url;
  }

  function renderPhoto() {
    if (state.photoKind === 'none') {
      photoFrame.classList.add('is-empty');
      photoFrame.replaceChildren(
        el('label', {
          class: 'dropzone-button',
          for: 'edit-photo',
          text: '+ Adjuntar imagen de la embarcación',
        }),
      );
      return;
    }
    photoFrame.classList.remove('is-empty');
    photoFrame.replaceChildren(
      el('img', {
        class: 'edit-photo-img',
        src: currentPhotoSrc() ?? '',
        alt: 'Fotografía de la embarcación',
      }),
      changeButton,
    );
    // La "X" solo aparece sobre una vista previa de una foto nueva seleccionada o sobre la actual.
    photoFrame.append(
      el('button', {
        type: 'button',
        class: 'preview-remove',
        'aria-label': 'Quitar imagen',
        text: '×',
        onclick: removePhoto,
      }),
    );
  }

  function removePhoto() {
    if (state.previewUrl) globalThis.URL.revokeObjectURL?.(state.previewUrl);
    state.photoKind = 'none';
    state.photo = null;
    state.previewUrl = null;
    state.photoRejected = null;
    delete state.server.photo;
    renderPhoto();
    update();
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return; // cancelar el selector no cambia la imagen
    const problem = await photoError(file);
    delete state.server.photo;
    if (problem) {
      // Un archivo rechazado no reemplaza la imagen que ya estaba.
      state.photoRejected = problem;
    } else {
      if (state.previewUrl) globalThis.URL.revokeObjectURL?.(state.previewUrl);
      state.photoRejected = null;
      state.photoKind = 'new';
      state.photo = file;
      state.previewUrl = globalThis.URL.createObjectURL?.(file) ?? '';
      renderPhoto();
    }
    update();
  });

  const photoField = el(
    'div',
    { class: 'field field-wide' },
    el('span', { class: 'field-label', text: 'Fotografía de la embarcación' }),
    photoFrame,
    fileInput,
    el('p', { class: 'dropzone-hint', text: TEXTS.photoHint }),
    photoMessage,
  );

  // ---- Campos bloqueados ----
  function lockedField(label, value) {
    return el(
      'div',
      { class: 'field' },
      el('span', { class: 'field-label', text: label }),
      el(
        'div',
        { class: 'locked-field' },
        el('input', {
          type: 'text',
          value,
          readonly: true,
          'aria-readonly': 'true',
          'aria-label': label,
        }),
        el('span', { class: 'lock-icon' }, svg(LOCK)),
      ),
    );
  }

  // ---- Servicios ----
  const checks = Object.fromEntries(
    SERVICES.map(([key]) => [
      key,
      el('input', {
        type: 'checkbox',
        name: key,
        id: `edit-service-${key}`,
        checked: original.services[key],
      }),
    ]),
  );
  const servicesBlock = el(
    'div',
    { class: 'services' },
    el('h2', { class: 'section-label', text: 'Servicios base obligatorios (incluidos)' }),
    el(
      'div',
      { class: 'base-services edit-base-services' },
      el('span', { class: 'base-service', text: 'Capitán (Fijo)' }),
      el('span', { class: 'base-service', text: 'Combustible (Fijo)' }),
    ),
    el('h2', { class: 'section-label', text: 'Seleccionar servicios adicionales' }),
    el(
      'div',
      { class: 'edit-checks' },
      SERVICES.map(([key, , label]) =>
        el(
          'label',
          { class: 'check', for: `edit-service-${key}` },
          checks[key],
          el('span', { text: label }),
        ),
      ),
    ),
  );

  // ---- Reglas y estado del formulario ----
  const stripZeros = (text) => text.trim().replace(/^0+/, '');

  function errorFor(key) {
    if (state.server[key]) return state.server[key];
    switch (key) {
      case 'name':
        return localize(nameError(nameInput.value));
      case 'capacity':
        return localize(capacityError(capacityInput.value, typeLimit));
      case 'rate':
        return localize(rateError(rateInput.value));
      case 'port':
        return localize(portNameError(portInput.value));
      case 'coordinates':
        return state.point ? null : MESSAGES.coordinatesRequired;
      default:
        return state.photoKind === 'none' ? MESSAGES.editRequired : null;
    }
  }

  function isDirty() {
    const services = SERVICES.some(([key]) => checks[key].checked !== original.services[key]);
    return (
      normalizeName(nameInput.value) !== original.name ||
      stripZeros(capacityInput.value) !== original.capacity ||
      stripZeros(rateInput.value) !== stripZeros(original.rate) ||
      normalizeName(portInput.value) !== original.port ||
      state.point.latitude !== original.point.latitude ||
      state.point.longitude !== original.point.longitude ||
      state.photoKind !== 'original' ||
      services
    );
  }

  const saveButton = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: () => submit(),
  });
  const saveLabel = el('span', { text: 'Guardar cambios' });
  saveButton.append(saveLabel);

  function update() {
    for (const key of KEYS) {
      const message = errorFor(key);
      if (key === 'coordinates') coordinatesError.textContent = message ?? '';
      else if (key === 'photo') {
        photoMessage.textContent = message ?? state.photoRejected ?? '';
        photoFrame.classList.toggle('is-invalid', Boolean(message ?? state.photoRejected));
      } else fields[key].setError(message);
    }
    const hasErrors = KEYS.some((key) => errorFor(key));
    saveButton.disabled = state.submitting || state.saved || !isDirty() || hasErrors;
  }

  for (const [key, input] of [
    ['name', nameInput],
    ['capacity', capacityInput],
    ['rate', rateInput],
    ['port', portInput],
  ]) {
    autoselect(input);
    input.addEventListener('input', () => {
      delete state.server[key];
      update();
    });
    // Enter no envía el formulario.
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') event.preventDefault();
    });
  }
  // Al perder el foco se normalizan los nombres (trim y espacios repetidos).
  for (const input of [nameInput, portInput]) {
    input.addEventListener('blur', () => {
      input.value = normalizeName(input.value);
      update();
    });
  }
  for (const check of Object.values(checks)) check.addEventListener('change', update);

  // ---- Salida con cambios sin guardar ----
  const onBeforeUnload = (event) => {
    if (isDirty() && !state.saved && !state.discarded) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  globalThis.addEventListener('beforeunload', onBeforeUnload);

  function openDiscardModal(onConfirm) {
    openModal({
      icon: 'warning',
      tone: 'amber',
      title: TEXTS.discardTitle,
      text: TEXTS.discardText,
      buttons: [
        { label: 'Seguir editando', variant: 'secondary', onClick: closeAllModals },
        {
          label: 'Sí, descartar',
          variant: 'warning',
          onClick: () => {
            closeAllModals();
            onConfirm();
          },
        },
      ],
    });
  }

  setGuard({
    confirmLeave(path) {
      if (state.discarded || state.saved || !isDirty()) return true;
      openDiscardModal(() => {
        state.discarded = true;
        navigate(path);
      });
      return false;
    },
    dispose() {
      globalThis.removeEventListener('beforeunload', onBeforeUnload);
    },
  });

  function leave() {
    if (state.saved || !isDirty()) {
      goDetail();
      return;
    }
    openDiscardModal(() => {
      state.discarded = true;
      goDetail();
    });
  }

  // ---- Guardado ----
  function setBusy(busy) {
    state.submitting = busy;
    saveButton.classList.toggle('is-loading', busy);
    saveButton.setAttribute('aria-busy', String(busy));
    saveLabel.textContent = busy ? 'Guardando…' : 'Guardar cambios';
    update();
  }

  function focusFirstError() {
    const targets = {
      name: nameInput,
      capacity: capacityInput,
      rate: rateInput,
      port: portInput,
      coordinates: latitudeInput,
      photo: changeButton,
    };
    const key = KEYS.find((candidate) => errorFor(candidate));
    targets[key]?.focus?.();
  }

  function applyServerErrors(error) {
    let applied = false;
    for (const { field, message } of error.errors ?? []) {
      const key = SERVER_FIELDS[field];
      if (key) {
        state.server[key] = message;
        applied = true;
      }
    }
    if (applied) {
      update();
      focusFirstError();
    }
    return applied;
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
        title: TEXTS.goneTitle,
        buttons: [
          {
            label: 'Aceptar',
            variant: 'primary',
            onClick: () => {
              state.discarded = true;
              closeAllModals();
              navigate('/owner');
            },
          },
        ],
      });
      return;
    }
    if (error.status === 403) {
      openModal({
        icon: 'warning',
        tone: 'amber',
        title: TEXTS.noPermission,
        buttons: [
          {
            label: 'Volver a Ver Detalles',
            variant: 'primary',
            onClick: () => {
              state.discarded = true;
              closeAllModals();
              goDetail();
            },
          },
        ],
      });
      return;
    }
    if (error.status === 409 && error.currentStatus) {
      openModal({
        icon: 'warning',
        tone: 'amber',
        title: TEXTS.failTitle,
        text: `La embarcación pasó a estado ${statusInfo(error.currentStatus).label} mientras editabas. No es posible guardar los cambios.`,
        buttons: [
          {
            label: 'Recargar página',
            variant: 'primary',
            onClick: () => {
              state.discarded = true;
              closeAllModals();
              reload();
            },
          },
        ],
      });
      return;
    }
    if (error.status === 400 && applyServerErrors(error)) return;
    // Red, servidor, tiempo agotado o servicio de imágenes: los datos del formulario se conservan.
    openTechnicalErrorModal({
      title: TEXTS.technicalTitle,
      text: TEXTS.technicalText,
      onClose: once(closeAllModals),
      onRetry: once(() => {
        closeAllModals();
        submit();
      }),
    });
  }

  async function submit() {
    if (state.submitting || state.saved) return;
    closeAllModals();
    nameInput.value = normalizeName(nameInput.value);
    portInput.value = normalizeName(portInput.value);
    update();
    if (saveButton.disabled) return;

    setBusy(true);
    try {
      await editBoat(boat.boat_id, {
        name: nameInput.value,
        maxCapacity: stripZeros(capacityInput.value),
        portName: portInput.value,
        latitude: state.point.latitude,
        longitude: state.point.longitude,
        baseRate: stripZeros(rateInput.value),
        services: Object.fromEntries(SERVICES.map(([key]) => [key, checks[key].checked])),
        photo: state.photoKind === 'new' ? state.photo : null,
      });
    } catch (error) {
      setBusy(false);
      showFailure(error);
      return;
    }
    state.saved = true;
    setBusy(false);
    openModal({
      icon: 'success',
      tone: 'green',
      title: TEXTS.savedTitle,
      text: TEXTS.savedText,
      buttons: [
        {
          label: 'Aceptar',
          variant: 'primary',
          onClick: () => {
            closeAllModals();
            goDetail();
          },
        },
      ],
    });
  }

  // ---- Estructura ----
  const backButton = el(
    'button',
    { type: 'button', class: 'btn btn-secondary detail-back', onclick: leave },
    el('span', { 'aria-hidden': 'true', text: '←' }),
    'Volver',
  );
  const discardButton = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Descartar',
    onclick: leave,
  });

  renderPhoto();
  update();

  return el(
    'div',
    { class: 'edit-wrap' },
    backButton,
    el(
      'section',
      { class: 'form-card' },
      el(
        'header',
        { class: 'form-card-header' },
        el(
          'div',
          {},
          el('h1', { class: 'form-title', text: 'Editar Información de Embarcación' }),
          el('p', {
            class: 'form-subtitle',
            text: 'Modifica los campos permitidos incluyendo la ubicación GPS del puerto. Los datos legales se encuentran bloqueados por seguridad.',
          }),
        ),
      ),
      el(
        'form',
        {
          class: 'two-columns edit-columns',
          novalidate: true,
          onsubmit: (e) => e.preventDefault(),
        },
        el(
          'div',
          { class: 'column' },
          photoField,
          lockedField('Matrícula legal (bloqueada)', boat.legal_registration ?? ''),
          lockedField('Tipo de embarcación (bloqueado)', TYPE_NAMES[boat.type] ?? boat.type ?? ''),
        ),
        el(
          'div',
          { class: 'column' },
          fields.name.element,
          el(
            'div',
            { class: 'form-grid inner-grid' },
            fields.capacity.element,
            fields.rate.element,
          ),
          fields.port.element,
          el('span', { class: 'field-label', text: 'Ubicación del puerto (selección en mapa)' }),
          map.element,
          coordinates,
          servicesBlock,
        ),
      ),
      el('footer', { class: 'form-actions' }, discardButton, saveButton),
    ),
  );
}
