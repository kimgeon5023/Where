# 어디갈까

## 서울 장소 검색 API

`npm run dev:api`로 API를 실행한 뒤, 다른 터미널에서 `npm run dev`로 프론트를 실행합니다. Vite 개발 서버는 `/api` 요청을 API 서버(`localhost:3001`)로 전달하며, 결과 화면의 지도와 추천 카드는 그 응답을 사용합니다.

`GET /api/places?area=연신내&category=cafe&q=로스터리&limit=20`

- `area`: 서울 동네 또는 구 (`연신내`, `불광`, `은평구` 등). 생략하면 서울 전체
- `category`: `food`, `cafe`, `tour`, `lodging`, `activity`
- `q`: 장소명·지역 키워드
- 응답 데이터: 장소명, 지역, 카테고리, 위도, 경도, 가격, 평점, 이미지 및 추천 화면용 상세 정보

개발 환경에서는 서울 기본 카탈로그와 은평권 확장 카탈로그를 사용합니다. 운영 전에는 `backend/eunpyeongPlaces.mjs`를 DB 또는 실제 장소 데이터 공급자로 교체하면 프론트 API 계약은 그대로 유지됩니다.

## PostgreSQL 회원가입

`POST /api/auth/signup`은 회원가입 정보를 `DATABASE_URL`이 가리키는 공용 PostgreSQL의 `users` 테이블에 저장합니다. 비밀번호는 평문이 아니라 salt를 적용한 Scrypt 해시로 저장됩니다. 각 가입에는 배포별 `SITE_ID`가 `source_site`로 함께 기록되며, `GET /api/auth/users`는 비밀번호를 제외한 가입 회원 목록을 반환합니다.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Cloud PostgreSQL membership database

The signup API now stores users in PostgreSQL. Copy `.env.example` to `.env` and set the managed PostgreSQL connection URL.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DATABASE_SSL=true
SITE_ID=where-main
```

Render처럼 TLS가 필요한 관리형 PostgreSQL에서는 `DATABASE_SSL=true`를 사용합니다. 로컬에서 TLS 없이 실행하는 PostgreSQL에만 `DATABASE_SSL=false`를 설정합니다.

Every deployment uses the same `DATABASE_URL` and a different `SITE_ID`:

- Main site: `SITE_ID=kimgeon5023-where`
- Friend site: `SITE_ID=tlqkfqqudtlstorl-where`
- Other sites: choose another stable identifier

This keeps all accounts in the same `users` table while `source_site` records where each signup came from. Usernames are globally unique across every connected site.

Start the API with `npm run dev:api`. PostgreSQL is the only runtime membership database.

For a cloud deployment, use `npm start`. The server uses the host-provided `PORT` value and defaults to `3001` locally.

When the frontend and API use different hosts, set `VITE_API_BASE_URL` during the frontend build. For example, a Vercel deployment can point to the Render API:

```env
VITE_API_BASE_URL=https://where-api.onrender.com
```

## Google OAuth login

The social login buttons use an authorization-code flow through the Render API. Add these environment variables to the Render web service:

```env
FRONTEND_URL=https://your-vercel-site.vercel.app
API_BASE_URL=https://your-render-api.onrender.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Register the following redirect URIs in the provider consoles, replacing the host with the deployed Render API host:

```text
https://your-render-api.onrender.com/api/auth/oauth/google/callback
```

For local OAuth testing, also register `http://localhost:3001/api/auth/oauth/google/callback`. Google requires a Web application OAuth client.
