# Cloudflare feature-parity verification

## September 16 production cutover

Production at https://cybershield35.ttr.gg now runs on Cloudflare Workers with
all application reads/writes on native D1, R2 caching, Durable Object cache
revalidation, alarm scheduling, and Cloudflare Workflows. The cs35.ttr.gg alias preserves paths
and queries when redirecting to the canonical host.

The source PostgreSQL database was frozen at 16:46:08 UTC. The final consistent
snapshot was captured at 16:46:49 UTC: **42 tables and 54,799 rows**. Every table
passed row-count and SHA-256 comparison against production D1, with no foreign-key
violations, at 16:55:20 UTC. Private snapshots and audit reports are retained.

Vercel production now serves only a static redirect; its cron definitions are
empty and automatic application builds are disabled. The legacy managed-scheduler
credential is disabled in D1. The frozen PostgreSQL source is retained for recovery with no compute endpoint;
Neon retirement is documented in the [migration runbook](cloudflare-migration.md).

## Release identity

Application source: `905c8f4d3d4b726b6b4f93c77929d82fce1f0df6`.
Cloudflare Worker version: `036f1593-28e8-4f0b-86c8-f8f8be04f64c`.
The canonical host and alias both expose that version in `X-CS35-Deployment`.
[Exact-source main CI](https://github.com/tutur3u/cybershield35/actions/runs/35133888454)
passed lint, test type checking, all 91 isolated test files, native workerd D1
verification, real alarm retry verification, and the Cloudflare production build.
Scheduler Worker version: `c11a9eac-f471-4caa-b003-da461480027d`.

The final release pins Next.js and its lint/test integrations to 16.3.3, resolving
the two critical Next.js advisories identified by GitHub during closeout. Its
updated image dependencies are included in the committed lockfile.

## Verified evidence

| Check | Result / scope |
| --- | --- |
| Unit and regression suite | 619 tests across 91 files; billing, provider retries, authorization contracts, state transitions, cache codec, and vector scores |
| Native workerd D1 | Typed dates/JSON/booleans, exact decimal text, concurrent scan claim, FK rollback/cascade, revision guards, SQLite search |
| D1 application integration | Article lifecycle, analytics, timeline, billing, atomic rollups, provider checkpoint replay, protected internal stage endpoint |
| Real Worker password login | Successful; session persisted in D1 |
| Centralized identity | Real Chrome login completed; authenticated workspace members loaded |
| Drive attachment grounding | Real centralized Chrome upload, extraction, AI response containing a code provided only in the file, and external file cleanup on conversation deletion |
| Real Worker chat writes | Create, rename, workspace visibility, fork, soft delete, deleted-resource denial |
| Real AI chat stream | HTTP 200; text deltas and completion, no error event; both messages persisted |
| Automatic scheduling | Production Durable Object alarms completed at 18:10:11, 18:15:06 and 18:20:08 UTC, including after Neon shutdown; D1 heartbeat source scheduled, status success, HTTP 200; daily timer 00:00 UTC |
| Scheduler retries | Native workerd alarm persisted a simulated HTTP 503, automatically retried successfully, and preserved the next timer |
| Real Cloudflare scan Workflow | All six stages completed in 13 seconds on isolated production QA text input |
| Read-only Worker APIs | Dashboard, intelligence, analytics, timeline/facets, topics, sources, pages, claims, activity, operations, costs, usage, articles, Zalo account metadata, AI models |
| Article mutation and exports | Edit/reload/version history/delete; PDF and DOCX return valid file signatures and Vietnamese content |
| Permission boundary | Local account receives 403 for Tuturuuu-only account administration |
| Related-evidence query | Staging 1,176-profile dataset; 200, profile ready, approximately 1.1 seconds |
| Repeated authenticated page streams | 15 complete responses across overview, intelligence, operations, and usage after cache replacement |
| Browser suite | 53 passed again on the final Next.js 16.3.3 release at the canonical production domain (1.5 minutes) |
| Runtime logs | Latest application version: no HTTP 5xx in the QA window; network-loss exceptions correlated with canceled browser navigations |
| QA cleanup | Temporary local account and sessions, QA scan, centralized test conversation and Drive objects removed |
| Neon shutdown | Only compute endpoint deleted after final CI/browser checks; console shows no compute; old connection rejected; retained storage remains within the current $0 Free plan |
| Recovery restore | Frozen PostgreSQL archive restored successfully in an isolated PostgreSQL 18/pgvector database; all 42 application tables and 54,799 rows matched |

The browser suite covers desktop/mobile/dark layouts, keyboard navigation,
legacy redirects, filters/search, detail pages, error recovery, and billing
periods/currency/CSV export. Billing interaction assertions use controlled API
fixtures; live billing API reads are separately checked against production D1 records.

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

- Platform API requests now provide an explicit User-Agent. Cloudflare fetch
  otherwise omitted the header required by upstream anonymous-request protection.
  Real centralized login and member listing verified the repair.
- Finalized attachments can claim extraction when their processing lock is null;
  a live upload exposed the stuck transition. SQLite regression coverage also
  verifies that an active processing claim remains exclusive.

## Verification boundaries

Live production tests use temporary QA records, with centralized login and
workspace membership also checked through the existing Chrome session. Billing
interaction assertions use fixtures; live API reads are verified separately.
No public Zalo messages, real invitations, or provider purchases are sent
as test actions. External-write contracts have focused regression coverage;
source runtime secrets and encryption keys are preserved. Existing external
identity, AI, Drive, crawler and Zalo services remain business integrations.

Daily collection is configured for midnight; that natural daily firing was not
awaited during this verification window. Its route and pipeline have regression
coverage, and the production six-stage scan Workflow was exercised separately.

Retain the old database frozen for recovery. Do not route traffic back to its
stale copy after D1 accepts writes. Roll back application code while keeping D1,
or reconcile new writes before any database rollback.
