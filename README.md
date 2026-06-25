# CyberShield 35

Private admin dashboard for AI For Life topic monitoring and evidence-grounded
counter-argument drafting.

## Server Setup

Run Postgres and the app services with Docker:

```bash
cp .env.example .env
docker compose up --build
```

Tuturuuu external app login is required. The browser posts a short handoff token
to `/api/auth/verify-app-token`; the server exchanges it with
`TUTURUUU_API_BASE_URL` and stores the returned access and refresh tokens in an
encrypted HttpOnly cookie. Do not expose
`CYBERSHIELD35_APP_SECRET`, `CYBERSHIELD35_SESSION_SECRET`, provider keys, or LLM
keys to the browser.

Required private auth environment:

- `TUTURUUU_API_BASE_URL`, ending in `/api/v1`
- `TUTURUUU_CYBERSHIELD35_WORKSPACE_ID`
- `CYBERSHIELD35_APP_ID`
- `CYBERSHIELD35_APP_SECRET`
- `CYBERSHIELD35_SESSION_SECRET`, at least 32 characters

Local development can set `AUTH_LOCAL_BYPASS=true` to skip the Tuturuuu token
handoff only when the request host is localhost/loopback and `NODE_ENV` is not
`production`. Production always requires a valid Tuturuuu session.
