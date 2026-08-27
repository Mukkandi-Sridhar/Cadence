import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { MicLevelMeter } from "../components/MicLevelMeter";
import { useSessionStore } from "../store/sessionStore";
import { useAudioCapture } from "../hooks/useAudioCapture";

export default function SessionSetup() {
  const navigate = useNavigate();
  const {
    topic,
    setTopic,
    coveragePoints,
    addCoveragePoint,
    removeCoveragePoint,
    targetDurationSeconds,
    setTargetDuration,
    presenterQueue,
    addPresenter,
    removePresenter,
    setSessionId,
    setActivePresenterIndex,
  } = useSessionStore();

  const [newPoint, setNewPoint] = useState("");
  const [newPresenterName, setNewPresenterName] = useState("");
  const [isTestMicActive, setIsTestMicActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { micVolume, requestMicPermission } = useAudioCapture();

  async function handleToggleMicTest() {
    if (!isTestMicActive) {
      await requestMicPermission();
      setIsTestMicActive(true);
    } else {
      setIsTestMicActive(false);
    }
  }

  function handleAddPoint(e: React.FormEvent) {
    e.preventDefault();
    if (newPoint.trim()) {
      addCoveragePoint(newPoint.trim());
      setNewPoint("");
      setValidationError(null);
    }
  }

  function handleAddPresenter(e: React.FormEvent) {
    e.preventDefault();
    if (newPresenterName.trim()) {
      addPresenter(newPresenterName.trim());
      setNewPresenterName("");
      setValidationError(null);
    }
  }

  function handleStartSession() {
    if (!topic.trim()) {
      setValidationError("Please enter a seminar topic.");
      return;
    }
    if (coveragePoints.length === 0) {
      setValidationError("Please add at least one expected coverage point.");
      return;
    }
    if (presenterQueue.length === 0) {
      setValidationError("Please add at least one presenter to the queue.");
      return;
    }

    const newSessionId = `sess-${Date.now()}`;
    setSessionId(newSessionId);
    setActivePresenterIndex(0);
    navigate(`/sessions/${newSessionId}/record`);
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Create Evaluation Session
            </h1>
            <p className="mt-1 text-sm sm:text-base text-white/60">
              Set the seminar topic, required coverage points, target presentation duration, and presenter queue.
            </p>
          </div>

          {validationError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              <span>⚠️</span>
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns — Form Controls */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Topic Input */}
              <div className="glass-card p-6 flex flex-col gap-3">
                <label className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Seminar Topic *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="e.g. Architectural Patterns in Microservices"
                  className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-base text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Coverage Points */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold uppercase tracking-wider text-brand-300">
                    Expected Coverage Points * ({coveragePoints.length})
                  </label>
                </div>

                <form onSubmit={handleAddPoint} className="flex gap-2">
                  <input
                    type="text"
                    value={newPoint}
                    onChange={(e) => setNewPoint(e.target.value)}
                    placeholder="Add a required concept to cover..."
                    className="flex-1 rounded-xl border border-white/10 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
                  />
                  <button type="submit" className="btn-primary py-2.5">
                    Add Point
                  </button>
                </form>

                <div className="flex flex-col gap-2 mt-2">
                  {coveragePoints.length === 0 ? (
                    <p className="text-xs text-white/40 italic">No coverage points added yet. Add required concepts above.</p>
                  ) : (
                    coveragePoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/90"
                      >
                        <span className="flex-1">{point}</span>
                        <button
                          onClick={() => removeCoveragePoint(idx)}
                          className="text-white/40 hover:text-danger text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Target Duration */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <label className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Target Duration
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[300, 600, 900, 1200].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTargetDuration(sec)}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        targetDurationSeconds === sec
                          ? "border-brand-500 bg-brand-600/20 text-white font-bold"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-lg font-mono">{sec / 60}m</div>
                      <div className="text-[10px] text-white/50">{sec} seconds</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column — Mic Test & Presenters */}
            <div className="flex flex-col gap-6">
              {/* Mic Selection & Test */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Microphone Test
                </h3>
                <p className="text-xs text-white/60">
                  Test podium room audio for 5 seconds before starting recording.
                </p>

                <button
                  type="button"
                  onClick={handleToggleMicTest}
                  className={`btn-ghost w-full justify-center border py-2.5 ${
                    isTestMicActive ? "border-danger text-danger" : "border-white/20"
                  }`}
                >
                  {isTestMicActive ? "Stop Mic Test" : "🎤 Run 5-Sec Mic Test"}
                </button>

                {isTestMicActive && <MicLevelMeter volume={micVolume} />}
              </div>

              {/* Presenter Queue */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Presenter Queue * ({presenterQueue.length})
                </h3>

                <form onSubmit={handleAddPresenter} className="flex gap-2">
                  <input
                    type="text"
                    value={newPresenterName}
                    onChange={(e) => setNewPresenterName(e.target.value)}
                    placeholder="Presenter full name..."
                    className="flex-1 rounded-xl border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
                  />
                  <button type="submit" className="btn-primary py-2 px-4 text-sm">
                    Add
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  {presenterQueue.length === 0 ? (
                    <p className="text-xs text-white/40 italic">No presenters added. Add presenter names above.</p>
                  ) : (
                    presenterQueue.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/30 text-xs font-mono font-bold text-brand-300">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-white">{p.name}</span>
                        </div>
                        <button
                          onClick={() => removePresenter(p.id)}
                          className="text-white/40 hover:text-danger text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Launch Session Button */}
              <button
                type="button"
                onClick={handleStartSession}
                className="btn-primary py-4 text-lg w-full shadow-xl shadow-brand-600/30"
              >
                Proceed to Live Recording →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
