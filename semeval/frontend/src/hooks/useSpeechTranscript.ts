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

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone permission denied. Please allow microphone access and try again.",
  "service-not-allowed": "Microphone permission denied. Please allow microphone access and try again.",
  "audio-capture": "No microphone was found. Check that a microphone is connected and try again.",
  network: "A network hiccup interrupted live transcription — reconnecting…",
};
// Fired constantly during ordinary pauses in speech — never surface as an error.
const SILENT_ERRORS = new Set(["no-speech", "aborted"]);

/**
 * Live browser-side transcription via the Web Speech API, plus a visual mic
 * level meter (from the same getUserMedia stream) so the presenter has some
 * confirmation audio is actually being picked up.
 * Chromium-only (Chrome/Edge) — no server-side ASR involved.
 */
export function useSpeechTranscript() {
  const [isSupported] = useState(() => {
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
  const recordedChunksRef = useRef<Blob[]>([]);

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

  const start = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (!isSupported) {
      setPermissionError(
        "Live transcription needs a Chromium-based browser (Chrome, Edge). Safari/Firefox aren't supported yet."
      );
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setPermissionError("Microphone permission denied. Please allow microphone access and try again.");
      return false;
    }

    startMeter(stream);

    // Record the raw audio too — the live captions below are just a rough
    // real-time preview; the accurate transcript actually used for scoring
    // comes from running this recording through gpt-4o-transcribe on Stop.
    recordedChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.warn("MediaRecorder unavailable — accurate transcription will be skipped:", err);
    }

    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (w.SpeechRecognition ||
      w.webkitSpeechRecognition) as new () => SpeechRecognitionLike;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    startTimeRef.current = Date.now() - usePresentationStore.getState().elapsedSeconds * 1000;

    recognition.onresult = (event) => {
      // Speech is clearly getting through — clear any stale transient error.
      setPermissionError(null);

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
      if (SILENT_ERRORS.has(err.error)) {
        return;
      }
      const message = ERROR_MESSAGES[err.error];
      if (message) {
        setPermissionError(message);
      }
      console.warn("Speech recognition notice:", err.error);
    };

    recognition.onend = () => {
      // Chrome ends recognition after a pause in speech — auto-restart while
      // still recording so the presenter doesn't have to notice or care.
      // Guarded against overlapping start() calls firing InvalidStateError
      // when onend/onerror land close together.
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
    } catch (err) {
      console.warn("Speech recognition failed to start:", err);
      setPermissionError("Could not start live transcription.");
      stopMeter();
      return false;
    }
    return true;
  }, [addTranscriptItem, setInterimText, isSupported, startMeter, stopMeter]);

  /** Stops recognition + recording, returns the recorded audio (or null if unavailable). */
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
    let audioBlob: Blob | null = null;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      audioBlob = await new Promise<Blob | null>((resolve) => {
        mediaRecorder.onstop = () => {
          const chunks = recordedChunksRef.current;
          recordedChunksRef.current = [];
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" }) : null);
        };
        try {
          mediaRecorder.stop();
        } catch {
          resolve(null);
        }
      });
    }

    // Stop the underlying tracks only after the recorder has flushed its
    // final chunk, so the last few seconds of audio aren't cut off.
    stopMeter();
    return audioBlob;
  }, [setInterimText, stopMeter]);

  return { start, stop, isSupported, permissionError, micLevel };
}
