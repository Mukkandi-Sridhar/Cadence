import { useState } from "react";

interface HumanRatingModalProps {
  onClose: () => void;
  onSubmit: (score: number, note: string) => Promise<void>;
}

const SCALE = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Weak" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Strong" },
  { value: 5, label: "Excellent" },
];

export function HumanRatingModal({ onClose, onSubmit }: HumanRatingModalProps) {
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (score === null) {
      setError("Please select a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(score, note.trim());
    } catch {
      setError("Could not score this presentation. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-card max-w-lg w-full p-6 flex flex-col gap-5 border border-ink/20">
        <div>
          <h3 className="text-xl font-bold text-ink">Rate Physical Delivery</h3>
          <p className="text-sm text-ink/60 mt-1">
            The AI only reads the transcript — it can't see the presenter. Rate their body
            language, hand gestures, movement, facial expressions, and overall physical
            confidence as one holistic score.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {SCALE.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setScore(s.value)}
              disabled={submitting}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 sm:p-4 transition-all disabled:opacity-50 ${
                score === s.value
                  ? "border-brand-500 bg-brand-600/20 text-ink font-bold"
                  : "border-ink/10 bg-ink/5 text-ink/70 hover:bg-ink/10"
              }`}
            >
              <span className="text-xl sm:text-2xl font-mono">{s.value}</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wide">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-brand-700">
            Note <span className="text-ink/40 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Confident stance, made eye contact, used hand gestures to emphasize key points."
            rows={2}
            disabled={submitting}
            className="w-full rounded-xl border border-ink/10 bg-surface-900 px-4 py-3 text-sm text-ink placeholder-ink/40 focus:border-brand-500 focus:outline-none resize-none disabled:opacity-50"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={submitting}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary" disabled={submitting}>
            {submitting ? "Scoring with AI…" : "Submit & Get Score →"}
          </button>
        </div>
      </div>
    </div>
  );
}
