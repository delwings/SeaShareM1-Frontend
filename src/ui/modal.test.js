import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeAllModals, openModal, openTechnicalErrorModal } from './modal.js';

afterEach(() => closeAllModals());

describe('openModal', () => {
  it('no se cierra con Esc ni al hacer clic fuera', () => {
    openModal({ title: 'Prueba', buttons: [{ label: 'Aceptar', onClick: () => {} }] });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.modal-overlay').click();

    expect(document.querySelector('.modal')).not.toBeNull();
  });

  it('solo muestra la X cuando se pide, y la X llama a onClose', () => {
    const onClose = vi.fn();
    openModal({ title: 'Sin X', buttons: [{ label: 'Ok', onClick: () => {} }] });
    expect(document.querySelector('.modal-close')).toBeNull();

    openModal({ title: 'Con X', onClose, buttons: [{ label: 'Ok', onClick: () => {} }] });
    document.querySelector('.modal-close').click();

    expect(onClose).toHaveBeenCalled();
  });

  it('abrir uno nuevo reemplaza al anterior', () => {
    openModal({ title: 'Uno', buttons: [{ label: 'Ok', onClick: () => {} }] });
    openModal({ title: 'Dos', buttons: [{ label: 'Ok', onClick: () => {} }] });

    expect(document.querySelectorAll('.modal')).toHaveLength(1);
    expect(document.querySelector('.modal-title').textContent).toBe('Dos');
  });

  it('el modal de error técnico tiene Cerrar y Reintentar', () => {
    const onRetry = vi.fn();
    openTechnicalErrorModal({ title: 'Error', text: 'Texto', onClose: closeAllModals, onRetry });

    const labels = [...document.querySelectorAll('.modal-actions button')].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Cerrar', 'Reintentar']);
    document.querySelectorAll('.modal-actions button')[1].click();
    expect(onRetry).toHaveBeenCalled();
  });
});
