# Cloudflare migration

## Current boundary

This is a staging migration. The production application still uses PostgreSQL and
Vercel Workflow. `CS35_DB` is a staging D1 binding; declaring it does not switch the
application database. No production custom domain or scheduled triggers are in
the Wrangler configuration.

Resources belong to the Tuturuuu account:

- D1: `cs35-migration-staging` (`5ecf345c-e585-480a-a746-71a1a3624d06`).
- R2 build cache: `cs35-migration-staging-cache`.
- Target Worker name: `cs35-migration-staging`.

The isolated candidate is available at
<https://cs35-migration-staging.tuturuuu-e89.workers.dev>. Anonymous verification
returned 200 for login, favicon and sampled JavaScript assets, 307 from `/usage`
to login, and 401 from `/api/usage`. On September 16, staging authentication
secrets were provisioned and the login gate was corrected so unrelated database
and crawler configuration cannot disable centralized sign-in. The application
still uses its PostgreSQL driver; these checks do not verify a login session or
any authenticated D1-backed application flow.

## Build and validate

```sh
bun install --frozen-lockfile
bun run cf:typegen
bun test test/d1-migration.test.ts test/cost-period.test.ts test/usage-summary.test.ts
bun run build:cloudflare
bunx wrangler deploy --dry-run
```

The Cloudflare build runs the required `bun run build`. Its post-build step extends
Next's generated middleware trace with the OpenTelemetry ESM files that OpenNext
resolves. Binding types are generated without replacing DOM/Next global types.
Worker minification is required to keep this app's bundle within the upload limit.
Neither a build nor a dry run establishes runtime compatibility.

## Data rehearsal

The staging schema preserves 42 application tables, foreign keys, enum constraints,
ordinary indexes and partial unique indexes. UUID creation moves to the native
application writer. Decimal costs remain text; JSON and existing 768-dimensional
vectors remain JSON text. PostgreSQL expression, full-text and HNSW indexes still
need native replacements before cutover.

```sh
bun scripts/generate-d1-schema.ts
bunx wrangler d1 migrations apply cs35-migration-staging --local
bunx wrangler d1 migrations apply cs35-migration-staging --remote
# Source credentials must already be in private runtime configuration.
bun scripts/export-d1-snapshot.ts
node scripts/import-d1-snapshot.ts --apply-staging
```

The exporter opens a read-only, repeatable-read source transaction and validates
the snapshot with SQLite before producing a manifest. All private files live in
the ignored `migration-private/` directory with restrictive permissions. It refuses
to overwrite an existing snapshot. Never commit or publish those files.

Use the parameterized importer. Raw SQL import exceeds D1's statement length limit
for some existing records. D1 also imports in chunks, so the importer loads parent
tables before children. After writing, it re-reads each D1 table in primary-key
order and compares both row count and SHA-256 with the captured source manifest,
then checks foreign keys. Enum primary keys preserve PostgreSQL's declared enum
order during comparison. A mismatch stops the transfer without overwriting data.
`d1-verification.json` is written only after every table passes.

For an isolated Worker deployment after inspecting its configuration, pass
`CLOUDFLARE_ACCOUNT_ID=e8912e2867beecc673d171907bf09649` to
`bunx opennextjs-cloudflare deploy`; the cache-population command needs an explicit
account when the local login has access to multiple accounts.

## Required before production cutover

1. Replace `lib/db/client.ts` and the PostgreSQL Drizzle schema with native D1 access.
2. Port raw PostgreSQL queries (JSON, date arithmetic, casts, rollups and search).
   Do not use regex SQL translation as the runtime database adapter.
3. Convert interactive transactions to atomic D1 batches or explicit concurrency
   control. Preserve job claims, article versioning, session and attachment safety.
4. Replace pgvector/HNSW lookup with verified Vectorize queries or equivalent
   native search that preserves model boundaries and authorization filtering.
5. Move scan stages to Cloudflare Workflows; verify retries, idempotency and deploy
   recovery. Move both cron jobs and reconcile the managed scheduler so jobs do not
   run twice.
6. Audit file/media storage, export generation and remaining Vercel SDK dependencies
   in the Workers runtime. Provision staging secrets through the authorized secret
   channel, with isolated provider/test data where external writes are involved.
7. Verify authenticated login, workspace boundaries, chat streaming/attachments,
   scans, intelligence/search, article edits/publication and billing on staging.
8. Pause all production writers for a final consistent snapshot, verify data parity,
   deploy the verified SHA, switch the canonical domain and scheduler, then verify
   production behavior and persistence. Define rollback before accepting new writes
   on D1: switching DNS back alone would lose writes made after cutover.

A rehearsal snapshot is not ongoing replication. Keep the source service until
cutover and rollback requirements have been satisfied.
