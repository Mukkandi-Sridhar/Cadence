import { useEffect, useRef } from "react";

export interface SessionEventItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
  status: "info" | "success" | "warning" | "error";
}

interface LiveEventStreamProps {
  events: SessionEventItem[];
}

export function LiveEventStream({ events }: LiveEventStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const badgeColors: Record<string, string> = {
    info: "text-brand-300 bg-brand-600/20 border-brand-500/30",
    success: "text-success bg-success/20 border-success/30",
    warning: "text-warning bg-warning/20 border-warning/30",
    error: "text-danger bg-danger/20 border-danger/30",
  };

  const icons: Record<string, string> = {
    RECORDING_STARTED: "⏺",
    TRANSCRIPT_CHUNK: "📝",
    AUDIO_HEALTH: "🎤",
    EVALUATION_TRIGGERED: "🤖",
    EVALUATION_COMPLETE: "✅",
    SUPABASE_SYNCED: "💾",
  };

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-300 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-ping" />
          Live Event Log & Stream History
        </span>
        <span className="text-[11px] font-mono text-white/50">{events.length} events logged</span>
      </div>

      <div
        ref={containerRef}
        aria-live="polite"
        className="flex h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-surface-900/60 p-3 text-xs scrollbar-thin scrollbar-thumb-brand-700"
      >
        {events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center italic text-white/40">
            Waiting for session events... Events will stream live here.
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-2 transition-all hover:bg-white/10"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-sm shrink-0">{icons[evt.type] || "📌"}</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-white truncate">{evt.title}</span>
                  <span className="text-[11px] text-white/60 truncate">{evt.detail}</span>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold border ${
                  badgeColors[evt.status] || badgeColors.info
                }`}
              >
                {evt.timestamp}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
