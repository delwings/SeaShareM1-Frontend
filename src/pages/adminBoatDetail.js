import { startDeleteBoat } from '../components/deleteBoatFlow.js';
import { startMaintenanceFlow } from '../components/maintenanceFlow.js';
import { deleteAdminBoat, getAdminBoat } from '../services/adminFleetService.js';
import { createBoatDetailPage } from './boatDetail.js';

/**
 * "Ver Detalles" del Administrador: la misma pantalla del propietario, sin "Editar". "Eliminar" y
 * "Enviar a Mantenimiento" piden un motivo obligatorio que verá el propietario. "Terminar
 * Mantenimiento" solo se habilita si el mantenimiento lo inició el administrador.
 */
export const adminBoatDetailPage = createBoatDetailPage({
  loadBoat: (boatId) => getAdminBoat(boatId),
  backPath: '/admin',
  errorBackLabel: 'Volver',
  servicesSubtitle:
    'Servicios base obligatorios y equipamiento adicional configurado por el propietario',
  finishLabel: 'Terminar Mantenimiento',
  // El administrador solo termina el mantenimiento que él mismo inició.
  canFinishMaintenance: (boat) => boat.maintenance_by === 'ADMIN',
  actions: (boat, { navigate, load, showBoat }) => ({
    onMaintenance: () =>
      startMaintenanceFlow({
        mode: boat.status === 'MAINTENANCE' ? 'finish' : 'start',
        boat,
        onChanged: showBoat,
        reload: load,
        navigate,
        admin: true,
      }),
    onDelete: () =>
      startDeleteBoat({
        boat,
        navigate,
        reload: load,
        remove: deleteAdminBoat,
        listPath: '/admin',
        askReason: true,
      }),
  }),
});
