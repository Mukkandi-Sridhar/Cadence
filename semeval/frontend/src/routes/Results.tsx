import { Header } from "../components/Header";
import { ScoreRadial } from "../components/ScoreRadial";
import { EvidenceSpan } from "../components/EvidenceSpan";
import { AudioPlayer } from "../components/AudioPlayer";
import { OverridePanel } from "../components/OverridePanel";
import { useEvaluationStore } from "../store/evaluationStore";

export default function Results() {
  const { activeEvaluation, openOverrideModal } = useEvaluationStore();

  const evalData = activeEvaluation || {
    id: "eval-1",
    recordingId: "rec-demo-1",
    presenterId: "p1",
    presenterName: "Ananya Sharma",
    totalScore: 73,
    audioQuality: "PASS",
    modelName: "gpt-4o",
    modelVersion: "2024-11-20",
    promptHash: "sha256:7f8a9b...",
    temperature: 0,
    seed: 42,
    dimensionScores: [
      {
        dimension: "Content and topic coverage",
        weight: 30,
        rawSubScore: 4,
        scaledScore: 24.0,
        status: "SCORED",
        evidence: [
          {
            id: "e1",
            transcriptSpan: "Leader election in Raft relies on randomized election timeouts to prevent split votes.",
            startMs: 15000,
            endMs: 22000,
            reason: "Presenter clearly explained leader election with randomized timeouts.",
            verified: true,
          },
        ],
      },
      {
        dimension: "Structure and clarity",
        weight: 15,
        rawSubScore: 3,
        scaledScore: 9.0,
        status: "SCORED",
        evidence: [
          {
            id: "e2",
            transcriptSpan: "First I will talk about state machines, then log replication, and finally cluster partitions.",
            startMs: 5000,
            endMs: 10000,
            reason: "Clear initial structural outline provided.",
            verified: true,
          },
        ],
      },
      {
        dimension: "Depth and technical accuracy",
        weight: 15,
        rawSubScore: 5,
        scaledScore: 15.0,
        status: "SCORED",
        evidence: [
          {
            id: "e3",
            transcriptSpan: "Safety is guaranteed because a candidate must contain all committed entries to win an election.",
            startMs: 45000,
            endMs: 52000,
            reason: "Correct formulation of Election Safety property.",
            verified: true,
          },
        ],
      },
      {
        dimension: "Delivery and pace",
        weight: 15,
        rawSubScore: 2,
        scaledScore: 6.0,
        status: "SCORED",
        evidence: [
          {
            id: "e4",
            transcriptSpan: "Um, like, basically the log entries are, um, appended to the follower nodes.",
            startMs: 30000,
            endMs: 36000,
            reason: "Vocal filler rate measured at 4.2 per minute.",
            verified: true,
          },
        ],
      },
      {
        dimension: "Engagement and audience contact",
        weight: 10,
        rawSubScore: 3,
        scaledScore: 6.0,
        status: "SCORED",
        evidence: [],
      },
      {
        dimension: "Q&A handling",
        weight: 10,
        rawSubScore: 4,
        scaledScore: 8.0,
        status: "SCORED",
        evidence: [],
      },
      {
        dimension: "Time management",
        weight: 5,
        rawSubScore: 5,
        scaledScore: 5.0,
        status: "SCORED",
        evidence: [],
      },
    ],
    strengths: [
      {
        text: "Deep technical accuracy regarding election safety invariants.",
        startMs: 45000,
        endMs: 52000,
        span: "Safety is guaranteed because a candidate must contain all committed entries to win an election.",
      },
      {
        text: "Effective handling of audience Q&A regarding network partitions.",
        startMs: 65000,
        endMs: 75000,
        span: "In a network partition, the minority partition cannot commit entries because it lacks a quorum.",
      },
      {
        text: "Punctual time management right on target duration.",
        startMs: 890000,
        endMs: 898000,
        span: "Concluding right on our 15 minute target.",
      },
    ],
    improvements: [
      {
        text: "Reduce vocal fillers ('um', 'like', 'basically') during log replication section.",
        startMs: 30000,
        endMs: 36000,
        span: "Um, like, basically the log entries are, um, appended to the follower nodes.",
      },
      {
        text: "Structure transition between leader election and log replication more explicitly.",
        startMs: 22000,
        endMs: 25000,
        span: "So next up is log replication.",
      },
      {
        text: "Vary speech pitch to avoid monotone segments in introductory definitions.",
        startMs: 5000,
        endMs: 12000,
        span: "First I will talk about state machines...",
      },
    ],
    overrides: [],
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Evaluation Results
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {evalData.presenterName}
              </h1>
              <p className="text-xs text-white/60 mt-0.5 font-mono">
                Model: {evalData.modelName} ({evalData.modelVersion}) • Temp: {evalData.temperature} • Seed: {evalData.seed}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={openOverrideModal} className="btn-ghost border border-white/20">
                ✏️ Override Score
              </button>
              <button onClick={() => alert("Exporting PDF report...")} className="btn-primary">
                📄 Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column — Radial Score & Dimension Breakdown */}
            <div className="flex flex-col gap-6">
              {/* Score Gauge Card */}
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
                <ScoreRadial score={evalData.totalScore} size={200} />

                {evalData.overrides.length > 0 && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning border border-warning/30">
                    ⚠️ Human Override Applied ({evalData.overrides[evalData.overrides.length - 1].overrideScore})
                  </div>
                )}
              </div>

              {/* Dimension Breakdown */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                  Rubric Dimension Breakdown
                </h3>

                <div className="flex flex-col gap-3">
                  {evalData.dimensionScores.map((ds) => (
                    <div key={ds.dimension} className="flex flex-col gap-1 border-b border-white/5 pb-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-white">{ds.dimension}</span>
                        <span className="font-mono text-brand-300 font-bold">
                          {ds.scaledScore !== null ? `${ds.scaledScore.toFixed(1)} / ${ds.weight}` : "Skipped"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-900">
                          <div
                            className="h-full bg-brand-500"
                            style={{
                              width: `${
                                ds.scaledScore !== null ? (ds.scaledScore / ds.weight) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-white/50">
                          {ds.rawSubScore !== null ? `${ds.rawSubScore}/5` : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 2 Columns — Audio Player, Strengths, Improvements, Evidence */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Audio Player Component */}
              <AudioPlayer />

              {/* Strengths Card */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-success">
                  Top 3 Key Strengths (Timestamped)
                </h3>
                <div className="flex flex-col gap-3">
                  {evalData.strengths.map((item, idx) => (
                    <EvidenceSpan
                      key={idx}
                      span={item.span}
                      startMs={item.startMs}
                      endMs={item.endMs}
                      reason={item.text}
                      verified={true}
                    />
                  ))}
                </div>
              </div>

              {/* Improvements Card */}
              <div className="glass-card p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-warning">
                  Top 3 Actionable Improvements (Timestamped)
                </h3>
                <div className="flex flex-col gap-3">
                  {evalData.improvements.map((item, idx) => (
                    <EvidenceSpan
                      key={idx}
                      span={item.span}
                      startMs={item.startMs}
                      endMs={item.endMs}
                      reason={item.text}
                      verified={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <OverridePanel />
    </div>
  );
}
