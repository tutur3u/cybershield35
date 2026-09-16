import { unchangedRow } from "../lib/db/d1-guard.ts";
import { containsInsensitive } from "../lib/db/sqlite-search.ts";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { getPlatformProxy } from "wrangler";
import { and, eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1Client } from "../lib/db/d1-client.ts";
import { claimD1Scan } from "../lib/db/d1-scan-claims.ts";
import { createD1StagingSchema } from "../lib/db/d1-migration.ts";
import * as schema from "../lib/db/schema.d1.ts";

// An ephemeral LOCAL D1 instance: never use a production or staging database.
const proxy = await getPlatformProxy<{ CS35_DB: D1Database }>({
	configPath: "wrangler.jsonc", persist: false, remoteBindings: false,
});
try {
	const binding = proxy.env.CS35_DB;
	for (const statement of createD1StagingSchema().split(";").filter((part) => part.trim())) {
		await binding.prepare(statement).run();
	}
	await binding.exec(readFileSync("drizzle-d1/0001_revisions.sql", "utf8").replaceAll("\n", " "));
	await binding.exec(readFileSync("drizzle-d1/0002_attachment_search.sql", "utf8").replaceAll("\n", " "));
    assert.equal(await binding.prepare("select sqrt(9) as value").first("value"), 3);
	const db = createD1Client(binding);
	const [source] = await db.insert(schema.sources).values({
		type: "text", originalInput: "D1 runtime verification", metadata: { language: "Tiếng Việt" },
	}).returning();
	assert.ok(source);
	assert.ok(source.createdAt instanceof Date);
	assert.deepEqual(source.metadata, { language: "Tiếng Việt" });
	const amountUsd = "123456789012.123456789012";
	await db.insert(schema.providerAccountCosts).values({
		id: "decimal-verification", provider: "test", accountId: "test-account",
		day: "2026-09-16", amountUsd, observedAt: new Date(),
	});
	const [cost] = await db.select().from(schema.providerAccountCosts);
	assert.equal(cost?.amountUsd, amountUsd);
	const [scan] = await db.insert(schema.scanJobs).values({sourceId: source.id, provider: "local_text"}).returning();
	assert.ok(scan);
	const claimed = await Promise.all([claimD1Scan(db, {scanId: scan.id}), claimD1Scan(db, {scanId: scan.id})]);
	assert.equal(claimed.filter(Boolean).length, 1);
	assert.equal(claimed.find(Boolean)?.attempts, 1);
	await db.insert(schema.scanJobs).values({sourceId: source.id, provider: "local_text", scheduledAt: new Date(Date.now() + 60000)});
	assert.equal(await claimD1Scan(db), null);
	const accountId = crypto.randomUUID();
	const sessionId = crypto.randomUUID();
	await db.batch([
		db.insert(schema.localAccounts).values({id: accountId, username: "d1-verification", passwordHash: "not-a-credential", disabled: true}),
		db.insert(schema.localAccountSessions).values({id: sessionId, accountId, tokenHash: "not-a-token", expiresAt: new Date(Date.now() + 60000)}),
	]);
	const [account] = await db.select().from(schema.localAccounts).where(eq(schema.localAccounts.id, accountId));
	assert.equal(account?.disabled, true);
	// A failed child insert must roll back the preceding parent update.
	await assert.rejects(() => db.batch([
		db.update(schema.localAccounts).set({disabled: false}).where(eq(schema.localAccounts.id, accountId)),
		db.insert(schema.localAccountSessions).values({accountId: crypto.randomUUID(), tokenHash: "invalid-fk", expiresAt: new Date()}),
	]));
	const [unchanged] = await db.select().from(schema.localAccounts).where(eq(schema.localAccounts.id, accountId));
	assert.equal(unchanged?.disabled, true);
    // A concurrent edit must fail the entire optimistic batch, including audit data.
    await assert.rejects(() => db.batch([
        unchangedRow(db, schema.localAccounts, and(eq(schema.localAccounts.id,accountId),eq(schema.localAccounts.revision,99))!),
        db.update(schema.localAccounts).set({disabled:false}).where(eq(schema.localAccounts.id,accountId)),
    ]));
    assert.equal((await db.select().from(schema.localAccounts).where(eq(schema.localAccounts.id,accountId)))[0]?.disabled,true);
    await db.batch([
        unchangedRow(db,schema.localAccounts,and(eq(schema.localAccounts.id,accountId),eq(schema.localAccounts.revision,0))!),
        db.update(schema.localAccounts).set({disabled:false}).where(eq(schema.localAccounts.id,accountId)),
    ]);
    assert.equal((await db.select().from(schema.localAccounts).where(eq(schema.localAccounts.id,accountId)))[0]?.revision,1);
    await db.update(schema.sources).set({originalInput:"Nội dung TIẾNG VIỆT"}).where(eq(schema.sources.id,source.id));
    assert.equal((await db.select().from(schema.sources).where(containsInsensitive(schema.sources.originalInput,"tiếng việt"))).length,1);
	await db.delete(schema.localAccounts).where(eq(schema.localAccounts.id, accountId));
	assert.equal((await db.select().from(schema.localAccountSessions)).length, 0);
	console.log("D1 runtime passed: typed reads/writes, exact decimals, JSON, dates, booleans, concurrent scan claims, future scheduling, atomic batch rollback, FK cascade.");
} finally {
	await proxy.dispose();
}
