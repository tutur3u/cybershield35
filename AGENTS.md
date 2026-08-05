<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CS35 Deployment Check

Before committing and pushing CS35 changes, run `bun run build` and ensure it passes. Also run the relevant focused tests and lint for the touched area.

## CS35 Shipping Flow

For CS35 implementation work, commit and push the verified changes to `main` when the work is complete unless the user explicitly asks not to.
