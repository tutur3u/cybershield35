# Cloudflare runtime and database migration

## Resources

| Environment | Worker | D1 | R2 cache |
| --- | --- | --- | --- |
| Candidate | cs35-migration-staging | 5ecf345c-e585-480a-a746-71a1a3624d06 | cs35-migration-staging-cache |
| Production | cs35-production | 991e3c70-d792-4597-b40a-b9c7a677f17b | cs35-production-cache |

The native application uses D1 through Drizzle SQLite, Cloudflare Workflows for
scan checkpoints, and Cron Triggers for scheduled scans and article publication.
R2 stores the Next cache; D1 cache tags invalidate shared results and a Durable
Object queues cache revalidation. External business integrations (Tuturuuu
identity/AI/Drive, crawlers, and Zalo) retain their existing contracts.

`wrangler.jsonc` targets the isolated candidate. `wrangler.production.jsonc`
targets production. Production domains and cron triggers must only be added after
the final data copy passes verification. Resource creation alone is not cutover.

## Validate and deploy

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck:test
bun test
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
   two cron schedules and disable the previous scheduler/deployment ownership.
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
