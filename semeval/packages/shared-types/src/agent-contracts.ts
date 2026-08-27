import { z } from "zod";

// ── Evidence Object (R2) ───────────────────────────────────────────────────
export const EvidenceSchema = z.object({
  transcript_span: z.string().min(1),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  reason: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ── AudioHealthAgent Output ───────────────────────────────────────────────
export const AudioHealthWarningCodeSchema = z.enum([
  "TOO_QUIET",
  "CLIPPING",
  "MIC_MUTED",
  "HEAVY_NOISE",
  "WRONG_DEVICE",
  "OVERLAP_DETECTED",
]);
export type AudioHealthWarningCode = z.infer<typeof AudioHealthWarningCodeSchema>;

export const AudioHealthWarningSchema = z.object({
  code: AudioHealthWarningCodeSchema,
  message: z.string(),
  start_ms: z.number().int(),
  end_ms: z.number().int(),
});
export type AudioHealthWarning = z.infer<typeof AudioHealthWarningSchema>;

export const AudioQualityGateSchema = z.enum(["PASS", "LOW_CONFIDENCE", "FAIL"]);
export type AudioQualityGate = z.infer<typeof AudioQualityGateSchema>;

export const AudioHealthAgentOutputSchema = z.object({
  rms_dbfs: z.number(),
  snr_db: z.number(),
  clipping_ratio: z.number().min(0).max(1),
  silence_ratio: z.number().min(0).max(1),
  speech_ratio: z.number().min(0).max(1),
  estimated_distance_proxy: z.number(),
  warnings: z.array(AudioHealthWarningSchema),
  quality_gate: AudioQualityGateSchema,
});
export type AudioHealthAgentOutput = z.infer<typeof AudioHealthAgentOutputSchema>;

// ── TranscriptionAgent Output ─────────────────────────────────────────────
export const WordTimestampSchema = z.object({
  word: z.string(),
  start_ms: z.number().int(),
  end_ms: z.number().int(),
  confidence: z.number().min(0).max(1),
});
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const TranscriptSegmentSchema = z.object({
  segment_id: z.string(),
  start_ms: z.number().int(),
  end_ms: z.number().int(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  language: z.string(),
  is_partial: z.boolean().optional(),
  words: z.array(WordTimestampSchema).optional(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

// ── DiarizationAgent Output ───────────────────────────────────────────────
export const SpeakerRoleSchema = z.enum(["PRESENTER", "AUDIENCE", "MODERATOR", "UNKNOWN"]);
export type SpeakerRole = z.infer<typeof SpeakerRoleSchema>;

export const DiarizedSegmentSchema = z.object({
  segment_id: z.string(),
  start_ms: z.number().int(),
  end_ms: z.number().int(),
  speaker_label: z.string(),
  speaker_role: SpeakerRoleSchema,
  overlap: z.boolean().optional(),
});
export type DiarizedSegment = z.infer<typeof DiarizedSegmentSchema>;

// ── IdentityAgent Output ──────────────────────────────────────────────────
export const IdentityFlagSchema = z.enum(["POSSIBLE_MISMATCH", "POSSIBLE_PLAYBACK"]);
export type IdentityFlag = z.infer<typeof IdentityFlagSchema>;

export const IdentityAgentOutputSchema = z.object({
  presenter_id: z.string(),
  match_score: z.number().min(0).max(1),
  flags: z.array(IdentityFlagSchema),
  playback_indicators: z
    .object({
      reverb_absent: z.boolean(),
      breath_absent: z.boolean(),
      near_zero_variance: z.boolean(),
    })
    .optional(),
});
export type IdentityAgentOutput = z.infer<typeof IdentityAgentOutputSchema>;

// ── ContentAgent Output ───────────────────────────────────────────────────
export const CoverageStatusSchema = z.enum(["COVERED", "PARTIALLY_COVERED", "MISSING"]);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

export const CoveragePointResultSchema = z.object({
  point: z.string(),
  status: CoverageStatusSchema,
  evidence: EvidenceSchema.optional(),
});
export type CoveragePointResult = z.infer<typeof CoveragePointResultSchema>;

export const ContentAgentOutputSchema = z.object({
  sub_score: z.number().int().min(0).max(5),
  evidence: z.array(EvidenceSchema).min(1),
  coverage_points: z.array(CoveragePointResultSchema),
  slide_reading_overlap_ratio: z.number().min(0).max(1).optional(),
});
export type ContentAgentOutput = z.infer<typeof ContentAgentOutputSchema>;

// ── DeliveryAgent Output ──────────────────────────────────────────────────
export const DeliveryMeasuredMetricsSchema = z.object({
  wpm_mean: z.number(),
  wpm_over_time: z.array(z.number()),
  filler_rate: z.number(),
  filler_words_found: z.array(z.string()).optional(),
  longest_pause_ms: z.number().int(),
  pause_distribution: z.record(z.number()).optional(),
  pitch_variance: z.number(),
  energy_variance: z.number(),
  repetition_rate: z.number(),
});
export type DeliveryMeasuredMetrics = z.infer<typeof DeliveryMeasuredMetricsSchema>;

export const DeliveryAgentOutputSchema = z.object({
  sub_score: z.number().int().min(0).max(5),
  evidence: z.array(EvidenceSchema).min(1),
  measured_metrics: DeliveryMeasuredMetricsSchema,
  interpretation: z.string().min(1),
});
export type DeliveryAgentOutput = z.infer<typeof DeliveryAgentOutputSchema>;

// ── QnAAgent Output ───────────────────────────────────────────────────────
export const AnswerQualitySchema = z.enum([
  "DIRECT",
  "PARTIAL",
  "DEFLECTED",
  "HONEST_UNKNOWN",
]);
export type AnswerQuality = z.infer<typeof AnswerQualitySchema>;

export const QnAHandledQuestionSchema = z.object({
  question_text: z.string(),
  answer_quality: AnswerQualitySchema,
});
export type QnAHandledQuestion = z.infer<typeof QnAHandledQuestionSchema>;

export const QnAAgentOutputSchema = z.object({
  skipped: z.boolean(),
  skip_reason: z.string().optional(),
  sub_score: z.number().int().min(0).max(5),
  evidence: z.array(EvidenceSchema).min(1),
  questions_handled: z.array(QnAHandledQuestionSchema).optional(),
});
export type QnAAgentOutput = z.infer<typeof QnAAgentOutputSchema>;

// ── Rubric & Evaluation Results ───────────────────────────────────────────
export const DimensionStatusSchema = z.enum([
  "SCORED",
  "SKIPPED",
  "INSUFFICIENT_EVIDENCE",
  "LOW_CONFIDENCE",
]);
export type DimensionStatus = z.infer<typeof DimensionStatusSchema>;

export const DimensionScoreResultSchema = z.object({
  dimension: z.string(),
  weight: z.number(),
  raw_sub_score: z.number().min(0).max(5).nullable(),
  scaled_score: z.number().nullable(),
  status: DimensionStatusSchema,
  evidence: z.array(EvidenceSchema).optional(),
  model_used: z.string().nullable().optional(),
});
export type DimensionScoreResult = z.infer<typeof DimensionScoreResultSchema>;

export const EvaluationResultSchema = z.object({
  total_score: z.number().int().min(0).max(100),
  dimension_scores: z.array(DimensionScoreResultSchema),
  rubric_version_id: z.string(),
  model_name: z.string(),
  model_version: z.string(),
  prompt_hash: z.string(),
  temperature: z.number(),
  seed: z.number().nullable().optional(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ── CalibrationAgent Output ───────────────────────────────────────────────
export const DriftFlagSchema = z.enum(["MEAN_TOO_HIGH", "STD_TOO_LOW", "MEAN_TOO_LOW"]);
export type DriftFlag = z.infer<typeof DriftFlagSchema>;

export const CalibrationReportSchema = z.object({
  session_id: z.string(),
  score_distribution: z.object({
    mean: z.number(),
    std_dev: z.number(),
    min: z.number(),
    max: z.number(),
    count: z.number().int(),
  }),
  drift_flags: z.array(DriftFlagSchema),
});
export type CalibrationReport = z.infer<typeof CalibrationReportSchema>;

// ── ReportAgent Output ────────────────────────────────────────────────────
export const ReportFeedbackItemSchema = z.object({
  text: z.string(),
  evidence: EvidenceSchema,
});
export type ReportFeedbackItem = z.infer<typeof ReportFeedbackItemSchema>;

export const ReportAgentOutputSchema = z.object({
  strengths: z.array(ReportFeedbackItemSchema).length(3),
  improvements: z.array(ReportFeedbackItemSchema).length(3),
});
export type ReportAgentOutput = z.infer<typeof ReportAgentOutputSchema>;
