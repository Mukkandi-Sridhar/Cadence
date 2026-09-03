import { useCallback, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PresentationCard } from "../components/PresentationCard";
import { NewPresentationModal, NewPresentationData } from "../components/NewPresentationModal";
import { CardGridSkeleton } from "../components/Skeletons";
import { apiFetch, apiJson } from "../lib/apiConfig";
import { cacheKeys, dropCache } from "../lib/cache";
import { useCachedResource } from "../hooks/useCachedResource";

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
  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchEvent = useCallback(
    () => apiJson<EventItem>(`/api/v1/events/${eventId}`, { timeoutMs: 60_000 }),
    [eventId]
  );
  const fetchPresentations = useCallback(
    () =>
      apiJson<PresentationItem[]>(`/api/v1/events/${eventId}/presentations`, {
        timeoutMs: 60_000,
      }),
    [eventId]
  );

  const { data: event } = useCachedResource<EventItem>(
    cacheKeys.event(eventId ?? ""),
    fetchEvent,
    Boolean(eventId)
  );
  const {
    data: presentations,
    loading,
    refreshing,
    error,
    mutate,
  } = useCachedResource<PresentationItem[]>(
    cacheKeys.presentations(eventId ?? ""),
    fetchPresentations,
    Boolean(eventId)
  );

  const list = presentations ?? [];

  async function handleCreate(data: NewPresentationData) {
    if (!eventId) return;
    const created = await apiJson<PresentationItem>(
      `/api/v1/events/${eventId}/presentations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: data.teamName,
          members: data.members,
          topic: data.topic,
          custom_instructions: data.customInstructions,
        }),
        timeoutMs: 60_000,
      }
    );
    mutate((current) => [created, ...(current ?? [])]);
    setShowModal(false);
    navigate(`/events/${eventId}/presentations/${created.id}/record`);
  }

  async function handleDeletePresentation(presId: string) {
    // Optimistic: drop it from the list immediately so the tap feels
    // instant, and put it back if the server rejects the delete.
    const previous = list;
    mutate((current) => (current ?? []).filter((p) => p.id !== presId));
    setActionError(null);
    try {
      await apiFetch(`/api/v1/presentations/${presId}`, { method: "DELETE" });
      dropCache(cacheKeys.presentation(presId));
      dropCache(cacheKeys.score(presId));
    } catch (err) {
      console.error("Delete presentation error:", err);
      mutate(previous);
      setActionError("Failed to delete presentation. Please try again.");
    }
  }

  const shownError = actionError ?? error;

  return (
    <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-6 sm:gap-8">
          <Link to="/" className="text-xs font-semibold text-brand-700 hover:text-brand-900 w-fit">
            ← All Events
          </Link>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 glass-card p-5 sm:p-6">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Event</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink break-words">
                {event?.name ?? "…"}
              </h1>
              <p className="text-xs text-ink/60 mt-0.5 flex items-center gap-2 flex-wrap">
                {event && (
                  <span>
                    {new Date(event.event_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    · {list.length} presentation{list.length !== 1 ? "s" : ""}
                  </span>
                )}
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
              + New Presentation
            </button>
          </div>

          {shownError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              ⚠️ {shownError}
            </div>
          )}

          {loading ? (
            <CardGridSkeleton count={3} />
          ) : list.length === 0 ? (
            <div className="glass-card p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-4 animate-fade-in">
              <p className="text-sm text-ink/40 italic">No presentations yet.</p>
              <button onClick={() => setShowModal(true)} className="btn-primary py-3 px-6">
                Create the First Presentation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {list.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-slide-up"
                  style={{
                    animationDelay: `${Math.min(i, 8) * 45}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <PresentationCard
                    eventId={eventId!}
                    id={p.id}
                    teamName={p.team_name}
                    topic={p.topic}
                    members={p.members}
                    status={p.status}
                    onDelete={handleDeletePresentation}
                  />
                </div>
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
