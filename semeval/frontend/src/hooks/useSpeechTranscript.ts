import { useCallback, useRef, useState } from "react";
import { usePresentationStore } from "../store/presentationStore";

interface SpeechRecognitionResultLike {
  isFinal?: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

// Live captions are a best-effort convenience only — the transcript that
// actually gets scored always comes from the recorded audio. So caption
// failures are never surfaced as blocking errors.
const SILENT_CAPTION_ERRORS = new Set(["no-speech", "aborted", "network"]);

/**
 * Records the presentation audio (the source of truth for scoring) and, on
 * Chromium, additionally shows rough live captions via the Web Speech API.
 *
 * Two deliberate properties:
 *  - Recording NEVER depends on Web Speech. Captions are a nice-to-have that
 *    is missing on Safari/Firefox and flaky even on Chrome (it needs its own
 *    connection to Google's servers); gating recording on it would break the
 *    whole feature for no reason.
 *  - Audio chunks accumulate ACROSS pause/resume cycles, so stopping always
 *    yields the complete recording from the very beginning, not just the
 *    latest segment.
 */
export function useSpeechTranscript() {
  const [captionsSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startTimeRef = useRef<number>(0);
  const seqRef = useRef(0);
  const restartingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Accumulates across every start/stop cycle for this presentation — only
  // cleared explicitly via resetAudio() when a genuinely new take begins.
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedMimeRef = useRef<string>("audio/webm");

  const addTranscriptItem = usePresentationStore((s) => s.addTranscriptItem);
  const setInterimText = usePresentationStore((s) => s.setInterimText);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtxClass();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const pcmData = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(pcmData);
      let sumSquares = 0;
      for (let i = 0; i < pcmData.length; i++) {
        sumSquares += pcmData[i] * pcmData[i];
      }
      const rms = Math.sqrt(sumSquares / pcmData.length);
      const dbfs = 20 * Math.log10(Math.max(rms, 1e-5));
      // Map roughly -55dBFS..-5dBFS onto 0..100 for a responsive on-screen meter.
      const normalized = Math.max(0, Math.min(100, (dbfs + 55) * (100 / 50)));
      setMicLevel(normalized);
      meterFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  /** Best-effort live captions. Never blocks or fails recording. */
  const startCaptions = useCallback(() => {
    if (!captionsSupported) return;

    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (w.SpeechRecognition ||
      w.webkitSpeechRecognition) as new () => SpeechRecognitionLike;

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const results = event.results as unknown as SpeechRecognitionResultLike[];
      let interim = "";
      for (let i = event.resultIndex; i < results.length; i++) {
        const res = results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) {
          if (text) {
            const now = Date.now();
            seqRef.current += 1;
            addTranscriptItem({
              id: `tr-${now}-${seqRef.current}`,
              text,
              startMs: now - startTimeRef.current,
              endMs: now - startTimeRef.current,
            });
          }
        } else {
          interim += `${text} `;
        }
      }
      setInterimText(interim.trim());
    };

    recognition.onerror = (err) => {
      if (!SILENT_CAPTION_ERRORS.has(err.error)) {
        console.warn("Live caption notice (recording is unaffected):", err.error);
      }
    };

    recognition.onend = () => {
      // Chrome ends recognition after a pause in speech — auto-restart while
      // still recording. Guarded against overlapping start() calls firing
      // InvalidStateError when onend/onerror land close together.
      if (recognitionRef.current !== recognition) return;
      if (!usePresentationStore.getState().isRecording) return;
      if (restartingRef.current) return;

      restartingRef.current = true;
      try {
        recognition.start();
      } catch {
        /* already running */
      } finally {
        setTimeout(() => {
          restartingRef.current = false;
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [captionsSupported, addTranscriptItem, setInterimText]);

  /** Clears accumulated audio — call when starting a genuinely new take. */
  const resetAudio = useCallback(() => {
    recordedChunksRef.current = [];
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermissionError(
        "This browser can't record audio. Please use a recent version of Chrome, Edge, or Safari."
      );
      return false;
    }

    let stream: MediaStream;
    try {
      // Mono + 16kHz is what speech models want anyway, and keeps the upload
      // small enough to survive a slow connection.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setPermissionError(
        name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No microphone found. Connect a microphone and try again."
          : "Microphone permission denied. Allow microphone access in your browser and try again."
      );
      return false;
    }

    startMeter(stream);

    // The recorded audio — not the live captions — is what gets scored.
    try {
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4", // Safari
      ];
      const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t));
      const mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        // ~24kbps mono opus: plenty for speech recognition, roughly 5x smaller
        // than Chrome's default, which matters a lot on a slow uplink.
        audioBitsPerSecond: 24000,
      });
      recordedMimeRef.current = mediaRecorder.mimeType || mimeType || "audio/webm";

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      // Flush every 5s so a crash/refresh loses at most a few seconds.
      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("MediaRecorder failed to start:", err);
      setPermissionError("Could not start audio recording on this browser.");
      stopMeter();
      return false;
    }

    // Keep caption timestamps continuous across pause/resume.
    startTimeRef.current = Date.now() - usePresentationStore.getState().elapsedSeconds * 1000;
    startCaptions();

    return true;
  }, [startMeter, stopMeter, startCaptions]);

  /**
   * Stops recognition + recording and returns the COMPLETE recording so far
   * (every segment across all pause/resume cycles), or null if no audio was
   * captured at all.
   */
  const stop = useCallback(async (): Promise<Blob | null> => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null; // prevents the onend auto-restart
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    }
    setInterimText("");

    const mediaRecorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        try {
          mediaRecorder.stop();
        } catch {
          resolve();
        }
      });
    }

    // Stop the mic only after the recorder has flushed its final chunk, so
    // the last few seconds of audio aren't cut off.
    stopMeter();

    const chunks = recordedChunksRef.current;
    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: recordedMimeRef.current });
  }, [setInterimText, stopMeter]);

  return {
    start,
    stop,
    resetAudio,
    captionsSupported,
    permissionError,
    micLevel,
  };
}
