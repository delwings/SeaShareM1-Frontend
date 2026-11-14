import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/authService.js', () => ({ login: vi.fn() }));

import { login } from '../services/authService.js';
import { loginPage } from './login.js';

function fill(page, documentNumber, password) {
  page.querySelector('[name=document_number]').value = documentNumber;
  page.querySelector('[name=password]').value = password;
  page.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
}

afterEach(() => vi.clearAllMocks());

describe('loginPage', () => {
  it('rechaza un documento con letras sin llamar al backend', () => {
    const page = loginPage({ navigate: vi.fn() });
    fill(page, 'abc', 'x');
    expect(login).not.toHaveBeenCalled();
    expect(page.querySelector('.form-error').textContent).toContain('solo dígitos');
  });

  it('con credenciales correctas va al inicio del rol', async () => {
    login.mockResolvedValue({ user: { role: 'OWNER' } });
    const navigate = vi.fn();
    const page = loginPage({ navigate });

    fill(page, '1010000002', 'SeaShare2026!');
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/owner'));

    expect(login).toHaveBeenCalledWith('1010000002', 'SeaShare2026!');
  });

  it('muestra el mensaje del backend cuando falla', async () => {
    login.mockRejectedValue({ detail: 'Número de documento o contraseña incorrectos.' });
    const page = loginPage({ navigate: vi.fn() });

    fill(page, '1010000002', 'mala');

    await vi.waitFor(() =>
      expect(page.querySelector('.form-error').textContent).toBe(
        'Número de documento o contraseña incorrectos.',
      ),
    );
  });
});
