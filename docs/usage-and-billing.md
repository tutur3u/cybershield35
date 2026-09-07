# Usage and billing

`/usage` combines recorded costs for CS35 and shows all-time, 30 UTC calendar days
including today, current-month and current-day totals. Analytics can switch between
30 days and all retained history. CSV exports the underlying provider/model/day
lines, including the data source, without credentials.

## Display currency and invoice snapshots

Costs default to VND. The selector persists VND/USD locally across Usage,
Overview, and provider reconciliation. The ledger stays in USD. VND uses the
dated USD rate from ExchangeRate-API's open endpoint, cached for one day;
responses older than seven days are rejected. The UI attributes the source and
labels conversion as an estimate, not a historical payment exchange rate. If
the rate is unavailable, USD is shown explicitly. CSV includes original USD,
display currency/amount, applied rate and its timestamp.

`CS35_BILLING_INVOICES_JSON` can hold privately reviewed paid Neon/Firecrawl
invoice snapshots: provider, reference, issuedOn, amountUsd, currency (`USD`),
status (`paid`), reviewedOn. Keep the values in private local/runtime
configuration, never Git. Identical references are deduplicated; conflicting
snapshots and overlapping invoice/usage provider coverage fail closed. Invoice
totals are attributed to issue date, not estimated consumption dates.

These snapshots are explicitly labeled `reviewed_provider_invoice` and appear
in a separate invoice table. Cost maintenance and manual reconciliation send them
to Tuturuuu's app-bound `POST /v1/provider-invoices` endpoint. The Integrations
page retains the original USD amount, issue/review dates and receipt time.
Replays are idempotent; conflicting references return 409 and require review.
These immutable invoice receipts are separate from metered provider usage and
never debit AI credits. Do not sum overlapping invoice and usage totals.
Deploy the Tuturuuu migration/API before enabling the CS35 invoice sender.
Browser sign-in
permits manual billing review; it does not establish an automated invoice API
connection or install a new persistent credential.

## Sources and accounting rules

- Apify: daily account totals in `provider_account_costs`, including retrospective
  billing and date-order/pay-per-event fees. Run receipts are supporting detail;
  they must not be added again.
- AI: `GET https://ai.tuturuuu.com/v1/usage` with the existing app-bound machine
  key, or the signed-in external-app session as fallback. Reports are restricted
  to the credential's app/workspace and include background and interactive calls.
  Provider USD cost is included once; billed/unmetered credits and local Chat token
  counters are separate dimensions, not additional expenses.
- Browser Use: official session USD costs, including LLM, browser and proxy costs.
  Set `BROWSER_USE_ACCOUNT_DEDICATED_TO_CS35=true` only for a dedicated account.
  Daily maintenance and manual reconciliation save daily snapshots and send them
  to Tuturuuu. A lower retained-session total requires review rather than silently
  erasing earlier costs. Deleted history preceding the first snapshot and monthly
  subscription invoices still need separate reconciliation.
- Vercel: only matching `Tags.ProjectId` charges from `/v1/billing/charges`.
  Include `BilledCost` after credits, never both billed and effective/list costs.
  Keep service dimensions as separate stable ledger resources. Unattributed team
  fees are not assigned to CS35, even when the project has a dedicated budget.
- Firecrawl and Neon: usage counters do not establish historical USD charges.
  These remain visible coverage gaps until invoice data is connected. Unknown
  costs are never represented as confirmed free usage.

On 2026-09-07 the authenticated Firecrawl billing dashboard for the configured
CS35 key showed Free ($0/month), no payment method, and no invoices. This is a
dated account review, not an automatically refreshed invoice integration.

Recorded consumption is not proof of payment, a tax invoice, or an exhaustive
account bill. The UI identifies missing sources and each report's freshness.

## Historical Vercel import

Export the official billing endpoint as NDJSON, retaining CS35's exact project ID.
The Vercel CLI `usage --group-by project --format json` is useful for reconciling
totals, but is not the raw charge format. CLI 55 `api --raw` still tries to parse
NDJSON as a single JSON document; use an authenticated HTTP client for this export.
Keep the original export privately outside Git for audit.

```sh
bun --conditions react-server scripts/import-vercel-costs.ts \
  --file=/private/path/charges.ndjson --project=prj_0aKoCUURPPB3gR7UY2uOxhtDjIUG
```

The default is dry-run. Add `--apply` after reviewing record counts and totals.
Imports are transactional and idempotent; amount changes clear the sync receipt.
Never-billed zero-dollar entries are omitted, while zero-dollar corrections to
existing charges are retained. Bulk inserts avoid one network round trip per row.
Daily attribution follows the provider's charge-period start date, which can
precede the requested export boundary when billing periods overlap it.
**Release the provider-aware `syncAccountCosts` implementation before importing
non-Apify rows.** Earlier workers hard-code Apify in the outbound payload.

Maintenance delivers 100 daily records per batch; a large backfill needs repeated
sync batches. Use the existing private production configuration and
`scripts/reconcile-provider-costs.ts --apply --account-only --sync`, repeating
until all provider ledger records have matching workspace sync receipts. Do not
paste credentials into commands, logs or Git. Future Vercel exports need the same
project/date filtering and reconciliation; no billing token is exposed in CS35's
browser bundle.

## Verification

- `bun test` covers UTC cutoffs, cross-provider sums, snapshot deduplication,
  Vercel project attribution and preserved provider identity in sync payloads.
- `bunx playwright test e2e/usage.e2e.ts --workers=1` checks desktop/mobile UI,
  CSV export, date-range controls, errors/retry and Overview navigation using
  deterministic billing fixtures. Provider API reads are verified separately.
- Run `bun run build` before shipping; the supported fallback is
  `NEXT_WEBPACK_BUILD=1 bun run build --webpack`.
