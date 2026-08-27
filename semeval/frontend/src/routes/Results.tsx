import { Header } from "../components/Header";
import { ScoreRadial } from "../components/ScoreRadial";
import { EvidenceSpan } from "../components/EvidenceSpan";
import { AudioPlayer } from "../components/AudioPlayer";
import { OverridePanel } from "../components/OverridePanel";
import { useEvaluationStore } from "../store/evaluationStore";
import { useSessionStore } from "../store/sessionStore";
import { Link } from "react-router-dom";

export default function Results() {
  const { activeEvaluation, openOverrideModal } = useEvaluationStore();
  const { presenterQueue, activePresenterIndex } = useSessionStore();

  const activePresenter = presenterQueue[activePresenterIndex] || { name: "Presenter" };

  if (!activeEvaluation) {
    return (
      <div className="min-h-screen bg-surface-950 text-white flex flex-col">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-xl px-4 py-16 text-center flex flex-col items-center justify-center">
          <div className="glass-card p-10 flex flex-col items-center gap-4 w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-400 font-bold text-xl">
              📋
            </div>
            <h2 className="text-2xl font-bold text-white">No Evaluation Recorded Yet</h2>
            <p className="text-sm text-white/60">
              Start a presentation session and complete recording to generate an evidence-backed evaluation report.
            </p>
            <Link to="/sessions/new" className="btn-primary mt-2 py-3 px-6">
              Create New Session →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Evaluation Results
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {activeEvaluation.presenterName || activePresenter.name}
              </h1>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                Model: {activeEvaluation.modelName} ({activeEvaluation.modelVersion}) • Temp: {activeEvaluation.temperature} • Seed: {activeEvaluation.seed}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={openOverrideModal} className="btn-ghost border border-white/20">
                ✏️ Override Score
              </button>
              <button onClick={() => alert("Exporting PDF report...")} className="btn-primary">
                📄 Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column — Radial Score & Dimension Breakdown */}
            <div className="flex flex-col gap-6">
              {/* Score Gauge Card */}
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
                <ScoreRadial score={activeEvaluation.totalScore} size={200} />

                {activeEvaluation.overrides.length > 0 && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning border border-warning/30">
                    ⚠️ Human Override Applied ({activeEvaluation.overrides[activeEvaluation.overrides.length - 1].overrideScore})
                  </div>
                )}
              </div>

              {/* Dimension Breakdown */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Rubric Dimension Breakdown
                </h3>

                <div className="flex flex-col gap-3">
                  {activeEvaluation.dimensionScores.map((ds) => (
                    <div key={ds.dimension} className="flex flex-col gap-1 border-b border-white/5 pb-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-white">{ds.dimension}</span>
                        <span className="font-mono text-brand-300 font-bold">
                          {ds.scaledScore !== null ? `${ds.scaledScore.toFixed(1)} / ${ds.weight}` : "Skipped"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-900">
                          <div
                            className="h-full bg-brand-500"
                            style={{
                              width: `${
                                ds.scaledScore !== null ? (ds.scaledScore / ds.weight) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-white/50">
                          {ds.rawSubScore !== null ? `${ds.rawSubScore}/5` : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 2 Columns — Audio Player, Strengths, Improvements */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Audio Player Component */}
              <AudioPlayer />

              {/* Strengths Card */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-success">
                  Key Strengths (Timestamped)
                </h3>
                <div className="flex flex-col gap-3">
                  {activeEvaluation.strengths.length === 0 ? (
                    <p className="text-xs text-white/40 italic">No specific strength spans highlighted.</p>
                  ) : (
                    activeEvaluation.strengths.map((item, idx) => (
                      <EvidenceSpan
                        key={idx}
                        span={item.span}
                        startMs={item.startMs}
                        endMs={item.endMs}
                        reason={item.text}
                        verified={true}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Improvements Card */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-warning">
                  Actionable Improvements (Timestamped)
                </h3>
                <div className="flex flex-col gap-3">
                  {activeEvaluation.improvements.length === 0 ? (
                    <p className="text-xs text-white/40 italic">No improvement spans flagged.</p>
                  ) : (
                    activeEvaluation.improvements.map((item, idx) => (
                      <EvidenceSpan
                        key={idx}
                        span={item.span}
                        startMs={item.startMs}
                        endMs={item.endMs}
                        reason={item.text}
                        verified={true}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <OverridePanel />
    </div>
  );
}
