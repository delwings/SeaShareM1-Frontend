import { describe, expect, it, vi } from 'vitest';
import { MAP_ERROR, createMapPicker } from './mapPicker.js';

describe('createMapPicker', () => {
  it('si no carga la librería muestra el error con "Reintentar"', async () => {
    const loadLibrary = vi.fn().mockRejectedValue(new Error('sin red'));
    const picker = createMapPicker({ onSelect: vi.fn(), loadLibrary });

    await vi.waitFor(() => expect(picker.element.querySelector('.map-error').hidden).toBe(false));

    expect(picker.element.querySelector('.map-error-text').textContent).toBe(MAP_ERROR);
    expect(picker.element.querySelector('.map-error button').textContent).toBe('Reintentar');
  });

  it('"Reintentar" vuelve a pedir la librería', async () => {
    const loadLibrary = vi.fn().mockRejectedValue(new Error('sin red'));
    const picker = createMapPicker({ onSelect: vi.fn(), loadLibrary });
    await vi.waitFor(() => expect(loadLibrary).toHaveBeenCalledTimes(1));

    picker.element.querySelector('.map-error button').click();

    await vi.waitFor(() => expect(loadLibrary).toHaveBeenCalledTimes(2));
  });

  it('centra el mapa en Santa Marta (zoom 12) y reporta el punto redondeado', async () => {
    const handlers = {};
    const marker = { setLatLng: vi.fn(), on: vi.fn(), addTo: vi.fn(() => marker) };
    const map = {
      setView: vi.fn(() => map),
      on: vi.fn((name, handler) => {
        handlers[name] = handler;
      }),
      invalidateSize: vi.fn(),
      remove: vi.fn(),
    };
    const layer = { addTo: vi.fn(() => layer), on: vi.fn() };
    const L = {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => layer),
      marker: vi.fn(() => marker),
      divIcon: vi.fn(() => ({})),
    };
    const onSelect = vi.fn();
    createMapPicker({ onSelect, loadLibrary: () => Promise.resolve(L) });
    await vi.waitFor(() => expect(map.setView).toHaveBeenCalled());

    expect(map.setView).toHaveBeenCalledWith([11.2408, -74.199], 12);
    const latlng = {
      lat: 10.123456,
      lng: -75.987654,
      wrap() {
        return this;
      },
    };
    handlers.click({ latlng });

    expect(onSelect).toHaveBeenCalledWith({ latitude: 10.1235, longitude: -75.9877 });
    expect(L.marker).toHaveBeenCalledWith(latlng, expect.objectContaining({ draggable: true }));
  });

  function fakeLeaflet() {
    const handlers = {};
    const marker = { setLatLng: vi.fn(), on: vi.fn(), addTo: vi.fn(() => marker) };
    const map = {
      setView: vi.fn(() => map),
      on: vi.fn((name, handler) => {
        handlers[name] = handler;
      }),
      invalidateSize: vi.fn(),
      remove: vi.fn(),
    };
    const layer = { addTo: vi.fn(() => layer), on: vi.fn() };
    const L = {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => layer),
      marker: vi.fn(() => marker),
      divIcon: vi.fn(() => ({})),
    };
    return { L, map, marker, handlers };
  }

  it('con un punto inicial abre centrado en él (zoom 15) y con el marcador puesto', async () => {
    const { L, map } = fakeLeaflet();
    createMapPicker({
      onSelect: vi.fn(),
      loadLibrary: () => Promise.resolve(L),
      initialPoint: { latitude: 10.7452, longitude: -74.7891 },
    });
    await vi.waitFor(() => expect(map.setView).toHaveBeenCalled());

    expect(map.setView).toHaveBeenCalledWith([10.7452, -74.7891], 15);
    expect(L.marker).toHaveBeenCalledWith([10.7452, -74.7891], expect.anything());
  });

  it('normaliza la longitud fuera de rango (190 → -170) con wrap', async () => {
    const { L, map, handlers } = fakeLeaflet();
    const onSelect = vi.fn();
    createMapPicker({ onSelect, loadLibrary: () => Promise.resolve(L) });
    await vi.waitFor(() => expect(map.setView).toHaveBeenCalled());

    const latlng = { lat: 10, lng: 190, wrap: () => ({ lat: 10, lng: -170 }) };
    handlers.click({ latlng });

    expect(onSelect).toHaveBeenCalledWith({ latitude: 10, longitude: -170 });
  });

  it('un punto no numérico llama a onInvalid y no a onSelect', async () => {
    const { L, map, handlers } = fakeLeaflet();
    const onSelect = vi.fn();
    const onInvalid = vi.fn();
    createMapPicker({ onSelect, onInvalid, loadLibrary: () => Promise.resolve(L) });
    await vi.waitFor(() => expect(map.setView).toHaveBeenCalled());

    handlers.click({ latlng: { wrap: () => ({ lat: NaN, lng: 1 }) } });

    expect(onInvalid).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('usa el mensaje de error que se le pida', async () => {
    const picker = createMapPicker({
      onSelect: vi.fn(),
      loadLibrary: vi.fn().mockRejectedValue(new Error('sin red')),
      errorMessage: 'No se pudo cargar el mapa interactivo en este momento.',
    });

    expect(picker.element.querySelector('.map-error-text').textContent).toBe(
      'No se pudo cargar el mapa interactivo en este momento.',
    );
  });
});
