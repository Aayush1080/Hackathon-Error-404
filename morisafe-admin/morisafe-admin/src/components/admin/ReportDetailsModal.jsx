import { X, Check, Ban, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
const Row = ({ k, v }) => <div><dt className="text-xs uppercase text-slate-400">{k}</dt><dd className="text-sm text-slate-800">{v}</dd></div>;
export default function ReportDetailsModal({ report: r, onClose, ask }) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-[#14233a]">{r.title}</h2>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {r.image_url ? <img src={r.image_url} alt="Uploaded incident" className="mt-3 max-h-64 w-full rounded-lg object-cover" /> : <div className="mt-3 rounded-lg bg-slate-100 p-6 text-center text-sm text-slate-400">No photograph uploaded</div>}
        <p className="mt-3 text-sm text-slate-700">{r.description || 'No description.'}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Row k="Category" v={r.category} />
          <Row k="Status" v={<StatusBadge value={r.status} />} />
          <Row k="Location" v={r.location_name} />
          <Row k="Coordinates" v={`${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`} />
          <Row k="Submitted" v={new Date(r.created_at).toLocaleString()} />
          <Row k="Reporter" v="Not stored in current schema" />
          {r.rejection_reason && <Row k="Rejection reason" v={r.rejection_reason} />}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {r.status !== 'approved' && <button onClick={() => ask('approve', r)} className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"><Check size={16} />Approve</button>}
          {r.status !== 'rejected' && <button onClick={() => ask('reject', r)} className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"><Ban size={16} />Reject</button>}
          <button onClick={() => ask('delete', r)} className="ml-auto flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"><Trash2 size={16} />Delete</button>
        </div>
      </div>
    </div>
  );
}
