# Ingestion Failure Classification

| Class                   | Evidence                                            | Correct layer                                              | Verification                                      |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Security policy         | URL/address/redirect rejected before fetch          | `url-security.ts` only if policy is incorrectly classified | SSRF unit cases for direct and redirected targets |
| Network/upstream        | DNS, connect, timeout, 408/429/5xx                  | `rss.ts` retry/circuit/status logic                        | Fake timers and mocked responses                  |
| Response bounds         | Oversized body, redirect loop, unsupported encoding | Fetch policy                                               | Boundary tests; never remove limits               |
| XML syntax              | Parser rejects malformed XML                        | Parser or catalog source correction                        | Minimal XML fixture                               |
| Schema mapping          | Valid RSS/Atom variant loses fields                 | `rss-parser.ts`                                            | Fixture asserts normalized entry                  |
| Identity                | Duplicate or changing IDs across refresh            | Parser normalization/cache key                             | Repeat-ingest fixture                             |
| Date/link normalization | Invalid date or relative/missing link               | Parser normalization                                       | Exact edge-case fixtures                          |
| Cache/database          | Correct entries not stored/read/indexed             | `cache.ts`, migrations, search triggers                    | Ephemeral SQLite tests                            |
| Scheduling              | Due feeds starve, duplicate, or retry too quickly   | `scheduler.ts`, status timestamps                          | Fake clock/concurrency tests                      |
| Health classification   | Working empty/archive feed marked broken            | `feed-health.ts`, validator rules                          | Classification table tests                        |
| UI/API                  | Backend state correct but poorly represented        | Route/client/page                                          | Contract and Playwright tests                     |

## Evidence Checklist

Capture:

- feed ID and canonical URL without credentials;
- final failure category and retry eligibility;
- HTTP status, redirect count, elapsed time, and bounded response metadata;
- parser format and entry count;
- cache hit/stale state and last successful fetch;
- circuit state, attempt counts, and next fetch time;
- scheduler batch/concurrency context;
- health classification and timestamp.

## Change Boundary

Do not relax SSRF, timeout, redirect, response-size, or validation controls to accommodate a source. Prefer canonical URL correction, explicit supported-format parsing, or a clear unsupported classification. Preserve the original error cause when rethrowing.
