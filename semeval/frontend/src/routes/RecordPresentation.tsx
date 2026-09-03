import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { HumanRatingModal } from "../components/HumanRatingModal";
import { AiThinkingOverlay } from "../components/AiThinkingOverlay";
import { usePresentationStore } from "../store/presentationStore";
import { useSpeechTranscript } from "../hooks/useSpeechTranscript";
import { requestScreenWakeLock, releaseScreenWakeLock } from "../lib/wakeLock";
import { apiFetch, apiJson, ApiError } from "../lib/apiConfig";
import { cacheKeys, dropCache } from "../lib/cache";

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
  const [draftMissing, setDraftMissing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "transcribing" | "saving" | "scoring">(null);
  const [transcribeNotice, setTranscribeNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const presentationId = usePresentationStore((s) => s.presentationId);
  const isRecording = usePresentationStore((s) => s.isRecording);
  const elapsedSeconds = usePresentationStore((s) => s.elapsedSeconds);
  const transcript = usePresentationStore((s) => s.transcript);
  const interimText = usePresentationStore((s) => s.interimText);
  const transcriptSaved = usePresentationStore((s) => s.transcriptSaved);
  const beginDraft = usePresentationStore((s) => s.beginDraft);
  const startRecording = usePresentationStore((s) => s.startRecording);
  const stopRecording = usePresentationStore((s) => s.stopRecording);
  const tickElapsed = usePresentationStore((s) => s.tickElapsed);
  const setTranscript = usePresentationStore((s) => s.setTranscript);
  const setTranscriptSaved = usePresentationStore((s) => s.setTranscriptSaved);
  const resetDraft = usePresentationStore((s) => s.resetDraft);

  const { start, stop, resetAudio, captionsSupported, permissionError, micLevel } =
    useSpeechTranscript();

  // Holds the recorded audio between "stop" and a successful upload, so a
  // failed upload can be retried without losing the recording.
  const pendingAudioRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!presId) return;
    beginDraft(presId);
  }, [presId, beginDraft]);

  useEffect(() => {
    if (!presId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<PresentationDetail>(`/api/v1/presentations/${presId}`);
        if (cancelled) return;
        setPresentation(data);
        setLoadError(null);
        setDraftMissing(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Presentation fetch error:", err);
        if (err instanceof ApiError && err.status === 404) {
          // A stale draft in localStorage pointing at a presentation that no
          // longer exists server-side. Without this the page sits forever
          // showing an old timer while every action 404s.
          setDraftMissing(true);
        } else {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not load this presentation. Check your connection."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Warn before closing/refreshing mid-recording or with an unsaved recording.
  useEffect(() => {
    const needsWarning = isRecording || (transcript.length > 0 && !transcriptSaved);
    if (!needsWarning) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording, transcript.length, transcriptSaved]);

  const handleStart = useCallback(async () => {
    setSaveError(null);
    setTranscribeNotice(null);
    // A brand-new take (nothing recorded yet) starts from a clean audio buffer.
    if (transcript.length === 0 && elapsedSeconds === 0) {
      resetAudio();
      pendingAudioRef.current = null;
    }
    const ok = await start();
    if (!ok) return;
    startRecording();
    await requestScreenWakeLock();
  }, [start, startRecording, resetAudio, transcript.length, elapsedSeconds]);

  /** Saves the rough live-caption draft. Returns true on success. */
  const saveRoughTranscript = useCallback(
    async (durationSeconds: number): Promise<boolean> => {
      if (!presId) return false;
      const state = usePresentationStore.getState();
      const transcriptText = state.transcript.map((t) => t.text).join(" ").trim();
      if (!transcriptText) return false;
      try {
        await apiFetch(`/api/v1/presentations/${presId}`, {
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
            duration_seconds: durationSeconds,
            status: "RECORDED",
          }),
        });
        return true;
      } catch (err) {
        console.error("Rough transcript save failed:", err);
        return false;
      }
    },
    [presId]
  );

  /**
   * Uploads the complete recording for accurate transcription, falling back to
   * the rough live captions. Only reports success once the transcript is
   * actually persisted server-side — scoring reads it back from there.
   */
  const uploadAndTranscribe = useCallback(
    async (audioBlob: Blob | null, durationSeconds: number): Promise<boolean> => {
      if (!presId) return false;

      if (audioBlob) {
        setBusy("transcribing");
        try {
          const formData = new FormData();
          const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
          formData.append("audio", audioBlob, `recording.${ext}`);
          formData.append("duration_seconds", String(durationSeconds));

          const data = await apiJson<{ transcript_text: string }>(
            `/api/v1/presentations/${presId}/transcribe`,
            {
              method: "POST",
              body: formData,
              // Upload + speech model on a free-tier instance: give it room,
              // and don't retry automatically (re-uploading a large file on a
              // flaky link usually makes things worse, and it costs money).
              timeoutMs: 180_000,
              retries: 0,
            }
          );

          const text = (data.transcript_text || "").trim();
          if (text) {
            setTranscript([
              {
                id: `accurate-${Date.now()}`,
                text,
                startMs: 0,
                endMs: durationSeconds * 1000,
              },
            ]);
            setTranscriptSaved(true);
            pendingAudioRef.current = null;
            return true;
          }
          setTranscribeNotice(
            "No speech was detected in the recording. Check your microphone and try again."
          );
        } catch (err) {
          console.error("Accurate transcription failed:", err);
          setTranscribeNotice(
            "Accurate transcription failed — falling back to the rough live captions. " +
              "Scoring may be less precise."
          );
        }
      }

      // Fallback: persist whatever the live captions caught.
      setBusy("saving");
      const ok = await saveRoughTranscript(durationSeconds);
      setTranscriptSaved(ok);
      if (!ok) {
        setSaveError(
          audioBlob
            ? "Could not save the transcript. Your recording is still here — tap Retry."
            : "No audio or captions were captured, so there's nothing to score. Please record again."
        );
      }
      return ok;
    },
    [presId, setTranscript, setTranscriptSaved, saveRoughTranscript]
  );

  const handleStop = useCallback(async () => {
    const audioBlob = await stop();
    stopRecording();
    await releaseScreenWakeLock();

    const durationSeconds = usePresentationStore.getState().elapsedSeconds;
    if (!presId) return;

    pendingAudioRef.current = audioBlob;
    setSaveError(null);
    try {
      await uploadAndTranscribe(audioBlob, durationSeconds);
    } finally {
      setBusy(null);
    }
  }, [stop, stopRecording, presId, uploadAndTranscribe]);

  const handleRetrySave = useCallback(async () => {
    setSaveError(null);
    setTranscribeNotice(null);
    const durationSeconds = usePresentationStore.getState().elapsedSeconds;
    try {
      await uploadAndTranscribe(pendingAudioRef.current, durationSeconds);
    } finally {
      setBusy(null);
    }
  }, [uploadAndTranscribe]);

  async function handleSubmitRating(score: number, note: string) {
    if (!presId || !eventId) return;
    setScoreError(null);
    setShowRatingModal(false);
    setBusy("scoring");
    try {
      await apiFetch(`/api/v1/presentations/${presId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ human_physical_score: score, human_note: note || null }),
        timeoutMs: 120_000,
        retries: 0,
      });
      // The presentation, its (new) score and the event's list of statuses
      // are all stale now — drop them so the results page fetches fresh
      // rather than painting a cached "not scored yet".
      dropCache(cacheKeys.score(presId));
      dropCache(cacheKeys.presentation(presId));
      dropCache(cacheKeys.presentations(eventId));
      navigate(`/events/${eventId}/presentations/${presId}/results`);
    } catch (err) {
      console.error("Scoring error:", err);
      setScoreError(
        err instanceof Error ? err.message : "Could not score this presentation."
      );
      setBusy(null);
    }
  }

  async function handleDeletePresentation() {
    if (!presId || !eventId) return;
    if (!window.confirm("Are you sure you want to delete this presentation?")) return;
    try {
      await apiFetch(`/api/v1/presentations/${presId}`, { method: "DELETE" });
      dropCache(cacheKeys.presentation(presId));
      dropCache(cacheKeys.score(presId));
      dropCache(cacheKeys.presentations(eventId));
      resetDraft();
      navigate(`/events/${eventId}`);
    } catch (err) {
      console.error("Delete error:", err);
      setLoadError("Could not delete this presentation. Please try again.");
    }
  }

  function formatTime(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const hasRecording = transcript.length > 0 || elapsedSeconds > 0;
  const draftReady = presentationId === presId;
  const canScore = !isRecording && transcriptSaved && busy === null;

  // A stale draft pointing at a deleted presentation — offer a clean way out
  // rather than leaving the user stuck against a wall of 404s.
  if (draftMissing) {
    return (
      <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-xl px-4 py-16 flex flex-col items-center justify-center">
          <div className="glass-card p-10 flex flex-col items-center gap-4 w-full text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/20 text-warning font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-2xl font-bold text-ink">Presentation Not Found</h2>
            <p className="text-sm text-ink/60">
              This presentation no longer exists — it may have been deleted. Any unsaved
              recording on this page can't be scored against it.
            </p>
            <button
              onClick={() => {
                resetDraft();
                navigate(eventId ? `/events/${eventId}` : "/");
              }}
              className="btn-primary mt-2 py-3 px-6"
            >
              ← Back to Event
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              to={`/events/${eventId}`}
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 w-fit"
            >
              ← Back to Event
            </Link>
            <button
              onClick={handleDeletePresentation}
              className="text-xs font-semibold text-danger/80 hover:text-danger transition-colors flex items-center gap-1"
            >
              🗑️ Delete Presentation
            </button>
          </div>

          <div className="glass-card p-6 flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              {presentation?.team_name || "Loading…"}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              {presentation?.topic || ""}
            </h1>
            {presentation && presentation.members.length > 0 && (
              <p className="text-xs text-ink/60">{presentation.members.join(", ")}</p>
            )}
          </div>

          {loadError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
              ⚠️ {loadError}
            </div>
          )}
          {permissionError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
              ⚠️ {permissionError}
            </div>
          )}
          {!captionsSupported && (
            <div className="rounded-xl border border-info/40 bg-info/10 p-4 text-sm text-info">
              ℹ️ Live captions aren't available in this browser, so the transcript panel will
              stay empty while you speak. Recording and AI scoring work normally — the
              transcript is generated from the audio when you stop.
            </div>
          )}
          {transcribeNotice && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm font-semibold text-warning">
              ⚠️ {transcribeNotice}
            </div>
          )}
          {saveError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <span>⚠️ {saveError}</span>
              {pendingAudioRef.current && (
                <button
                  onClick={handleRetrySave}
                  disabled={busy !== null}
                  className="btn-primary py-2 px-4 text-xs whitespace-nowrap disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {scoreError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
              ⚠️ {scoreError}
            </div>
          )}

          <div className="glass-card p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="font-mono text-5xl sm:text-6xl font-extrabold tracking-tight text-ink">
              {formatTime(elapsedSeconds)}
            </div>
            {isRecording && (
              <div className="flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-danger">
                  <span className="h-2 w-2 rounded-full bg-danger animate-pulse" /> Recording
                </span>
                {/* Live mic level meter — visual confirmation audio is being picked up */}
                <div
                  className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/10"
                  role="progressbar"
                  aria-label="Microphone input level"
                  aria-valuenow={Math.round(micLevel)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width] duration-75 ease-out"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}

            {!isRecording ? (
              <button
                onClick={handleStart}
                disabled={!draftReady || busy !== null}
                className="btn-primary py-4 px-10 text-lg shadow-xl shadow-brand-600/30 disabled:opacity-50"
              >
                ⏺ {hasRecording ? "Resume Recording" : "Start Recording"}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="btn-danger py-4 px-10 text-lg shadow-lg shadow-danger/30"
              >
                ⏹ Stop Recording
              </button>
            )}

            {hasRecording && !isRecording && (
              <p className="text-[11px] text-ink/50 max-w-sm">
                Resuming continues the same recording — the whole talk is transcribed
                together when you finish.
              </p>
            )}
          </div>

          <div className="glass-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                Live Transcript
              </span>
              <span className="text-[11px] font-mono text-ink/50">
                {isRecording ? "streaming" : "paused"}
              </span>
            </div>
            <TranscriptPanel items={transcript} interimText={interimText} />
          </div>

          {canScore && (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center border border-brand-500/30">
              <p className="text-sm text-ink/70">
                Recording saved. Ready to score this presentation?
              </p>
              <button
                onClick={() => setShowRatingModal(true)}
                className="btn-primary py-3 px-8 text-base"
              >
                Get Score →
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {showRatingModal && (
        <HumanRatingModal onClose={() => setShowRatingModal(false)} onSubmit={handleSubmitRating} />
      )}

      {busy === "transcribing" && (
        <AiThinkingOverlay
          title="Transcribing your recording…"
          subtitle="Uploading the audio and running it through an accurate speech model. Longer talks take longer."
        />
      )}
      {busy === "saving" && (
        <AiThinkingOverlay title="Saving transcript…" subtitle="Almost there." />
      )}
      {busy === "scoring" && (
        <AiThinkingOverlay
          title="Scoring with GPT-4o…"
          subtitle="Reading the transcript against the rubric — this takes a few seconds."
        />
      )}
    </div>
  );
}
