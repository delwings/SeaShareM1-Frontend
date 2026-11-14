import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({
  completeRegistration: vi.fn(),
  getDraft: vi.fn(),
}));
let reportPoint;
vi.mock('../components/mapPicker.js', async () => {
  const { el } = await import('../ui/dom.js');
  return {
    createMapPicker: ({ onSelect }) => {
      reportPoint = onSelect;
      return { element: el('div', { class: 'map-picker' }) };
    },
  };
});

import { completeRegistration, getDraft } from '../services/fleetService.js';
import { clearSession, saveSession } from '../auth/session.js';
import { clearDraft, getCurrentDraft, setDraft } from '../state/registrationFlow.js';
import { closeAllModals } from '../ui/modal.js';
import { registerBoatDetailsPage } from './registerBoatDetails.js';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let page;
let navigate;
const q = (selector) => page.querySelector(selector);
const errorOf = (id) => q(`#${id}`).closest('.field').querySelector('.field-error').textContent;
const coordinatesError = () =>
  q('.inner-grid').closest('.field').querySelector(':scope > .field-error').textContent;
const clickSave = () => q('.form-actions .btn-primary').click();

function mount() {
  navigate = vi.fn();
  page = registerBoatDetailsPage({ navigate });
  document.body.append(page);
}

function type(id, value) {
  const input = q(`#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function attach(bytes, name = 'foto.png') {
  const input = q('#boat-photo');
  const file = new File([new Uint8Array(bytes)], name);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() =>
    expect(q('.dropzone').classList.contains('is-invalid') || q('.preview')).toBeTruthy(),
  );
  return file;
}

function fillValid() {
  type('port-name', 'Marina Magdalena');
  reportPoint({ latitude: 11.2408, longitude: -74.199 });
  type('base-rate', '180000');
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
  saveSession({ accessToken: 't', expiresInSeconds: 3600, user: { id: 'u1', role: 'OWNER' } });
  globalThis.localStorage.clear();
  setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });
});

afterEach(() => {
  // Las pantallas que quedaron abiertas guardan su avance al salir: se deja que lo hagan antes de limpiar.
  globalThis.dispatchEvent(new Event('hashchange'));
  page?.remove();
  closeAllModals();
  clearDraft();
  clearSession();
  globalThis.localStorage.clear();
  vi.clearAllMocks();
});

describe('Paso 2: Datos Complementarios', () => {
  it('muestra los textos del spec y los servicios sin marcar', () => {
    mount();

    expect(q('.form-subtitle').textContent).toBe(
      'Paso 2 de 2: Puerto de atraque, tarifa, servicios y fotografía oficial.',
    );
    expect(q('.step-done .step-marker').textContent).toBe('✓');
    expect(q('#port-name').placeholder).toBe('Ej. Marina Magdalena');
    expect(q('#base-rate').placeholder).toBe('Ej. 180000');
    expect(q('#port-latitude').readOnly).toBe(true);
    expect(q('#port-longitude').readOnly).toBe(true);
    expect(q('#port-latitude').placeholder).toBe('');
    expect(q('.dropzone-hint').textContent).toBe('PNG, JPG hasta 10MB');
    expect([...page.querySelectorAll('.base-service')].map((n) => n.textContent)).toEqual([
      'Capitán (Obligatorio)',
      'Combustible (Obligatorio)',
    ]);
    const boxes = [...page.querySelectorAll('input[type=checkbox]')];
    expect(boxes).toHaveLength(5);
    expect(boxes.some((box) => box.checked)).toBe(false);
    expect(q('.form-actions .btn-primary').textContent).toBe('Guardar Registro');
    expect(q('.form-actions button:first-child').textContent).toBe('Cancelar');
  });

  it('el mapa completa Latitud y Longitud y no se pueden editar a mano', () => {
    mount();

    reportPoint({ latitude: 11.2408, longitude: -74.199 });

    expect(q('#port-latitude').value).toBe('11.2408');
    expect(q('#port-longitude').value).toBe('-74.199');
  });

  it('"Guardar Registro" con todo vacío marca cada campo y no guarda', () => {
    mount();

    clickSave();

    expect(errorOf('port-name')).toBe('Este campo es obligatorio para continuar con el registro');
    expect(coordinatesError()).toBe('Las coordenadas son obligatorias');
    expect(errorOf('base-rate')).toBe('Este campo es obligatorio para continuar con el registro');
    expect(q('.dropzone').closest('.field').querySelector('.field-error').textContent).toBe(
      'Este campo es obligatorio para continuar con el registro',
    );
    expect(completeRegistration).not.toHaveBeenCalled();
  });

  it('valida nombre del puerto y tarifa en tiempo real', () => {
    mount();

    type('port-name', '12');
    type('base-rate', '12a');

    expect(errorOf('port-name')).toContain('El nombre del puerto debe tener entre 3 y 50');
    expect(errorOf('base-rate')).toBe('Solo se aceptan valores numéricos');
    type('base-rate', '0');
    expect(errorOf('base-rate')).toBe('La tarifa debe ser mayor que 0');
    type('base-rate', '10000000000');
    expect(errorOf('base-rate')).toBe('La tarifa excede el valor permitido');
  });

  it('acepta una foto real, la reemplaza y la quita con la X', async () => {
    mount();

    await attach(PNG);
    expect(q('.preview')).not.toBeNull();
    await attach(PNG, 'otra.png');
    expect(page.querySelectorAll('.preview')).toHaveLength(1);

    q('.preview-remove').click();

    expect(q('.preview')).toBeNull();
    expect(q('.dropzone').closest('.field').querySelector('.field-error').textContent).toBe(
      'Este campo es obligatorio para continuar con el registro',
    );
  });

  it('rechaza un archivo que no es imagen', async () => {
    mount();

    await attach([0x25, 0x50, 0x44, 0x46], 'falsa.png');

    expect(q('.preview')).toBeNull();
    expect(q('.dropzone').closest('.field').querySelector('.field-error').textContent).toBe(
      'Formato de imagen inválido',
    );
  });

  it('guarda con datos válidos y muestra el modal de éxito', async () => {
    completeRegistration.mockResolvedValue({});
    mount();
    fillValid();
    await attach(PNG);
    q('#service-lifeJackets').checked = true;

    clickSave();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title')?.textContent).toBe('¡Embarcación registrada!'),
    );
    const [boatId, details] = completeRegistration.mock.calls[0];
    expect(boatId).toBe('b1');
    expect(details).toMatchObject({
      portName: 'Marina Magdalena',
      latitude: 11.2408,
      longitude: -74.199,
      baseRate: '180000',
      services: { lifeJackets: true, divingGear: false },
    });
    expect(document.querySelector('.modal-text').textContent).toBe(
      'El nuevo vehículo fluvial ha sido registrado con éxito y se encuentra disponible en tu flota.',
    );

    document.querySelector('.modal-actions button').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('guarda sin servicios adicionales', async () => {
    completeRegistration.mockResolvedValue({});
    mount();
    fillValid();
    await attach(PNG);

    clickSave();

    await vi.waitFor(() => expect(completeRegistration).toHaveBeenCalled());
  });

  it('si el borrador ya no existe muestra el modal y lleva a la lista', async () => {
    completeRegistration.mockRejectedValue({ status: 404 });
    mount();
    fillValid();
    await attach(PNG);

    clickSave();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title')?.textContent).toBe('El borrador ya no existe'),
    );
    document.querySelector('.modal-actions button').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('un error técnico conserva los datos y Reintentar vuelve a guardar', async () => {
    completeRegistration.mockRejectedValueOnce({ status: 0, errors: [] });
    completeRegistration.mockResolvedValueOnce({});
    mount();
    fillValid();
    await attach(PNG);

    clickSave();
    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title')?.textContent).toBe(
        'No se pudo guardar el registro',
      ),
    );
    expect(q('#port-name').value).toBe('Marina Magdalena');

    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Reintentar')
      .click();

    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title')?.textContent).toBe('¡Embarcación registrada!'),
    );
    expect(completeRegistration).toHaveBeenCalledTimes(2);
  });

  it('muestra los errores de campo que devuelve el servidor', async () => {
    completeRegistration.mockRejectedValue({
      status: 400,
      errors: [{ field: 'photo', message: 'El tamaño de imagen se excede' }],
    });
    mount();
    fillValid();
    await attach(PNG);

    clickSave();

    await vi.waitFor(() =>
      expect(q('.dropzone').closest('.field').querySelector('.field-error').textContent).toBe(
        'El tamaño de imagen se excede',
      ),
    );
  });

  it('sin borrador en memoria lo pide al servidor; si no hay, vuelve a la lista', async () => {
    clearDraft();
    getDraft.mockResolvedValue(null);

    mount();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner'));
  });

  it('sin borrador en memoria pero con uno en el servidor muestra el formulario', async () => {
    clearDraft();
    getDraft.mockResolvedValue({ boat_id: 'b9', name: 'X' });

    mount();

    await vi.waitFor(() => expect(q('#port-name')).not.toBeNull());
  });

  describe('Retomar el borrador', () => {
    const modalButton = (label) =>
      [...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent === label);
    const checkbox = (key) => q(`#service-${key}`);

    function cancelWithData() {
      mount();
      fillValid();
      checkbox('soundSystem').checked = true;
      q('.form-actions .btn-secondary').click();
      modalButton('Salir').click();
      page.remove();
      closeAllModals();
    }

    it('al cancelar y volver, los campos aparecen como se dejaron', () => {
      cancelWithData();
      setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });

      mount();

      expect(q('#port-name').value).toBe('Marina Magdalena');
      expect(q('#base-rate').value).toBe('180000');
      expect(q('#port-latitude').value).toBe('11.2408');
      expect(q('#port-longitude').value).toBe('-74.199');
      expect(checkbox('soundSystem').checked).toBe(true);
      expect(checkbox('lifeJackets').checked).toBe(false);
      expect(errorOf('port-name')).toBe('');
    });

    it('con las coordenadas restauradas solo falta la foto para poder guardar', () => {
      cancelWithData();
      setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });
      mount();

      clickSave();

      expect(coordinatesError()).toBe('');
      expect(errorOf('port-name')).toBe('');
      expect(completeRegistration).not.toHaveBeenCalled();
    });

    it('salir sin cancelar (cambio de pantalla) también conserva lo escrito', () => {
      mount();
      type('port-name', 'Bahía Concha');
      globalThis.dispatchEvent(new Event('hashchange'));
      page.remove();

      mount();

      expect(q('#port-name').value).toBe('Bahía Concha');
    });

    it('otro borrador u otro usuario no ven ese avance', () => {
      cancelWithData();
      setDraft({ boat_id: 'otro', name: 'Otra' });
      mount();
      expect(q('#port-name').value).toBe('');
      page.remove();

      saveSession({ accessToken: 't', expiresInSeconds: 3600, user: { id: 'u2', role: 'OWNER' } });
      setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });
      mount();
      expect(q('#port-name').value).toBe('');
    });

    it('al registrar la embarcación se borra el avance guardado', async () => {
      completeRegistration.mockResolvedValue({});
      cancelWithData();
      setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });
      mount();
      await attach(PNG);

      clickSave();
      await vi.waitFor(() => expect(completeRegistration).toHaveBeenCalled());
      globalThis.dispatchEvent(new Event('hashchange'));
      page.remove();
      closeAllModals();

      setDraft({ boat_id: 'b1', name: 'Río Magdalena II' });
      mount();
      expect(q('#port-name').value).toBe('');
    });

    it('si el navegador no deja guardar, el paso 2 sigue funcionando', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('lleno');
      });
      mount();
      type('port-name', 'Bahía Concha');

      expect(() => globalThis.dispatchEvent(new Event('hashchange'))).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('Cancelar', () => {
    const clickCancel = () => q('.form-actions .btn-secondary').click();
    const modalButton = (label) =>
      [...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent === label);

    it('abre el modal "¿Suspender registro?" con los textos del spec, vacío o con datos', () => {
      mount();

      clickCancel();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Suspender registro?');
      expect(document.querySelector('.modal-text').textContent).toBe(
        'Los datos de identificación básica (Paso 1) se almacenarán de forma temporal en estado borrador, permitiendo reanudar el proceso de registro en futuras sesiones.',
      );
      expect(
        [...document.querySelectorAll('.modal-actions button')].map((b) => b.textContent),
      ).toEqual(['Continuar registro', 'Salir']);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('"Continuar registro" conserva los datos y limpia los errores visibles', () => {
      mount();
      fillValid();
      type('base-rate', '1.5');
      q('#base-rate').dispatchEvent(new Event('blur'));
      clickSave();
      expect(errorOf('base-rate')).not.toBe('');

      clickCancel();
      modalButton('Continuar registro').click();

      expect(document.querySelector('.modal')).toBeNull();
      expect(q('#port-name').value).toBe('Marina Magdalena');
      expect(q('#base-rate').value).toBe('1.5');
      expect(errorOf('base-rate')).toBe('');
      expect(errorOf('port-name')).toBe('');
      expect(q('#port-latitude').value).toBe('11.2408');
      expect(completeRegistration).not.toHaveBeenCalled();
    });

    it('"Salir" vuelve a la lista sin llamar al servidor y suelta el borrador en memoria', () => {
      mount();
      fillValid();

      clickCancel();
      modalButton('Salir').click();

      expect(navigate).toHaveBeenCalledWith('/owner');
      expect(completeRegistration).not.toHaveBeenCalled();
      expect(getDraft).not.toHaveBeenCalled();
      expect(getCurrentDraft()).toBeNull();
    });

    it('el modal no se cierra con Esc ni haciendo clic fuera', () => {
      mount();

      clickCancel();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.querySelector('.modal-overlay').click();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Suspender registro?');
    });
  });
});
