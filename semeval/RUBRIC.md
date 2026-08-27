# RUBRIC.md — Scoring Model

## Default Rubric Dimensions

| Dimension | Weight |
|---|---|
| Content and topic coverage | 30 |
| Structure and clarity | 15 |
| Depth and technical accuracy | 15 |
| Delivery and pace | 15 |
| Engagement and audience contact | 10 |
| Q&A handling | 10 |
| Time management | 5 |
| **Total** | **100** |

Each dimension is scored **0–5** by its agent, with the following band descriptors:

| Band | Score | Descriptor |
|---|---|---|
| Exceptional | 5 | Fully meets the criterion with no meaningful gaps |
| Good | 4 | Meets the criterion with minor gaps |
| Adequate | 3 | Partially meets the criterion |
| Weak | 2 | Significantly below criterion |
| Poor | 1 | Barely present |
| Absent | 0 | Not demonstrated |

## Scoring Formula

> **Rule R1**: The LLM never computes the final score. All arithmetic is deterministic Python code in `semeval/scoring/engine.py`.

```
effective_weight_i = weight_i × (100 / Σ active_weights)

scaled_score_i     = (raw_sub_score_i / 5.0) × effective_weight_i

final_score        = round(Σ scaled_score_i)   clamped to [0, 100]
```

When a dimension is **SKIPPED** or has **INSUFFICIENT_EVIDENCE**, its weight is proportionally redistributed to the remaining active dimensions. This means the total always sums to 100 regardless of how many dimensions are skipped.

## Worked Example

**Presenter: Ananya S. — "Distributed Systems: Raft Consensus"**

| Dimension | Weight | Sub-score | Effective Weight | Scaled Score |
|---|---|---|---|---|
| Content and topic coverage | 30 | 4 | 30.0 | 24.0 |
| Structure and clarity | 15 | 3 | 15.0 | 9.0 |
| Depth and technical accuracy | 15 | 5 | 15.0 | 15.0 |
| Delivery and pace | 15 | 2 | 15.0 | 6.0 |
| Engagement and audience contact | 10 | 3 | 10.0 | 6.0 |
| Q&A handling | 10 | 4 | 10.0 | 8.0 |
| Time management | 5 | 5 | 5.0 | 5.0 |
| **Total** | **100** | | | **73** |

`round(24 + 9 + 15 + 6 + 6 + 8 + 5) = round(73.0) = 73`

## Worked Example — With Skipped Dimension

Same presenter, but Q&A did not occur (SKIPPED, weight=10 redistributed):

Active weight sum = 90. Each effective weight = `declared × (100/90)`.

| Dimension | Weight | Sub-score | Effective Weight | Scaled Score |
|---|---|---|---|---|
| Content and topic coverage | 30 | 4 | 33.33 | 26.67 |
| Structure and clarity | 15 | 3 | 16.67 | 10.00 |
| Depth and technical accuracy | 15 | 5 | 16.67 | 16.67 |
| Delivery and pace | 15 | 2 | 16.67 | 6.67 |
| Engagement and audience contact | 10 | 3 | 11.11 | 6.67 |
| Q&A handling | 10 | SKIPPED | 0.00 | — |
| Time management | 5 | 5 | 5.56 | 5.56 |
| **Total** | | | | **72** |

`round(26.67 + 10.00 + 16.67 + 6.67 + 6.67 + 5.56) = round(72.24) = 72`

## Time Management Curve

Computed purely in code (`semeval/scoring/time_management.py`). No LLM involvement.

Let `ratio = actual_duration / target_duration`:

| Ratio range | Sub-score |
|---|---|
| ≤ 0.5 | 0 (severely short) |
| 0.5 – 0.8 | lerp(1, 3) — recovering |
| 0.8 – 1.0 | lerp(3, 5) — approaching perfect |
| 1.0 – 1.1 | lerp(5, 4) — small overrun, still good |
| 1.1 – 1.3 | lerp(4, 2) — significant overrun |
| > 1.3 | 0 (severe overrun) |

`lerp(a, b, t)` = linear interpolation between a and b at position t ∈ [0, 1].

## Rubric Versioning

Rubrics are versioned in the database (`rubric_versions` table). Editing a rubric creates a new version row — old versions are **never mutated**. Old evaluations continue pointing at the version they were scored under, ensuring historical score integrity.

## Evidence Requirements (R2)

Every sub-score must carry at least one evidence object:

```json
{
  "transcript_span": "...verbatim text from transcript...",
  "start_ms": 42000,
  "end_ms": 47500,
  "reason": "Presenter covered the CAP theorem with a concrete example."
}
```

The EvidenceAgent exact-matches `transcript_span` against the full transcript. A quote not found verbatim causes the agent output to be rejected and regenerated. If still failing after one retry, the dimension is marked `INSUFFICIENT_EVIDENCE` and its weight is redistributed.
