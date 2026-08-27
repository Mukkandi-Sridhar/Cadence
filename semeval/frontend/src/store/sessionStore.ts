import { create } from "zustand";

export interface PresenterItem {
  id: string;
  name: string;
  queueOrder: number;
  status: "QUEUED" | "RECORDING" | "SCORED" | "SKIPPED";
}

interface SessionState {
  topic: string;
  coveragePoints: string[];
  targetDurationSeconds: number;
  selectedMicDeviceId: string;
  presenterQueue: PresenterItem[];
  activePresenterIndex: number;

  setTopic: (topic: string) => void;
  addCoveragePoint: (point: string) => void;
  removeCoveragePoint: (index: number) => void;
  setTargetDuration: (seconds: number) => void;
  setSelectedMic: (deviceId: string) => void;
  addPresenter: (name: string) => void;
  removePresenter: (id: string) => void;
  reorderPresenter: (fromIndex: number, toIndex: number) => void;
  setActivePresenterIndex: (index: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  topic: "Distributed Systems: Raft Consensus Algorithm",
  coveragePoints: [
    "Leader election mechanism and term numbers",
    "Log replication and safety guarantees",
    "Handling cluster network partitions",
    "Cluster membership changes",
  ],
  targetDurationSeconds: 900, // 15 minutes default
  selectedMicDeviceId: "default",
  presenterQueue: [
    { id: "p1", name: "Ananya Sharma", queueOrder: 1, status: "QUEUED" },
    { id: "p2", name: "Rahul Verma", queueOrder: 2, status: "QUEUED" },
    { id: "p3", name: "Priya Nair", queueOrder: 3, status: "QUEUED" },
  ],
  activePresenterIndex: 0,

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
          id: `p-${Date.now()}`,
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
}));
