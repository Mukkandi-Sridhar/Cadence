import { useEffect, useRef } from "react";
import { LiveTranscriptItem } from "../store/recordingStore";

interface LiveTranscriptProps {
  items: LiveTranscriptItem[];
}

export function LiveTranscript({ items }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [items]);

  function formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={containerRef}
      aria-live="polite"
      className="flex h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-surface-900/60 p-4 scrollbar-thin scrollbar-thumb-brand-700"
    >
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm italic text-white/40">
          Listening for speech... Partials will appear live.
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex flex-col gap-1 rounded-xl bg-white/5 p-3 text-sm border border-white/5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="font-semibold text-brand-300">
                {item.speaker} ({item.speakerRole})
              </span>
              <span className="font-mono text-[11px] opacity-75">{formatTime(item.startMs)}</span>
            </div>
            <p className="text-white/90 leading-relaxed">{item.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
