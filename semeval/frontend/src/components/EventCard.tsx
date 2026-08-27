import { Link } from "react-router-dom";

interface EventCardProps {
  id: string;
  name: string;
  eventDate: string;
}

export function EventCard({ id, name, eventDate }: EventCardProps) {
  const formatted = (() => {
    const d = new Date(eventDate);
    return Number.isNaN(d.getTime())
      ? eventDate
      : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  })();

  return (
    <Link
      to={`/events/${id}`}
      className="glass-card p-6 flex flex-col gap-2 border border-transparent hover:border-brand-500/40 transition-all"
    >
      <span className="text-xs font-mono text-white/50">{formatted}</span>
      <h3 className="text-lg font-bold text-white">{name}</h3>
      <span className="text-xs font-semibold text-brand-400">View Presentations →</span>
    </Link>
  );
}
