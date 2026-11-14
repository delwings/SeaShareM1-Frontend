import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({ deleteBoat: vi.fn() }));

import { deleteBoat } from '../services/fleetService.js';
import { startDeleteBoat } from './deleteBoatFlow.js';

let navigate;
let reload;

const modal = () => document.querySelector('.modal');
const title = () => modal()?.querySelector('.modal-title')?.textContent;
const buttons = () => [...document.querySelectorAll('.modal-actions button')];
const button = (label) => buttons().find((b) => b.textContent === label);

function start() {
  startDeleteBoat({ boat: { boat_id: 'b1' }, navigate, reload });
}

beforeEach(() => {
  navigate = vi.fn();
  reload = vi.fn();
});

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((node) => node.remove());
  vi.clearAllMocks();
});

describe('Eliminar embarcación: confirmación', () => {
  it('muestra el modal con los textos exactos y los dos botones', () => {
    start();

    expect(title()).toBe('¿Eliminar embarcación?');
    expect(modal().textContent).toContain(
      'Esta acción eliminará el registro de forma permanente y liberará su matrícula asociada en el sistema.',
    );
    expect(modal().querySelector('.modal-warning').textContent).toBe(
      'Esta acción no se puede deshacer.',
    );
    expect(buttons().map((b) => b.textContent)).toEqual(['Conservar', 'Sí, eliminar']);
  });

  it('"Conservar" cierra el modal sin llamar al servidor ni navegar', () => {
    start();

    button('Conservar').click();

    expect(modal()).toBeNull();
    expect(deleteBoat).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no se cierra con Esc ni al hacer clic fuera', () => {
    start();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.modal-overlay').click();

    expect(title()).toBe('¿Eliminar embarcación?');
  });
});

describe('Eliminar embarcación: resultado', () => {
  it('éxito: muestra "¡Embarcación eliminada!" y "Aceptar" lleva a la lista', async () => {
    deleteBoat.mockResolvedValue(null);
    start();

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));

    expect(modal().textContent).toContain('La embarcación ha sido eliminada del sistema.');
    expect(deleteBoat).toHaveBeenCalledWith('b1');
    button('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
    expect(modal()).toBeNull();
  });

  it('un doble clic envía una sola solicitud y deja los botones deshabilitados', async () => {
    let finish;
    deleteBoat.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    start();
    const confirm = button('Sí, eliminar');

    confirm.click();
    confirm.click();

    expect(deleteBoat).toHaveBeenCalledTimes(1);
    expect(confirm.disabled).toBe(true);
    expect(button('Conservar').disabled).toBe(true);
    finish(null);
    await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));
  });

  it('estado cambiado (409): informa el estado nuevo y "Recargar página" vuelve a consultar', async () => {
    deleteBoat.mockRejectedValue({ status: 409, currentStatus: 'RESERVED' });
    start();

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('No es posible eliminar la embarcación'));

    expect(modal().textContent).toContain(
      'La embarcación pasó a estado Reservado mientras tanto. No es posible eliminarla.',
    );
    button('Recargar página').click();
    expect(reload).toHaveBeenCalled();
    expect(modal()).toBeNull();
  });

  it('embarcación ya eliminada o ajena (404): "Esta embarcación ya no existe" y Aceptar va a la lista', async () => {
    deleteBoat.mockRejectedValue({ status: 404 });
    start();

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('Esta embarcación ya no existe'));

    button('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('error técnico: "Cerrar" deja al usuario en el detalle', async () => {
    deleteBoat.mockRejectedValue({ status: 0 });
    start();

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('No se pudo eliminar la embarcación'));

    expect(modal().textContent).toContain(
      'Ocurrió un problema técnico al eliminar la embarcación. Verifique su conexión a internet e inténtelo nuevamente.',
    );
    expect(buttons().map((b) => b.textContent)).toEqual(['Cerrar', 'Reintentar']);
    button('Cerrar').click();
    expect(modal()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Reintentar" repite la eliminación y, si falla otra vez, muestra el mismo modal', async () => {
    deleteBoat.mockRejectedValue({ status: 500 });
    start();
    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('No se pudo eliminar la embarcación'));

    button('Reintentar').click();
    await vi.waitFor(() => expect(deleteBoat).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(button('Reintentar')?.disabled).toBe(false));

    expect(title()).toBe('No se pudo eliminar la embarcación');
  });

  it('"Reintentar" que funciona termina en el modal de éxito', async () => {
    deleteBoat.mockRejectedValueOnce({ status: 0 }).mockResolvedValueOnce(null);
    start();
    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('No se pudo eliminar la embarcación'));

    button('Reintentar').click();

    await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));
  });

  it('sesión vencida (401): cierra los modales sin mostrar errores', async () => {
    deleteBoat.mockRejectedValue({ status: 401 });
    start();

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(modal()).toBeNull());

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Eliminar embarcación: variante del administrador', () => {
  it('usa la llamada y el destino indicados', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    startDeleteBoat({ boat: { boat_id: 'b9' }, navigate, reload, remove, listPath: '/admin' });

    button('Sí, eliminar').click();
    await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));
    button('Aceptar').click();

    expect(remove).toHaveBeenCalledWith('b9');
    expect(deleteBoat).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  describe('con motivo obligatorio (administrador)', () => {
    const startWithReason = (remove) =>
      startDeleteBoat({
        boat: { boat_id: 'b9' },
        navigate,
        reload,
        remove,
        listPath: '/admin',
        askReason: true,
      });
    const type = (value) => {
      const input = document.querySelector('.reason-input');
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    it('muestra el campo, el contador y sigue con los mismos textos', () => {
      startWithReason(vi.fn());

      expect(title()).toBe('¿Eliminar embarcación?');
      expect(modal().textContent).toContain('Motivo de la eliminación');
      expect(document.querySelector('.reason-input').getAttribute('maxlength')).toBe('300');
      type('Fotos falsas');
      expect(document.querySelector('.reason-counter').textContent).toBe('12/300');
      expect(buttons().map((b) => b.textContent)).toEqual(['Conservar', 'Sí, eliminar']);
    });

    it('sin motivo no elimina: marca el error y deja los botones activos', () => {
      const remove = vi.fn();
      startWithReason(remove);

      button('Sí, eliminar').click();
      type('   ');
      button('Sí, eliminar').click();

      expect(remove).not.toHaveBeenCalled();
      expect(document.querySelector('.field-error').textContent).toBe(
        'Escribe el motivo de la eliminación.',
      );
      expect(button('Sí, eliminar').disabled).toBe(false);
    });

    it('al escribir desaparece el error y el motivo viaja recortado', async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      startWithReason(remove);
      button('Sí, eliminar').click();

      type('  Datos falsos  ');
      expect(document.querySelector('.field-error').textContent).toBe('');
      button('Sí, eliminar').click();
      await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));

      expect(remove).toHaveBeenCalledWith('b9', 'Datos falsos');
    });

    it('"Reintentar" repite con el mismo motivo', async () => {
      const remove = vi.fn().mockRejectedValueOnce({ status: 0 }).mockResolvedValueOnce(undefined);
      startWithReason(remove);
      type('Motivo');
      button('Sí, eliminar').click();
      await vi.waitFor(() => expect(title()).toBe('No se pudo eliminar la embarcación'));

      button('Reintentar').click();
      await vi.waitFor(() => expect(title()).toBe('¡Embarcación eliminada!'));

      expect(remove).toHaveBeenNthCalledWith(2, 'b9', 'Motivo');
    });
  });
});
