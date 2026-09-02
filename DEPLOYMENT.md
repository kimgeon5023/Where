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
- `backend/`: local API implementation used by `npm run dev:api`.
- `backend-publish/`: Git submodule containing the standalone Render deployment directory. Its `render.yaml` is the Render Blueprint.
- `.env.example`: safe variable template. Copy it to `.env` for local work; never commit `.env`.
- `vercel.json`: Vercel SPA fallback routing.

## Local development

```powershell
git clone --recurse-submodules https://github.com/kimgeon5023/Where.git
cd Where
npm install
Copy-Item .env.example .env
npm run dev
```

If the repository was already cloned, fetch the Render backend files with `git submodule update --init --recursive`.

For frontend work against the deployed API, keep `VITE_API_BASE_URL` set to the Render URL above. If you also need a local API, set `DATABASE_URL` in `.env`, then run `npm run dev:api` in a second terminal.

## Deployment ownership

- Vercel: set `VITE_API_BASE_URL` for Production and Preview.
- Render: configure `DATABASE_URL`, `FRONTEND_URL` (exactly `https://where-silk.vercel.app`, without a trailing slash), `API_BASE_URL`, `AUTH_TOKEN_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, OAuth credentials, and Kakao REST keys in the Render service dashboard.

Before deploying a backend version with schema changes, run `npm run migrate` once against the production database (or configure it as the platform's explicit pre-deploy command). The API process no longer runs schema migrations at startup.

The current authentication model uses a 14-day Bearer token stored by the existing frontend. Refresh tokens are not implemented yet; a future auth migration should introduce short-lived access tokens and HttpOnly, Secure refresh cookies without accepting user IDs from request bodies.

All keys, database URLs, OAuth secrets, and `.env` files are intentionally excluded from Git. Ask the project owner for access or for values through a secure channel.
