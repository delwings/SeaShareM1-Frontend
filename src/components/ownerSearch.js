import { searchOwners } from '../services/adminOwnerService.js';
import { ownerInitials } from '../ui/ownerFormat.js';
import { el } from '../ui/dom.js';

export const MIN_CHARS = 3;
export const SEARCH_DELAY_MS = 300;
export const TEXTS = {
  placeholder: 'Buscar propietario por nombre o cédula...',
  heading: 'RESULTADOS DE BÚSQUEDA (PROPIETARIO)',
  empty: 'No se encontraron propietarios con esa búsqueda.',
  more: 'Hay más resultados. Escribe más caracteres para precisar la búsqueda.',
  error: 'No se pudo realizar la búsqueda',
};

/**
 * Barra "Buscar propietario por nombre o cédula..." con su ventana de resultados. No toca la
 * tabla. Busca desde 3 caracteres; se cierra con Esc, al hacer clic fuera o al borrar el texto;
 * las flechas recorren los resultados y Enter abre el resaltado. onOpen(ownerId) abre la pantalla.
 */
export function createOwnerSearch({ onOpen }) {
  const input = el('input', {
    type: 'text',
    class: 'filter-search',
    placeholder: TEXTS.placeholder,
    'aria-label': 'Buscar propietario por nombre o cédula',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': 'owner-search-panel',
    autocomplete: 'off',
    maxlength: '100',
  });
  const panel = el('div', {
    class: 'search-panel',
    id: 'owner-search-panel',
    role: 'listbox',
    'aria-live': 'polite',
  });
  panel.hidden = true;
  const root = el('div', { class: 'owner-search' }, input, panel);

  let timer = null;
  let attempt = 0;
  let rows = [];
  let found = [];
  let active = -1;

  function open() {
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    clearTimeout(timer);
    attempt += 1;
    panel.hidden = true;
    panel.replaceChildren();
    rows = [];
    found = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function highlight(index) {
    active = index;
    rows.forEach((row, i) => {
      row.classList.toggle('active', i === index);
      row.setAttribute('aria-selected', String(i === index));
    });
    if (index >= 0) input.setAttribute('aria-activedescendant', rows[index].id);
    else input.removeAttribute('aria-activedescendant');
  }

  const heading = () => el('p', { class: 'search-heading', text: TEXTS.heading });

  function showLoading() {
    open();
    panel.replaceChildren(
      heading(),
      el(
        'div',
        { role: 'status', 'aria-label': 'Buscando propietarios' },
        [1, 2].map(() => el('div', { class: 'skeleton search-skeleton' })),
      ),
    );
  }

  function showResult({ owners, hasMore }) {
    rows = owners.map((owner, index) =>
      el(
        'div',
        {
          class: 'search-row',
          role: 'option',
          id: `owner-option-${index}`,
          'aria-selected': 'false',
        },
        el('span', {
          class: 'avatar search-avatar',
          'aria-hidden': 'true',
          text: ownerInitials(owner.full_name),
        }),
        el(
          'span',
          { class: 'search-person' },
          el('span', { class: 'search-name', text: owner.full_name }),
          el('span', { class: 'search-doc', text: owner.document_number }),
        ),
        el('button', {
          type: 'button',
          class: 'btn btn-primary search-open',
          text: 'Ver Detalles',
          onclick: () => onOpen(owner.owner_id),
        }),
      ),
    );
    found = owners;
    active = -1;
    if (owners.length === 0) {
      panel.replaceChildren(el('p', { class: 'search-message', text: TEXTS.empty }));
    } else {
      panel.replaceChildren(
        heading(),
        ...rows,
        hasMore ? el('p', { class: 'search-more', text: TEXTS.more }) : null,
      );
    }
  }

  function showError(retry) {
    rows = [];
    panel.replaceChildren(
      el(
        'div',
        { class: 'search-message' },
        el('p', { text: TEXTS.error }),
        el('button', {
          type: 'button',
          class: 'btn btn-secondary',
          text: 'Reintentar',
          onclick: retry,
        }),
      ),
    );
  }

  async function run() {
    const text = input.value.trim();
    const mine = ++attempt;
    showLoading();
    try {
      const result = await searchOwners(text);
      if (mine === attempt) showResult(result);
    } catch (error) {
      if (mine !== attempt || error.status === 401) return;
      showError(run);
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (input.value.trim().length < MIN_CHARS) {
      close();
      return;
    }
    timer = setTimeout(run, SEARCH_DELAY_MS);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown' && rows.length > 0) {
      event.preventDefault();
      highlight((active + 1) % rows.length);
    } else if (event.key === 'ArrowUp' && rows.length > 0) {
      event.preventDefault();
      highlight(active <= 0 ? rows.length - 1 : active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      onOpen(found[active].owner_id);
    }
  });

  document.addEventListener('click', function onOutside(event) {
    if (!root.isConnected) {
      document.removeEventListener('click', onOutside);
    } else if (!event.composedPath().includes(root) && !panel.hidden) {
      close();
    }
  });

  return root;
}
