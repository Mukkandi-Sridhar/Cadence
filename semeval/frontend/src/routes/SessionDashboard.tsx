import { Header } from "../components/Header";
import { Link } from "react-router-dom";

export default function SessionDashboard() {
  const presenters = [
    { rank: 1, id: "p2", name: "Rahul Verma", score: 88, status: "SCORED", flags: [] },
    { rank: 2, id: "p1", name: "Ananya Sharma", score: 73, status: "SCORED", flags: [] },
    { rank: 3, id: "p3", name: "Priya Nair", score: 65, status: "SCORED", flags: ["LOW_CONFIDENCE"] },
  ];

  const distribution = [
    { range: "90-100", count: 0 },
    { range: "80-89", count: 1 },
    { range: "70-79", count: 1 },
    { range: "60-69", count: 1 },
    { range: "< 60", count: 0 },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Session Leaderboard & Analytics
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Distributed Systems Seminar
              </h1>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                3 Presenters Scored • Calibrated under Rubric v1.0
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => alert("Exporting Session CSV...")} className="btn-ghost border border-white/20">
                📊 Export CSV
              </button>
              <button onClick={() => alert("Exporting Summary PDF...")} className="btn-primary">
                📄 Export All PDF
              </button>
            </div>
          </div>

          {/* Calibration Drift Alert Banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-info/30 bg-info/10 p-4 text-sm text-info">
            <span className="text-xl">ℹ️</span>
            <div>
              <h4 className="font-bold">Calibration Drift Check</h4>
              <p className="text-xs opacity-90">
                Session mean is 75.3 (Std Dev 11.6). No grade inflation or distribution drift detected.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns — Leaderboard Table */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                Presenter Rankings
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/50 uppercase tracking-wider">
                      <th className="py-3 px-2">Rank</th>
                      <th className="py-3 px-2">Presenter</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Score</th>
                      <th className="py-3 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {presenters.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-2 font-mono font-bold text-brand-300">#{p.rank}</td>
                        <td className="py-4 px-2 font-semibold text-white">{p.name}</td>
                        <td className="py-4 px-2">
                          <span className="badge badge-success">{p.status}</span>
                        </td>
                        <td className="py-4 px-2 text-right font-mono font-extrabold text-lg text-white">
                          {p.score}
                        </td>
                        <td className="py-4 px-2 text-right">
                          <Link
                            to={`/sessions/s1/results/${p.id}`}
                            className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline"
                          >
                            View Report →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column — Distribution Histogram */}
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                Score Distribution
              </h3>

              <div className="flex flex-col gap-3">
                {distribution.map((d) => (
                  <div key={d.range} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-white/70 font-mono">
                      <span>{d.range}</span>
                      <span>{d.count} presenter(s)</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-900">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${(d.count / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
