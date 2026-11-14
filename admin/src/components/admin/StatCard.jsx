const T = { blue: ['bg-blue-50 text-blue-700', 'border-blue-600'], orange: ['bg-orange-50 text-orange-700', 'border-orange-500'], green: ['bg-green-50 text-green-700', 'border-green-600'], red: ['bg-red-50 text-red-700', 'border-red-600'] };
export default function StatCard({ icon: Icon, label, value, tone, note }) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${T[tone][1]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${T[tone][0]}`}><Icon size={18} /></span>
      </div>
      <div className="mt-2 text-3xl font-bold text-[#14233a]">{value}</div>
      <div className="text-xs text-slate-400">{note}</div>
    </div>
  );
}
