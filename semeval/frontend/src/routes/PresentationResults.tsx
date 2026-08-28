import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ScoreRadial } from "../components/ScoreRadial";
import { EvidenceSpan } from "../components/EvidenceSpan";
import { getApiBaseUrl } from "../lib/apiConfig";

interface EvidenceItem {
  span: string;
  reason: string;
}

interface DimensionScore {
  dimension: string;
  weight: number;
  raw_sub_score: number | null;
  scaled_score: number | null;
  status: string;
  source: "AI" | "HUMAN";
  evidence: EvidenceItem[];
}

interface FeedbackItem {
  text: string;
  span: string;
}

interface ScoreData {
  id: string;
  presentation_id: string;
  total_score: number;
  dimension_scores: DimensionScore[];
  positives: FeedbackItem[];
  negatives: FeedbackItem[];
  human_physical_score: number;
  human_note: string | null;
}

interface PresentationDetail {
  id: string;
  event_id: string;
  team_name: string;
  members: string[];
  topic: string;
  transcript_text: string;
  status: string;
}

export default function PresentationResults() {
  const { eventId, presId } = useParams<{ eventId: string; presId: string }>();
  const [presentation, setPresentation] = useState<PresentationDetail | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set());

  function toggleDimension(dimension: string) {
    setExpandedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dimension)) {
        next.delete(dimension);
      } else {
        next.add(dimension);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!presId) return;
    const baseUrl = getApiBaseUrl();
    (async () => {
      setLoading(true);
      try {
        const [presRes, scoreRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/presentations/${presId}`),
          fetch(`${baseUrl}/api/v1/presentations/${presId}/score`),
        ]);
        if (presRes.ok) setPresentation(await presRes.json());
        if (scoreRes.ok) {
          setScore(await scoreRes.json());
          setError(null);
        } else {
          setError("No score found yet for this presentation.");
        }
      } catch (err) {
        console.error("Results fetch error:", err);
        setError("Could not load results. Make sure the API is running.");
      } finally {
        setLoading(false);
      }
    })();
  }, [presId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center text-ink/40 text-sm animate-pulse">
          Loading results…
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-xl px-4 py-16 text-center flex flex-col items-center justify-center">
          <div className="glass-card p-10 flex flex-col items-center gap-4 w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-700 font-bold text-xl">
              📋
            </div>
            <h2 className="text-2xl font-bold text-ink">No Score Yet</h2>
            <p className="text-sm text-ink/60">{error || "This presentation hasn't been scored."}</p>
            <Link to={eventId ? `/events/${eventId}` : "/"} className="btn-primary mt-2 py-3 px-6">
              ← Back to Event
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 text-ink flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-1 glass-card p-6">
            <Link
              to={`/events/${eventId}`}
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 w-fit"
            >
              ← Back to Event
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink mt-1">
              {presentation?.team_name}
            </h1>
            <p className="text-sm text-ink/70 mt-0.5">{presentation?.topic}</p>
            {presentation && presentation.members.length > 0 && (
              <p className="text-xs text-ink/50 mt-1">{presentation.members.join(", ")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column — Score & Dimensions */}
            <div className="flex flex-col gap-6">
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center gap-3">
                <ScoreRadial score={score.total_score} size={200} />
                <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning border border-warning/30">
                  Human physical rating: {score.human_physical_score}/5
                </div>
              </div>

              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-700">
                  Dimension Breakdown
                </h3>
                <div className="flex flex-col gap-3">
                  {score.dimension_scores.map((ds) => {
                    const hasEvidence = ds.evidence && ds.evidence.length > 0;
                    const isExpanded = expandedDims.has(ds.dimension);
                    return (
                      <div key={ds.dimension} className="flex flex-col gap-1 border-b border-ink/5 pb-2">
                        <button
                          type="button"
                          onClick={() => hasEvidence && toggleDimension(ds.dimension)}
                          className={`flex justify-between items-center gap-2 text-xs font-medium text-left ${
                            hasEvidence ? "cursor-pointer" : "cursor-default"
                          }`}
                          aria-expanded={isExpanded}
                        >
                          <span className="text-ink flex items-center gap-1.5 min-w-0">
                            {hasEvidence && (
                              <span className="shrink-0 text-ink/40 text-[10px]">{isExpanded ? "▾" : "▸"}</span>
                            )}
                            <span className="truncate">{ds.dimension}</span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                ds.source === "HUMAN" ? "bg-warning/20 text-warning" : "bg-info/20 text-info"
                              }`}
                            >
                              {ds.source}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-brand-700 font-bold">
                            {ds.scaled_score !== null ? `${ds.scaled_score.toFixed(1)} / ${ds.weight}` : "Skipped"}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-900">
                            <div
                              className="h-full bg-brand-500"
                              style={{
                                width: `${ds.scaled_score !== null ? (ds.scaled_score / ds.weight) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-ink/50">
                            {ds.raw_sub_score !== null ? `${ds.raw_sub_score}/5` : "N/A"}
                          </span>
                        </div>
                        {isExpanded && hasEvidence && (
                          <div className="flex flex-col gap-2 mt-2">
                            {ds.evidence.map((item, idx) => (
                              <EvidenceSpan key={idx} span={item.span} reason={item.reason} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {presentation && (
                <div className="glass-card p-4 flex flex-col gap-2">
                  <button
                    onClick={() => setShowTranscript((v) => !v)}
                    className="text-xs font-bold uppercase tracking-wider text-brand-700 text-left"
                  >
                    {showTranscript ? "▾" : "▸"} Full Transcript
                  </button>
                  {showTranscript && (
                    <p className="text-xs text-ink/70 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {presentation.transcript_text || "No transcript captured."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right 2 Columns — Positives / Negatives */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-success">Positives</h3>
                <div className="flex flex-col gap-3">
                  {score.positives.length === 0 ? (
                    <p className="text-xs text-ink/40 italic">No specific positives identified.</p>
                  ) : (
                    score.positives.map((item, idx) => (
                      <EvidenceSpan key={idx} span={item.span} reason={item.text} />
                    ))
                  )}
                </div>
              </div>

              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-warning">Negatives</h3>
                <div className="flex flex-col gap-3">
                  {score.negatives.length === 0 ? (
                    <p className="text-xs text-ink/40 italic">No specific negatives identified.</p>
                  ) : (
                    score.negatives.map((item, idx) => (
                      <EvidenceSpan key={idx} span={item.span} reason={item.text} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
