import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/adminOwnerService.js', () => ({ searchOwners: vi.fn() }));
vi.mock('../services/adminFleetService.js', () => ({
  listFleet: vi.fn(),
  listFleetOwners: vi.fn(),
}));

import { listFleet, listFleetOwners } from '../services/adminFleetService.js';
import { adminHomePage } from './adminHome.js';

const BOATS = [
  {
    boat_id: 'b1',
    name: 'Río Magdalena I',
    owner: { owner_id: 'o1', full_name: 'Fernando Fernández', document_number: '1010000002' },
    legal_registration: 'CP-05-1042-A',
    type: 'MOTORBOAT',
    status: 'AVAILABLE',
  },
  {
    boat_id: 'b2',
    name: 'Atlántico Star',
    owner: { owner_id: 'o1', full_name: 'Fernando Fernández', document_number: '1010000002' },
    legal_registration: 'CP-12-0891-B',
    type: 'YACHT',
    status: 'MAINTENANCE',
  },
];
const OWNERS = [
  { owner_id: 'o1', full_name: 'Fernando Fernández', document_number: '1010000002' },
  { owner_id: 'o2', full_name: 'Mariana Gómez', document_number: '1010000003' },
];

let page;
let navigate;
const q = (selector) => page.querySelector(selector);

async function mount(boats = BOATS) {
  listFleet.mockResolvedValue(boats);
  listFleetOwners.mockResolvedValue(OWNERS);
  navigate = vi.fn();
  page = adminHomePage({ navigate });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.table-card').textContent).not.toMatch(/Cargando/));
}

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  page?.remove();
  vi.clearAllMocks();
});

describe('Control General de Flota Fluvial', () => {
  it('muestra el título, el subtítulo y las columnas del wireframe', async () => {
    await mount();

    expect(q('.page-title').textContent).toBe('Control General de Flota Fluvial');
    expect(q('.page-subtitle').textContent).toBe(
      'Listado completo de embarcaciones registradas en la plataforma a nivel global.',
    );
    expect([...page.querySelectorAll('th')].map((th) => th.textContent)).toEqual([
      'Embarcación',
      'Propietario',
      'Matrícula',
      'Tipo',
      'Estado operativo',
      'Acciones',
    ]);
  });

  it('lista cada embarcación con propietario, matrícula, tipo y estado', async () => {
    await mount();

    const rows = [...page.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].slice(0, 5).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['Río Magdalena I', 'Fernando Fernández', 'CP-05-1042-A', 'Lancha', 'Disponible'],
      ['Atlántico Star', 'Fernando Fernández', 'CP-12-0891-B', 'Yate', 'Mantenimiento'],
    ]);
  });

  it('"Ver Detalles" lleva al detalle del administrador', async () => {
    await mount();

    page.querySelector('tbody .btn').click();

    expect(navigate).toHaveBeenCalledWith('/admin/boats/b1');
  });

  it('carga los propietarios en el filtro y los cuatro estados', async () => {
    await mount();

    const [owner, status] = page.querySelectorAll('select');
    expect([...owner.options].map((o) => o.textContent)).toEqual([
      'Filtrar por Propietario...',
      'Fernando Fernández',
      'Mariana Gómez',
    ]);
    expect([...status.options].map((o) => o.textContent)).toEqual([
      'Estado: Todos',
      'Disponible',
      'Reservado',
      'En Navegación',
      'Mantenimiento',
    ]);
  });

  it('al elegir propietario o estado vuelve a consultar con el filtro', async () => {
    await mount();
    const [owner, status] = page.querySelectorAll('select');

    owner.value = 'o2';
    owner.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(listFleet).toHaveBeenLastCalledWith({ ownerId: 'o2', status: '' }),
    );

    status.value = 'MAINTENANCE';
    status.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(listFleet).toHaveBeenLastCalledWith({
        ownerId: 'o2',
        status: 'MAINTENANCE',
      }),
    );
  });

  it('escribir en la barra de propietarios no consulta ni cambia la tabla', async () => {
    await mount();
    listFleet.mockClear();
    const input = q('.filter-search');

    input.value = 'ma';
    input.dispatchEvent(new Event('input'));

    expect(input.placeholder).toBe('Buscar propietario por nombre o cédula...');
    expect(listFleet).not.toHaveBeenCalled();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('sin resultados con filtros dice que no se encontraron embarcaciones', async () => {
    await mount();
    listFleet.mockResolvedValue([]);
    const status = page.querySelectorAll('select')[1];

    status.value = 'RESERVED';
    status.dispatchEvent(new Event('change'));

    await vi.waitFor(() =>
      expect(q('.table-message').textContent).toBe(
        'No se encontraron embarcaciones con esos filtros',
      ),
    );
  });

  it('sin embarcaciones ni filtros lo indica', async () => {
    await mount([]);
    expect(q('.table-message').textContent).toBe(
      'Aún no hay embarcaciones registradas en la plataforma',
    );
  });

  it('si el listado falla muestra el error y "Reintentar" vuelve a consultar', async () => {
    listFleet.mockRejectedValueOnce({ status: 500, detail: 'Falló' });
    listFleetOwners.mockResolvedValue(OWNERS);
    page = adminHomePage({ navigate: vi.fn() });
    document.body.append(page);
    await vi.waitFor(() => expect(q('.table-message button')).not.toBeNull());
    listFleet.mockResolvedValue(BOATS);

    q('.table-message button').click();

    await vi.waitFor(() => expect(page.querySelectorAll('tbody tr')).toHaveLength(2));
  });

  it('si fallan los propietarios el listado sigue funcionando', async () => {
    listFleet.mockResolvedValue(BOATS);
    listFleetOwners.mockRejectedValue({ status: 500 });
    page = adminHomePage({ navigate: vi.fn() });
    document.body.append(page);

    await vi.waitFor(() => expect(page.querySelectorAll('tbody tr')).toHaveLength(2));
    expect(page.querySelectorAll('select')[0].options).toHaveLength(1);
  });
});
