import { useState } from "react";
import { Link } from "react-router-dom";

interface PresentationCardProps {
  eventId: string;
  id: string;
  teamName: string;
  topic: string;
  members: string[];
  status: string;
  totalScore?: number | null;
  onDelete?: (id: string) => Promise<void> | void;
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
  onDelete,
}: PresentationCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const target =
    status === "SCORED"
      ? `/events/${eventId}/presentations/${id}/results`
      : `/events/${eventId}/presentations/${id}/record`;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (deleting) return;
    setDeleting(true);
    if (onDelete) {
      await onDelete(id);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <div className="relative group">
      <Link
        to={target}
        className="glass-card p-5 flex flex-col gap-3 border border-transparent hover:border-brand-500/40 transition-all block h-full"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-ink truncate pr-6">{teamName}</h3>
            <p className="text-xs text-ink/60 mt-0.5 line-clamp-2">{topic}</p>
          </div>
          {typeof totalScore === "number" && (
            <span className="shrink-0 rounded-full bg-brand-600/20 border border-brand-500/30 px-2.5 py-1 text-xs font-mono font-bold text-brand-700">
              {totalScore}/100
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
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

      {onDelete && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          {confirming ? (
            <div className="flex items-center gap-1 bg-surface-900/90 border border-danger/40 backdrop-blur-md rounded-lg p-1 shadow-xl animate-fadeIn">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-0.5 text-[11px] font-bold text-white bg-danger rounded hover:bg-danger/80 transition-colors disabled:opacity-50"
                title="Confirm delete"
              >
                {deleting ? "…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleting}
                className="px-2 py-0.5 text-[11px] font-medium text-ink/70 hover:text-ink transition-colors"
                title="Cancel"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-ink/40 hover:text-danger hover:bg-danger/10 transition-all"
              title="Delete presentation"
              aria-label={`Delete ${teamName}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
