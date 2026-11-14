import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  formatCapacity,
  formatCoordinate,
  formatRate,
  orDash,
  statusInfo,
} from './boatFormat.js';

describe('formatRate', () => {
  it.each([
    ['950.00', '$ 950'],
    ['180000.00', '$ 180.000'],
    ['1500000.00', '$ 1.500.000'],
    ['99999999.00', '$ 99.999.999'],
    ['9999999999.00', '$ 9.999.999.999'],
    ['180000', '$ 180.000'],
  ])('%s se ve como %s', (value, expected) => {
    expect(formatRate(value)).toBe(expected);
  });

  it('un valor vacío o inválido se ve como guion', () => {
    expect(formatRate(null)).toBe(EMPTY_VALUE);
    expect(formatRate('')).toBe(EMPTY_VALUE);
    expect(formatRate('abc')).toBe(EMPTY_VALUE);
  });
});

describe('formatCoordinate', () => {
  it.each([
    ['10.745', '10.7450'],
    ['11', '11.0000'],
    ['-74.7891', '-74.7891'],
    ['-74.78914', '-74.7891'],
  ])('%s se ve como %s', (value, expected) => {
    expect(formatCoordinate(value)).toBe(expected);
  });

  it('un valor vacío se ve como guion', () => {
    expect(formatCoordinate(undefined)).toBe(EMPTY_VALUE);
  });
});

describe('formatCapacity', () => {
  it('usa singular y plural', () => {
    expect(formatCapacity(1)).toBe('1 pasajero');
    expect(formatCapacity(12)).toBe('12 pasajeros');
  });

  it('un valor vacío se ve como guion', () => {
    expect(formatCapacity(null)).toBe(EMPTY_VALUE);
  });
});

describe('estados y datos vacíos', () => {
  it('los nombres de estado son los del diccionario único', () => {
    expect(statusInfo('AVAILABLE').label).toBe('Disponible');
    expect(statusInfo('RESERVED').label).toBe('Reservado');
    expect(statusInfo('NAVIGATION').label).toBe('En Navegación');
    expect(statusInfo('MAINTENANCE').label).toBe('Mantenimiento');
  });

  it('orDash reemplaza solo lo vacío', () => {
    expect(orDash('CP-05-1042-A')).toBe('CP-05-1042-A');
    expect(orDash('')).toBe(EMPTY_VALUE);
    expect(orDash(null)).toBe(EMPTY_VALUE);
  });
});
