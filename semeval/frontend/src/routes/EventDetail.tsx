import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PresentationCard } from "../components/PresentationCard";
import { NewPresentationModal, NewPresentationData } from "../components/NewPresentationModal";
import { getApiBaseUrl } from "../lib/apiConfig";

interface EventItem {
  id: string;
  name: string;
  event_date: string;
}

interface PresentationItem {
  id: string;
  event_id: string;
  team_name: string;
  members: string[];
  topic: string;
  status: string;
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const baseUrl = getApiBaseUrl();
    (async () => {
      setLoading(true);
      try {
        const [evRes, presRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/events/${eventId}`),
          fetch(`${baseUrl}/api/v1/events/${eventId}/presentations`),
        ]);
        if (evRes.ok) setEvent(await evRes.json());
        if (presRes.ok) setPresentations(await presRes.json());
        setError(null);
      } catch (err) {
        console.error("Event detail fetch error:", err);
        setError("Could not load this event. Make sure the API is running.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function handleCreate(data: NewPresentationData) {
    if (!eventId) return;
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/events/${eventId}/presentations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: data.teamName,
        members: data.members,
        topic: data.topic,
        custom_instructions: data.customInstructions,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create presentation: ${res.status}`);
    const created = await res.json();
    setShowModal(false);
    navigate(`/events/${eventId}/presentations/${created.id}/record`);
  }

  return (
    <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <Link to="/" className="text-xs font-semibold text-brand-700 hover:text-brand-900 w-fit">
            ← All Events
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Event</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">
                {event?.name || (loading ? "Loading…" : "Event")}
              </h1>
              {event && (
                <p className="text-xs text-ink/60 mt-0.5">
                  {new Date(event.event_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  · {presentations.length} presentation{presentations.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6 whitespace-nowrap">
              + New Presentation
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-ink/40 text-sm animate-pulse">
              Loading presentations…
            </div>
          ) : presentations.length === 0 ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
              <p className="text-sm text-ink/40 italic">No presentations yet.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6">
                Create the First Presentation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {presentations.map((p) => (
                <PresentationCard
                  key={p.id}
                  eventId={eventId!}
                  id={p.id}
                  teamName={p.team_name}
                  topic={p.topic}
                  members={p.members}
                  status={p.status}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {showModal && <NewPresentationModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
