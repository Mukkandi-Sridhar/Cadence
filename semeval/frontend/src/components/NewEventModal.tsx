import { useState } from "react";

interface NewEventModalProps {
  onClose: () => void;
  onCreate: (name: string, eventDate: string) => Promise<void>;
}

export function NewEventModal({ onClose, onCreate }: NewEventModalProps) {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter an event name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim(), eventDate);
    } catch {
      setError("Could not create the event. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-card max-w-md w-full p-6 flex flex-col gap-5 border border-white/20">
        <h3 className="text-xl font-bold text-white">New Event</h3>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Event Name *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Capstone Demo Day"
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Event Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
