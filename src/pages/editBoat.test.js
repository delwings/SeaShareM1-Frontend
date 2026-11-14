import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({ getBoat: vi.fn(), editBoat: vi.fn() }));

// El mapa real necesita Leaflet y la red: se reemplaza por uno que deja disparar la selección.
let mapOptions;
vi.mock('../components/mapPicker.js', () => ({
  createMapPicker: vi.fn((options) => {
    mapOptions = options;
    return { element: document.createElement('div'), reload: vi.fn() };
  }),
}));

import { ApiError } from '../api/client.js';
import { editBoat, getBoat } from '../services/fleetService.js';
import { editBoatPage } from './editBoat.js';

const BOAT = {
  boat_id: 'b1',
  name: 'Río Magdalena I',
  legal_registration: 'CP-05-1042-A',
  type: 'MOTORBOAT',
  max_capacity: 8,
  status: 'AVAILABLE',
  photo_url: 'https://img.test/boat.png',
  base_rate: '180000.00',
  port: { name: 'Marina Central', latitude: '10.7452', longitude: '-74.7891' },
  services: {
    life_jackets: true,
    cooler_with_ice: false,
    sound_system: false,
    fishing_gear: false,
    diving_gear: false,
  },
};

let page;
let navigate;
let guard;
const q = (selector) => page.querySelector(selector);
const save = () => q('.form-actions .btn-primary');
const discard = () => q('.form-actions .btn-secondary');
const modal = () => document.querySelector('.modal');
const modalButton = (label) =>
  [...document.querySelectorAll('.modal button')].find((b) => b.textContent === label);

function type(selector, value) {
  const input = q(selector);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

async function mount(boat = BOAT) {
  getBoat.mockResolvedValue(boat);
  navigate = vi.fn();
  guard = null;
  page = editBoatPage({
    navigate,
    params: { boatId: 'b1' },
    setGuard: (next) => {
      guard = next;
    },
  });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.detail-skeleton')).toBeNull());
}

async function mountForm(boat) {
  await mount(boat);
  await vi.waitFor(() => expect(q('#edit-name')).not.toBeNull());
}

function pngFile(size = 20) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], 'nueva.png', { type: 'image/png' });
}

async function pick(file) {
  const input = q('#edit-photo');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  guard?.dispose?.();
  page?.remove();
  document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
  vi.clearAllMocks();
});

