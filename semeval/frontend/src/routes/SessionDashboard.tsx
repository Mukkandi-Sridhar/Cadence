import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../lib/apiConfig";

interface Session {
  id: string;
  topic: string;
  presenter_names: string[];
  status: string;
  created_at: string;
  target_duration_seconds: number;
}

interface SessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export default function SessionDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      try {
        const res = await fetch(`${baseUrl}/api/v1/sessions`);
        if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Backend API returned HTML instead of JSON. Check backend service configuration.");
        }
        const data: Session[] = await res.json();
        setSessions(data);
        // Backup to localStorage
        try { localStorage.setItem("cadence_sessions_backup", JSON.stringify(data)); } catch {}
        setError(null);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        // Fallback to local storage backup if available
        try {
          const cached = localStorage.getItem("cadence_sessions_backup");
          if (cached) {
            setSessions(JSON.parse(cached));
            setError(null);
            return;
          }
        } catch {}
        setError("Could not connect to backend. Make sure the API is running.");
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleSelectSession = async (session: Session) => {
    setSelectedSession(session);
    setEventsLoading(true);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/sessions/${session.id}/events`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          const data: SessionEvent[] = await res.json();
          setEvents(data);
        }
      }
    } catch (err) {
      console.error("Events fetch error:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "text-white/60 bg-white/10",
    RECORDING: "text-warning bg-warning/20",
    PROCESSING: "text-brand-300 bg-brand-600/20",
    SCORED: "text-success bg-success/20",
    FAILED: "text-danger bg-danger/20",
  };

  const eventTypeIcons: Record<string, string> = {
    RECORDING_STARTED: "⏺",
    RECORDING_STOPPED: "⏹",
    TRANSCRIPT_CHUNK: "📝",
    AUDIO_HEALTH: "🎤",
    STAGE_UPDATE: "⚙️",
    EVALUATION_COMPLETE: "✅",
    EVALUATION_FAILED: "❌",
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Session History & Analytics
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                All Sessions
              </h1>
              <p className="text-xs text-white/60 mt-0.5">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded · auto-refreshes every 15s
              </p>
            </div>
            <Link to="/sessions/new" className="btn-primary py-3 px-6 whitespace-nowrap">
              + New Session
            </Link>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sessions List */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                Sessions
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-white/40 text-sm animate-pulse">
                  Loading sessions from backend…
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-white/40 italic">No sessions found.</p>
                  <Link to="/sessions/new" className="btn-primary mt-4 py-2 px-4 text-sm">
                    Create Your First Session
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/50 uppercase tracking-wider">
                        <th className="py-3 px-2">Topic</th>
                        <th className="py-3 px-2">Presenters</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2 text-right">Created</th>
                        <th className="py-3 px-2 text-right">Events</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sessions.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => handleSelectSession(s)}
                          className={`cursor-pointer hover:bg-white/5 transition-colors ${selectedSession?.id === s.id ? "bg-brand-600/10" : ""}`}
                        >
                          <td className="py-4 px-2 font-semibold text-white max-w-xs truncate">
                            {s.topic}
                          </td>
                          <td className="py-4 px-2 text-white/70 text-xs">
                            {s.presenter_names.slice(0, 3).join(", ")}
                            {s.presenter_names.length > 3 && ` +${s.presenter_names.length - 3} more`}
                          </td>
                          <td className="py-4 px-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[s.status] || "text-white/60 bg-white/10"}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right font-mono text-xs text-white/50">
                            {new Date(s.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-2 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectSession(s); }}
                              className="text-xs font-semibold text-brand-400 hover:text-brand-300"
                            >
                              View Events →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Session Event Timeline */}
            <div className="glass-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                {selectedSession ? `Events: ${selectedSession.topic.slice(0, 24)}…` : "Session Events"}
              </h3>

              {!selectedSession ? (
                <p className="text-xs text-white/40 italic mt-4">
                  Select a session from the table to view its full event timeline.
                </p>
              ) : eventsLoading ? (
                <div className="text-xs text-white/40 animate-pulse py-4">Loading events…</div>
              ) : events.length === 0 ? (
                <p className="text-xs text-white/40 italic mt-4">No events recorded for this session yet.</p>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[480px]">
                  {events.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-xs">
                      <span className="text-base shrink-0">{eventTypeIcons[evt.event_type] || "📌"}</span>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-semibold text-brand-300 truncate">{evt.event_type}</span>
                        {Object.keys(evt.payload).length > 0 && (
                          <span className="text-white/50 font-mono text-[10px] truncate">
                            {JSON.stringify(evt.payload).slice(0, 80)}
                          </span>
                        )}
                        <span className="text-white/30 font-mono text-[10px]">
                          {new Date(evt.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
