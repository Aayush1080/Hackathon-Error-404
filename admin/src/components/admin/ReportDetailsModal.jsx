import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Check, Ban, Trash2, Pencil, CheckCircle2, Archive, RotateCcw, Layers, Split, ShieldCheck, ThumbsUp, ThumbsDown, Merge } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { incidentIcon } from '../../lib/icons';
import { fetchReport, CATEGORIES, TOWNS, inMauritius, distanceKm, TILES, TILE_OPTS } from '../../services/adminService';

const BOUNDS = [[-20.65, 57.18], [-19.85, 58.1]];
const Row = ({ k, v }) => <div><dt className="text-xs uppercase text-slate-400">{k}</dt><dd className="text-sm text-slate-800">{v}</dd></div>;
const field = 'w-full rounded-lg border p-2 text-sm';
const AUDIT = { status: 'Status changed', edit: 'Edited', delete: 'Deleted', resolve: 'Resolved and removed', login: 'Signed in', merge: 'Merged', unmerge: 'Split out' };

function MiniMap({ lat, lng, category, others, editable, onPick }) {
  const el = useRef(null), map = useRef(null), marker = useRef(null);
  useEffect(() => {
    const m = (map.current = L.map(el.current, { maxBounds: BOUNDS, maxBoundsViscosity: 1, minZoom: 9 }).setView([lat, lng], 15));
    L.tileLayer(TILES, TILE_OPTS).addTo(m);
    others.forEach((o) => L.circleMarker([o.latitude, o.longitude], { radius: 6, color: '#fff', weight: 2, fillColor: '#7c3aed', fillOpacity: 0.9 }).bindTooltip('Merged report').addTo(m));
    marker.current = L.marker([lat, lng], { icon: incidentIcon(L, category) }).addTo(m);
    return () => m.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { marker.current?.setLatLng([lat, lng]); }, [lat, lng]);
  useEffect(() => {
    const m = map.current;
    const h = (e) => onPick(e.latlng.lat, e.latlng.lng);
    if (editable) m.on('click', h);
    m.getContainer().style.cursor = editable ? 'crosshair' : '';
    return () => { m.off('click', h); };
  }, [editable, onPick]);
  return <div ref={el} className="h-56 w-full rounded-lg border" aria-label="Report location map" />;
}

export default function ReportDetailsModal({ report: r, reports = [], onClose, ask, onSave, onMerge, onUnmerge, can }) {
  const [audit, setAudit] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const dups = r.duplicates || [];
  useEffect(() => {
    let live = true;
    fetchReport(r.id).then((d) => live && setAudit(d.audit)).catch(() => live && setAudit([]));
    return () => { live = false; };
  }, [r.id, r.updated_at, r.status, dups.length]);

  const editing = !!form;
  // Escape closes the panel, except while editing (unsaved changes) or typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || editing || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = useCallback((lat, lng) => {
    if (!inMauritius(lat, lng)) return;
    setForm((f) => ({ ...f, latitude: +lat.toFixed(6), longitude: +lng.toFixed(6) }));
  }, []);
  const start = () => {
    setErr('');
    setForm({ category: r.category, custom_category: r.custom_category || '', location_name: r.location_name,
      town: r.town, observed_time: r.observed_time || '', description: r.description, latitude: r.latitude, longitude: r.longitude });
  };
  async function save() {
    const patch = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) };
    if (!inMauritius(patch.latitude, patch.longitude)) return setErr('The location must be in Mauritius.');
    if (patch.category === 'Other' && !patch.custom_category.trim()) return setErr('Describe the incident type for "Other".');
    if (patch.category !== 'Other') patch.custom_category = null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.observed_time)) delete patch.observed_time;
    setBusy(true); setErr('');
    try { await onSave(r.id, patch); setForm(null); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  // Other open incidents of the same type within 1 km: likely the same emergency, reported separately.
  const similar = useMemo(() => reports.filter((o) => o.id !== r.id && o.category === r.category && ['pending', 'approved'].includes(o.status) &&
    distanceKm(r.latitude, r.longitude, o.latitude, o.longitude) <= 1).slice(0, 5), [reports, r]);

  const lat = editing ? Number(form.latitude) : r.latitude, lng = editing ? Number(form.longitude) : r.longitude;
  const photos = [...(r.photos || []).map((p) => ({ ...p, from: 'Original report' })), ...dups.flatMap((d, i) => (d.photos || []).map((p) => ({ ...p, from: `Merged report ${i + 1}` })))];
  const fb = r.feedback || { still_there: 0, gone: 0 };
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={r.title}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold font-extrabold">{r.title}</h2>
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">Report {r.id}
              {r.source === 'police' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-900 px-2 py-0.5 font-semibold text-white"><ShieldCheck size={12} />Police report</span>}
              {dups.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800"><Layers size={12} />{dups.length + 1} reports of this incident</span>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className={photos.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
            {photos.length ? photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block">
                <img src={p.url} alt={`Photo: ${p.from}`} className={`${photos.length > 1 ? 'h-32' : 'max-h-64'} w-full rounded-lg bg-slate-100 object-cover`} />
                {photos.length > 1 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{p.from}</span>}
              </a>
            )) : <div className="rounded-lg bg-slate-100 p-6 text-center text-sm text-slate-400">No photograph uploaded</div>}
          </div>
          <div>
            <MiniMap lat={lat} lng={lng} category={r.category} others={dups} editable={editing} onPick={pick} />
            {editing && <p className="mt-1 text-xs text-blue-700">Click the map to move the incident.</p>}
          </div>
        </div>

        {editing ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Type<select className={field} value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            {form.category === 'Other'
              ? <label className="text-sm">Incident described as<input className={field} maxLength={60} value={form.custom_category} onChange={set('custom_category')} /></label>
              : <span />}
            <label className="text-sm">Time observed<input className={field} type="time" value={form.observed_time} onChange={set('observed_time')} /></label>
            <label className="text-sm">Town<select className={field} value={form.town} onChange={set('town')}>{TOWNS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="text-sm sm:col-span-2">Location<input className={field} maxLength={160} value={form.location_name} onChange={set('location_name')} /></label>
            <label className="text-sm">Latitude<input className={field} type="number" step="0.000001" value={form.latitude} onChange={set('latitude')} /></label>
            <label className="text-sm">Longitude<input className={field} type="number" step="0.000001" value={form.longitude} onChange={set('longitude')} /></label>
            <label className="text-sm sm:col-span-2">Description<textarea className={field} rows={3} maxLength={500} value={form.description} onChange={set('description')} /></label>
            {err && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{err}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <button disabled={busy} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
              <button disabled={busy} onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{r.description || 'No description.'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Row k="Type" v={r.label} />
              <Row k="Status" v={<StatusBadge value={r.status} />} />
              <Row k="Reported by" v={r.reporter ? `${r.reporter.name} (NID ${r.reporter.nid_masked})${r.reporter.role === 'police' ? ' · police' : ''}` : r.reporter_ref ? `Anonymous device ${r.reporter_ref}` : 'Anonymous'} />
              <Row k="Location" v={`${r.location_name} (${r.town})`} />
              <Row k="Coordinates" v={`${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`} />
              <Row k="Observed" v={r.observed_time || '—'} />
              <Row k="Submitted" v={new Date(r.created_at).toLocaleString()} />
              <Row k="Published" v={r.approved_at ? new Date(r.approved_at).toLocaleString() : '—'} />
              {r.status === 'approved' && <Row k="Passers-by: still there?" v={<span className="inline-flex gap-3"><span className="inline-flex items-center gap-1 text-green-700"><ThumbsUp size={14} />{fb.still_there} yes</span><span className="inline-flex items-center gap-1 text-amber-700"><ThumbsDown size={14} />{fb.gone} gone</span></span>} />}
              {r.rejection_reason && <Row k="Rejection reason" v={r.rejection_reason} />}
            </dl>
            {r.status === 'approved' && fb.gone >= 2 && fb.gone > fb.still_there && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">People passing by say this incident is over. Consider marking it resolved.</p>
            )}
          </>
        )}

        {!editing && (
          <div className="mt-5 flex flex-wrap gap-2">
            {can('review') && r.status !== 'approved' && <button onClick={() => ask('approve', r)} className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"><Check size={16} />Approve & publish</button>}
            {can('review') && r.status !== 'rejected' && <button onClick={() => ask('reject', r)} className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"><Ban size={16} />Reject</button>}
            {can('review') && r.status === 'approved' && <button onClick={() => ask('resolve', r)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 size={16} />Mark resolved (removes it)</button>}
            {can('review') && r.status !== 'pending' && <button onClick={() => ask('pending', r)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RotateCcw size={16} />Back to pending</button>}
            {can('review') && r.status !== 'archived' && <button onClick={() => ask('archive', r)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Archive size={16} />Archive</button>}
            {can('edit') && <button onClick={start} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Pencil size={16} />Edit</button>}
            {can('delete') && <button onClick={() => ask('delete', r)} className="ml-auto flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"><Trash2 size={16} />Delete</button>}
          </div>
        )}

        {dups.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-1 text-sm font-bold font-extrabold"><Layers size={16} />Merged reports of this incident ({dups.length})</h3>
            <p className="text-xs text-slate-500">Sent by other people for the same emergency. Approving, rejecting or resolving this incident applies to all of them.</p>
            <ul className="mt-2 space-y-2">
              {dups.map((d) => (
                <li key={d.id} className="flex gap-3 rounded-lg border p-2 text-sm">
                  {d.photos?.[0]?.url && <a href={d.photos[0].url} target="_blank" rel="noreferrer"><img src={d.photos[0].url} alt="Merged report photo" className="h-16 w-20 rounded object-cover" /></a>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><b>{d.label}</b><StatusBadge value={d.status} />{d.source === 'police' && <span className="rounded-full bg-blue-900 px-2 text-xs text-white">Police</span>}</div>
                    <div className="text-xs text-slate-500">{d.location_name} · {Math.round(distanceKm(r.latitude, r.longitude, d.latitude, d.longitude) * 1000)} m away · {new Date(d.created_at).toLocaleString()}{d.reporter ? ` · ${d.reporter.name}` : ''}</div>
                    {d.description && <p className="mt-1 text-slate-700">{d.description}</p>}
                  </div>
                  {can('edit') && <button onClick={() => onUnmerge(d.id)} title="Not the same incident: make it a separate report" className="flex h-fit items-center gap-1 self-center rounded-lg border px-2 py-1 text-xs"><Split size={14} />Unmerge</button>}
                </li>
              ))}
            </ul>
          </>
        )}

        {can('edit') && similar.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-1 text-sm font-bold font-extrabold"><Merge size={16} />Similar open incidents within 1 km</h3>
            <p className="text-xs text-slate-500">If one of these is the same emergency, merge this report into it so it shows as a single incident.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {similar.map((o) => (
                <li key={o.id} className="flex items-center gap-2 border-t pt-1">
                  <span className="flex-1">{o.label} · {o.location_name} · <StatusBadge value={o.status} /> · {Math.round(distanceKm(r.latitude, r.longitude, o.latitude, o.longitude) * 1000)} m</span>
                  <button onClick={() => onMerge(r.id, o.id)} className="rounded-lg border px-2 py-1 text-xs">Merge into this</button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mt-6 text-sm font-bold font-extrabold">History</h3>
        {audit === null ? <p className="text-sm text-slate-400">Loading…</p> : audit.length === 0 ? <p className="text-sm text-slate-400">No administrator actions yet.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="border-t pt-1 text-slate-600">
                <b>{AUDIT[a.action] || a.action}</b>{a.action === 'status' && <> from {a.old_status} to {a.new_status}</>}
                {a.action === 'edit' && a.changes && <> ({Object.keys(a.changes).join(', ')})</>}
                {a.report_id && a.report_id !== r.id && <span className="text-xs text-slate-400"> (merged report)</span>} by {a.admin_email || 'unknown'} · {new Date(a.created_at).toLocaleString()}
                {a.changes?.checklist && <div className="text-xs text-green-700">Review checklist completed</div>}
                {a.changes?.reason && <div className="text-xs text-slate-500">Reason: {a.changes.reason}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
