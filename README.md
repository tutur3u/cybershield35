# CyberShield 35

Private admin dashboard for AI For Life topic monitoring and evidence-grounded
counter-argument drafting.

## Server Setup

Run Postgres and the app services with Docker:

```bash
cp .env.example .env
docker compose up --build
```

Tuturuuu Auth is required in production. CyberShield 35 never asks operators to
type app credentials, provider keys, or LLM secrets in the browser. Admins must
configure every secret server-side, then restart or redeploy the app. The server
stores validated Tuturuuu sessions in an encrypted HttpOnly cookie.

When auth is configured but no session exists, the app shows a
`Đăng nhập bằng Tuturuuu` button. That sends the operator to Tuturuuu
centralized login and returns to `/verify-token`, where CyberShield exchanges the
short handoff token server-side through `/api/auth/verify-app-token`.

Required private auth environment:

- `TUTURUUU_API_BASE_URL`, ending in `/api/v1`
- `TUTURUUU_CYBERSHIELD35_WORKSPACE_ID`
- `CYBERSHIELD35_APP_ID`
- `CYBERSHIELD35_APP_SECRET`

Optional private auth environment:

- `CYBERSHIELD35_SESSION_SECRET`, used only when you want cookie encryption to
  rotate independently from `CYBERSHIELD35_APP_SECRET`. If unset, CyberShield
  falls back to `CYBERSHIELD35_APP_SECRET`, matching Yashie.
- `TUTURUUU_WEB_APP_URL`, defaults to `https://tuturuuu.com` and is used to build
  the centralized login URL.
- `TUTURUUU_EXTERNAL_APP_APPROVAL_URL`, defaults to
  `${TUTURUUU_WEB_APP_URL}/vi/internal/infrastructure/external-apps/approve` and
  is used only for the admin quick action when Tuturuuu rejects newly requested
  app scopes.
- `CYBERSHIELD35_PUBLIC_APP_URL`, optional public origin used when managed
  scheduler callbacks are configured. If unset, the current request origin is
  used.

CyberShield requests these code-owned external-app scopes during login:
`workspace:session`, `workspace:members:read`, `workspace:members:write`,
`workspace:roles:read`, `workspace:roles:write`, `workspace:cron:read`,
`workspace:cron:write`, `users:profile:read`, and `users:profile:write`. Do not
configure requested scopes in the browser.

Local development can set `AUTH_LOCAL_BYPASS=true` to skip the Tuturuuu session
check only when the request host is localhost/loopback and `NODE_ENV` is not
`production`. Production always requires a valid Tuturuuu session.

If the login screen reports missing or invalid configuration on Vercel:

- Open Project Settings, Environment Variables.
- Set the required private auth environment for Production and Preview.
- Set provider/runtime secrets such as `DATABASE_URL`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `APIFY_TOKEN`, `FIRECRAWL_API_KEY`,
  `BROWSER_USE_API_KEY`, and `LLM_API_KEY` or the configured LLM equivalent.
- Redeploy the latest `main` build after changing environment variables.
- Verify that `TUTURUUU_API_BASE_URL` ends in `/api/v1` and that
  `CYBERSHIELD35_APP_SECRET` is set server-side.
