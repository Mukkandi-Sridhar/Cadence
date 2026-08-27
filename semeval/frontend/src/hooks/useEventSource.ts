import { useEffect, useRef } from "react";
import { useRecordingStore, LiveTranscriptItem } from "../store/recordingStore";
import { useEvaluationStore, EvaluationStage } from "../store/evaluationStore";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function useEventSource(recordingId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { addTranscriptItem, setAudioHealth } = useRecordingStore();
  const { setStage } = useEvaluationStore();

  useEffect(() => {
    if (!recordingId) return;

    const sseUrl = `${API_BASE}/api/v1/stream/${recordingId}`;

    let es: EventSource;
    try {
      es = new EventSource(sseUrl);
    } catch (err) {
      console.warn("SSE connection failed (non-critical in offline mode):", err);
      return;
    }
    eventSourceRef.current = es;

    es.addEventListener("transcript", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveTranscriptItem;
        addTranscriptItem(data);
      } catch (err) {
        console.error("Error parsing SSE transcript event:", err);
      }
    });

    es.addEventListener("audio_health", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setAudioHealth(data);
      } catch (err) {
        console.error("Error parsing SSE audio_health event:", err);
      }
    });

    es.addEventListener("job_status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { stage: EvaluationStage; progress: number };
        setStage(data.stage, data.progress);
      } catch (err) {
        console.error("Error parsing SSE job_status event:", err);
      }
    });

    es.onerror = () => {
      // Non-fatal — SSE reconnects automatically or may not be available in dev
    };

    return () => {
      es.close();
    };
  }, [recordingId, addTranscriptItem, setAudioHealth, setStage]);
}
