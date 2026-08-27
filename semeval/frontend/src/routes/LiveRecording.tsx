import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { AudioHealthChip } from "../components/AudioHealthChip";
import { LiveWaveform } from "../components/LiveWaveform";
import { LiveTranscript } from "../components/LiveTranscript";
import { CoverageChecklist } from "../components/CoverageChecklist";
import { useSessionStore } from "../store/sessionStore";
import { useRecordingStore } from "../store/recordingStore";
import { useEvaluationStore } from "../store/evaluationStore";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useEventSource } from "../hooks/useEventSource";
import { requestScreenWakeLock, releaseScreenWakeLock } from "../lib/wakeLock";

export default function LiveRecording() {
  const navigate = useNavigate();
  const { topic, coveragePoints, targetDurationSeconds, presenterQueue, activePresenterIndex } = useSessionStore();
  const {
    isRecording,
    isPaused,
    recordingId,
    elapsedSeconds,
    audioHealth,
    liveTranscript,
    coveredPointIndices,
    startRecording,
    stopRecording,
    tickElapsed,
    togglePointCovered,
  } = useRecordingStore();
  const { setStage } = useEvaluationStore();

  const { startCapture, stopCapture } = useAudioCapture();
  const [showStopModal, setShowStopModal] = useState(false);

  const activePresenter = presenterQueue[activePresenterIndex] || { name: "Presenter" };

  useEventSource(recordingId);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        tickElapsed();
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused, tickElapsed]);

  async function handleStart() {
    const newRecId = `rec-${Date.now()}`;
    startRecording(newRecId);
    await startCapture(newRecId);
    await requestScreenWakeLock();
  }

  async function handleConfirmStop() {
    stopRecording();
    stopCapture();
    await releaseScreenWakeLock();
    setShowStopModal(false);
    setStage("TRANSCRIBING", 10);
    navigate("/sessions/active/evaluating");
  }

  function formatTime(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const progressPercent = Math.min(100, (elapsedSeconds / targetDurationSeconds) * 100);

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          {/* Top Bar — Presenter & Health Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Current Presenter</span>
              <h2 className="text-xl font-bold text-white">{activePresenter.name}</h2>
              <p className="text-xs text-white/60 truncate max-w-md">{topic || "Presentation Session"}</p>
            </div>
            <AudioHealthChip
              gate={audioHealth.qualityGate}
              snrDb={audioHealth.snrDb}
              warningsCount={audioHealth.warnings.length}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns — Timer, Waveform, Live Transcript */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Podium View Elapsed Timer */}
              <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                <div className="relative flex flex-col items-center justify-center">
                  <div className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tight text-white">
                    {formatTime(elapsedSeconds)}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/50 mt-1">
                    Target: {formatTime(targetDurationSeconds)}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full mt-4 h-2 rounded-full bg-surface-900 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Waveform */}
              {isRecording && <LiveWaveform />}

              {/* Live Transcript Container */}
              <div className="glass-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                    Live Scrolling Transcript
                  </span>
                  <span className="text-[11px] font-mono text-white/50">streaming</span>
                </div>
                <LiveTranscript items={liveTranscript} />
              </div>
            </div>

            {/* Right Column — Controls & Coverage */}
            <div className="flex flex-col gap-6">
              {/* Action Buttons */}
              <div className="glass-card p-6 flex flex-col gap-3">
                {!isRecording ? (
                  <button
                    onClick={handleStart}
                    className="btn-primary py-4 text-xl w-full shadow-lg shadow-brand-600/30"
                  >
                    ⏺ Start Recording
                  </button>
                ) : (
                  <button
                    onClick={() => setShowStopModal(true)}
                    className="btn-danger py-4 text-xl w-full shadow-lg shadow-danger/30"
                  >
                    ⏹ Stop Recording
                  </button>
                )}
              </div>

              {/* Coverage Checklist */}
              <CoverageChecklist
                points={coveragePoints}
                coveredIndices={coveredPointIndices}
                onTogglePoint={togglePointCovered}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Stop Confirmation Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full p-6 flex flex-col gap-4 border border-white/20">
            <h3 className="text-xl font-bold text-white">Stop Recording?</h3>
            <p className="text-sm text-white/70">
              This will conclude {activePresenter.name}'s presentation and trigger multi-agent AI evaluation immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowStopModal(false)} className="btn-ghost">
                Resume Recording
              </button>
              <button onClick={handleConfirmStop} className="btn-danger">
                Confirm Stop & Evaluate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
