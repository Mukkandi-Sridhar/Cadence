import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { HumanRatingModal } from "../components/HumanRatingModal";
import { usePresentationStore } from "../store/presentationStore";
import { useSpeechTranscript } from "../hooks/useSpeechTranscript";
import { requestScreenWakeLock, releaseScreenWakeLock } from "../lib/wakeLock";
import { getApiBaseUrl } from "../lib/apiConfig";

interface PresentationDetail {
  id: string;
  event_id: string;
  team_name: string;
  members: string[];
  topic: string;
  custom_instructions: string | null;
  status: string;
}

export default function RecordPresentation() {
  const { eventId, presId } = useParams<{ eventId: string; presId: string }>();
  const navigate = useNavigate();

  const [presentation, setPresentation] = useState<PresentationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const presentationId = usePresentationStore((s) => s.presentationId);
  const isRecording = usePresentationStore((s) => s.isRecording);
  const elapsedSeconds = usePresentationStore((s) => s.elapsedSeconds);
  const transcript = usePresentationStore((s) => s.transcript);
  const interimText = usePresentationStore((s) => s.interimText);
  const beginDraft = usePresentationStore((s) => s.beginDraft);
  const startRecording = usePresentationStore((s) => s.startRecording);
  const stopRecording = usePresentationStore((s) => s.stopRecording);
  const tickElapsed = usePresentationStore((s) => s.tickElapsed);

  const { start, stop, isSupported, permissionError } = useSpeechTranscript();

  useEffect(() => {
    if (!presId) return;
    beginDraft(presId);
  }, [presId, beginDraft]);

  useEffect(() => {
    if (!presId) return;
    const baseUrl = getApiBaseUrl();
    fetch(`${baseUrl}/api/v1/presentations/${presId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.json();
      })
      .then((data: PresentationDetail) => setPresentation(data))
      .catch((err) => {
        console.error("Presentation fetch error:", err);
        setLoadError("Could not load this presentation. Make sure the API is running.");
      });
  }, [presId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRecording) {
      timer = setInterval(() => tickElapsed(), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, tickElapsed]);

  const handleStart = useCallback(async () => {
    const ok = await start();
    if (!ok) return;
    startRecording();
    await requestScreenWakeLock();
  }, [start, startRecording]);

  const handleStop = useCallback(async () => {
    stop();
    stopRecording();
    await releaseScreenWakeLock();

    if (presId) {
      const baseUrl = getApiBaseUrl();
      const state = usePresentationStore.getState();
      const transcriptText = state.transcript.map((t) => t.text).join(" ");
      fetch(`${baseUrl}/api/v1/presentations/${presId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_text: transcriptText,
          transcript_segments: state.transcript.map((t) => ({
            id: t.id,
            text: t.text,
            start_ms: t.startMs,
            end_ms: t.endMs,
          })),
          duration_seconds: state.elapsedSeconds,
          status: "RECORDED",
        }),
      }).catch((err) => console.warn("Transcript save failed (kept in local draft):", err));
    }
  }, [stop, stopRecording, presId]);

  async function handleSubmitRating(score: number, note: string) {
    if (!presId || !eventId) return;
    setScoreError(null);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/presentations/${presId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ human_physical_score: score, human_note: note || null }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Scoring failed: ${res.status} ${text}`);
      }
      setShowRatingModal(false);
      navigate(`/events/${eventId}/presentations/${presId}/results`);
    } catch (err) {
      console.error("Scoring error:", err);
      setScoreError("Could not score this presentation. Check your connection and try again.");
      throw err;
    }
  }

  function formatTime(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const hasTranscript = transcript.length > 0;
  const draftReady = presentationId === presId;

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <Link
            to={`/events/${eventId}`}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 w-fit"
          >
            ← Back to Event
          </Link>

          <div className="glass-card p-6 flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
              {presentation?.team_name || "Loading…"}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">{presentation?.topic || ""}</h1>
            {presentation && presentation.members.length > 0 && (
              <p className="text-xs text-white/60">{presentation.members.join(", ")}</p>
            )}
          </div>

          {loadError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
              ⚠️ {loadError}
            </div>
          )}
          {permissionError && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm font-semibold text-warning">
              ⚠️ {permissionError}
            </div>
          )}
          {!isSupported && !permissionError && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm font-semibold text-warning">
              ⚠️ Live transcription needs a Chromium-based browser (Chrome, Edge). Safari/Firefox
              aren't supported yet.
            </div>
          )}
          {scoreError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
              ⚠️ {scoreError}
            </div>
          )}

          <div className="glass-card p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="font-mono text-6xl font-extrabold tracking-tight text-white">
              {formatTime(elapsedSeconds)}
            </div>
            {isRecording && (
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-danger">
                <span className="h-2 w-2 rounded-full bg-danger animate-pulse" /> Recording
              </span>
            )}

            {!isRecording ? (
              <button
                onClick={handleStart}
                disabled={!draftReady}
                className="btn-primary py-4 px-10 text-lg shadow-xl shadow-brand-600/30 disabled:opacity-50"
              >
                ⏺ {hasTranscript ? "Resume Recording" : "Start Recording"}
              </button>
            ) : (
              <button onClick={handleStop} className="btn-danger py-4 px-10 text-lg shadow-lg shadow-danger/30">
                ⏹ Stop Recording
              </button>
            )}
          </div>

          <div className="glass-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70">Live Transcript</span>
              <span className="text-[11px] font-mono text-white/50">{isRecording ? "streaming" : "paused"}</span>
            </div>
            <TranscriptPanel items={transcript} interimText={interimText} />
          </div>

          {!isRecording && hasTranscript && (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center border border-brand-500/30">
              <p className="text-sm text-white/70">Recording stopped. Ready to score this presentation?</p>
              <button onClick={() => setShowRatingModal(true)} className="btn-primary py-3 px-8 text-base">
                Get Score →
              </button>
            </div>
          )}
        </div>
      </main>

      {showRatingModal && (
        <HumanRatingModal onClose={() => setShowRatingModal(false)} onSubmit={handleSubmitRating} />
      )}
    </div>
  );
}
