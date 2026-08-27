import { useState } from "react";

export interface NewPresentationData {
  teamName: string;
  members: string[];
  topic: string;
  customInstructions: string | null;
}

interface NewPresentationModalProps {
  onClose: () => void;
  onCreate: (data: NewPresentationData) => Promise<void>;
}

export function NewPresentationModal({ onClose, onCreate }: NewPresentationModalProps) {
  const [teamName, setTeamName] = useState("");
  const [topic, setTopic] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMember() {
    const trimmed = memberInput.trim();
    if (trimmed && !members.includes(trimmed)) {
      setMembers((prev) => [...prev, trimmed]);
    }
    setMemberInput("");
  }

  function handleMemberKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addMember();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) {
      setError("Please enter a team name.");
      return;
    }
    if (!topic.trim()) {
      setError("Please enter a presentation topic.");
      return;
    }
    const finalMembers = memberInput.trim()
      ? [...members, memberInput.trim()]
      : members;
    if (finalMembers.length === 0) {
      setError("Please add at least one team member.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        teamName: teamName.trim(),
        members: finalMembers,
        topic: topic.trim(),
        customInstructions: customInstructions.trim() || null,
      });
    } catch {
      setError("Could not create the presentation. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto py-10">
      <div className="glass-card max-w-lg w-full p-6 flex flex-col gap-5 border border-white/20 my-auto">
        <h3 className="text-xl font-bold text-white">New Presentation</h3>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Team Name *
            </label>
            <input
              autoFocus
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Team Vector"
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Team Members *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={handleMemberKeyDown}
                placeholder="Type a name, press Enter to add"
                className="flex-1 rounded-xl border border-white/10 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
              />
              <button type="button" onClick={addMember} className="btn-primary py-2.5 px-4 text-sm">
                Add
              </button>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {members.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 border border-brand-500/30 px-3 py-1 text-xs font-semibold text-brand-300"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => setMembers((prev) => prev.filter((x) => x !== m))}
                      className="text-brand-300/70 hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Presentation Topic *
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Retrieval Augmented Generation for Support Bots"
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Custom Evaluation Instructions{" "}
              <span className="text-white/40 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Focus heavily on whether they explain the math behind attention, and penalize skipping the live demo."
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create & Start →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
