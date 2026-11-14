// Reglas de validación del registro de embarcaciones. Son las mismas del backend (la fuente de la
// verdad es el spec "Registrar Embarcación"); aquí sirven para avisar al instante, y el backend
// vuelve a validar todo.

export const MESSAGES = {
  required: 'Este campo es obligatorio para continuar con el registro',
  editRequired: 'Este campo es obligatorio',
  nameInvalid:
    'El nombre debe tener entre 3 y 50 caracteres, contener al menos una letra y solo puede incluir letras, números, espacios, tildes y guiones',
  portNameInvalid:
    'El nombre del puerto debe tener entre 3 y 50 caracteres, contener al menos una letra y solo puede incluir letras, números, espacios, tildes y guiones',
  legalFormat: 'Formato de matrícula legal inválido',
  legalTaken: 'Matrícula existente en el sistema',
  notNumeric: 'Solo se aceptan valores numéricos',
  noDecimals: 'Ingrese un número entero sin puntos ni comas',
  capacityPositive: 'Ingrese un número entero mayor que 0',
  capacityExceeded: 'Este valor excede la capacidad máxima de la embarcación',
  ratePositive: 'La tarifa debe ser mayor que 0',
  rateTooHigh: 'La tarifa excede el valor permitido',
  coordinatesRequired: 'Las coordenadas son obligatorias',
  imageFormat: 'Formato de imagen inválido',
  imageTooLarge: 'El tamaño de imagen se excede',
};

export const MAX_RATE = 9_999_999_999;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Quita los espacios sobrantes y unifica las tildes (igual que el backend). */
export function normalize(text) {
  return (text ?? '').normalize('NFC').trim();
}

/**
 * Normalización de nombres (embarcación y puerto): quita los espacios de los extremos, convierte
 * tabulaciones y espacios no estándar en un espacio simple y colapsa los repetidos.
 */
export function normalizeName(text) {
  return (text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Valida un nombre (de embarcación o de puerto). Devuelve el mensaje de error o null. */
export function nameError(value, invalidMessage = MESSAGES.nameInvalid) {
  const text = normalize(value);
  if (!text) return MESSAGES.required;
  const validCharacters = /^[\p{L}\p{N} -]+$/u.test(text);
  const hasLetter = /\p{L}/u.test(text);
  if (text.length < 3 || text.length > 50 || !validCharacters || !hasLetter) return invalidMessage;
  return null;
}

export function portNameError(value) {
  return nameError(value, MESSAGES.portNameInvalid);
}

export function legalRegistrationFormatError(value) {
  const text = normalize(value);
  if (!text) return MESSAGES.required;
  return /^CP-\d{2}-\d{4}-[A-Z]$/.test(text) ? null : MESSAGES.legalFormat;
}

/** Mensaje para el primer carácter que no es un dígito, o null si todo son dígitos. */
function nonDigitMessage(text) {
  const bad = [...text].find((character) => !/\d/.test(character));
  if (bad === undefined) return null;
  return /[.,+-]/.test(bad) ? MESSAGES.noDecimals : MESSAGES.notNumeric;
}

/** Capacidad: entero mayor que 0 que no supere el máximo del tipo (si ya hay tipo elegido). */
export function capacityError(value, maxCapacity = null) {
  const text = (value ?? '').trim();
  if (!text) return MESSAGES.required;
  const problem = nonDigitMessage(text);
  if (problem) return problem;
  const digits = text.replace(/^0+/, '');
  if (digits === '') return MESSAGES.capacityPositive;
  if (maxCapacity !== null && Number(digits) > maxCapacity) return MESSAGES.capacityExceeded;
  return null;
}

/** Tarifa base: entero mayor que 0 y hasta 9.999.999.999. */
export function rateError(value) {
  const text = (value ?? '').trim();
  if (!text) return MESSAGES.required;
  const problem = nonDigitMessage(text);
  if (problem) return problem;
  const digits = text.replace(/^0+/, '');
  if (digits === '') return MESSAGES.ratePositive;
  if (digits.length > 10 || Number(digits) > MAX_RATE) return MESSAGES.rateTooHigh;
  return null;
}

/** Redondea una coordenada a 4 decimales (la mitad se aleja del cero, como en el backend). */
export function roundCoordinate(value) {
  return (Math.sign(value) * Math.round(Math.abs(value) * 10_000)) / 10_000;
}

function startsWith(bytes, signature) {
  return signature.every((byte, index) => bytes[index] === byte);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

/** Valida la foto por su contenido (no solo la extensión) y su peso. Devuelve el error o null. */
export async function photoError(file) {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!startsWith(header, PNG) && !startsWith(header, JPEG)) return MESSAGES.imageFormat;
  return file.size > MAX_IMAGE_BYTES ? MESSAGES.imageTooLarge : null;
}
