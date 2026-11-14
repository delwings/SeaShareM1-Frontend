import { describe, expect, it } from 'vitest';
import {
  MESSAGES,
  capacityError,
  legalRegistrationFormatError,
  nameError,
  normalizeName,
  photoError,
  portNameError,
  rateError,
  roundCoordinate,
} from './registrationRules.js';

function fileWith(bytes, size = bytes.length) {
  const file = new File([new Uint8Array(bytes)], 'foto.bin');
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('nameError', () => {
  it.each(['Río Magdalena II', 'Peñón del Norte', 'Río Magdalena 2', 'Ab-1'])(
    'acepta %s',
    (value) => expect(nameError(value)).toBeNull(),
  );

  it.each(['', '   '])('pide el campo cuando está vacío (%j)', (value) =>
    expect(nameError(value)).toBe(MESSAGES.required),
  );

  it.each(['ab', 'a'.repeat(51), '123', '---', 'Río_Magdalena', 'Barco!'])('rechaza %s', (value) =>
    expect(nameError(value)).toBe(MESSAGES.nameInvalid),
  );

  it('ignora los espacios sobrantes al contar', () => {
    expect(nameError('  abc  ')).toBeNull();
    expect(nameError(`  ${'a'.repeat(50)}  `)).toBeNull();
  });

  it('el puerto usa su propio mensaje', () => {
    expect(portNameError('x')).toBe(MESSAGES.portNameInvalid);
  });
});

describe('legalRegistrationFormatError', () => {
  it('acepta el formato CP-NN-NNNN-L', () => {
    expect(legalRegistrationFormatError(' CP-05-1042-A ')).toBeNull();
  });

  it.each(['CP-5-1042-A', 'cp-05-1042-a', 'CP-05-1042-AB', 'CP-05-104-A'])('rechaza %s', (value) =>
    expect(legalRegistrationFormatError(value)).toBe(MESSAGES.legalFormat),
  );

  it('pide el campo vacío', () => {
    expect(legalRegistrationFormatError('')).toBe(MESSAGES.required);
  });
});

describe('capacityError', () => {
  it('acepta un entero dentro del máximo y ceros a la izquierda', () => {
    expect(capacityError('10', 10)).toBeNull();
    expect(capacityError('007', 10)).toBeNull();
  });

  it('separa letras de puntuación', () => {
    expect(capacityError('1a')).toBe(MESSAGES.notNumeric);
    expect(capacityError('1.5')).toBe(MESSAGES.noDecimals);
    expect(capacityError('1,5')).toBe(MESSAGES.noDecimals);
    expect(capacityError('-3')).toBe(MESSAGES.noDecimals);
  });

  it('rechaza el cero, el exceso y el vacío', () => {
    expect(capacityError('0')).toBe(MESSAGES.capacityPositive);
    expect(capacityError('11', 10)).toBe(MESSAGES.capacityExceeded);
    expect(capacityError('')).toBe(MESSAGES.required);
  });

  it('sin tipo no compara con ningún máximo', () => {
    expect(capacityError('500')).toBeNull();
  });
});

describe('rateError', () => {
  it('acepta hasta 9.999.999.999', () => {
    expect(rateError('180000')).toBeNull();
    expect(rateError('9999999999')).toBeNull();
    expect(rateError('0180000')).toBeNull();
  });

  it('rechaza lo que pide el spec', () => {
    expect(rateError('')).toBe(MESSAGES.required);
    expect(rateError('0')).toBe(MESSAGES.ratePositive);
    expect(rateError('10000000000')).toBe(MESSAGES.rateTooHigh);
    expect(rateError('12a')).toBe(MESSAGES.notNumeric);
    expect(rateError('1.5')).toBe(MESSAGES.noDecimals);
  });
});

describe('roundCoordinate', () => {
  it('redondea a 4 decimales conservando el signo', () => {
    expect(roundCoordinate(11.240849)).toBe(11.2408);
    expect(roundCoordinate(-74.19905)).toBe(-74.1991);
    expect(roundCoordinate(-74.19904)).toBe(-74.199);
  });
});

describe('photoError', () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const jpeg = [0xff, 0xd8, 0xff, 0xe0];

  it('acepta PNG y JPEG reales', async () => {
    expect(await photoError(fileWith(png))).toBeNull();
    expect(await photoError(fileWith(jpeg))).toBeNull();
  });

  it('rechaza un archivo que no es imagen aunque se llame foto.png', async () => {
    expect(await photoError(fileWith([0x25, 0x50, 0x44, 0x46]))).toBe(MESSAGES.imageFormat);
  });

  it('rechaza el exceso de peso (10 MiB exactos sí se aceptan)', async () => {
    expect(await photoError(fileWith(png, 10 * 1024 * 1024))).toBeNull();
    expect(await photoError(fileWith(png, 10 * 1024 * 1024 + 1))).toBe(MESSAGES.imageTooLarge);
  });

  it('el formato se revisa antes que el tamaño', async () => {
    expect(await photoError(fileWith([1, 2, 3], 20 * 1024 * 1024))).toBe(MESSAGES.imageFormat);
  });
});

describe('normalizeName', () => {
  it('quita extremos, colapsa espacios repetidos y convierte espacios no estándar', () => {
    expect(normalizeName('  Río \t  Magdalena\u00A0\u00A0II  ')).toBe('Río Magdalena II');
    expect(normalizeName('Ri\u0301o')).toBe('Río');
    expect(normalizeName(null)).toBe('');
  });
});
