# Cloudflare runtime and database migration

## Resources

| Environment | Worker | D1 | R2 cache |
| --- | --- | --- | --- |
| Candidate | cs35-migration-staging | 5ecf345c-e585-480a-a746-71a1a3624d06 | cs35-migration-staging-cache |
| Production | cs35-production | 991e3c70-d792-4597-b40a-b9c7a677f17b | cs35-production-cache |

The native application uses D1 through Drizzle SQLite, Cloudflare Workflows for
scan checkpoints, and Durable Object alarms for scheduled scans and article publication.
R2 stores the Next cache; D1 cache tags invalidate shared results and a Durable
Object queues cache revalidation. External business integrations (Tuturuuu
identity/AI/Drive, crawlers, and Zalo) retain their existing contracts.

`wrangler.jsonc` targets the isolated candidate. `wrangler.production.jsonc`
targets production. The final verified copy and production cutover completed on
September 16, 2026; see [verification evidence](cloudflare-parity-verification.md).
For future transfers, attach domains and start the scheduler only after data verification.

## Validate and deploy

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck:test
bun run test
node --experimental-strip-types scripts/verify-d1-runtime.ts
bun run build:cloudflare
CLOUDFLARE_ACCOUNT_ID=e8912e2867beecc673d171907bf09649 bun run deploy:cloudflare
```

The Cloudflare build includes the required `bun run build`. CI verifies each
main/PR commit. Deploy from that verified commit using an authenticated Wrangler
session or a scoped Cloudflare deployment token. Never place runtime secrets in
Git, build arguments, or public variables.

Next 16.3 partially rendered page streams intermittently hang in the deployed
OpenNext runtime. Pages therefore render at request time. The persisted data cache uses OpenNext incremental caching and shared tags, with
a codec that preserves database Date values. Re-enable Cache Components only
after repeated authenticated Worker tests pass.
Vietnamese dates explicitly use Asia/Ho_Chi_Minh to match server and browser.

## Data and consistency

The 42 PostgreSQL application tables have native D1 mappings. JSON and vectors
use JSON text, money retains decimal text, and UTC timestamps have six fractional
digits to preserve ordering and source checksums. `_revision` triggers and
conditional guards protect multi-statement D1 batches from stale writes. A failed
guard rolls back the complete batch. Scan claiming is one conditional UPDATE,
including capacity; each scan attempt has a deterministic Workflow instance ID.

Exact related-evidence ranking pages vectors through the Worker and retains the
same cosine scores and ranking rules. It does not join every JSON vector element
against every target element in D1. Variable ID lists use a single JSON parameter;
bulk inserts respect D1's 100-parameter limit. Attachment text search uses FTS5.

## Final transfer procedure

1. Verify authenticated candidate reads, mutations, exports, mobile layouts,
   Workflows, billing, and external integration configuration.
2. Stop source writers and scheduled jobs; confirm no active scans/publications.
   Record the write-freeze time in the private migration audit.
3. Capture a fresh consistent PostgreSQL snapshot with
   `scripts/export-d1-snapshot.ts`. Preserve the earlier snapshot separately.
4. Apply production D1 migrations with `bun run db:migrate:production`.
5. Run `node --experimental-strip-types scripts/import-d1-snapshot.ts --apply-production`.
   It requires a snapshot newer than the freeze marker, refuses mismatched
   existing data, rereads every application table, compares SHA-256/counts, and
   checks foreign keys. Private reports remain under ignored `migration-private/`.
6. Provision the same nonempty runtime settings, especially the cookie/app secret
   and Zalo token encryption key. Never replace a sensitive setting with an empty
   value from an environment export. Database credentials are not transferred.
7. Verify the production Worker before attaching canonical domains. Enable its
   alarm scheduler and disable the previous scheduler/deployment ownership.
8. Verify canonical authenticated behavior, actual deployment version, logs, and
   data persistence before declaring cutover complete.

The candidate must not refresh copied Zalo refresh tokens: refresh rotates the
shared credential. `CS35_DEPLOYMENT_MODE=staging` prevents that operation.

## Maintenance and rollback

Maintenance scripts resolve D1 explicitly. Commands default to **local** D1;
`--remote` selects the candidate and `--production` selects production. For example:

```sh
bun run db:analyze-intelligence
bun run db:analyze-intelligence --production
bun run db:backfill-intelligence --production
```

Use `bun run db:generate` to generate reviewed SQLite migration proposals in
`drizzle-d1-generated`; reconcile the existing baseline before adopting a proposal.
Apply reviewed SQL in `drizzle-d1` through Wrangler. PostgreSQL schema/driver code
is retained only for source export and rollback tooling.

Retain the frozen source database and private verified snapshot after cutover.
After D1 accepts writes, switching DNS to the old database would lose those
writes. Roll back the Worker version while retaining D1, or first reconcile new
D1 data into a validated source copy during another write freeze.

## Domain account routing

The ttr.gg zone belongs to Skora Personal; application resources belong to
Tuturuuu. `wrangler.gateway.jsonc` deploys a streaming routing Worker in the zone
account. It forwards requests to the production Worker over HTTPS with a shared
`CS35_GATEWAY_SECRET`. The application validates that credential and the allowed
public hostname before restoring canonical request URLs and stripping the
internal credential. Cookies, request bodies, redirects, and response streams
are preserved. Deploy the application before the gateway when changing ingress.


## Recovery archive and Neon retirement

Before disabling Neon compute, retain both the verified D1 transfer snapshot and
an independent PostgreSQL custom-format archive. On September 16, PostgreSQL 18
`pg_dump` captured the frozen source; `pg_restore` decoded the complete archive
successfully (43 table-data sections, including migration metadata). An isolated
PostgreSQL 18 restore with pgvector then reproduced all 42 application tables
and 54,799 rows from the final source manifest. The temporary restore container
was removed. Files and
checksums are in the ignored private migration directory and must not be committed.

The authenticated Neon billing page showed the CS35 organization on Free at
$0/month, with 0.5 GB storage included; the project retained about 0.11 GB.
The only compute endpoint, `ep-divine-scene-ao8bdq5b`, was deleted after validation
at 2026-09-16T18:14:17.579Z. The console now shows no compute, and the old
connection is rejected. Old connection strings cannot wake the removed endpoint.
The frozen branch can remain within that free allowance as a recovery copy.
Recheck the plan before any future change; historical invoices are independent
of future compute use.


## Persistent scheduled jobs

`wrangler.scheduler.jsonc` deploys `cs35-scheduler` in the application account.
Each recurring job owns a SQLite-backed Durable Object: daily scans at 00:00 UTC,
and publication/queue maintenance at five-minute UTC boundaries. The scheduler
calls the application through a service binding with `CRON_SECRET`. The same
secret must be installed in both Workers. No database credentials are needed.

Deploy the application first, then `bunx wrangler deploy --config
wrangler.scheduler.jsonc`. With `CRON_SECRET` supplied through private runtime
configuration, run `node scripts/bootstrap-cloudflare-scheduler.mjs`. Bootstrap
is idempotent: it preserves existing timers and retry state. The first maintenance
alarm runs promptly to verify the path; daily collection waits for midnight.
`--status` reads persisted state without changing it. Control endpoints require
authentication. Application Cron Triggers are empty to keep one scheduling owner.

Failed jobs retry with a 30-second exponential backoff capped at five minutes;
success returns to the next UTC boundary. The alarm is re-armed before external
I/O and after each result. Alarms are at-least-once, so existing database job claims
and provider checkpoints remain necessary to prevent duplicate business writes.
Historical `cloudflare-cron` heartbeat/provider IDs are preserved for continuity.

The standalone alarm runtime test verifies authenticated control, repeated startup,
automatic invocation, persisted failure and automatic recovery:
`node scripts/verify-scheduler-runtime.mjs`. Native Cron Triggers did not produce
an invocation during the cutover observation window, so completion depends on a
verified production alarm heartbeat rather than trigger registration alone.
