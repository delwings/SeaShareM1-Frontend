import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/adminOwnerService.js', () => ({ getOwner: vi.fn() }));

import { getOwner } from '../services/adminOwnerService.js';
import { adminOwnerPage, ERROR_TITLE, SUBTITLE } from './adminOwner.js';

const OWNER = {
  owner_id: 'o1',
  full_name: 'Fernando Fernández',
  document_number: '1042389104',
  email: 'fernando.fernandez@seashare.com',
  phone: '3104567890',
};

let page;
let navigate;
const q = (selector) => page.querySelector(selector);
const buttons = () => [...page.querySelectorAll('.detail-error button')].map((b) => b.textContent);

async function mount(result = OWNER) {
  if (result instanceof Error || result?.status) getOwner.mockRejectedValue(result);
  else getOwner.mockResolvedValue(result);
  navigate = vi.fn();
  page = adminOwnerPage({ navigate, params: { ownerId: 'o1' } });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.skeleton-card')).toBeNull());
}

afterEach(() => {
  page?.remove();
  vi.clearAllMocks();
});

describe('Información del Propietario', () => {
  it('muestra avatar, nombre, subtítulo y los datos con formato', async () => {
    await mount();

    expect(getOwner).toHaveBeenCalledWith('o1');
    expect(q('.owner-avatar').textContent).toBe('FF');
    expect(q('.page-title').textContent).toBe('Fernando Fernández');
    expect(q('.page-subtitle').textContent).toBe(SUBTITLE);
    const cards = [...page.querySelectorAll('.detail-card')].map((card) => [
      card.querySelector('.detail-label').textContent,
      card.querySelector('.detail-value').textContent,
    ]);
    expect(cards).toEqual([
      ['Correo electrónico', 'fernando.fernandez@seashare.com'],
      ['Teléfono de contacto', '+57 310 456 7890'],
      ['Documento de identidad', '1042389104'],
    ]);
  });

  it('es de solo lectura: el único botón es «Volver»', async () => {
    await mount();
    expect([...page.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['←Volver']);
    expect(page.querySelector('input, textarea, select')).toBeNull();
  });

  it('«Volver» regresa al listado del administrador', async () => {
    await mount();
    q('.detail-back').click();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('un dato vacío se muestra como «—»', async () => {
    await mount({ ...OWNER, email: '', phone: null });
    const values = [...page.querySelectorAll('.detail-value')].map((v) => v.textContent);
    expect(values.slice(0, 2)).toEqual(['—', '—']);
  });

  it('muestra el esqueleto mientras carga', () => {
    getOwner.mockReturnValue(new Promise(() => {}));
    page = adminOwnerPage({ navigate: vi.fn(), params: { ownerId: 'o1' } });
    expect(page.querySelector('[role="status"]')).not.toBeNull();
  });

  it('404: error solo con «Volver»', async () => {
    await mount({ status: 404 });
    expect(q('.detail-error-title').textContent).toBe(ERROR_TITLE);
    expect(buttons()).toEqual(['Volver']);
  });

  it('error de servidor: «Volver» y «Reintentar», y reintentar consulta de nuevo', async () => {
    await mount({ status: 500 });
    expect(buttons()).toEqual(['Volver', 'Reintentar']);
    getOwner.mockResolvedValue(OWNER);

    page.querySelectorAll('.detail-error button')[1].click();

    await vi.waitFor(() => expect(q('.owner-card')).not.toBeNull());
    expect(getOwner).toHaveBeenCalledTimes(2);
  });

  it('401: no muestra error (el cliente redirige al inicio de sesión)', async () => {
    getOwner.mockRejectedValue({ status: 401 });
    page = adminOwnerPage({ navigate: vi.fn(), params: { ownerId: 'o1' } });
    document.body.append(page);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('.detail-error')).toBeNull();
  });
});