describe('Editar: acceso y carga', () => {
  it('muestra un esqueleto mientras consulta la embarcación del enlace', async () => {
    getBoat.mockReturnValue(new Promise(() => {}));
    page = editBoatPage({ navigate: vi.fn(), params: { boatId: 'b1' } });

    expect(page.querySelector('.detail-skeleton')).not.toBeNull();
    expect(getBoat).toHaveBeenCalledWith('b1');
  });

  it.each(['RESERVED', 'NAVIGATION'])(
    'en estado %s muestra la pantalla de bloqueo',
    async (status) => {
      await mount({ ...BOAT, status });

      expect(page.textContent).toContain(
        'Esta embarcación no se puede editar en su estado actual.',
      );
      expect(q('form')).toBeNull();
      [...page.querySelectorAll('button')]
        .find((b) => b.textContent === 'Volver a Ver Detalles')
        .click();
      expect(navigate).toHaveBeenCalledWith('/owner/boats/b1');
    },
  );

  it('en mantenimiento sí abre el formulario', async () => {
    await mountForm({ ...BOAT, status: 'MAINTENANCE' });

    expect(q('form')).not.toBeNull();
  });

  it.each([404, 400, 403])('con %i no deja reintentar y ofrece volver', async (status) => {
    getBoat.mockRejectedValue(new ApiError({ status, title: 'x', detail: 'x' }));
    page = editBoatPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    await vi.waitFor(() => expect(page.querySelector('.detail-skeleton')).toBeNull());

    expect(page.textContent).toContain('no tienes permiso para editarla');
    expect([...page.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Volver a Ver Detalles',
    ]);
  });

  it('si la carga falla muestra el error con Reintentar y no el formulario vacío', async () => {
    getBoat.mockRejectedValueOnce(new ApiError({ status: 500, title: 'x', detail: 'x' }));
    page = editBoatPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    await vi.waitFor(() => expect(page.querySelector('.detail-error')).not.toBeNull());

    expect(page.textContent).toContain('No se pudo cargar la información de la embarcación');
    expect(page.querySelector('form')).toBeNull();
    getBoat.mockResolvedValue(BOAT);
    [...page.querySelectorAll('button')].find((b) => b.textContent === 'Reintentar').click();
    await vi.waitFor(() => expect(page.querySelector('#edit-name')).not.toBeNull());
  });

  it('con 401 no muestra error (el cliente ya redirige al inicio de sesión)', async () => {
    getBoat.mockRejectedValue(new ApiError({ status: 401, title: 'x', detail: 'x' }));
    page = editBoatPage({ navigate: vi.fn(), params: { boatId: 'b1' } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(page.querySelector('.detail-error')).toBeNull();
  });
});

describe('Editar: formulario precargado', () => {
  it('precarga los datos, bloquea matrícula y tipo, y deja Guardar deshabilitado', async () => {
    await mountForm();

    expect(q('#edit-name').value).toBe('Río Magdalena I');
    expect(q('#edit-capacity').value).toBe('8');
    expect(q('#edit-rate').value).toBe('180000');
    expect(q('#edit-port').value).toBe('Marina Central');
    expect(q('#edit-latitude').value).toBe('10.7452');
    expect(q('#edit-longitude').value).toBe('-74.7891');
    expect(q('#edit-service-lifeJackets').checked).toBe(true);
    expect(q('#edit-service-soundSystem').checked).toBe(false);
    const locked = [...page.querySelectorAll('.locked-field input')];
    expect(locked.map((i) => i.value)).toEqual(['CP-05-1042-A', 'Lancha']);
    expect(locked.every((i) => i.readOnly)).toBe(true);
    expect(page.querySelectorAll('.lock-icon svg')).toHaveLength(2);
    expect(save().disabled).toBe(true);
    expect(page.textContent).toContain('Tarifa base (COP)');
    expect(page.textContent).not.toMatch(/por hora|por día/i);
    expect(page.textContent).toContain('Capitán (Fijo)');
    expect(page.textContent).toContain('PNG, JPG hasta 10 MB (Recomendado 400 × 400 px)');
  });

  it('abre el mapa centrado en el punto guardado', async () => {
    await mountForm();

    expect(mapOptions.initialPoint).toEqual({ latitude: 10.7452, longitude: -74.7891 });
  });

  it('autoselecciona el texto al enfocar', async () => {
    await mountForm();
    const input = q('#edit-name');
    const select = vi.spyOn(input, 'select');

    input.dispatchEvent(new Event('focus'));

    expect(select).toHaveBeenCalled();
  });
});

describe('Editar: validación en tiempo real y botón Guardar', () => {
  it('habilita Guardar con un cambio válido y lo deshabilita al revertirlo', async () => {
    await mountForm();

    type('#edit-name', 'Río Magdalena II');
    expect(save().disabled).toBe(false);
    type('#edit-name', 'Río Magdalena I');
    expect(save().disabled).toBe(true);
  });

  it('normaliza el nombre al perder el foco (espacios repetidos y extremos)', async () => {
    await mountForm();
    const input = type('#edit-name', '  Río \t  Magdalena   II ');

    input.dispatchEvent(new Event('blur'));

    expect(input.value).toBe('Río Magdalena II');
  });

  it('el nombre inválido muestra su mensaje debajo y bloquea Guardar', async () => {
    await mountForm();

    type('#edit-name', '123');

    expect(q('#edit-name').closest('.field').querySelector('.field-error').textContent).toContain(
      'El nombre debe tener entre 3 y 50',
    );
    expect(save().disabled).toBe(true);
    type('#edit-name', '');
    expect(q('#edit-name').closest('.field').querySelector('.field-error').textContent).toBe(
      'Este campo es obligatorio',
    );
  });

  it.each([
    ['abc', 'Solo se aceptan valores numéricos'],
    ['1.5', 'Ingrese un número entero sin puntos ni comas'],
    ['0', 'Ingrese un número entero mayor que 0'],
    ['11', 'Este valor excede la capacidad máxima de la embarcación'],
    ['100', 'Este valor excede la capacidad máxima de la embarcación'],
  ])('capacidad %j → %s', async (value, message) => {
    await mountForm();

    type('#edit-capacity', value);

    expect(q('#edit-capacity').closest('.field').querySelector('.field-error').textContent).toBe(
      message,
    );
    expect(save().disabled).toBe(true);
  });

  it('acepta ceros a la izquierda en la capacidad ("009" es 9)', async () => {
    await mountForm();

    type('#edit-capacity', '009');

    expect(q('#edit-capacity').closest('.field').querySelector('.field-error').textContent).toBe(
      '',
    );
    expect(save().disabled).toBe(false);
  });

  it('valida la tarifa y acepta hasta 9.999.999.999', async () => {
    await mountForm();

    type('#edit-rate', '10000000000');
    expect(q('#edit-rate').closest('.field').querySelector('.field-error').textContent).toBe(
      'La tarifa excede el valor permitido',
    );
    type('#edit-rate', '9999999999');
    expect(q('#edit-rate').closest('.field').querySelector('.field-error').textContent).toBe('');
  });

  it('mover el marcador actualiza latitud y longitud, y cuenta como cambio solo si difieren', async () => {
    await mountForm();

    mapOptions.onSelect({ latitude: 10.7452, longitude: -74.7891 });
    expect(save().disabled).toBe(true);
    mapOptions.onSelect({ latitude: 10.8, longitude: -170 });

    expect(q('#edit-latitude').value).toBe('10.8');
    expect(q('#edit-longitude').value).toBe('-170');
    expect(save().disabled).toBe(false);
  });

  it('una selección inválida del mapa muestra el mensaje y bloquea Guardar', async () => {
    await mountForm();
    type('#edit-name', 'Otro nombre');

    mapOptions.onInvalid();

    expect(q('#edit-coords-error').textContent).toContain('Selección de ubicación inválida');
    expect(save().disabled).toBe(true);
  });

  it('desmarcar un servicio cuenta como cambio', async () => {
    await mountForm();

    const check = q('#edit-service-lifeJackets');
    check.checked = false;
    check.dispatchEvent(new Event('change'));

    expect(save().disabled).toBe(false);
  });

  it('Enter en un campo no envía el formulario', async () => {
    await mountForm();
    type('#edit-name', 'Otro nombre');

    q('#edit-name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    q('form').dispatchEvent(new Event('submit', { cancelable: true }));

    expect(editBoat).not.toHaveBeenCalled();
  });
});

describe('Editar: fotografía', () => {
  it('"Cambiar fotografía" con un archivo válido reemplaza la imagen y habilita Guardar', async () => {
    await mountForm();

    await pick(pngFile());

    expect(q('.edit-photo-img').getAttribute('src')).toBe('blob:preview');
    expect(save().disabled).toBe(false);
  });

  it('un archivo inválido muestra el error y conserva la imagen anterior', async () => {
    await mountForm();

    await pick(new File([new Uint8Array(20)], 'texto.png'));

    expect(q('#edit-photo-error').textContent).toBe('Formato de imagen inválido');
    expect(q('.edit-photo-img').getAttribute('src')).toBe('https://img.test/boat.png');
    expect(save().disabled).toBe(true);
  });

  it('un archivo de más de 10 MB muestra el error de tamaño', async () => {
    await mountForm();
    const big = pngFile();
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });

    await pick(big);

    expect(q('#edit-photo-error').textContent).toBe('El tamaño de imagen se excede');
  });

  it('la "X" deja el campo vacío, muestra "Este campo es obligatorio" y deshabilita Guardar', async () => {
    await mountForm();
    type('#edit-name', 'Otro nombre');

    q('.preview-remove').click();

    expect(q('.edit-photo-img')).toBeNull();
    expect(q('#edit-photo-error').textContent).toBe('Este campo es obligatorio');
    expect(save().disabled).toBe(true);
  });

  it('cancelar el selector no cambia la imagen', async () => {
    await mountForm();
    const input = q('#edit-photo');
    Object.defineProperty(input, 'files', { value: [], configurable: true });

    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(q('.edit-photo-img').getAttribute('src')).toBe('https://img.test/boat.png');
  });
});

describe('Editar: guardado', () => {
  it('envía una sola petición con los datos normalizados y sin foto si no cambió', async () => {
    editBoat.mockResolvedValue({});
    await mountForm();
    type('#edit-name', '  Mi   Lancha ');
    type('#edit-capacity', '007');
    type('#edit-rate', '250000');

    save().click();
    save().click();

    await vi.waitFor(() => expect(modal()).not.toBeNull());
    expect(editBoat).toHaveBeenCalledTimes(1);
    expect(editBoat).toHaveBeenCalledWith('b1', {
      name: 'Mi Lancha',
      maxCapacity: '7',
      portName: 'Marina Central',
      latitude: 10.7452,
      longitude: -74.7891,
      baseRate: '250000',
      services: {
        lifeJackets: true,
        coolerWithIce: false,
        soundSystem: false,
        fishingGear: false,
        divingGear: false,
      },
      photo: null,
    });
  });

  it('muestra el spinner y deshabilita Guardar mientras guarda', async () => {
    let finish;
    editBoat.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    expect(save().disabled).toBe(true);
    expect(save().classList.contains('is-loading')).toBe(true);
    finish({});
    await vi.waitFor(() => expect(modal()).not.toBeNull());
  });

  it('envía la foto solo cuando se cambió', async () => {
    editBoat.mockResolvedValue({});
    await mountForm();
    const file = pngFile();
    await pick(file);

    save().click();

    await vi.waitFor(() => expect(editBoat).toHaveBeenCalled());
    expect(editBoat.mock.calls[0][1].photo).toBe(file);
  });

  it('éxito: modal "¡Cambios guardados!" y "Aceptar" lleva a Ver Detalles sin preguntar', async () => {
    editBoat.mockResolvedValue({});
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() => expect(modal().textContent).toContain('¡Cambios guardados!'));
    expect(modal().textContent).toContain(
      'La información de tu embarcación ha sido actualizada exitosamente en el sistema.',
    );
    expect(save().disabled).toBe(true);
    expect(guard.confirmLeave('/owner')).toBe(true);
    modalButton('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner/boats/b1');
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('error técnico: modal con Cerrar y Reintentar, datos intactos; Reintentar repite el guardado', async () => {
    editBoat.mockRejectedValueOnce(new ApiError({ status: 0, title: 'x', detail: 'x' }));
    editBoat.mockResolvedValueOnce({});
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() => expect(modal().textContent).toContain('No se pudo guardar los cambios'));
    expect(modal().textContent).toContain('Verifique su conexión a internet');
    expect(modalButton('Cerrar')).not.toBeUndefined();
    expect(q('#edit-name').value).toBe('Otro nombre');
    modalButton('Reintentar').click();
    await vi.waitFor(() => expect(modal().textContent).toContain('¡Cambios guardados!'));
    expect(editBoat).toHaveBeenCalledTimes(2);
  });

  it('un 502 (falla la imagen) también muestra el modal técnico', async () => {
    editBoat.mockRejectedValue(new ApiError({ status: 502, title: 'x', detail: 'x' }));
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() => expect(modal().textContent).toContain('No se pudo guardar los cambios'));
  });

  it('409 por cambio de estado: modal con el estado y "Recargar página" vuelve a consultar', async () => {
    editBoat.mockRejectedValue(
      new ApiError({ status: 409, title: 'x', detail: 'x', currentStatus: 'RESERVED' }),
    );
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() =>
      expect(modal().textContent).toContain(
        'La embarcación pasó a estado Reservado mientras editabas. No es posible guardar los cambios.',
      ),
    );
    getBoat.mockResolvedValue({ ...BOAT, status: 'RESERVED' });
    modalButton('Recargar página').click();
    await vi.waitFor(() =>
      expect(page.textContent).toContain(
        'Esta embarcación no se puede editar en su estado actual.',
      ),
    );
  });

  it('404 al guardar: "Esta embarcación ya no existe." y Aceptar lleva a la lista', async () => {
    editBoat.mockRejectedValue(new ApiError({ status: 404, title: 'x', detail: 'x' }));
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() => expect(modal().textContent).toContain('Esta embarcación ya no existe.'));
    modalButton('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('403 al guardar: "No tienes permiso…" y vuelve a Ver Detalles', async () => {
    editBoat.mockRejectedValue(new ApiError({ status: 403, title: 'x', detail: 'x' }));
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();

    await vi.waitFor(() =>
      expect(modal().textContent).toContain('No tienes permiso para editar esta embarcación.'),
    );
    modalButton('Volver a Ver Detalles').click();
    expect(navigate).toHaveBeenCalledWith('/owner/boats/b1');
  });

  it('401 al guardar: cierra los modales sin mostrar errores', async () => {
    editBoat.mockRejectedValue(new ApiError({ status: 401, title: 'x', detail: 'x' }));
    await mountForm();
    type('#edit-name', 'Otro nombre');

    save().click();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(modal()).toBeNull();
  });

  it('400 del servidor: el mensaje va debajo de su campo, rehabilita el botón y enfoca el campo', async () => {
    editBoat.mockRejectedValue(
      new ApiError({
        status: 400,
        title: 'x',
        detail: 'x',
        errors: [
          {
            field: 'max_capacity',
            message: 'Este valor excede la capacidad máxima de la embarcación',
          },
        ],
      }),
    );
    await mountForm();
    type('#edit-capacity', '9');

    save().click();

    await vi.waitFor(() =>
      expect(q('#edit-capacity').closest('.field').querySelector('.field-error').textContent).toBe(
        'Este valor excede la capacidad máxima de la embarcación',
      ),
    );
    expect(document.activeElement).toBe(q('#edit-capacity'));
    type('#edit-capacity', '8');
    expect(q('#edit-capacity').closest('.field').querySelector('.field-error').textContent).toBe(
      '',
    );
  });
});

