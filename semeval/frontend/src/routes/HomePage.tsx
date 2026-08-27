import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { EventCard } from "../components/EventCard";
import { NewEventModal } from "../components/NewEventModal";
import { getApiBaseUrl } from "../lib/apiConfig";

interface EventItem {
  id: string;
  name: string;
  event_date: string;
  created_at: string;
}

const CACHE_KEY = "cadence_events_cache";

export default function HomePage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      const baseUrl = getApiBaseUrl();
      try {
        const res = await fetch(`${baseUrl}/api/v1/events`);
        if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Backend API returned HTML instead of JSON. Check backend service configuration.");
        }
        const data: EventItem[] = await res.json();
        setEvents(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
          /* storage unavailable */
        }
        setError(null);
      } catch (err) {
        console.error("Events fetch error:", err);
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            setEvents(JSON.parse(cached));
            setError(null);
            return;
          }
        } catch {
          /* ignore */
        }
        setError("Could not connect to backend. Make sure the API is running.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  async function handleCreate(name: string, eventDate: string) {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, event_date: eventDate }),
    });
    if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
    const data: EventItem = await res.json();
    setEvents((prev) => [data, ...prev]);
    setShowModal(false);
    navigate(`/events/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Presentation Evaluation
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Events</h1>
              <p className="text-xs text-white/60 mt-0.5">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6 whitespace-nowrap">
              + New Event
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/40 text-sm animate-pulse">
              Loading events…
            </div>
          ) : events.length === 0 ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
              <p className="text-sm text-white/40 italic">No events yet.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6">
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((e) => (
                <EventCard key={e.id} id={e.id} name={e.name} eventDate={e.event_date} />
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && <NewEventModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
