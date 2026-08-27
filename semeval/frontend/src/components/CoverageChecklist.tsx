interface CoverageChecklistProps {
  points: string[];
  coveredIndices: number[];
  onTogglePoint?: (index: number) => void;
}

export function CoverageChecklist({ points, coveredIndices, onTogglePoint }: CoverageChecklistProps) {
  const percent = points.length > 0 ? Math.round((coveredIndices.length / points.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-white/70 uppercase">Topic Coverage Checklist</span>
        <span className="font-mono text-xs font-semibold text-brand-300">{percent}% Covered</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-900">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="flex flex-col gap-2 mt-1">
        {points.map((point, idx) => {
          const isCovered = coveredIndices.includes(idx);
          return (
            <div
              key={idx}
              onClick={() => onTogglePoint && onTogglePoint(idx)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-all ${
                isCovered
                  ? "border-success/30 bg-success/10 text-white font-medium shadow-sm"
                  : "border-white/5 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isCovered ? "bg-success text-black" : "border border-white/20 bg-surface-900 text-white/40"
                }`}
              >
                {isCovered ? "✓" : idx + 1}
              </div>
              <span className="flex-1 leading-snug">{point}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
