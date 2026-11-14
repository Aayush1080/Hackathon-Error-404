import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { incidentIcon, placeIcon } from '../../lib/icons';
import { TILES, TILE_OPTS } from '../../services/adminService';
import PLACES from '../../lib/places.json';

// Compact overview map: open incidents (pending and live) plus police stations, hospitals and fire stations.
export default function LiveMap({ reports, view }) {
  const el = useRef(null), map = useRef(null), layer = useRef(null);
  useEffect(() => {
    const m = (map.current = L.map(el.current, { maxBounds: [[-20.65, 57.18], [-19.85, 58.1]], maxBoundsViscosity: 1, minZoom: 9, zoomControl: true, attributionControl: false })
      .fitBounds([[-20.53, 57.3], [-19.97, 57.81]]));
    L.tileLayer(TILES, TILE_OPTS).addTo(m);
    // Emergency services appear once zoomed in, so they never hide the incidents on the island overview.
    const poi = L.layerGroup();
    PLACES.filter((p) => p.t !== 'clinic').forEach((p) => L.marker([p.lat, p.lng], { icon: placeIcon(L, p.t), keyboard: false }).bindTooltip(p.n).addTo(poi));
    const upd = () => (m.getZoom() >= 12 ? poi.addTo(m) : poi.remove());
    m.on('zoomend', upd);
    upd();
    layer.current = L.layerGroup().addTo(m);
    return () => m.remove();
  }, []);
  useEffect(() => {
    layer.current.clearLayers();
    reports.filter((r) => r.status === 'pending' || r.status === 'approved').forEach((r) => {
      L.marker([r.latitude, r.longitude], { icon: incidentIcon(L, r.category, { police: r.source === 'police', old: r.status === 'pending' && false }), zIndexOffset: 800 })
        .bindTooltip(`${r.label} · ${r.location_name} · ${r.status === 'approved' ? 'live' : 'pending'}`)
        .on('click', () => view(r)).addTo(layer.current);
    });
  }, [reports, view]);
  return <div ref={el} className="h-56 w-full overflow-hidden rounded-xl" aria-label="Live map of incidents" />;
}
