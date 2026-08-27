import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useEvaluationStore, EvaluationStage } from "../store/evaluationStore";

export default function Evaluating() {
  const navigate = useNavigate();
  const { currentStage, progressPercent, setStage, setEvaluation } = useEvaluationStore();

  useEffect(() => {
    // Staged evaluation simulation
    const stages: Array<{ stage: EvaluationStage; progress: number; delay: number }> = [
      { stage: "TRANSCRIBING", progress: 25, delay: 1000 },
      { stage: "ANALYZING_CONTENT", progress: 50, delay: 3000 },
      { stage: "ANALYZING_DELIVERY", progress: 75, delay: 5000 },
      { stage: "SCORING", progress: 95, delay: 7000 },
    ];

    stages.forEach(({ stage, progress, delay }) => {
      setTimeout(() => setStage(stage, progress), delay);
    });

    // Complete evaluation after 8.5 seconds
    const timer = setTimeout(() => {
      setEvaluation({
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
                reason: "Presenter clearly explained the leader election mechanism with randomized timeouts.",
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
                reason: "Clear initial outline provided.",
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
                reason: "Correct formulation of the Election Safety property.",
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
                reason: "High filler word rate (4.2 fillers per minute).",
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
            evidence: [
              {
                id: "e5",
                transcriptSpan: "Does anyone have a question about term numbers before we move to safety properties?",
                startMs: 25000,
                endMs: 29000,
                reason: "Maintained direct audience check-in.",
                verified: true,
              },
            ],
          },
          {
            dimension: "Q&A handling",
            weight: 10,
            rawSubScore: 4,
            scaledScore: 8.0,
            status: "SCORED",
            evidence: [
              {
                id: "e6",
                transcriptSpan: "That is a great question. In a network partition, the minority partition cannot commit entries because it lacks a quorum.",
                startMs: 65000,
                endMs: 75000,
                reason: "Directly answered audience question regarding network partitions.",
                verified: true,
              },
            ],
          },
          {
            dimension: "Time management",
            weight: 5,
            rawSubScore: 5,
            scaledScore: 5.0,
            status: "SCORED",
            evidence: [
              {
                id: "e7",
                transcriptSpan: "Thank you for your time. Concluding right on our 15 minute target.",
                startMs: 890000,
                endMs: 898000,
                reason: "Completed in 14m 58s (99.8% of target duration).",
                verified: true,
              },
            ],
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
      });
      navigate("/sessions/s1/results/p1");
    }, 8500);

    return () => clearTimeout(timer);
  }, [setStage, setEvaluation, navigate]);

  const stagesList = [
    { key: "TRANSCRIBING", title: "1. Transcribing Audio", desc: "Generating punctuated, timestamped transcript via ASR adapter." },
    { key: "ANALYZING_CONTENT", title: "2. Content Analysis", desc: "Checking topic coverage against expected points & technical depth." },
    { key: "ANALYZING_DELIVERY", title: "3. Delivery DSP Metrics", desc: "Measuring WPM, filler word rate, pause distribution, and energy variance." },
    { key: "SCORING", title: "4. Deterministic Scoring", desc: "Verifying transcript evidence and computing weighted score out of 100." },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 flex flex-col justify-center">
        <div className="glass-card p-8 sm:p-10 flex flex-col gap-8 text-center">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Evaluating Presentation</h1>
            <p className="text-sm text-white/60 mt-1">
              Multi-agent pipeline running across 11 specialized evaluation workers.
            </p>
          </div>

          {/* Staged Progress Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono font-semibold text-brand-300">
              <span>{currentStage.replace(/_/g, " ")}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-900 border border-white/10">
              <div
                className="h-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Staged List */}
          <div className="flex flex-col gap-3 text-left">
            {stagesList.map((item, idx) => {
              const activeIdx = stagesList.findIndex((s) => s.key === currentStage);
              const isDone = activeIdx > idx;
              const isCurrent = activeIdx === idx;

              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? "border-brand-500/40 bg-brand-600/10 text-white"
                      : isDone
                      ? "border-success/30 bg-success/5 text-white/80"
                      : "border-white/5 bg-white/5 text-white/40"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isDone
                        ? "bg-success text-black"
                        : isCurrent
                        ? "bg-brand-500 text-white animate-pulse"
                        : "bg-surface-900 text-white/40 border border-white/10"
                    }`}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-white/60 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
