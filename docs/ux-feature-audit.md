# CS35 feature and UX audit

Scope: every page template, shared navigation, loading/error states, data browsing, and core workflows. Live-provider writes are tracked separately from read-only checks.

| Route template | Source | Coverage |
| --- | --- | --- |
| `/alerts` | `app/alerts/page.tsx` | Canonical redirect verified; destination covered separately |
| `/analysis` | `app/analysis/page.tsx` | Canonical redirect verified; destination covered separately |
| `/articles/[id]` | `app/articles/[id]/page.tsx` | Representative existing record opened on desktop/mobile; shared visual system applied |
| `/articles/new` | `app/articles/new/page.tsx` | Canonical redirect verified; destination covered separately |
| `/articles` | `app/articles/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/audit` | `app/audit/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/chat/[id]` | `app/chat/[id]/page.tsx` | No existing conversation in the local audit identity; conversation operations covered by existing tests, live conversation UI remains unverified |
| `/chat` | `app/chat/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/counter-arguments` | `app/counter-arguments/page.tsx` | Canonical redirect verified; destination covered separately |
| `/drafts/[id]` | `app/drafts/[id]/page.tsx` | Fallback redirect and retained scan context covered by final browser regression |
| `/drafts` | `app/drafts/page.tsx` | Canonical redirect verified; destination covered separately |
| `/evidence/[id]` | `app/evidence/[id]/page.tsx` | Representative existing record opened on desktop/mobile; shared visual system applied |
| `/evidence` | `app/evidence/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/guides/5-step-process` | `app/guides/5-step-process/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/guides/policies` | `app/guides/policies/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/guides/user-guide` | `app/guides/user-guide/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/intelligence` | `app/intelligence/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/intelligence/topics/[slug]` | `app/intelligence/topics/[slug]/page.tsx` | Representative existing record opened on desktop/mobile; shared visual system applied |
| `/login` | `app/login/page.tsx` | Authenticated localhost redirect covered; existing production session verified; fresh SSO and local-password submission not exercised |
| `/members` | `app/members/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/operations` | `app/operations/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/` | `app/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/scans/[id]` | `app/scans/[id]/page.tsx` | Representative existing record opened on desktop/mobile; shared visual system applied |
| `/settings` | `app/settings/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/sources` | `app/sources/page.tsx` | Desktop/mobile read-only render and dark-theme captures passed; shared visual system applied |
| `/topics/[slug]` | `app/topics/[slug]/page.tsx` | Representative existing record opened on desktop/mobile; shared visual system applied |
| `/topics` | `app/topics/page.tsx` | Canonical redirect verified; destination covered separately |
| `/verify-token` | `app/verify-token/page.tsx` | Tokenless recovery redirect covered with localhost test session; fresh token exchange not exercised |

## Verification boundaries

- Existing baseline: 545 unit tests passed.
- Legacy redirects are verified as redirects, not counted as distinct working screens.
- Browser tests must block unplanned mutations and paid provider calls.
- Record desktop, mobile, dark theme, keyboard interactions, loading, empty and failure states.
- Live publication, messaging, membership changes and provider billing are not certified by mocked tests.

## Module changes and functional checks

| Module | Improvements and checks | Remaining live-action boundary |
| --- | --- | --- |
| Shared shell | Consistent headings, cards, breadcrumbs, navigation, skip link, focus states, reduced motion, narrow-screen layout, navigation progress feedback | Authenticated production smoke test after deployment is recorded in the release report |
| Sources and scans | Shared keyboard tabs, URL persistence, all four views, existing scan detail | No extra paid scrape, source deletion, or schedule mutation triggered for this UI audit |
| Analysis and topics | Shared tabs, browser Back, real sort-parameter fix, persistent filters, compact mobile advanced filters, loading/error/retry states | No new paid AI generation triggered |
| Evidence timeline and detail | Responsive shared layout and compact two-column detail summary; real record and invalid-ID recovery | Triage, assignment, deletion and export logic covered by existing tests; no live evidence mutation |
| Articles and editor | Readable mobile rows, selection, search, correct failure states, semantic editor heading and wrapping actions | Live saving, approval, media upload and Zalo publishing not exercised; existing domain tests cover their logic/contracts |
| Chat | Accessible page heading, shared navigation feedback and loading frame | No existing conversation available to audit identity; streaming, tools, attachments and deletion require a dedicated test conversation |
| Operations | Four focused views, searchable scan rows, stale-data retry, honest missing-service status, maintenance confirmation | Cleanup cancelled in browser; no Drive deletion triggered |
| Provider costs | Account-cost and sync summary cards; monthly account totals remain separate from expandable run receipts, preventing double counting | Existing Apify/account-cost/delivery tests pass; no billing or AI-credit mutation added |
| Members | Shared presentation and readable labels | Listing checked; invitations, roles, passwords and account deletion not changed live |
| Settings and account controls | Clear links to operations, members and guides; connected-channel panel retained | Existing auth/profile/member tests; no credential or integration settings changed |
| Audit log | Clearer copy; explicit loading/error/retry instead of false empty state | Existing event records read; no synthetic audit events written |
| Guides | Consistent guide navigation, typography and shared page layout | All three static guides covered |

This audit distinguishes page coverage from exhaustive workflow certification. Existing tests include provider boundaries, AI metering, Apify reconciliation, scheduler callbacks, scan concurrency/retries, evidence processing, article validation and publication contracts, auth/session checks, membership, exports and media. Passing those tests does not establish live delivery to Zalo, successful paid provider calls, fresh SSO, every role permutation, or every Chat tool.

## Regression commands

- `bun test`
- `bun run typecheck`
- `bun run lint -- <changed TypeScript paths>`
- `bunx playwright test --workers=1` (read-only configured data; API writes blocked in workspace audit)
- `NEXT_WEBPACK_BUILD=1 bun run build --webpack`

The browser suite includes 22 main page/view combinations, four existing detail screens, canonical/legacy redirects, navigation feedback, mobile filters, sorting persistence, reversible article selection, cancelled maintenance and injected request failures with retry. Screenshots and traces remain local under `test-results/` and are not committed.

## Local verification result (2026-09-07)

- 545 tests passed across 67 files; TypeScript and changed-file ESLint passed.
- 49 browser checks passed: 48 in the final full run, followed by a passing focused rerun of one cold-server redirect timeout. Navigation feedback is verified while data is deferred; this does not claim every authenticated route is fully available from cache.
- Webpack reports an optional `browser-use-sdk` wallet dependency warning (`viem/accounts`). CS35 uses the API-key adapter; wallet/x402 authentication is not used.

- Production webpack build passed and generated all 99 routes.

- Live follow-up: current healthy services plus retired worker history no longer produce a false warning. Added five behavioral health tests; the full suite now passes 550 tests across 68 files. Chat activity is explicitly labeled separately from workspace-wide AI metering.

## Usage and Overview follow-up (2026-09-07)

- `/usage`: dedicated navigation and breadcrumbs, combined-provider summaries,
  provider/model/activity breakdowns, daily chart/table, all-time/30-day selection,
  CSV export, source coverage and provider synchronization receipts.
- `/`: clearer current-workload cards, explicit evidence/time scopes, compact
  recent activity, expense summary and actionable links; no false loading zeros
  or false healthy state when priority queries fail.
- Focused browser fixtures cover desktop/mobile layouts, export, range selection,
  error retry and Overview-to-Usage navigation. Live billing reads and receipt
  reconciliation are separate gates; missing Firecrawl/Neon invoices remain visible.
