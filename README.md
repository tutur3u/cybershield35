# CyberShield 35

Private admin dashboard for AI For Life topic monitoring and evidence-grounded
counter-argument drafting.

## Server Setup

Run Postgres and the app services with Docker:

```bash
cp .env.example .env
docker compose up --build
```

Tuturuuu external app login is required outside explicit local demo bypass. The
browser posts a short handoff token to `/api/auth/verify-app-token`; the server
exchanges it with `TUTURUUU_API_BASE_URL` and stores the returned access and
refresh tokens in an encrypted HttpOnly cookie. Do not expose
`CYBERSHIELD35_APP_SECRET`, `CYBERSHIELD35_SESSION_SECRET`, provider keys, or LLM
keys to the browser.

Required private auth environment:

- `TUTURUUU_API_BASE_URL`, ending in `/api/v1`
- `TUTURUUU_CYBERSHIELD35_WORKSPACE_ID`
- `CYBERSHIELD35_APP_ID`
- `CYBERSHIELD35_APP_SECRET`
- `CYBERSHIELD35_SESSION_SECRET`, at least 32 characters

For local UI-only demos without Tuturuuu server setup, set both
`DEMO_MODE=true` and `AUTH_DEMO_BYPASS=true`. Keep `AUTH_DEMO_BYPASS=false` in
private deployments.
