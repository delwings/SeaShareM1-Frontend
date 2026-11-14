import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({
  startMaintenance: vi.fn(),
  finishMaintenance: vi.fn(),
  requestMaintenanceReview: vi.fn(),
}));

vi.mock('../services/adminFleetService.js', () => ({
  startAdminMaintenance: vi.fn(),
  finishAdminMaintenance: vi.fn(),
}));

import { finishAdminMaintenance, startAdminMaintenance } from '../services/adminFleetService.js';
import {
  finishMaintenance,
  requestMaintenanceReview,
  startMaintenance,
} from '../services/fleetService.js';
import { startMaintenanceFlow, startReviewRequestFlow } from './maintenanceFlow.js';

let onChanged;
let reload;
let navigate;

const modal = () => document.querySelector('.modal');
const title = () => modal()?.querySelector('.modal-title')?.textContent;
const buttons = () => [...document.querySelectorAll('.modal-actions button')];
const button = (label) => buttons().find((b) => b.textContent === label);

function start(mode) {
  startMaintenanceFlow({ mode, boat: { boat_id: 'b1' }, onChanged, reload, navigate });
}

beforeEach(() => {
  onChanged = vi.fn();
  reload = vi.fn();
  navigate = vi.fn();
});

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((node) => node.remove());
  vi.clearAllMocks();
});

describe('Enviar a mantenimiento: confirmación', () => {
  it('muestra los textos exactos y los dos botones', () => {
    start('start');
    expect(title()).toBe('¿Enviar a Mantenimiento?');
    expect(modal().textContent).toContain('La embarcación no recibirá reservas temporalmente.');
    expect(buttons().map((b) => b.textContent)).toEqual(['Cancelar', 'Sí, enviar']);
  });

  it('"Cancelar" cierra el modal sin llamar al servidor', () => {
    start('start');
    button('Cancelar').click();
    expect(modal()).toBeNull();
    expect(startMaintenance).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('no se cierra con Esc ni al hacer clic fuera', () => {
    start('start');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.modal-overlay').click();
    expect(title()).toBe('¿Enviar a Mantenimiento?');
  });

  it('"Sí, enviar" llama una sola vez aunque se pulse dos veces y entrega la embarcación', async () => {
    startMaintenance.mockResolvedValue({ boat_id: 'b1', status: 'MAINTENANCE' });
    start('start');
    const yes = button('Sí, enviar');
    yes.click();
    yes.click();

    await vi.waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ boat_id: 'b1', status: 'MAINTENANCE' }),
    );
    expect(startMaintenance).toHaveBeenCalledTimes(1);
    expect(startMaintenance).toHaveBeenCalledWith('b1');
    expect(modal()).toBeNull();
  });
});

describe('Terminar mantenimiento: confirmación', () => {
  it('muestra los textos exactos y los dos botones', () => {
    start('finish');
    expect(title()).toBe('¿Terminar Mantenimiento?');
    expect(modal().textContent).toContain('La embarcación podrá recibir reservas nuevamente.');
    expect(buttons().map((b) => b.textContent)).toEqual(['Cancelar', 'Sí, terminar']);
  });

  it('"Sí, terminar" entrega la embarcación Disponible', async () => {
    finishMaintenance.mockResolvedValue({ boat_id: 'b1', status: 'AVAILABLE' });
    start('finish');
    button('Sí, terminar').click();
    await vi.waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ boat_id: 'b1', status: 'AVAILABLE' }),
    );
    expect(modal()).toBeNull();
  });
});

