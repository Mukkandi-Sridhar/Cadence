import { Link } from "react-router-dom";

interface PresentationCardProps {
  eventId: string;
  id: string;
  teamName: string;
  topic: string;
  members: string[];
  status: string;
  totalScore?: number | null;
}

const statusColors: Record<string, string> = {
  DRAFT: "text-ink/60 bg-ink/10",
  RECORDING: "text-warning bg-warning/20",
  RECORDED: "text-info bg-info/20",
  SCORED: "text-success bg-success/20",
};

export function PresentationCard({
  eventId,
  id,
  teamName,
  topic,
  members,
  status,
  totalScore,
}: PresentationCardProps) {
  const target =
    status === "SCORED"
      ? `/events/${eventId}/presentations/${id}/results`
      : `/events/${eventId}/presentations/${id}/record`;

  return (
    <Link
      to={target}
      className="glass-card p-5 flex flex-col gap-3 border border-transparent hover:border-brand-500/40 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink truncate">{teamName}</h3>
          <p className="text-xs text-ink/60 mt-0.5 line-clamp-2">{topic}</p>
        </div>
        {typeof totalScore === "number" && (
          <span className="shrink-0 rounded-full bg-brand-600/20 border border-brand-500/30 px-2.5 py-1 text-xs font-mono font-bold text-brand-700">
            {totalScore}/100
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink/50 truncate">
          {members.slice(0, 3).join(", ")}
          {members.length > 3 ? ` +${members.length - 3}` : ""}
        </span>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            statusColors[status] || "text-ink/60 bg-ink/10"
          }`}
        >
          {status}
        </span>
      </div>
    </Link>
  );
}
