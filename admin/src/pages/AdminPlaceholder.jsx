export default function AdminPlaceholder({ name }) {
  return <div className="rounded-xl bg-white p-8 text-slate-500 shadow-sm"><b>{name}</b> is not built into the dashboard yet. To add an administrator: create the user in Supabase (Authentication), then add a row to public.admins with role admin, moderator or viewer.</div>;
}
