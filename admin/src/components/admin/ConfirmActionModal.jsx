import { useState } from 'react';
import { CHECKLIST } from '../../services/adminService';

const CFG = {
  approve: { title: 'Review checklist: approve and publish', btn: 'bg-green-600 hover:bg-green-700', text: "It appears in the public app's Alerts and Map for 20 hours, and opted-in phones are notified." },
  resolve: { title: 'Mark resolved', btn: 'bg-blue-600 hover:bg-blue-700', text: 'The incident is over. It is removed from the app and deleted, with every report merged into it and their photos. This cannot be undone; the audit log keeps a record.' },
  archive: { title: 'Archive report', btn: 'bg-slate-600 hover:bg-slate-700', text: 'Hidden from the public and kept for records.' },
  pending: { title: 'Move back to pending', btn: 'bg-orange-600 hover:bg-orange-700', text: 'Unpublishes the report until it is reviewed again.' },
  reject: { title: 'Reject report', btn: 'bg-red-600 hover:bg-red-700', text: 'The report will not be shown publicly.' },
  delete: { title: 'Delete report permanently', btn: 'bg-red-700 hover:bg-red-800', text: 'The report, every report merged into it and their photos are removed permanently. This cannot be undone.' },
};
export default function ConfirmActionModal({ action, busy, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState({});
  const c = CFG[action.type];
  const isApprove = action.type === 'approve';
  const done = CHECKLIST.filter(([k]) => checks[k]).length;
  const blocked = (action.type === 'reject' && !reason.trim()) || (isApprove && done < CHECKLIST.length);
  const merged = action.report.duplicates?.length || 0;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={c.title}>
        <h3 className="text-lg font-bold font-extrabold">{c.title}</h3>
        <p className="mt-1 text-sm text-slate-600"><b>{action.report.title}</b>{merged > 0 && <> (+{merged} merged report{merged > 1 ? 's' : ''})</>}<br />{c.text}</p>
        {isApprove && (
          <fieldset className="mt-3 space-y-1.5 rounded-lg border bg-slate-50 p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">Confirm each point ({done}/{CHECKLIST.length})</legend>
            {CHECKLIST.map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
                <span>{label}</span>
              </label>
            ))}
            {action.report.source === 'police' && <p className="pt-1 text-xs text-blue-800">Sent from a police account.</p>}
          </fieldset>
        )}
        {action.type === 'reject' && (
          <textarea className="mt-3 w-full rounded-lg border p-2 text-sm" rows={3} placeholder="Rejection reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy || blocked} onClick={() => onConfirm(reason.trim(), checks)} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${c.btn}`}>
            {busy ? 'Working…' : isApprove ? 'Approve & publish' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
