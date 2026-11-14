import { describe, expect, it } from 'vitest';
import { formatPhone, ownerInitials } from './ownerFormat.js';

describe('ownerInitials', () => {
  it.each([
    ['Fernando Fernández', 'FF'],
    ['Laura Gómez Restrepo', 'LR'],
    ['  maría   fernanda   ospina ', 'MO'],
    ['Madonna', 'M'],
    ['', '?'],
    [null, '?'],
  ])('%s -> %s', (name, expected) => expect(ownerInitials(name)).toBe(expected));
});

describe('formatPhone', () => {
  it('da formato +57 a 10 dígitos', () => {
    expect(formatPhone('3104567890')).toBe('+57 310 456 7890');
    expect(formatPhone('310 456-7890')).toBe('+57 310 456 7890');
  });

  it('deja otro formato como llegó y vacío como «—»', () => {
    expect(formatPhone('12345')).toBe('12345');
    expect(formatPhone('')).toBe('—');
    expect(formatPhone(null)).toBe('—');
  });
});
