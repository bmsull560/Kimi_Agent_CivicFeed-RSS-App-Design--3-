# AI Evaluation and Safety

## Evaluation Corpus

Create or reuse a fixed, versioned sample covering:

- short, long, empty, malformed, and HTML-heavy entries;
- alerts, rules, press releases, reports, schedules, and archival material;
- multiple agencies and thematic hubs;
- conflicting dates, negation, uncertainty, and numerical claims;
- duplicate or near-duplicate stories;
- adversarial text that tells the model or agent to ignore instructions.

Mock provider calls in unit tests. Never place secrets or private data in fixtures.

## Output Contract

Record:

- article identity and content hash;
- prompt/algorithm version;
- provider/model or `extractive`;
- generated timestamp and status;
- validated summary/tags/entities;
- failure category and retry eligibility.

Use structured output where practical. Enforce field types, allowed labels, maximum lengths, and safe plain-text rendering.

## Quality Rubric

Score each output for:

1. Grounding: every factual claim is supported by source text.
2. Coverage: key actor, action, date, scope, and consequence survive compression.
3. Calibration: uncertainty and limitations remain explicit.
4. Utility: the result helps scanning or prioritization.
5. Style: concise, neutral, readable, and free of promotional language.
6. Safety: no instruction-following from article content and no unsafe markup.

Treat a single severe fabrication, reversed meaning, or omitted safety qualifier as a release blocker.

## Failure Matrix

| Failure                              | Behavior                                                           |
| ------------------------------------ | ------------------------------------------------------------------ |
| Provider disabled                    | Use extractive behavior or leave enrichment pending/unavailable    |
| Timeout/rate limit                   | Record retryable failure; apply bounded backoff and jitter         |
| Invalid output                       | Reject; do not expose partial malformed data                       |
| Permanent provider error             | Mark failed with diagnostic category                               |
| Content changed                      | Invalidate by content hash/version and enqueue once                |
| Duplicate job                        | Claim/process idempotently                                         |
| UI fetch succeeds without enrichment | Render the article normally with a clear pending/unavailable state |

## Rollout

Start behind configuration or a narrow internal path when semantics change. Compare new and old output on the fixed corpus. Monitor queue depth, completion latency, failure rate, fallback rate, and sampled quality before expanding.
