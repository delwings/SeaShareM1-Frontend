// Roles del sistema (los mismos valores que devuelve el backend) y la página de inicio de cada uno.
export const ROLES = { OWNER: 'OWNER', ADMIN: 'ADMIN' };

const HOME_BY_ROLE = {
  [ROLES.OWNER]: '/owner',
  [ROLES.ADMIN]: '/admin',
};

export function homePathFor(role) {
  return HOME_BY_ROLE[role] ?? '/login';
}
