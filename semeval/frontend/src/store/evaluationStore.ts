import { create } from "zustand";

export interface EvaluationDimensionScore {
  dimension: string;
  weight: number;
  rawSubScore: number | null;
  scaledScore: number | null;
  status: "SCORED" | "SKIPPED" | "INSUFFICIENT_EVIDENCE" | "LOW_CONFIDENCE";
  modelUsed?: string;
  evidence: Array<{
    id: string;
    transcriptSpan: string;
    startMs: number;
    endMs: number;
    reason: string;
    verified: boolean;
  }>;
}

export interface EvaluationData {
  id: string;
  recordingId: string;
  presenterId: string;
  presenterName: string;
  totalScore: number;
  audioQuality: "PASS" | "LOW_CONFIDENCE" | "FAIL";
  modelName: string;
  modelVersion: string;
  promptHash: string;
  temperature: number;
  seed: number | null;
  dimensionScores: EvaluationDimensionScore[];
  strengths: Array<{ text: string; startMs: number; endMs: number; span: string }>;
  improvements: Array<{ text: string; startMs: number; endMs: number; span: string }>;
  overrides: Array<{
    id: string;
    dimension: string | null;
    originalScore: number;
    overrideScore: number;
    actorName: string;
    reason: string;
    createdAt: string;
  }>;
}

export type EvaluationStage = "IDLE" | "TRANSCRIBING" | "ANALYZING_CONTENT" | "ANALYZING_DELIVERY" | "SCORING" | "COMPLETE" | "FAILED";

interface EvaluationState {
  currentStage: EvaluationStage;
  progressPercent: number;
  activeEvaluation: EvaluationData | null;
  activeSeekMs: number | null;
  isOverrideModalOpen: boolean;

  setStage: (stage: EvaluationStage, progress: number) => void;
  setEvaluation: (data: EvaluationData) => void;
  seekToAudioMs: (ms: number) => void;
  openOverrideModal: () => void;
  closeOverrideModal: () => void;
  applyOverride: (dimension: string | null, overrideScore: number, reason: string) => void;
}

export const useEvaluationStore = create<EvaluationState>((set) => ({
  currentStage: "IDLE",
  progressPercent: 0,
  activeEvaluation: null,
  activeSeekMs: null,
  isOverrideModalOpen: false,

  setStage: (currentStage, progressPercent) => set({ currentStage, progressPercent }),
  setEvaluation: (activeEvaluation) => set({ activeEvaluation, currentStage: "COMPLETE", progressPercent: 100 }),
  seekToAudioMs: (activeSeekMs) => set({ activeSeekMs }),
  openOverrideModal: () => set({ isOverrideModalOpen: true }),
  closeOverrideModal: () => set({ isOverrideModalOpen: false }),
  applyOverride: (dimension, overrideScore, reason) =>
    set((state) => {
      if (!state.activeEvaluation) return {};
      const newOverride = {
        id: `ov-${Date.now()}`,
        dimension,
        originalScore: state.activeEvaluation.totalScore,
        overrideScore,
        actorName: "Evaluator (Human)",
        reason,
        createdAt: new Date().toISOString(),
      };
      return {
        isOverrideModalOpen: false,
        activeEvaluation: {
          ...state.activeEvaluation,
          totalScore: dimension === null ? Math.round(overrideScore) : state.activeEvaluation.totalScore,
          overrides: [...state.activeEvaluation.overrides, newOverride],
        },
      };
    }),
}));