describe('Editar: salir con cambios sin guardar', () => {
  it('sin cambios, Descartar y Volver navegan directo a Ver Detalles', async () => {
    await mountForm();

    discard().click();
    q('.detail-back').click();

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('/owner/boats/b1');
    expect(modal()).toBeNull();
  });

  it('con cambios pregunta; "Seguir editando" conserva todo', async () => {
    await mountForm();
    type('#edit-name', 'Otro nombre');

    discard().click();

    expect(modal().textContent).toContain('¿Descartar cambios?');
    expect(modal().textContent).toContain(
      'Tienes modificaciones sin guardar que se perderán. ¿Estás seguro de que deseas volver sin guardar?',
    );
    modalButton('Seguir editando').click();
    expect(modal()).toBeNull();
    expect(q('#edit-name').value).toBe('Otro nombre');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Sí, descartar" vuelve a Ver Detalles sin guardar', async () => {
    await mountForm();
    type('#edit-name', 'Otro nombre');

    q('.detail-back').click();
    modalButton('Sí, descartar').click();

    expect(navigate).toHaveBeenCalledWith('/owner/boats/b1');
    expect(editBoat).not.toHaveBeenCalled();
  });

  it('la guardia del enrutador impide cambiar de ruta con cambios y deja pasar tras descartar', async () => {
    await mountForm();
    expect(guard.confirmLeave('/owner')).toBe(true);
    type('#edit-name', 'Otro nombre');

    expect(guard.confirmLeave('/owner')).toBe(false);
    expect(modal().textContent).toContain('¿Descartar cambios?');
    modalButton('Sí, descartar').click();

    expect(navigate).toHaveBeenCalledWith('/owner');
    expect(guard.confirmLeave('/owner')).toBe(true);
  });

  it('avisa al cerrar la pestaña solo si hay cambios, y deja de avisar al salir de la página', async () => {
    await mountForm();
    const clean = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    type('#edit-name', 'Otro nombre');
    const dirty = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    guard.dispose();
    const after = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