describe('Mantenimiento: errores', () => {
  it('409 (estado cambió): avisa el estado y "Recargar página" vuelve a consultar', async () => {
    startMaintenance.mockRejectedValue({ status: 409, currentStatus: 'RESERVED' });
    start('start');
    button('Sí, enviar').click();

    await vi.waitFor(() =>
      expect(title()).toBe('No es posible enviar la embarcación a mantenimiento'),
    );
    expect(modal().textContent).toContain('pasó a estado Reservado');
    button('Recargar página').click();
    expect(reload).toHaveBeenCalled();
    expect(modal()).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('409 por suspensión del administrador: explica que solo él puede habilitarla', async () => {
    finishMaintenance.mockRejectedValue({
      status: 409,
      currentStatus: 'MAINTENANCE',
      maintenanceBy: 'ADMIN',
    });
    start('finish');
    button('Sí, terminar').click();

    await vi.waitFor(() => expect(title()).toBe('Embarcación suspendida por el administrador'));
    expect(modal().textContent).toContain('Solo él puede habilitarla');
    button('Aceptar').click();
    expect(reload).toHaveBeenCalled();
  });

  it('404: avisa que ya no existe y lleva a Mis Embarcaciones', async () => {
    startMaintenance.mockRejectedValue({ status: 404 });
    start('start');
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('Esta embarcación ya no existe'));
    button('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('401: solo cierra los modales', async () => {
    startMaintenance.mockRejectedValue({ status: 401 });
    start('start');
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(modal()).toBeNull());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('error técnico: Cerrar o Reintentar, y el reintento repite la solicitud', async () => {
    startMaintenance.mockRejectedValueOnce({ status: 0 });
    startMaintenance.mockResolvedValueOnce({ boat_id: 'b1', status: 'MAINTENANCE' });
    start('start');
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('No se pudo enviar a mantenimiento'));
    expect(buttons().map((b) => b.textContent)).toEqual(['Cerrar', 'Reintentar']);
    button('Reintentar').click();

    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(startMaintenance).toHaveBeenCalledTimes(2);
  });

  it('error técnico: "Cerrar" no cambia nada', async () => {
    finishMaintenance.mockRejectedValue({ status: 500 });
    start('finish');
    button('Sí, terminar').click();

    await vi.waitFor(() => expect(title()).toBe('No se pudo terminar el mantenimiento'));
    button('Cerrar').click();
    expect(modal()).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('Mantenimiento del administrador', () => {
  const startAdmin = (mode) =>
    startMaintenanceFlow({
      mode,
      boat: { boat_id: 'b1' },
      onChanged,
      reload,
      navigate,
      admin: true,
    });
  const type = (value) => {
    const input = document.querySelector('.reason-input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('enviar: muestra el texto del admin, el campo del motivo y los botones', () => {
    startAdmin('start');

    expect(title()).toBe('¿Enviar a Mantenimiento?');
    expect(modal().textContent).toContain('Se enviará una notificación al propietario.');
    expect(modal().textContent).toContain('Motivo del mantenimiento');
    expect(document.querySelector('.reason-input').placeholder).toBe(
      'Describe la razón del mantenimiento (ej. revisión de motor...)',
    );
    expect(buttons().map((b) => b.textContent)).toEqual(['Cancelar', 'Sí, enviar']);
  });

  it('enviar sin motivo no llama al servidor y marca el error', () => {
    startAdmin('start');

    button('Sí, enviar').click();
    type('   ');
    button('Sí, enviar').click();

    expect(startAdminMaintenance).not.toHaveBeenCalled();
    expect(document.querySelector('.field-error').textContent).toBe(
      'Escribe el motivo del mantenimiento.',
    );
    expect(button('Sí, enviar').disabled).toBe(false);
  });

  it('enviar con motivo llama al servicio del admin con el motivo recortado y actualiza la pantalla', async () => {
    startAdminMaintenance.mockResolvedValue({ boat_id: 'b1', status: 'MAINTENANCE' });
    startAdmin('start');
    type('  Revisión de motor  ');

    button('Sí, enviar').click();

    await vi.waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ boat_id: 'b1', status: 'MAINTENANCE' }),
    );
    expect(startAdminMaintenance).toHaveBeenCalledWith('b1', 'Revisión de motor');
    expect(startMaintenance).not.toHaveBeenCalled();
    expect(modal()).toBeNull();
  });

  it('terminar: sin campo de motivo, llama al servicio del admin', async () => {
    finishAdminMaintenance.mockResolvedValue({ boat_id: 'b1', status: 'AVAILABLE' });
    startAdmin('finish');

    expect(title()).toBe('¿Terminar Mantenimiento?');
    expect(document.querySelector('.reason-input')).toBeNull();
    button('Sí, terminar').click();

    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(finishAdminMaintenance).toHaveBeenCalledWith('b1');
    expect(finishMaintenance).not.toHaveBeenCalled();
  });

  it('terminar un mantenimiento del propietario (409): explica que solo él puede terminarlo', async () => {
    finishAdminMaintenance.mockRejectedValue({
      status: 409,
      currentStatus: 'MAINTENANCE',
      maintenanceBy: 'OWNER',
    });
    startAdmin('finish');
    button('Sí, terminar').click();

    await vi.waitFor(() => expect(title()).toBe('Mantenimiento iniciado por el propietario'));
    expect(modal().textContent).toContain('Solo él puede terminarlo.');
    button('Aceptar').click();
    expect(reload).toHaveBeenCalled();
  });

  it('404 lleva a la tabla de flota', async () => {
    startAdminMaintenance.mockRejectedValue({ status: 404 });
    startAdmin('start');
    type('Motivo');
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('Esta embarcación ya no existe'));
    button('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('"Reintentar" tras un fallo técnico repite con el mismo motivo', async () => {
    startAdminMaintenance
      .mockRejectedValueOnce({ status: 0 })
      .mockResolvedValueOnce({ boat_id: 'b1' });
    startAdmin('start');
    type('Motivo');
    button('Sí, enviar').click();
    await vi.waitFor(() => expect(title()).toBe('No se pudo enviar a mantenimiento'));

    button('Reintentar').click();

    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(startAdminMaintenance).toHaveBeenNthCalledWith(2, 'b1', 'Motivo');
  });
});

describe('Solicitar revisión (propietario)', () => {
  const startReview = () => startReviewRequestFlow({ boat: { boat_id: 'b1' }, reload, navigate });

  it('muestra "¿Enviar a revisión?" con Cancelar y Sí, enviar', () => {
    startReview();

    expect(title()).toBe('¿Enviar a revisión?');
    expect(modal().textContent).toContain('Se enviará una notificación al administrador.');
    expect(buttons().map((b) => b.textContent)).toEqual(['Cancelar', 'Sí, enviar']);
  });

  it('"Cancelar" no llama al servidor', () => {
    startReview();
    button('Cancelar').click();
    expect(modal()).toBeNull();
    expect(requestMaintenanceReview).not.toHaveBeenCalled();
  });

  it('"Sí, enviar" avisa al administrador y confirma la solicitud', async () => {
    requestMaintenanceReview.mockResolvedValue(undefined);
    startReview();

    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('Solicitud enviada'));
    expect(requestMaintenanceReview).toHaveBeenCalledWith('b1');
    button('Aceptar').click();
    expect(modal()).toBeNull();
  });

  it('al enviar avisa a la pantalla con la revisión ya solicitada', async () => {
    requestMaintenanceReview.mockResolvedValue(undefined);
    const onChanged = vi.fn();
    startReviewRequestFlow({ boat: { boat_id: 'b1' }, onChanged, reload, navigate });

    button('Sí, enviar').click();

    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalledWith({ boat_id: 'b1', review_requested: true });
  });

  it('404: "Esta embarcación ya no existe" lleva a Mis Embarcaciones', async () => {
    requestMaintenanceReview.mockRejectedValue({ status: 404 });
    startReview();
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('Esta embarcación ya no existe'));
    button('Aceptar').click();
    expect(navigate).toHaveBeenCalledWith('/owner');
  });

  it('409: avisa que el estado cambió y recarga', async () => {
    requestMaintenanceReview.mockRejectedValue({ status: 409 });
    startReview();
    button('Sí, enviar').click();

    await vi.waitFor(() => expect(title()).toBe('No es posible solicitar la revisión'));
    button('Recargar página').click();
    expect(reload).toHaveBeenCalled();
  });

  it('fallo técnico: Reintentar vuelve a enviar', async () => {
    requestMaintenanceReview.mockRejectedValueOnce({ status: 0 }).mockResolvedValueOnce(undefined);
    startReview();
    button('Sí, enviar').click();
    await vi.waitFor(() => expect(title()).toBe('No se pudo enviar la solicitud'));

    button('Reintentar').click();

    await vi.waitFor(() => expect(title()).toBe('Solicitud enviada'));
    expect(requestMaintenanceReview).toHaveBeenCalledTimes(2);
  });
});
