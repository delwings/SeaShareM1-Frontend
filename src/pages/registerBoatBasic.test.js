import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({
  createDraft: vi.fn(),
  isLegalRegistrationAvailable: vi.fn(),
  listBoatTypes: vi.fn(),
}));

import {
  createDraft,
  isLegalRegistrationAvailable,
  listBoatTypes,
} from '../services/fleetService.js';
import { getCurrentDraft } from '../state/registrationFlow.js';
import { closeAllModals } from '../ui/modal.js';
import { registerBoatBasicPage } from './registerBoatBasic.js';

const TYPES = [
  { code: 'MOTORBOAT', name: 'Lancha', max_capacity: 10 },
  { code: 'YACHT', name: 'Yate', max_capacity: 20 },
];

let page;
let navigate;

const q = (selector) => page.querySelector(selector);
const errorOf = (id) => q(`#${id}`).closest('.field').querySelector('.field-error').textContent;

function type(id, value) {
  const input = q(`#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function leave(id) {
  q(`#${id}`).dispatchEvent(new Event('blur'));
}

function chooseType(code) {
  const select = q('#boat-type');
  select.value = code;
  select.dispatchEvent(new Event('change'));
}

async function mount() {
  navigate = vi.fn();
  page = registerBoatBasicPage({ navigate });
  document.body.append(page);
  await vi.waitFor(() => expect(q('#boat-type').options.length).toBe(3));
}

function fillValid() {
  type('boat-name', 'Río Magdalena II');
  type('boat-legal-registration', 'CP-05-1042-A');
  chooseType('MOTORBOAT');
  type('boat-capacity', '8');
}

const clickNext = () => page.querySelector('.form-actions .btn-primary').click();

beforeEach(() => {
  listBoatTypes.mockResolvedValue(TYPES);
  isLegalRegistrationAvailable.mockResolvedValue(true);
});

afterEach(() => {
  page?.remove();
  closeAllModals();
  vi.clearAllMocks();
});

describe('Paso 1: Datos Básicos', () => {
  it('muestra los textos y placeholders del spec', async () => {
    await mount();

    expect(q('.form-title').textContent).toBe('Registrar Nueva Embarcación');
    expect(q('.form-subtitle').textContent).toBe(
      'Paso 1 de 2: Información general y datos legales del vehículo fluvial.',
    );
    expect(q('#boat-name').placeholder).toBe('Ej. Río Magdalena II');
    expect(q('#boat-legal-registration').placeholder).toBe('Ej. CP-05-XXXX-A');
    expect(q('#boat-capacity').placeholder).toBe('Ej. 10');
    expect(q('#boat-type').options[0].textContent).toBe('Seleccionar tipo (Lancha, Yate, etc.)');
    expect([...page.querySelectorAll('.form-actions button')].map((b) => b.textContent)).toEqual([
      'Cancelar',
      'Siguiente›',
    ]);
  });

  it('pide el campo obligatorio al salir de él vacío', async () => {
    await mount();

    leave('boat-name');

    expect(errorOf('boat-name')).toBe('Este campo es obligatorio para continuar con el registro');
  });

  it('valida nombre y formato de matrícula en tiempo real', async () => {
    await mount();

    type('boat-name', '123');
    type('boat-legal-registration', 'cp-05-1042-a');

    expect(errorOf('boat-name')).toContain('El nombre debe tener entre 3 y 50 caracteres');
    expect(errorOf('boat-legal-registration')).toBe('Formato de matrícula legal inválido');
  });

  it('avisa si la matrícula ya existe', async () => {
    isLegalRegistrationAvailable.mockResolvedValue(false);
    await mount();

    type('boat-legal-registration', 'CP-05-1042-A');

    await vi.waitFor(() =>
      expect(errorOf('boat-legal-registration')).toBe('Matrícula existente en el sistema'),
    );
  });

  it('capacidad: deja la letra escrita y muestra el mensaje', async () => {
    await mount();
    chooseType('MOTORBOAT');

    type('boat-capacity', '1a');
    expect(q('#boat-capacity').value).toBe('1a');
    expect(errorOf('boat-capacity')).toBe('Solo se aceptan valores numéricos');

    type('boat-capacity', '1.5');
    expect(errorOf('boat-capacity')).toBe('Ingrese un número entero sin puntos ni comas');

    type('boat-capacity', '0');
    expect(errorOf('boat-capacity')).toBe('Ingrese un número entero mayor que 0');

    type('boat-capacity', '11');
    expect(errorOf('boat-capacity')).toBe(
      'Este valor excede la capacidad máxima de la embarcación',
    );
  });

  it('al cambiar el tipo vuelve a validar la capacidad', async () => {
    await mount();
    chooseType('YACHT');
    type('boat-capacity', '15');
    expect(errorOf('boat-capacity')).toBe('');

    chooseType('MOTORBOAT');

    expect(errorOf('boat-capacity')).toBe(
      'Este valor excede la capacidad máxima de la embarcación',
    );
  });

  it('capacidad escrita sin tipo pide el tipo debajo del selector', async () => {
    await mount();

    type('boat-capacity', '5');

    expect(errorOf('boat-type')).toBe('Este campo es obligatorio para continuar con el registro');
  });

  it('"Siguiente" con todo vacío no avanza y marca cada campo', async () => {
    await mount();

    clickNext();

    for (const id of ['boat-name', 'boat-legal-registration', 'boat-type', 'boat-capacity']) {
      expect(errorOf(id)).toBe('Este campo es obligatorio para continuar con el registro');
    }
    expect(createDraft).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('con datos válidos guarda el borrador y pasa al paso 2', async () => {
    createDraft.mockResolvedValue({ boat_id: 'b1', name: 'Río Magdalena II' });
    await mount();
    fillValid();

    clickNext();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new/details'));
    expect(createDraft).toHaveBeenCalledWith({
      name: 'Río Magdalena II',
      legalRegistration: 'CP-05-1042-A',
      type: 'MOTORBOAT',
      maxCapacity: 8,
    });
    expect(getCurrentDraft().boat_id).toBe('b1');
  });

  it('el botón queda deshabilitado mientras guarda', async () => {
    let finish;
    createDraft.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await mount();
    fillValid();

    clickNext();

    await vi.waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(page.querySelector('.form-actions .btn-primary').disabled).toBe(true);
    finish({ boat_id: 'b1' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('un error técnico abre el modal y Reintentar repite el guardado', async () => {
    createDraft.mockRejectedValueOnce({ status: 0, errors: [] });
    createDraft.mockResolvedValueOnce({ boat_id: 'b1' });
    await mount();
    fillValid();

    clickNext();
    await vi.waitFor(() =>
      expect(document.querySelector('.modal-title')?.textContent).toBe(
        'No se pudo guardar el registro',
      ),
    );
    expect(q('#boat-name').value).toBe('Río Magdalena II');

    [...document.querySelectorAll('.modal-actions button')]
      .find((b) => b.textContent === 'Reintentar')
      .click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new/details'));
    expect(createDraft).toHaveBeenCalledTimes(2);
  });

  it('un 409 de matrícula del servidor se muestra bajo el campo', async () => {
    createDraft.mockRejectedValue({
      status: 409,
      errors: [{ field: 'legal_registration', message: 'Matrícula existente en el sistema' }],
    });
    await mount();
    fillValid();

    clickNext();

    await vi.waitFor(() =>
      expect(errorOf('boat-legal-registration')).toBe('Matrícula existente en el sistema'),
    );
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('si falla la verificación de la matrícula muestra el modal técnico', async () => {
    isLegalRegistrationAvailable.mockRejectedValue({ status: 0 });
    await mount();

    type('boat-legal-registration', 'CP-05-1042-A');

    await vi.waitFor(() => expect(document.querySelector('.modal')).not.toBeNull());
  });

  it('si no cargan los tipos muestra el aviso y vuelve a intentar al abrir el selector', async () => {
    listBoatTypes.mockRejectedValueOnce({ status: 0 });
    navigate = vi.fn();
    page = registerBoatBasicPage({ navigate });
    document.body.append(page);
    await vi.waitFor(() =>
      expect(q('.field-notice').textContent).toBe(
        'No se pudieron cargar los tipos de embarcación. Inténtelo nuevamente.',
      ),
    );

    q('#boat-type').dispatchEvent(new Event('mousedown'));

    await vi.waitFor(() => expect(q('#boat-type').options.length).toBe(3));
  });

  describe('Cancelar', () => {
    const clickCancel = () => page.querySelector('.form-actions .btn-secondary').click();
    const modalButton = (label) =>
      [...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent === label);

    it('con el formulario vacío abre el modal con los textos del spec y no navega', async () => {
      await mount();

      clickCancel();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Cancelar registro?');
      expect(document.querySelector('.modal-text').textContent).toBe(
        'Los datos ingresados hasta el momento se perderán y no se guardará ninguna embarcación.',
      );
      expect(
        [...document.querySelectorAll('.modal-actions button')].map((b) => b.textContent),
      ).toEqual(['Continuar registro', 'Sí, cancelar']);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('con datos ingresados muestra el mismo modal', async () => {
      await mount();
      fillValid();

      clickCancel();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Cancelar registro?');
    });

    it('"Continuar registro" cierra el modal, conserva los datos y limpia los errores', async () => {
      await mount();
      type('boat-name', '12');
      leave('boat-name');
      expect(errorOf('boat-name')).not.toBe('');

      clickCancel();
      modalButton('Continuar registro').click();

      expect(document.querySelector('.modal')).toBeNull();
      expect(q('#boat-name').value).toBe('12');
      expect(errorOf('boat-name')).toBe('');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('"Continuar registro" con el formulario vacío lo deja vacío', async () => {
      await mount();

      clickCancel();
      modalButton('Continuar registro').click();

      expect(document.querySelector('.modal')).toBeNull();
      expect(q('#boat-name').value).toBe('');
    });

    it('"Sí, cancelar" vuelve a la lista sin guardar nada', async () => {
      await mount();
      fillValid();

      clickCancel();
      modalButton('Sí, cancelar').click();

      expect(navigate).toHaveBeenCalledWith('/owner');
      expect(createDraft).not.toHaveBeenCalled();
      expect(getCurrentDraft()).toBeNull();
      expect(document.querySelector('.modal')).toBeNull();
    });

    it('el modal no se cierra con Esc ni haciendo clic fuera', async () => {
      await mount();

      clickCancel();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.querySelector('.modal-overlay').click();

      expect(document.querySelector('.modal-title').textContent).toBe('¿Cancelar registro?');
    });
  });
});
