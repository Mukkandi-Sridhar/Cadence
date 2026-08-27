import { Header } from "../components/Header";
import { Link } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";

export default function SessionDashboard() {
  const { topic, presenterQueue } = useSessionStore();

  const presenters = presenterQueue.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    name: p.name,
    score: p.status === "SCORED" ? 80 : "--",
    status: p.status,
  }));

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
                {topic || "Presentation Session"}
              </h1>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                {presenterQueue.length} Presenter(s) in Queue
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns — Leaderboard Table */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                Presenter Rankings
              </h3>

              <div className="overflow-x-auto">
                {presenters.length === 0 ? (
                  <div className="py-12 text-center text-sm text-white/40 italic">
                    No presenters added to this session yet. Create a session to populate presenter queue.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/50 uppercase tracking-wider">
                        <th className="py-3 px-2">Order</th>
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
                            <span className="badge badge-info">{p.status}</span>
                          </td>
                          <td className="py-4 px-2 text-right font-mono font-extrabold text-lg text-white">
                            {p.score}
                          </td>
                          <td className="py-4 px-2 text-right">
                            <Link
                              to={`/sessions/active/results/${p.id}`}
                              className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline"
                            >
                              View Report →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right Column — Session Info */}
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                Session Control
              </h3>
              <p className="text-xs text-white/60">
                Manage presenter queues, monitor audio health thresholds, and review aggregate score distributions.
              </p>
              <Link to="/sessions/new" className="btn-primary py-3 text-center w-full">
                + Create New Session
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
