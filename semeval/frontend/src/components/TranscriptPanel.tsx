import { useEffect, useRef } from "react";
import { TranscriptItem } from "../store/presentationStore";

interface TranscriptPanelProps {
  items: TranscriptItem[];
  interimText: string;
}

export function TranscriptPanel({ items, interimText }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [items, interimText]);

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
      className="flex h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-surface-900/60 p-4"
    >
      {items.length === 0 && !interimText ? (
        <div className="flex flex-1 items-center justify-center text-sm italic text-white/40 text-center px-6">
          Listening for speech… start talking and your words will appear here live.
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1 rounded-xl bg-white/5 p-3 text-sm border border-white/5"
            >
              <span className="font-mono text-[11px] text-white/40">{formatTime(item.startMs)}</span>
              <p className="text-white/90 leading-relaxed">{item.text}</p>
            </div>
          ))}
          {interimText && (
            <div className="flex flex-col gap-1 rounded-xl bg-white/[0.02] p-3 text-sm border border-dashed border-white/10">
              <p className="text-white/50 italic leading-relaxed">{interimText}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
