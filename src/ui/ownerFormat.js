import { orDash } from './boatFormat.js';

/** Iniciales del avatar: primera letra de la primera y de la última palabra (una sola si hay una). */
export function ownerInitials(fullName) {
  const words = String(fullName ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  return (words.length === 1 ? first : first + words[words.length - 1][0]).toUpperCase();
}

/** Teléfono colombiano de 10 dígitos como "+57 310 456 7890"; otro formato se deja como llegó. */
export function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length !== 10) return orDash(phone);
  return `+57 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
