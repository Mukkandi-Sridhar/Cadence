import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TranscriptItem {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

interface PresentationDraftState {
  presentationId: string | null;
  isRecording: boolean;
  elapsedSeconds: number;
  transcript: TranscriptItem[];
  interimText: string;
  humanScore: number | null;
  humanNote: string;

  beginDraft: (presentationId: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  tickElapsed: () => void;
  addTranscriptItem: (item: TranscriptItem) => void;
  setTranscript: (items: TranscriptItem[]) => void;
  setInterimText: (text: string) => void;
  setHumanScore: (score: number | null) => void;
  setHumanNote: (note: string) => void;
  resetDraft: () => void;
}

const EMPTY_DRAFT = {
  isRecording: false,
  elapsedSeconds: 0,
  transcript: [] as TranscriptItem[],
  interimText: "",
  humanScore: null as number | null,
  humanNote: "",
};

export const usePresentationStore = create<PresentationDraftState>()(
  persist(
    (set, get) => ({
      presentationId: null,
      ...EMPTY_DRAFT,

      beginDraft: (presentationId) => {
        if (get().presentationId === presentationId) return;
        set({ presentationId, ...EMPTY_DRAFT });
      },
      startRecording: () => set({ isRecording: true }),
      stopRecording: () => set({ isRecording: false, interimText: "" }),
      tickElapsed: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
      addTranscriptItem: (item) =>
        set((s) => ({ transcript: [...s.transcript, item], interimText: "" })),
      setTranscript: (items) => set({ transcript: items, interimText: "" }),
      setInterimText: (text) => set({ interimText: text }),
      setHumanScore: (score) => set({ humanScore: score }),
      setHumanNote: (note) => set({ humanNote: note }),
      resetDraft: () => set({ presentationId: null, ...EMPTY_DRAFT }),
    }),
    {
      name: "cadence_presentation_draft",
      partialize: (s) => ({
        presentationId: s.presentationId,
        elapsedSeconds: s.elapsedSeconds,
        transcript: s.transcript,
        humanScore: s.humanScore,
        humanNote: s.humanNote,
        // isRecording / interimText intentionally excluded — a page refresh
        // should never resume in a "still recording" state.
      }),
    }
  )
);
