import { useState } from "react";
import { useEvaluationStore } from "../store/evaluationStore";

export function OverridePanel() {
  const { isOverrideModalOpen, closeOverrideModal, applyOverride, activeEvaluation } = useEvaluationStore();
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [newScore, setNewScore] = useState<number>(activeEvaluation?.totalScore || 75);
  const [reason, setReason] = useState<string>("");

  if (!isOverrideModalOpen || !activeEvaluation) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    applyOverride(selectedDimension, newScore, reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-card max-w-lg w-full p-6 flex flex-col gap-4 border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-lg font-bold text-white">Human Evaluator Override</h3>
          <button onClick={closeOverrideModal} className="text-white/60 hover:text-white text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1">Target Dimension</label>
            <select
              value={selectedDimension || "TOTAL"}
              onChange={(e) => setSelectedDimension(e.target.value === "TOTAL" ? null : e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="TOTAL">Total Score (Overall)</option>
              {activeEvaluation.dimensionScores.map((ds) => (
                <option key={ds.dimension} value={ds.dimension}>
                  {ds.dimension} (Current: {ds.scaledScore ?? "Skipped"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1">New Score (0 - 100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={newScore}
              onChange={(e) => setNewScore(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1">Reason for Override (Audit Log)</label>
            <textarea
              required
              minLength={10}
              rows={3}
              placeholder="Provide a detailed justification for overriding the AI score..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeOverrideModal} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Confirm & Save Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
