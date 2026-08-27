interface MicLevelMeterProps {
  volume: number; // 0 to 100
  rmsDbfs?: number;
}

export function MicLevelMeter({ volume, rmsDbfs = -22 }: MicLevelMeterProps) {
  let verdict = "Good";
  let verdictColor = "text-success bg-success/10 border-success/20";

  if (volume < 15 || rmsDbfs < -45) {
    verdict = "Too quiet, move closer to mic";
    verdictColor = "text-warning bg-warning/10 border-warning/20";
  } else if (volume > 90 || rmsDbfs > -2) {
    verdict = "Clipping, lower input gain";
    verdictColor = "text-danger bg-danger/10 border-danger/20";
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-xs font-semibold text-white/70">
        <span>MICROPHONE LEVEL METER</span>
        <span className="font-mono text-white/90">{rmsDbfs.toFixed(1)} dBFS</span>
      </div>

      {/* Meter Bar */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-900 border border-white/5">
        <div
          className="h-full transition-all duration-75"
          style={{
            width: `${Math.min(100, Math.max(0, volume))}%`,
            background:
              volume > 90
                ? "linear-gradient(90deg, #22c55e 0%, #f59e0b 70%, #ef4444 100%)"
                : volume < 15
                ? "linear-gradient(90deg, #f59e0b 0%, #22c55e 100%)"
                : "linear-gradient(90deg, #6366f1 0%, #22c55e 100%)",
          }}
        />
      </div>

      {/* Plain Language Verdict */}
      <div className={`mt-1 inline-flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-medium ${verdictColor}`}>
        <span className="font-semibold">Verdict: {verdict}</span>
        <span className="font-mono opacity-80">{volume.toFixed(0)}%</span>
      </div>
    </div>
  );
}
