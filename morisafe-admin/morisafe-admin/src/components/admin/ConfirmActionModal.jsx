import { useState } from 'react';
const CFG = {
  approve: { title: 'Approve report', btn: 'bg-green-600 hover:bg-green-700', text: 'This will publish the report on the public map.' },
  reject: { title: 'Reject report', btn: 'bg-red-600 hover:bg-red-700', text: 'The report will not be shown publicly.' },
  delete: { title: 'Delete report permanently', btn: 'bg-red-700 hover:bg-red-800', text: 'This cannot be undone.' },
};
export default function ConfirmActionModal({ action, busy, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const c = CFG[action.type];
  const needReason = action.type === 'reject' && !reason.trim();
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3 className="text-lg font-bold text-[#14233a]">{c.title}</h3>
        <p className="mt-1 text-sm text-slate-600"><b>{action.report.title}</b><br />{c.text}</p>
        {action.type === 'reject' && (
          <textarea className="mt-3 w-full rounded-lg border p-2 text-sm" rows={3} placeholder="Rejection reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={busy || needReason} onClick={() => onConfirm(reason.trim())} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${c.btn}`}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
