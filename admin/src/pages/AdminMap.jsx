import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { incidentIcon, placeIcon, catBadge, placeBadge, CAT_COLOR } from '../lib/icons';
import { TILES, TILE_OPTS } from '../services/adminService';
import PLACES from '../lib/places.json';

// Every incident at its stored coordinates, with one symbol per emergency type, plus emergency services.
// Status is shown by the ring colour. Click an incident to review it.
const RING = { pending: '#f97316', approved: '#16a34a', rejected: '#dc2626', archived: '#64748b' };
const ISLAND = [[-20.53, 57.3], [-19.97, 57.81]];
const PLACE_LABEL = { police: 'Police stations', hospital: 'Hospitals', clinic: 'Clinics', fire: 'Fire stations' };
const Html = ({ html }) => <span className="inline-flex" dangerouslySetInnerHTML={{ __html: html }} />;

export default function AdminMap() {
  const { reports, view } = useOutletContext();
  const [show, setShow] = useState({ pending: true, approved: true, rejected: false, archived: false });
  const [places, setPlaces] = useState({ police: true, hospital: true, clinic: false, fire: true });
  const el = useRef(null), map = useRef(null), layer = useRef(null), poi = useRef(null);

  useEffect(() => {
    const m = (map.current = L.map(el.current, { maxBounds: [[-20.65, 57.18], [-19.85, 58.1]], maxBoundsViscosity: 1, minZoom: 9 }).fitBounds(ISLAND));
    L.tileLayer(TILES, TILE_OPTS).addTo(m);
    poi.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    return () => m.remove();
  }, []);

  useEffect(() => {
    poi.current.clearLayers();
    PLACES.filter((p) => places[p.t]).forEach((p) => {
      L.marker([p.lat, p.lng], { icon: placeIcon(L, p.t), keyboard: false })
        .bindTooltip(`${p.n}${p.ph ? ' · ' + p.ph : ''}`).addTo(poi.current);
    });
  }, [places]);

  useEffect(() => {
    layer.current.clearLayers();
    reports.filter((r) => show[r.status]).forEach((r) => {
      const icon = incidentIcon(L, r.category, { police: r.source === 'police' });
      const ring = L.circleMarker([r.latitude, r.longitude], { radius: 22, color: RING[r.status], weight: 3, fill: false, interactive: false });
      ring.addTo(layer.current);
      L.marker([r.latitude, r.longitude], { icon, zIndexOffset: 500 })
        .bindTooltip(`${r.label} · ${r.location_name} · ${r.status}${r.duplicates?.length ? ` · ${r.duplicates.length + 1} reports` : ''}${r.source === 'police' ? ' · police' : ''}`)
        .on('click', () => view(r))
        .addTo(layer.current);
    });
  }, [reports, show, view]);

  const shown = reports.filter((r) => show[r.status]).length;
  const chip = 'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm';
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-400">Status</span>
        {Object.entries(RING).map(([s, c]) => (
          <label key={s} className={`${chip} capitalize`}>
            <input type="checkbox" checked={show[s]} onChange={(e) => setShow({ ...show, [s]: e.target.checked })} />
            <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: c }} />{s} ({reports.filter((r) => r.status === s).length})
          </label>
        ))}
        <span className="ml-auto text-sm text-slate-500">{shown} incidents shown · click a symbol to review</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-400">Emergency services</span>
        {Object.entries(PLACE_LABEL).map(([k, l]) => (
          <label key={k} className={chip}>
            <input type="checkbox" checked={places[k]} onChange={(e) => setPlaces({ ...places, [k]: e.target.checked })} />
            <Html html={placeBadge(k)} />{l} ({PLACES.filter((p) => p.t === k).length})
          </label>
        ))}
      </div>
      <div ref={el} className="h-[68vh] w-full rounded-lg" aria-label="Map of reports" />
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.keys(CAT_COLOR).map((c) => <span key={c} className="inline-flex items-center gap-1"><Html html={catBadge(c, 18)} />{c}</span>)}
        <span>Navy outline = police report · Map data © OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
