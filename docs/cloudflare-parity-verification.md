# Cloudflare feature-parity verification

## Release decision: blocked

September 16 update: authentication secrets are now provisioned on the staging
Worker. The login gate no longer requires unrelated PostgreSQL/crawler settings.
The auth regression suite passes (65 tests), along with focused lint and both
builds. This removes the disabled login control; it does not establish completed
token exchange, authenticated persistence, or D1 feature parity. The September 15
results below remain the historical baseline, not new cutover approval.

Verification date: 2026-09-15. Baseline source:
`ae185e4115a239693f916c55276d1414a844019d`, plus the Overview responsive-grid fix.
Production remains on Vercel/PostgreSQL. This report does not authorize cutover.

The candidate at `https://cs35-migration-staging.tuturuuu-e89.workers.dev`
renders **Đăng nhập chưa khả dụng** and has no Tuturuuu login link. Production
provides that link. Authentication parity fails before any authenticated feature
can be exercised. The application database driver also still targets PostgreSQL;
the D1 snapshot and binding do not implement D1 application reads or writes.

## Results and limits

| Check | Result | What it establishes |
| --- | --- | --- |
| Bun suite | 605 passed, 0 failed across 83 files | Existing logic, contracts and mocked route regressions |
| Each test file in a separate Bun process | All 83 passed | Results do not depend on mocks leaked from other test files |
| Application and test TypeScript checks | Passed | Static compatibility |
| Next production build, OpenNext Worker build and focused lint | Passed | Build compatibility; not authenticated runtime proof |
| Browser baseline, first run | 51 passed, 2 failed | Both failures exposed Overview overflow after desktop-to-mobile resize |
| Browser baseline after grid fix | All 53 passed | Next development server with local authentication bypass; not Workers or real login |
| Deployed anonymous route comparison | 21 paths passed on each host | 11 pages redirect to login; 10 private APIs return 401 |
| Deployed login comparison | Failed | Cloudflare login is unavailable |
| D1 data rehearsal | Previously verified 42 tables / 54,149 rows | Snapshot counts, hashes and foreign keys; not current production synchronization |

The browser baseline uses only the configured database credential, with
`options=-c default_transaction_read_only=on`. The launcher checks
`SHOW default_transaction_read_only` before starting Playwright. No provider
credentials are inherited from the source environment file. Workspace and usage
tests block browser API mutations. Billing tests use fixture API responses.

The responsive failure was reproduced in Chromium: after loading Overview at
1440px and resizing to 390px, the document expanded to 443px. Explicitly defining
the mobile grid as one `minmax(0, 1fr)` column and allowing both grid children to
shrink fixes the oversized billing and shortcut column. Existing browser tests
exercise this exact resize and the link from Overview to Usage.

Next development logs also contain instant-render validation errors, client-render
bailouts and early-closed streams. Passing browser assertions do not certify those
diagnostics as harmless in Workers; inspect deployed authenticated runtime logs
when that environment is available.

## Required functional acceptance on the actual candidate

Every row below is **unverified on Cloudflare**. Use isolated test workspaces,
real D1 persistence, and sandbox provider destinations for external writes.
Mocked route responses cannot satisfy these checks.

| Feature | Required acceptance |
| --- | --- |
| Authentication and access | Centralized and password login, refresh, logout, expired tokens, invitations, roles, cross-workspace denial |
| Sources and scans | Create/edit source, enqueue, concurrent claims, stage completion, retry, cancellation, restart recovery, no duplicate jobs |
| Intelligence and search | Filters, sorting, pagination, topic/detail counts, vector model boundaries, authorization filters and representative search results compared with source |
| Articles | Create/edit/reload, version history, concurrent edits, complete AI generation, interrupted generation, approval transitions |
| Chat | Create/reload conversations, streaming, interruption/retry, attachment upload/finalization/grounding, tool approval, scoped access |
| Publishing | Sandbox Zalo publication, duplicate prevention, queue recovery, provider refusal, retries and truthful publication status |
| Files and exports | Upload/download/delete permissions, images, PDF/DOCX/audio bytes, Unicode filenames and browser downloads |
| Billing | Provider receipt ingestion, duplicate receipt replay, negative corrections, decimal precision, date boundaries, missing costs, invoice reconciliation, CSV and currency display |
| Scheduling | Both cron flows, managed-scheduler overlap prevention, missed execution recovery and idempotency |
| Cutover and rollback | Final writer freeze, fresh snapshot verification, exact source/deployment version, one active scheduler, canonical-host checks and preservation of post-cutover writes |

Follow [the migration runbook](cloudflare-migration.md) for the unfinished runtime
ports. Do not switch domains or production writers until these acceptance checks
pass on the deployed candidate and rollback has been rehearsed.
