interface AudioHealthChipProps {
  gate: "PASS" | "LOW_CONFIDENCE" | "FAIL";
  snrDb?: number;
  warningsCount?: number;
}

export function AudioHealthChip({ gate, snrDb = 24.5, warningsCount = 0 }: AudioHealthChipProps) {
  let badgeClass = "bg-success/20 text-success border-success/30";
  let label = "Audio Health: Excellent";

  if (gate === "LOW_CONFIDENCE") {
    badgeClass = "bg-warning/20 text-warning border-warning/30";
    label = "Audio Health: Low Confidence";
  } else if (gate === "FAIL") {
    badgeClass = "bg-danger/20 text-danger border-danger/30";
    label = "Audio Health: Muted / Failed";
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-sm ${badgeClass}`}>
      <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
      <span>{label}</span>
      <span className="font-mono text-[10px] opacity-75">({snrDb.toFixed(1)} dB SNR)</span>
      {warningsCount > 0 && (
        <span className="ml-1 rounded-full bg-warning/30 px-1.5 py-0.2 text-[10px] font-bold">
          {warningsCount} alert
        </span>
      )}
    </div>
  );
}
