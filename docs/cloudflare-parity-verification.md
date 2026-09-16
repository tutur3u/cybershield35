# Cloudflare feature-parity verification

## September 16 native candidate

The candidate now runs on Cloudflare Workers with all application reads/writes
on native D1, R2 caching, Durable Object cache revalidation, and Cloudflare
Workflows. Production domain cutover is a separate final step; a deployed
candidate or copied snapshot does not establish current production synchronization.

## Verified evidence

| Check | Result / scope |
| --- | --- |
| Unit and regression suite | 615 tests across 90 files; billing, provider retries, authorization contracts, state transitions, cache codec, and vector scores |
| Native workerd D1 | Typed dates/JSON/booleans, exact decimal text, concurrent scan claim, FK rollback/cascade, revision guards, SQLite search |
| D1 application integration | Article lifecycle, analytics, timeline, billing, atomic rollups, provider checkpoint replay, protected internal stage endpoint |
| Real Worker password login | Successful; session persisted in D1 |
| Real Worker chat writes | Create, rename, workspace visibility, fork, soft delete, deleted-resource denial |
| Real AI chat stream | HTTP 200; text deltas and completion, no error event; both messages persisted |
| Real Cloudflare scan Workflow | All six stages completed in 10 seconds on isolated text input |
| Read-only Worker APIs | Dashboard, intelligence, analytics, timeline/facets, topics, sources, pages, claims, activity, operations, costs, usage, articles, Zalo account metadata, AI models |
| Article mutation and exports | Edit/reload/version history/delete; PDF and DOCX return valid file signatures and Vietnamese content |
| Permission boundary | Local account receives 403 for Tuturuuu-only account administration |
| Related-evidence query | Real 1,176-profile dataset; 200, profile ready, approximately 1.1 seconds |
| Repeated authenticated page streams | 15 complete responses across overview, intelligence, operations, and usage after cache replacement |
| Browser suite | 53 passed on the deployed native Worker (2.3 minutes) |

The browser suite covers desktop/mobile/dark layouts, keyboard navigation,
legacy redirects, filters/search, detail pages, error recovery, and billing
periods/currency/CSV export. Billing interaction assertions use controlled API
fixtures; live billing API reads are separately checked against copied records.

## Regressions found and repaired during migration

- D1's short LIKE/GLOB pattern limit rejected a normal search term. Search now
  uses parameterized literal substring matching with Vietnamese case folding.
- Worker UTC and browser local time disagreed during hydration. Dates now have
  an explicit Vietnamese workspace time zone.
- React streaming cache state intermittently stalled requests in workerd.
  Request-time rendering and persisted data caching replace that path. Cached
  database dates round-trip through a tested codec.
- SQLite element-to-element vector joins exceeded the request budget. Bounded
  vector batches preserve exact cosine/ranking rules and finish promptly.
- Early interaction with the article search field could race hydration. The
  field becomes editable when its event handlers are ready.

- R2 upload completion could timestamp old catalog data after an edit. Cache
  timestamps now record the start of the write, preserving tag invalidation
  ordering. Immediate edit-to-catalog freshness passes on the real Worker.

## Verification boundaries

Live candidate tests use an isolated local QA account and a copied database.
They do not send public Zalo messages, refresh copied Zalo credentials, invite
real users, or modify external shared storage. These external-write contracts
are covered by focused regression tests; source secrets and encryption keys are
preserved. Centralized OAuth redirects and source sessions require canonical-host
verification during cutover. A local-account 403 is expected for centralized-only
features and must not be reported as successful authenticated coverage.

Before completion, record the verified source SHA, provider version, fresh final
snapshot counts/hashes, canonical authenticated checks, scheduler ownership, and
runtime log findings. Retain the old database frozen for recovery; do not route
traffic back to its stale copy after D1 accepts writes.
