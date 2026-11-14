import { listFleet, listFleetOwners } from '../services/adminFleetService.js';
import { createOwnerSearch } from '../components/ownerSearch.js';
import { STATUS, statusInfo, TYPE_NAMES } from '../ui/boatFormat.js';
import { el } from '../ui/dom.js';

const COLUMNS = ['Embarcación', 'Propietario', 'Matrícula', 'Tipo', 'Estado operativo', 'Acciones'];

function statusChip(status) {
  const info = statusInfo(status);
  return el(
    'span',
    { class: `chip chip-${info.tone}` },
    el('span', { class: 'chip-dot', 'aria-hidden': 'true' }),
    info.label,
  );
}

function fleetRow(boat, navigate) {
  return el(
    'tr',
    {},
    el('td', { class: 'cell-name', text: boat.name }),
    el('td', { class: 'cell-muted', text: boat.owner?.full_name ?? '—' }),
    el('td', { class: 'cell-muted', text: boat.legal_registration }),
    el('td', { class: 'cell-muted', text: TYPE_NAMES[boat.type] ?? boat.type }),
    el('td', {}, statusChip(boat.status)),
    el(
      'td',
      { class: 'cell-actions' },
      el('button', {
        type: 'button',
        class: 'btn btn-outline',
        text: 'Ver Detalles',
        onclick: () => navigate(`/admin/boats/${encodeURIComponent(boat.boat_id)}`),
      }),
    ),
  );
}

function fleetTable(boats, navigate) {
  return el(
    'table',
    { class: 'boats-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        COLUMNS.map((name) => el('th', { text: name })),
      ),
    ),
    el(
      'tbody',
      {},
      boats.map((boat) => fleetRow(boat, navigate)),
    ),
  );
}

/** Pantalla "Control General de Flota Fluvial" del Administrador (solo lectura). */
export function adminHomePage({ navigate }) {
  const card = el('section', { class: 'table-card' });
  const ownerSelect = el(
    'select',
    { class: 'filter-select', 'aria-label': 'Filtrar por propietario' },
    el('option', { value: '', text: 'Filtrar por Propietario...' }),
  );
  const statusSelect = el(
    'select',
    { class: 'filter-select', 'aria-label': 'Filtrar por estado' },
    el('option', { value: '', text: 'Estado: Todos' }),
    Object.entries(STATUS).map(([value, info]) => el('option', { value, text: info.label })),
  );
  const search = createOwnerSearch({
    onOpen: (ownerId) => navigate(`/admin/owners/${encodeURIComponent(ownerId)}`),
  });

  const page = el(
    'main',
    { class: 'page' },
    el(
      'div',
      { class: 'page-header' },
      el(
        'div',
        {},
        el('h1', { class: 'page-title', text: 'Control General de Flota Fluvial' }),
        el('p', {
          class: 'page-subtitle',
          text: 'Listado completo de embarcaciones registradas en la plataforma a nivel global.',
        }),
      ),
    ),
    el(
      'div',
      { class: 'filters' },
      el('div', { class: 'filters-selects' }, ownerSelect, statusSelect),
      el('div', { class: 'filter-search-box' }, search),
    ),
    card,
  );

  let attempt = 0;

  const filters = () => ({ ownerId: ownerSelect.value, status: statusSelect.value });
  const hasFilters = () => Object.values(filters()).some((value) => value.trim() !== '');

  async function load() {
    const mine = ++attempt;
    card.replaceChildren(el('p', { class: 'table-message', text: 'Cargando embarcaciones…' }));
    try {
      const boats = await listFleet(filters());
      if (mine !== attempt) return;
      card.replaceChildren(
        boats.length > 0
          ? fleetTable(boats, navigate)
          : el('p', {
              class: 'table-message',
              text: hasFilters()
                ? 'No se encontraron embarcaciones con esos filtros'
                : 'Aún no hay embarcaciones registradas en la plataforma',
            }),
      );
    } catch (error) {
      if (mine !== attempt || error.status === 401) return;
      card.replaceChildren(
        el(
          'div',
          { class: 'table-message' },
          el('p', { text: error.detail ?? 'No se pudo cargar el listado de embarcaciones.' }),
          el('button', {
            type: 'button',
            class: 'btn btn-secondary',
            text: 'Reintentar',
            onclick: load,
          }),
        ),
      );
    }
  }

  async function loadOwners() {
    try {
      const owners = await listFleetOwners();
      ownerSelect.append(
        ...owners.map((owner) => el('option', { value: owner.owner_id, text: owner.full_name })),
      );
    } catch {
      // Sin la lista de propietarios el listado sigue funcionando; el filtro queda sin opciones.
    }
  }

  ownerSelect.addEventListener('change', load);
  statusSelect.addEventListener('change', load);

  loadOwners();
  load();
  return page;
}
