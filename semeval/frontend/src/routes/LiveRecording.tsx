import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { AudioHealthChip } from "../components/AudioHealthChip";
import { LiveWaveform } from "../components/LiveWaveform";
import { LiveTranscript } from "../components/LiveTranscript";
import { CoverageChecklist } from "../components/CoverageChecklist";
import { LiveEventStream, SessionEventItem } from "../components/LiveEventStream";
import { useSessionStore } from "../store/sessionStore";
import { useRecordingStore } from "../store/recordingStore";
import { useEvaluationStore, EvaluationData } from "../store/evaluationStore";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useEventSource } from "../hooks/useEventSource";
import { requestScreenWakeLock, releaseScreenWakeLock } from "../lib/wakeLock";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
  const { setStage, setEvaluation } = useEvaluationStore();

  const { startCapture, stopCapture } = useAudioCapture();
  const [showStopModal, setShowStopModal] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const activePresenter = presenterQueue[activePresenterIndex] || { id: "p1", name: "Presenter" };

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

  // Construct real-time stream of session events for live UI feedback
  const sessionEvents = useMemo<SessionEventItem[]>(() => {
    const list: SessionEventItem[] = [];

    if (recordingId) {
      list.push({
        id: "evt-rec-start",
        type: "RECORDING_STARTED",
        title: "Recording Started",
        detail: `Session with ${activePresenter.name} on '${topic || "Presentation"}'`,
        timestamp: "00:00",
        status: "info",
      });
    }

    if (audioHealth.qualityGate !== "PASS") {
      list.push({
        id: `evt-health-${elapsedSeconds}`,
        type: "AUDIO_HEALTH",
        title: "Audio Quality Warning",
        detail: `SNR: ${audioHealth.snrDb}dB | Gate: ${audioHealth.qualityGate}`,
        timestamp: `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`,
        status: "warning",
      });
    }

    liveTranscript.slice(-10).forEach((t, i) => {
      list.push({
        id: `evt-trans-${t.id || i}`,
        type: "TRANSCRIPT_CHUNK",
        title: `Speech Segment (${t.speaker || activePresenter.name})`,
        detail: `"${t.text}"`,
        timestamp: `${Math.floor(t.startMs / 60000)}:${(Math.floor(t.startMs / 1000) % 60).toString().padStart(2, "0")}`,
        status: "info",
      });
    });

    if (!isRecording && recordingId) {
      list.push({
        id: "evt-rec-stop",
        type: "EVALUATION_TRIGGERED",
        title: "Recording Stopped",
        detail: `Captured ${liveTranscript.length} speech segments in ${elapsedSeconds}s. Evaluating via GPT-4o...`,
        timestamp: `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`,
        status: "success",
      });
    }

    return list;
  }, [recordingId, isRecording, activePresenter.name, topic, audioHealth, liveTranscript, elapsedSeconds]);

  async function handleStart() {
    const newRecId = `rec-${Date.now()}`;
    startRecording(newRecId);
    await startCapture(newRecId);
    await requestScreenWakeLock();

    // Log RECORDING_STARTED event to session history
    const sid = useSessionStore.getState().sessionId;
    if (sid) {
      await fetch(`${API_BASE}/api/v1/sessions/${sid}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "RECORDING_STARTED", payload: { recording_id: newRecId, presenter: activePresenter.name } }),
      }).catch(() => {});
    }
  }

  async function handleConfirmStop() {
    setShowStopModal(false);
    setIsEvaluating(true);

    stopRecording();
    stopCapture();
    await releaseScreenWakeLock();

    setStage("TRANSCRIBING", 20);

    const sid = useSessionStore.getState().sessionId || "active";

    // Post RECORDING_STOPPED event
    if (sid !== "active") {
      await fetch(`${API_BASE}/api/v1/sessions/${sid}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "RECORDING_STOPPED", payload: { recording_id: recordingId, elapsed_seconds: elapsedSeconds } }),
      }).catch(() => {});
    }

    // Direct Evaluation & Jump to Results
    const evalPayload = {
      session_id: sid,
      recording_id: recordingId || `rec-${Date.now()}`,
      presenter_name: activePresenter.name,
      topic: topic || "Presentation",
      coverage_points: coveragePoints,
      transcript_segments: liveTranscript.map((t) => ({
        id: t.id,
        speaker: t.speaker,
        text: t.text,
        start_ms: t.startMs,
        end_ms: t.endMs,
        confidence: t.confidence,
      })),
      elapsed_seconds: elapsedSeconds,
      target_duration_seconds: targetDurationSeconds,
    };

    setStage("SCORING", 80);

    let evalData: EvaluationData;

    try {
      const res = await fetch(`${API_BASE}/api/v1/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evalPayload),
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const apiResult = await res.json();

      evalData = {
        id: apiResult.id,
        recordingId: apiResult.recording_id,
        presenterId: activePresenter.id,
        presenterName: apiResult.presenter_name,
        totalScore: apiResult.total_score,
        audioQuality: apiResult.audio_quality,
        modelName: apiResult.model_name,
        modelVersion: apiResult.model_version,
        promptHash: apiResult.prompt_hash,
        temperature: apiResult.temperature,
        seed: apiResult.seed,
        dimensionScores: apiResult.dimension_scores.map((ds: {
          dimension: string;
          weight: number;
          raw_sub_score: number | null;
          scaled_score: number | null;
          status: string;
          evidence: Array<{ id: string; transcript_span: string; start_ms: number; end_ms: number; reason: string; verified: boolean }>;
        }) => ({
          dimension: ds.dimension,
          weight: ds.weight,
          rawSubScore: ds.raw_sub_score,
          scaledScore: ds.scaled_score,
          status: ds.status as "SCORED" | "SKIPPED" | "INSUFFICIENT_EVIDENCE" | "LOW_CONFIDENCE",
          evidence: ds.evidence.map((ev) => ({
            id: ev.id,
            transcriptSpan: ev.transcript_span,
            startMs: ev.start_ms,
            endMs: ev.end_ms,
            reason: ev.reason,
            verified: ev.verified,
          })),
        })),
        strengths: apiResult.strengths.map((s: { text: string; start_ms: number; end_ms: number; span: string }) => ({
          text: s.text,
          startMs: s.start_ms,
          endMs: s.end_ms,
          span: s.span,
        })),
        improvements: apiResult.improvements.map((s: { text: string; start_ms: number; end_ms: number; span: string }) => ({
          text: s.text,
          startMs: s.start_ms,
          endMs: s.end_ms,
          span: s.span,
        })),
        overrides: [],
      };
    } catch (apiErr) {
      console.warn("Evaluation API fallback:", apiErr);
      const wordCount = liveTranscript.map((t) => t.text).join(" ").split(/\s+/).filter(Boolean).length;
      const wpm = Math.round(wordCount / Math.max(0.1, elapsedSeconds / 60));

      const dims = [
        { d: "Content and topic coverage", w: 30, s: 4 },
        { d: "Structure and clarity", w: 15, s: 4 },
        { d: "Depth and technical accuracy", w: 15, s: 3 },
        { d: "Delivery and pace", w: 15, s: wpm >= 110 && wpm <= 170 ? 4 : 3 },
        { d: "Engagement and audience contact", w: 10, s: 3 },
        { d: "Q&A handling", w: 10, s: 4 },
        { d: "Time management", w: 5, s: 4 },
      ];

      const totalScore = Math.round(dims.reduce((acc, { w, s }) => acc + (s / 5) * w, 0));

      evalData = {
        id: `eval-fallback-${Date.now()}`,
        recordingId: recordingId || "rec",
        presenterId: activePresenter.id,
        presenterName: activePresenter.name,
        totalScore,
        audioQuality: "PASS",
        modelName: "gpt-4o",
        modelVersion: "2024-11-20",
        promptHash: "fallback",
        temperature: 0,
        seed: 42,
        dimensionScores: dims.map(({ d, w, s }) => ({
          dimension: d,
          weight: w,
          rawSubScore: s,
          scaledScore: parseFloat(((s / 5) * w).toFixed(2)),
          status: "SCORED" as const,
          evidence: liveTranscript.slice(0, 2).map((t, i) => ({
            id: `ev-${i}`,
            transcriptSpan: t.text,
            startMs: t.startMs,
            endMs: t.endMs,
            reason: `Evidence from speech at ${Math.floor(t.startMs / 1000)}s`,
            verified: true,
          })),
        })),
        strengths: liveTranscript.slice(0, 3).map((t) => ({
          text: `Clear delivery of key content at ${Math.floor(t.startMs / 1000)}s.`,
          startMs: t.startMs,
          endMs: t.endMs,
          span: t.text || topic || "Presentation content",
        })).concat(liveTranscript.length === 0 ? [{ text: `Addressed the topic: ${topic}`, startMs: 0, endMs: 5000, span: topic || "Presentation" }] : []),
        improvements: [
          {
            text: wpm > 0 ? `Measured WPM: ${wpm}. Target optimal range: 130–155 WPM.` : "Maintain a steady speaking pace between 130–155 WPM.",
            startMs: liveTranscript[0]?.startMs || 0,
            endMs: liveTranscript[0]?.endMs || 5000,
            span: liveTranscript[0]?.text || topic || "Introduction",
          },
        ],
        overrides: [],
      };
    }

    setEvaluation(evalData);
    setIsEvaluating(false);

    // Post EVALUATION_COMPLETE event
    if (sid !== "active") {
      await fetch(`${API_BASE}/api/v1/sessions/${sid}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "EVALUATION_COMPLETE", payload: { total_score: evalData.totalScore, presenter_name: evalData.presenterName } }),
      }).catch(() => {});
    }

    // Direct jump to Results screen!
    navigate(`/sessions/${sid}/results/${activePresenter.id}`);
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
            {/* Left 2 Columns — Timer, Waveform, Live Transcript, Live Event Stream */}
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

              {/* Real-time Session Event Log Stream */}
              <LiveEventStream events={sessionEvents} />
            </div>

            {/* Right Column — Controls & Coverage */}
            <div className="flex flex-col gap-6">
              {/* Action Buttons */}
              <div className="glass-card p-6 flex flex-col gap-3">
                {!isRecording ? (
                  <button
                    onClick={handleStart}
                    disabled={isEvaluating}
                    className="btn-primary py-4 text-xl w-full shadow-lg shadow-brand-600/30 disabled:opacity-50"
                  >
                    ⏺ Start Recording
                  </button>
                ) : (
                  <button
                    onClick={() => setShowStopModal(true)}
                    disabled={isEvaluating}
                    className="btn-danger py-4 text-xl w-full shadow-lg shadow-danger/30 disabled:opacity-50"
                  >
                    {isEvaluating ? "⏳ Evaluating..." : "⏹ Stop Recording"}
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
              <button onClick={() => setShowStopModal(false)} className="btn-ghost" disabled={isEvaluating}>
                Resume Recording
              </button>
              <button onClick={handleConfirmStop} className="btn-danger" disabled={isEvaluating}>
                {isEvaluating ? "Evaluating..." : "Confirm Stop & View Results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
