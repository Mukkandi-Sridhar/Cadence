import { useEffect, useState } from "react";

export function LiveWaveform() {
  const [bars, setBars] = useState<number[]>([30, 45, 60, 40, 75, 90, 50, 65, 80, 45, 35, 70, 85, 40, 60]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map(() => Math.floor(Math.random() * 70) + 20)
      );
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1.5 py-4 px-6 rounded-2xl bg-white/5 border border-white/10">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-brand-500 transition-all duration-150"
          style={{ height: `${height}%`, opacity: 0.4 + (height / 100) * 0.6 }}
        />
      ))}
    </div>
  );
}
