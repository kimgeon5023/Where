# Where: frontend and API connection

## Live services

- Frontend (Vercel): https://where-silk.vercel.app
- API (Render): https://where-api-kimgeon5023.onrender.com
- API health check: https://where-api-kimgeon5023.onrender.com/api/health

The Vercel production and preview environments use this public build variable:

```env
VITE_API_BASE_URL=https://where-api-kimgeon5023.onrender.com
```

The frontend builds request API routes as `${VITE_API_BASE_URL}/api/...`. Do not add a trailing slash to the value.

## Repository layout

- `src/`: React + Vite frontend.
- `src/`: React + Vite frontend source.
- Backend source: [Where-Backend](https://github.com/kimgeon5023/Where-Backend) is the only API source repository and the source connected to Render.
- `.env.example`: safe variable template. Copy it to `.env` for local work; never commit `.env`.
- `vercel.json`: Vercel SPA fallback routing.

## Local development

```powershell
git clone https://github.com/kimgeon5023/Where.git
cd Where
npm install
Copy-Item .env.example .env
npm run dev
```

For frontend work against the deployed API, keep `VITE_API_BASE_URL` set to the Render URL above. For local API work, clone `Where-Backend` beside this repository, configure its `.env`, and run `npm run dev` there.

## Deployment ownership

- Vercel deploys only from `Where/main`; its Production Branch is `main`.
- Render deploys only from `Where-Backend/main`; automatic deploy is enabled.
- Both repositories require a pull request, one approval, passing checks, and a merge into `main`. Do not deploy from feature branches or `master`.
- Render: configure `DATABASE_URL`, `FRONTEND_URL` (exactly `https://where-silk.vercel.app`, without a trailing slash), `API_BASE_URL`, `AUTH_TOKEN_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, OAuth credentials, and Kakao REST keys in the Render service dashboard.

Before deploying a backend version with schema changes, run `npm run migrate` once against the production database (or configure it as the platform's explicit pre-deploy command). The API process no longer runs schema migrations at startup.

The current authentication model uses a 14-day Bearer token stored by the existing frontend. Refresh tokens are not implemented yet; a future auth migration should introduce short-lived access tokens and HttpOnly, Secure refresh cookies without accepting user IDs from request bodies.

All keys, database URLs, OAuth secrets, and `.env` files are intentionally excluded from Git. Ask the project owner for access or for values through a secure channel.
