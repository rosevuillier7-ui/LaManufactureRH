type BadgeVariant = "green" | "blue" | "yellow" | "red" | "gray" | "purple" | "indigo";

const variants: Record<BadgeVariant, string> = {
  green: "bg-emerald-500/15 text-emerald-400",
  blue: "bg-sky-500/15 text-sky-400",
  yellow: "bg-amber-500/15 text-amber-400",
  red: "bg-rose-500/15 text-rose-400",
  gray: "bg-gray-500/15 text-gray-400",
  purple: "bg-violet-500/15 text-violet-400",
  indigo: "bg-indigo-500/15 text-indigo-400",
};

export default function Badge({
  label,
  variant = "gray",
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
