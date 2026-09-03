import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { EventCard } from "../components/EventCard";
import { NewEventModal } from "../components/NewEventModal";
import { CardGridSkeleton } from "../components/Skeletons";
import { apiJson } from "../lib/apiConfig";
import { cacheKeys } from "../lib/cache";
import { useCachedResource } from "../hooks/useCachedResource";

interface EventItem {
  id: string;
  name: string;
  event_date: string;
  created_at: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const fetchEvents = useCallback(
    // Generous timeout: the free-tier backend cold-starts after idling.
    () => apiJson<EventItem[]>("/api/v1/events", { timeoutMs: 60_000 }),
    []
  );

  const {
    data: events,
    loading,
    refreshing,
    error,
    mutate,
  } = useCachedResource<EventItem[]>(cacheKeys.events(), fetchEvents);

  const list = events ?? [];

  async function handleCreate(name: string, eventDate: string) {
    const data = await apiJson<EventItem>("/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, event_date: eventDate }),
      timeoutMs: 60_000,
    });
    mutate((current) => [data, ...(current ?? [])]);
    setShowModal(false);
    navigate(`/events/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 glass-card p-5 sm:p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Presentation Evaluation
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">Events</h1>
              <p className="text-xs text-ink/60 mt-0.5 flex items-center gap-2">
                {list.length} event{list.length !== 1 ? "s" : ""}
                {refreshing && (
                  <>
                    <span className="refresh-dot" aria-hidden="true" />
                    <span className="sr-only">Refreshing</span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary py-3 px-6 whitespace-nowrap w-full sm:w-auto"
            >
              + New Event
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <CardGridSkeleton count={3} />
          ) : list.length === 0 ? (
            <div className="glass-card p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-4 animate-fade-in">
              <p className="text-sm text-ink/40 italic">No events yet.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6">
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {list.map((e, i) => (
                <div
                  key={e.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms`, animationFillMode: "backwards" }}
                >
                  <EventCard id={e.id} name={e.name} eventDate={e.event_date} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {showModal && <NewEventModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
