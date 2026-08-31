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
- Render: configure `DATABASE_URL`, `FRONTEND_URL`, `API_BASE_URL`, OAuth credentials, and Kakao REST keys in the Render service dashboard.

All keys, database URLs, OAuth secrets, and `.env` files are intentionally excluded from Git. Ask the project owner for access or for values through a secure channel.
