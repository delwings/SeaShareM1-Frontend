import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/adminOwnerService.js', () => ({ searchOwners: vi.fn() }));

import { searchOwners } from '../services/adminOwnerService.js';
import { createOwnerSearch, TEXTS } from './ownerSearch.js';

const OWNERS = [
  { owner_id: 'o1', full_name: 'Fernando Fernández', document_number: '1042389104' },
  { owner_id: 'o2', full_name: 'Fernanda Ruiz', document_number: '1010000009' },
];

let root;
let onOpen;
const input = () => root.querySelector('input');
const panel = () => root.querySelector('.search-panel');
const rows = () => [...root.querySelectorAll('.search-row')];

async function type(text) {
  input().value = text;
  input().dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(300);
}

beforeEach(() => {
  vi.useFakeTimers();
  onOpen = vi.fn();
  root = createOwnerSearch({ onOpen });
  document.body.append(root);
  searchOwners.mockResolvedValue({ owners: OWNERS, hasMore: false });
});

afterEach(() => {
  root.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Búsqueda de propietario', () => {
  it('tiene el texto de ayuda y la ventana cerrada', () => {
    expect(input().placeholder).toBe(TEXTS.placeholder);
    expect(panel().hidden).toBe(true);
  });

  it('con menos de 3 caracteres no busca ni abre la ventana', async () => {
    await type('fe');
    expect(searchOwners).not.toHaveBeenCalled();
    expect(panel().hidden).toBe(true);
  });

  it('espera a que termine de escribir y busca una sola vez', async () => {
    for (const text of ['fer', 'fern', 'fernan']) {
      input().value = text;
      input().dispatchEvent(new Event('input'));
    }
    await vi.advanceTimersByTimeAsync(300);

    expect(searchOwners).toHaveBeenCalledTimes(1);
    expect(searchOwners).toHaveBeenCalledWith('fernan');
  });

  it('muestra encabezado, avatar con iniciales, nombre, documento y «Ver Detalles»', async () => {
    await type('fernan');

    expect(panel().hidden).toBe(false);
    expect(panel().querySelector('.search-heading').textContent).toBe(TEXTS.heading);
    expect(rows()).toHaveLength(2);
    expect(rows()[0].querySelector('.avatar').textContent).toBe('FF');
    expect(rows()[0].querySelector('.search-name').textContent).toBe('Fernando Fernández');
    expect(rows()[0].querySelector('.search-doc').textContent).toBe('1042389104');
    expect(rows()[0].querySelector('button').textContent).toBe('Ver Detalles');
  });

  it('«Ver Detalles» abre el propietario', async () => {
    await type('fernan');
    rows()[1].querySelector('button').click();
    expect(onOpen).toHaveBeenCalledWith('o2');
  });

  it('con más de 5 coincidencias muestra el aviso', async () => {
    searchOwners.mockResolvedValue({ owners: OWNERS, hasMore: true });
    await type('fernan');
    expect(panel().querySelector('.search-more').textContent).toBe(TEXTS.more);
  });

  it('sin resultados lo dice', async () => {
    searchOwners.mockResolvedValue({ owners: [], hasMore: false });
    await type('zzzz');
    expect(panel().textContent).toBe(TEXTS.empty);
  });

  it('si falla muestra el error y «Reintentar» repite la búsqueda', async () => {
    searchOwners.mockRejectedValueOnce({ status: 500 });
    await type('fernan');
    expect(panel().textContent).toContain(TEXTS.error);

    panel().querySelector('button').click();
    await vi.advanceTimersByTimeAsync(0);

    expect(searchOwners).toHaveBeenCalledTimes(2);
    expect(rows()).toHaveLength(2);
  });

  it('mientras busca muestra el esqueleto', async () => {
    searchOwners.mockReturnValue(new Promise(() => {}));
    await type('fernan');
    expect(panel().querySelector('[role="status"]')).not.toBeNull();
  });

  it('Esc, borrar el texto o hacer clic fuera cierran la ventana', async () => {
    await type('fernan');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel().hidden).toBe(true);

    await type('fernan');
    await type('');
    expect(panel().hidden).toBe(true);

    await type('fernan');
    document.body.click();
    expect(panel().hidden).toBe(true);
  });

  it('un clic dentro de la ventana no la cierra', async () => {
    await type('fernan');
    panel().click();
    expect(panel().hidden).toBe(false);
  });

  it('las flechas resaltan y Enter abre el resaltado', async () => {
    await type('fernan');
    const key = (name) =>
      input().dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));

    key('Enter');
    expect(onOpen).not.toHaveBeenCalled();

    key('ArrowDown');
    key('ArrowDown');
    expect(rows()[1].classList.contains('active')).toBe(true);
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    key('ArrowUp');
    expect(rows()[0].classList.contains('active')).toBe(true);

    key('Enter');
    expect(onOpen).toHaveBeenCalledWith('o1');
  });

  it('una respuesta vieja no pisa una búsqueda más nueva', async () => {
    let resolveFirst;
    searchOwners.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)));
    await type('fern');
    searchOwners.mockResolvedValueOnce({ owners: [OWNERS[1]], hasMore: false });
    await type('fernanda');

    resolveFirst({ owners: [OWNERS[0]], hasMore: false });
    await vi.advanceTimersByTimeAsync(0);

    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.search-name').textContent).toBe('Fernanda Ruiz');
  });
});
