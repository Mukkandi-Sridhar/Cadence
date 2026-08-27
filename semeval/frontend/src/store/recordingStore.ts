import { create } from "zustand";

export interface LiveTranscriptItem {
  id: string;
  speaker: string;
  speakerRole: "PRESENTER" | "AUDIENCE" | "MODERATOR";
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface AudioHealthState {
  rmsDbfs: number;
  snrDb: number;
  clippingRatio: number;
  silenceRatio: number;
  speechRatio: number;
  qualityGate: "PASS" | "LOW_CONFIDENCE" | "FAIL";
  warnings: Array<{ code: string; message: string; startMs: number; endMs: number }>;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingId: string | null;
  elapsedSeconds: number;
  audioHealth: AudioHealthState;
  liveTranscript: LiveTranscriptItem[];
  coveredPointIndices: number[];
  wakeLockActive: boolean;

  startRecording: (recordingId: string) => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  tickElapsed: () => void;
  setAudioHealth: (health: Partial<AudioHealthState>) => void;
  addTranscriptItem: (item: LiveTranscriptItem) => void;
  togglePointCovered: (index: number) => void;
  setWakeLockActive: (active: boolean) => void;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  isPaused: false,
  recordingId: null,
  elapsedSeconds: 0,
  audioHealth: {
    rmsDbfs: -22.4,
    snrDb: 24.5,
    clippingRatio: 0.0001,
    silenceRatio: 0.15,
    speechRatio: 0.85,
    qualityGate: "PASS",
    warnings: [],
  },
  liveTranscript: [],
  coveredPointIndices: [0],
  wakeLockActive: false,

  startRecording: (recordingId) =>
    set({
      isRecording: true,
      isPaused: false,
      recordingId,
      elapsedSeconds: 0,
      liveTranscript: [],
    }),
  pauseRecording: () => set({ isPaused: true }),
  resumeRecording: () => set({ isPaused: false }),
  stopRecording: () => set({ isRecording: false, isPaused: false }),
  tickElapsed: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  setAudioHealth: (health) =>
    set((state) => ({
      audioHealth: { ...state.audioHealth, ...health },
    })),
  addTranscriptItem: (item) =>
    set((state) => ({
      liveTranscript: [...state.liveTranscript, item],
    })),
  togglePointCovered: (index) =>
    set((state) => {
      const exists = state.coveredPointIndices.includes(index);
      return {
        coveredPointIndices: exists
          ? state.coveredPointIndices.filter((i) => i !== index)
          : [...state.coveredPointIndices, index],
      };
    }),
  setWakeLockActive: (active) => set({ wakeLockActive: active }),
  resetRecording: () =>
    set({
      isRecording: false,
      isPaused: false,
      recordingId: null,
      elapsedSeconds: 0,
      liveTranscript: [],
      coveredPointIndices: [],
    }),
}));
