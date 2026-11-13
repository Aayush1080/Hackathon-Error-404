const S = { pending: 'bg-orange-100 text-orange-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };
const V = { High: 'bg-red-100 text-red-800', Medium: 'bg-orange-100 text-orange-800', Low: 'bg-blue-100 text-blue-800' };
export default function StatusBadge({ value, severity }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${(severity ? V : S)[value]}`}>{value}</span>;
}
