import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/fleetService.js', () => ({
  listBoats: vi.fn(),
  getDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

import { deleteDraft, getDraft, listBoats } from '../services/fleetService.js';
import { getCurrentDraft } from '../state/registrationFlow.js';
import { closeAllModals } from '../ui/modal.js';
import { ownerHomePage } from './ownerHome.js';

const BOATS = [
  {
    boat_id: '1',
    name: 'Río Magdalena I',
    legal_registration: 'CP-05-1042-A',
    type: 'MOTORBOAT',
    status: 'AVAILABLE',
    is_new: true,
  },
  {
    boat_id: '2',
    name: 'Atlántico Star',
    legal_registration: 'CP-12-0891-B',
    type: 'YACHT',
    status: 'MAINTENANCE',
    is_new: false,
  },
  {
    boat_id: '3',
    name: 'Brisa del Norte',
    legal_registration: 'CP-01-0332-C',
    type: 'CATAMARAN',
    status: 'AVAILABLE',
    is_new: false,
  },
];
const DRAFT = { boat_id: 'd1', name: 'Río Magdalena II' };

let page;
let navigate;
const q = (selector) => page.querySelector(selector);
const modalTitle = () => document.querySelector('.modal-title')?.textContent;
const modalButton = (label) =>
  [...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent === label);

async function mount(boats = BOATS) {
  listBoats.mockResolvedValue(boats);
  navigate = vi.fn();
  page = ownerHomePage({ navigate });
  document.body.append(page);
  await vi.waitFor(() => expect(q('.table-card').textContent).not.toContain('Cargando'));
}

afterEach(() => {
  page?.remove();
  closeAllModals();
  vi.clearAllMocks();
});

describe('Lista "Mis Embarcaciones Registradas"', () => {
  it('muestra título, subtítulo, columnas, filas, tipos, estados y la etiqueta NUEVA', async () => {
    await mount();

    expect(q('.page-title').textContent).toBe('Mis Embarcaciones Registradas');
    expect(q('.page-subtitle').textContent).toBe(
      'Gestiona el estado operativo y consulta los detalles de tus vehículos fluviales',
    );
    expect([...page.querySelectorAll('th')].map((th) => th.textContent)).toEqual([
      'Nombre de la embarcación',
      'Matrícula',
      'Tipo',
      'Estado operativo',
      'Acciones',
    ]);
    const rows = [...page.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('NUEVA');
    expect(rows[0].textContent).toContain('Lancha');
    expect(rows[0].textContent).toContain('Disponible');
    expect(rows[1].textContent).toContain('Mantenimiento');
    expect(rows[2].textContent).toContain('Catamarán');
    expect(page.querySelectorAll('.badge-new')).toHaveLength(1);
    expect(rows[0].querySelector('button').textContent).toBe('Ver Detalles');
  });

  it('sin embarcaciones muestra el mensaje y deja el botón de registro', async () => {
    await mount([]);

    expect(q('.table-card').textContent).toBe('Aún no tienes embarcaciones registradas');
    expect(q('.page-header .btn-primary').textContent).toContain('Registrar Nueva Embarcación');
  });

  it('si falla la carga ofrece Reintentar', async () => {
    listBoats.mockRejectedValueOnce({ detail: 'Sin conexión' });
    navigate = vi.fn();
    page = ownerHomePage({ navigate });
    document.body.append(page);
    await vi.waitFor(() => expect(q('.table-card button')?.textContent).toBe('Reintentar'));

    listBoats.mockResolvedValue(BOATS);
    q('.table-card button').click();

    await vi.waitFor(() => expect(page.querySelectorAll('tbody tr')).toHaveLength(3));
  });

  it('sin borrador, "Registrar Nueva Embarcación" va al paso 1', async () => {
    getDraft.mockResolvedValue(null);
    await mount();

    q('.page-header .btn-primary').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new'));
  });
});

describe('Borrador detectado', () => {
  async function openDraftModal() {
    getDraft.mockResolvedValue(DRAFT);
    await mount();
    q('.page-header .btn-primary').click();
    await vi.waitFor(() => expect(modalTitle()).toBe('Borrador detectado'));
  }

  it('muestra el nombre del borrador y los botones del spec', async () => {
    await openDraftModal();

    expect(document.querySelector('.modal-text').textContent).toBe(
      'Tienes un registro incompleto guardado bajo el nombre:',
    );
    expect(document.querySelector('.draft-name').textContent).toBe('"Río Magdalena II"');
    expect(document.querySelector('.modal-question').textContent).toBe('¿Cómo deseas continuar?');
    expect(modalButton('Empezar un registro nuevo')).toBeDefined();
    expect(modalButton('Continuar registro pendiente')).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('la X cierra el modal y conserva el borrador', async () => {
    await openDraftModal();

    document.querySelector('.modal-close').click();

    expect(document.querySelector('.modal')).toBeNull();
    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it('"Continuar registro pendiente" lleva al paso 2 con el borrador', async () => {
    await openDraftModal();

    modalButton('Continuar registro pendiente').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new/details'));
    expect(getCurrentDraft()).toEqual(DRAFT);
  });

  it('si falla cargar el borrador muestra el error y "Cerrar" regresa al modal anterior', async () => {
    await openDraftModal();
    getDraft.mockRejectedValue({ status: 0 });

    modalButton('Continuar registro pendiente').click();

    await vi.waitFor(() => expect(modalTitle()).toBe('No se pudo cargar el registro pendiente'));
    modalButton('Cerrar').click();
    expect(modalTitle()).toBe('Borrador detectado');
  });

  it('"Empezar un registro nuevo" advierte y "Regresar" vuelve sin borrar', async () => {
    await openDraftModal();

    modalButton('Empezar un registro nuevo').click();
    expect(modalTitle()).toBe('¿Iniciar nuevo registro?');
    expect(document.querySelector('.highlight').textContent).toBe(
      'se eliminará de forma permanente',
    );

    modalButton('Regresar').click();

    expect(modalTitle()).toBe('Borrador detectado');
    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it('"Sí, eliminar y empezar" borra el borrador y abre el paso 1', async () => {
    deleteDraft.mockResolvedValue(null);
    await openDraftModal();
    modalButton('Empezar un registro nuevo').click();

    modalButton('Sí, eliminar y empezar').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new'));
    expect(deleteDraft).toHaveBeenCalled();
  });

  it('si falla la eliminación conserva el borrador y permite reintentar', async () => {
    deleteDraft.mockRejectedValueOnce({ status: 0 });
    deleteDraft.mockResolvedValueOnce(null);
    await openDraftModal();
    modalButton('Empezar un registro nuevo').click();

    modalButton('Sí, eliminar y empezar').click();
    await vi.waitFor(() => expect(modalTitle()).toBe('No se pudo eliminar el borrador'));
    expect(navigate).not.toHaveBeenCalled();

    modalButton('Reintentar').click();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner/boats/new'));
  });
});

describe('Ver Detalles', () => {
  it('lleva a los detalles de la embarcación de esa fila', async () => {
    await mount();

    [...page.querySelectorAll('tbody tr')][1].querySelector('button').click();

    expect(navigate).toHaveBeenCalledWith('/owner/boats/2');
  });
});
