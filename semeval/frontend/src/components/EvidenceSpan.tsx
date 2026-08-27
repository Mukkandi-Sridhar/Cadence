interface EvidenceSpanProps {
  span: string;
  reason: string;
  startMs?: number;
  verified?: boolean;
}

export function EvidenceSpan({ span, reason, startMs, verified = true }: EvidenceSpanProps) {
  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-ink/5 p-3 text-sm hover:border-brand-500/40 transition-all">
      <div className="flex items-center justify-between">
        {typeof startMs === "number" ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-600/20 px-2.5 py-1 font-mono text-xs font-semibold text-brand-700 border border-brand-500/30">
            <span>⏱</span>
            <span>{formatTime(startMs)}</span>
          </span>
        ) : (
          <span />
        )}
        {verified && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
            <span>✓ Verbatim Match</span>
          </span>
        )}
      </div>

      <blockquote className="border-l-2 border-brand-400 pl-3 italic text-ink/90">
        "{span}"
      </blockquote>
      <p className="text-xs text-ink/60">{reason}</p>
    </div>
  );
}
