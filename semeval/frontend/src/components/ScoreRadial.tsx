interface ScoreRadialProps {
  score: number; // 0 to 100
  size?: number;
}

export function ScoreRadial({ score, size = 180 }: ScoreRadialProps) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color = "#22c55e"; // Green for 75+
  if (score < 50) color = "#ef4444"; // Red for < 50
  else if (score < 75) color = "#f59e0b"; // Yellow/Orange for 50-74

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-extrabold tracking-tight text-white">{score}</span>
        <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">out of 100</span>
      </div>
    </div>
  );
}
