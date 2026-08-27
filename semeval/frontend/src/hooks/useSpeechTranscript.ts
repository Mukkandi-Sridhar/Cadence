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

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

/**
 * Live browser-side transcription via the Web Speech API.
 * Chromium-only (Chrome/Edge) — no server-side ASR involved.
 */
export function useSpeechTranscript() {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startTimeRef = useRef<number>(0);
  const seqRef = useRef(0);

  const addTranscriptItem = usePresentationStore((s) => s.addTranscriptItem);
  const setInterimText = usePresentationStore((s) => s.setInterimText);

  const start = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    if (!isSupported) {
      setPermissionError("Live transcription needs a Chromium-based browser (Chrome, Edge). Safari/Firefox aren't supported yet.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPermissionError("Microphone permission denied. Please allow microphone access and try again.");
      return false;
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
      if (err.error === "not-allowed" || err.error === "service-not-allowed") {
        setPermissionError("Microphone permission denied.");
      }
      console.warn("Speech recognition notice:", err.error);
    };

    recognition.onend = () => {
      // Chrome ends recognition after a pause in speech — auto-restart while
      // still recording so the presenter doesn't have to notice or care.
      if (recognitionRef.current === recognition && usePresentationStore.getState().isRecording) {
        try {
          recognition.start();
        } catch {
          /* already running */
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition failed to start:", err);
      setPermissionError("Could not start live transcription.");
      return false;
    }
    return true;
  }, [addTranscriptItem, setInterimText, isSupported]);

  const stop = useCallback(() => {
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
  }, [setInterimText]);

  return { start, stop, isSupported, permissionError };
}
