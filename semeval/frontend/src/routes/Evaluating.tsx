import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useEvaluationStore } from "../store/evaluationStore";
import { useSessionStore } from "../store/sessionStore";

export default function Evaluating() {
  const navigate = useNavigate();
  const { currentStage, progressPercent, setStage, activeEvaluation } = useEvaluationStore();
  const { presenterQueue, activePresenterIndex } = useSessionStore();

  const activePresenter = presenterQueue[activePresenterIndex] || { id: "p1", name: "Presenter" };

  useEffect(() => {
    // Stage progression tracker
    let interval: ReturnType<typeof setInterval> | null = null;
    let currentPct = 10;

    interval = setInterval(() => {
      currentPct += 15;
      if (currentPct <= 30) {
        setStage("TRANSCRIBING", currentPct);
      } else if (currentPct <= 60) {
        setStage("ANALYZING_CONTENT", currentPct);
      } else if (currentPct <= 85) {
        setStage("ANALYZING_DELIVERY", currentPct);
      } else if (currentPct <= 95) {
        setStage("SCORING", currentPct);
      } else {
        if (interval) clearInterval(interval);
        if (activeEvaluation) {
          navigate(`/sessions/active/results/${activePresenter.id}`);
        } else {
          // Complete stage redirect
          setStage("COMPLETE", 100);
          navigate(`/sessions/active/results/${activePresenter.id}`);
        }
      }
    }, 1500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [setStage, activeEvaluation, navigate, activePresenter.id]);

  const stagesList = [
    { key: "TRANSCRIBING", title: "1. Transcribing Audio", desc: "Generating punctuated, timestamped transcript via ASR adapter." },
    { key: "ANALYZING_CONTENT", title: "2. Content Analysis", desc: "Checking topic coverage against expected points & technical depth." },
    { key: "ANALYZING_DELIVERY", title: "3. Delivery DSP Metrics", desc: "Measuring WPM, filler word rate, pause distribution, and energy variance." },
    { key: "SCORING", title: "4. Deterministic Scoring", desc: "Verifying transcript evidence and computing weighted score out of 100." },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 flex flex-col justify-center">
        <div className="glass-card p-8 sm:p-10 flex flex-col gap-8 text-center">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Evaluating Presentation</h1>
            <p className="text-sm text-white/60 mt-1">
              Multi-agent AI pipeline evaluating {activePresenter.name}'s presentation.
            </p>
          </div>



          {/* Staged Progress Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono font-semibold text-brand-300">
              <span>{currentStage.replace(/_/g, " ")}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-900 border border-white/10">
              <div
                className="h-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Staged List */}
          <div className="flex flex-col gap-3 text-left">
            {stagesList.map((item, idx) => {
              const activeIdx = stagesList.findIndex((s) => s.key === currentStage);
              const isDone = activeIdx > idx;
              const isCurrent = activeIdx === idx;

              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? "border-brand-500/40 bg-brand-600/10 text-white"
                      : isDone
                      ? "border-success/30 bg-success/5 text-white/80"
                      : "border-white/5 bg-white/5 text-white/40"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isDone
                        ? "bg-success text-black"
                        : isCurrent
                        ? "bg-brand-500 text-white animate-pulse"
                        : "bg-surface-900 text-white/40 border border-white/10"
                    }`}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-white/60 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
