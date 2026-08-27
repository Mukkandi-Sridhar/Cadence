import { create } from "zustand";

export interface PresenterItem {
  id: string;
  name: string;
  queueOrder: number;
  status: "QUEUED" | "RECORDING" | "SCORED" | "SKIPPED";
}

interface SessionState {
  sessionId: string | null;
  topic: string;
  coveragePoints: string[];
  targetDurationSeconds: number;
  selectedMicDeviceId: string;
  presenterQueue: PresenterItem[];
  activePresenterIndex: number;

  setSessionId: (id: string) => void;
  setTopic: (topic: string) => void;
  addCoveragePoint: (point: string) => void;
  removeCoveragePoint: (index: number) => void;
  setTargetDuration: (seconds: number) => void;
  setSelectedMic: (deviceId: string) => void;
  addPresenter: (name: string) => void;
  removePresenter: (id: string) => void;
  reorderPresenter: (fromIndex: number, toIndex: number) => void;
  setActivePresenterIndex: (index: number) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  topic: "",
  coveragePoints: [],
  targetDurationSeconds: 600, // 10 minutes default
  selectedMicDeviceId: "default",
  presenterQueue: [],
  activePresenterIndex: 0,

  setSessionId: (sessionId) => set({ sessionId }),
  setTopic: (topic) => set({ topic }),
  addCoveragePoint: (point) =>
    set((state) => ({
      coveragePoints: [...state.coveragePoints, point],
    })),
  removeCoveragePoint: (index) =>
    set((state) => ({
      coveragePoints: state.coveragePoints.filter((_, i) => i !== index),
    })),
  setTargetDuration: (seconds) => set({ targetDurationSeconds: seconds }),
  setSelectedMic: (deviceId) => set({ selectedMicDeviceId: deviceId }),
  addPresenter: (name) =>
    set((state) => ({
      presenterQueue: [
        ...state.presenterQueue,
        {
          id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name,
          queueOrder: state.presenterQueue.length + 1,
          status: "QUEUED",
        },
      ],
    })),
  removePresenter: (id) =>
    set((state) => ({
      presenterQueue: state.presenterQueue.filter((p) => p.id !== id),
    })),
  reorderPresenter: (fromIndex, toIndex) =>
    set((state) => {
      const queue = [...state.presenterQueue];
      const [moved] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, moved);
      return { presenterQueue: queue.map((p, idx) => ({ ...p, queueOrder: idx + 1 })) };
    }),
  setActivePresenterIndex: (index) => set({ activePresenterIndex: index }),
  resetSession: () =>
    set({
      sessionId: null,
      topic: "",
      coveragePoints: [],
      targetDurationSeconds: 600,
      selectedMicDeviceId: "default",
      presenterQueue: [],
      activePresenterIndex: 0,
    }),
}));
