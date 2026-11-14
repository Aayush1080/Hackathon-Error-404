const S = { pending: 'bg-orange-100 text-orange-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', resolved: 'bg-blue-100 text-blue-800', archived: 'bg-slate-200 text-slate-700' };
export default function StatusBadge({ value }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${S[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}
