import { el } from '../ui/dom.js';
import { roundCoordinate } from '../validation/registrationRules.js';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_BASE = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${LEAFLET_VERSION}`;
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Vista inicial del mapa: Santa Marta, zoom 12. */
export const INITIAL_VIEW = { center: [11.2408, -74.199], zoom: 12 };

export const MAP_ERROR =
  'No se pudo cargar el mapa. Verifique su conexión a internet e inténtelo nuevamente.';

let loading = null;

/** Descarga Leaflet (mapa) la primera vez que se necesita. */
function loadLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      document.head.append(el('link', { rel: 'stylesheet', href: `${LEAFLET_BASE}/leaflet.css` }));
      const script = el('script', { src: `${LEAFLET_BASE}/leaflet.js` });
      script.addEventListener('load', () => resolve(globalThis.L));
      script.addEventListener('error', () => {
        loading = null;
        reject(new Error('No se pudo cargar Leaflet'));
      });
      document.head.append(script);
    });
  }
  return loading;
}

/** Zoom con el que abre el mapa cuando ya hay un punto guardado (edición). */
export const SAVED_POINT_ZOOM = 15;

/**
 * Selector de coordenadas en mapa. El propietario hace clic o arrastra el marcador y se llama a
 * onSelect({ latitude, longitude }) con los valores redondeados a 4 decimales (la longitud fuera
 * de rango se normaliza: 190 pasa a -170). Con initialPoint abre centrado en ese punto, con el
 * marcador puesto. Si el punto entregado no es un número válido se llama a onInvalid().
 */
export function createMapPicker({
  onSelect,
  loadLibrary = loadLeaflet,
  initialPoint = null,
  errorMessage = MAP_ERROR,
  onInvalid = () => {},
}) {
  const canvas = el('div', { class: 'map-canvas' });
  const message = el('p', { class: 'map-error-text', text: errorMessage });
  const retry = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text: 'Reintentar',
    onclick: () => start(),
  });
  const failure = el('div', { class: 'map-error', hidden: true }, message, retry);
  const element = el('div', { class: 'map-picker' }, canvas, failure);
  let map = null;

  function showError() {
    failure.hidden = false;
  }

  function build(L) {
    const startView = initialPoint
      ? { center: [initialPoint.latitude, initialPoint.longitude], zoom: SAVED_POINT_ZOOM }
      : INITIAL_VIEW;
    map = L.map(canvas).setView(startView.center, startView.zoom);
    let tilesLoaded = false;
    const layer = L.tileLayer(TILES, {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    layer.on('tileload', () => {
      tilesLoaded = true;
    });
    layer.on('tileerror', () => {
      if (!tilesLoaded) showError();
    });

    let marker = null;
    const report = (latlng) => {
      const point = latlng.wrap();
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        onInvalid();
        return;
      }
      onSelect({
        latitude: roundCoordinate(point.lat),
        longitude: roundCoordinate(point.lng),
      });
    };
    const placeMarker = (latlng) => {
      if (marker) {
        marker.setLatLng(latlng);
        return;
      }
      marker = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: 'map-dot', iconSize: [20, 20] }),
      }).addTo(map);
      marker.on('dragend', () => report(marker.getLatLng()));
    };
    if (initialPoint) placeMarker(startView.center);
    map.on('click', (event) => {
      placeMarker(event.latlng);
      report(event.latlng);
    });
    setTimeout(() => map.invalidateSize(), 0);
  }

  async function start() {
    failure.hidden = true;
    map?.remove();
    map = null;
    try {
      build(await loadLibrary());
    } catch {
      showError();
    }
  }

  // Se espera a que la página ya esté en el documento para que el mapa mida bien su espacio.
  setTimeout(start, 0);
  return { element, reload: start };
}
