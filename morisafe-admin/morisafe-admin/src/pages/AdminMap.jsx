import { useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const COLORS = { approved: '#16a34a', pending: '#f97316' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export default function AdminMap() {
  const { reports, view } = useOutletContext();
  const el = useRef(null);
  useEffect(() => {
    const map = L.map(el.current, { minZoom: 9 }).setView([-20.2, 57.55], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    reports.filter((r) => COLORS[r.status] && Number.isFinite(Number(r.latitude))).forEach((r) => {
      const m = L.circleMarker([r.latitude, r.longitude], { radius: 9, color: '#fff', weight: 2, fillColor: COLORS[r.status], fillOpacity: 1 }).addTo(map);
      const box = document.createElement('div');
      box.innerHTML = `<b>${esc(r.title)}</b><br>${esc(r.category)} · ${esc(r.location_name)}<br><i>${esc(r.status)}</i><br>`;
      const b = document.createElement('button');
      b.textContent = 'View details'; b.style.cssText = 'color:#2563eb;text-decoration:underline';
      b.onclick = () => view(r); box.appendChild(b); m.bindPopup(box);
    });
    return () => map.remove();
  }, [reports, view]);
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div ref={el} className="h-[65vh] w-full rounded-lg" style={{ zIndex: 0 }} />
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span><i className="mr-1 inline-block h-3 w-3 rounded-full" style={{ background: COLORS.approved }} />Approved (public)</span>
        <span><i className="mr-1 inline-block h-3 w-3 rounded-full" style={{ background: COLORS.pending }} />Pending (admin only)</span>
        <span className="text-slate-400">Rejected reports are hidden.</span>
      </div>
    </div>
  );
}
