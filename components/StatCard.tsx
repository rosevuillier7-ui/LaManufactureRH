interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky" | "gray";
  icon?: React.ReactNode;
}

const colorMap = {
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  gray: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function StatCard({ label, value, sub, color = "indigo", icon }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 ${colorMap[color]}`}>
      {icon && <div className="text-2xl">{icon}</div>}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
      </div>
    </div>
  );
}
