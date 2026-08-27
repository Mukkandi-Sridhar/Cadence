import { useEffect, useRef } from "react";
import { useRecordingStore, LiveTranscriptItem } from "../store/recordingStore";
import { useEvaluationStore, EvaluationStage } from "../store/evaluationStore";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function useEventSource(recordingId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fatalRef = useRef(false);
  const { addTranscriptItem, setAudioHealth } = useRecordingStore();
  const { setStage } = useEvaluationStore();

  useEffect(() => {
    if (!recordingId || fatalRef.current) return;

    const sseUrl = `${API_BASE}/api/v1/stream/${recordingId}`;

    let es: EventSource;
    try {
      es = new EventSource(sseUrl);
    } catch (err) {
      console.warn("[SSE] EventSource constructor failed — offline mode:", err);
      return;
    }
    eventSourceRef.current = es;

    es.addEventListener("transcript", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveTranscriptItem;
        addTranscriptItem(data);
      } catch (err) {
        console.error("[SSE] Failed to parse transcript event:", err);
      }
    });

    es.addEventListener("audio_health", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setAudioHealth(data);
      } catch (err) {
        console.error("[SSE] Failed to parse audio_health event:", err);
      }
    });

    es.addEventListener("job_status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { stage: EvaluationStage; progress: number };
        setStage(data.stage, data.progress);
      } catch (err) {
        console.error("[SSE] Failed to parse job_status event:", err);
      }
    });

    es.onerror = () => {
      // Check if the connection was refused or returned wrong MIME type.
      // readyState 2 = CLOSED (won't reconnect), 0 = CONNECTING (will retry)
      if (es.readyState === EventSource.CLOSED) {
        // Fatal — wrong MIME type, endpoint not found, or network error with no retry
        fatalRef.current = true;
        console.warn("[SSE] Connection closed fatally (backend not reachable or wrong MIME). SSE disabled.");
        es.close();
      }
      // readyState CONNECTING = browser is already retrying, do nothing
    };

    return () => {
      es.close();
    };
  }, [recordingId, addTranscriptItem, setAudioHealth, setStage]);
}
