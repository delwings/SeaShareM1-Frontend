// Nombres y formatos de la embarcación. Son los mismos en la lista y en "Ver Detalles" (NFR-006).

/** Diccionario único de estados operativos. */
export const STATUS = {
  AVAILABLE: { label: 'Disponible', tone: 'green' },
  RESERVED: { label: 'Reservado', tone: 'blue' },
  NAVIGATION: { label: 'En Navegación', tone: 'blue' },
  MAINTENANCE: { label: 'Mantenimiento', tone: 'amber' },
};

export const TYPE_NAMES = {
  MOTORBOAT: 'Lancha',
  YACHT: 'Yate',
  CATAMARAN: 'Catamarán',
  SAILBOAT: 'Velero',
};

export const EMPTY_VALUE = '—';

export function statusInfo(status) {
  return STATUS[status] ?? { label: status, tone: 'blue' };
}

/** Tarifa entera en COP con puntos de miles y sin decimales: "180000.00" → "$ 180.000". */
export function formatRate(value) {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const integer = String(value).split('.')[0];
  if (!/^\d+$/.test(integer)) return EMPTY_VALUE;
  return `$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Coordenada con signo (si es negativa) y siempre 4 decimales: "10.745" → "10.7450". */
export function formatCoordinate(value) {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : EMPTY_VALUE;
}

/** Capacidad con su unidad: 12 → "12 pasajeros", 1 → "1 pasajero". */
export function formatCapacity(value) {
  if (!Number.isInteger(value)) return EMPTY_VALUE;
  return value === 1 ? '1 pasajero' : `${value} pasajeros`;
}

/** Texto del dato o "—" si llegó vacío. */
export function orDash(value) {
  return value === null || value === undefined || value === '' ? EMPTY_VALUE : value;
}
