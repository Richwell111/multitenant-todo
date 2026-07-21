# Phase 1: Foundation — Specification

## 1. Scope

Establish the React + TypeScript foundation the later phases build on:

- Vite + React + TypeScript project setup.
- Client-side routing.
- `/` redirects to `/login`.
- Placeholder `/login` page (static, no logic).
- Placeholder `/register` page (static, no logic).
- Placeholder `/admin` page (static, no logic).
- Simple modular folder structure under `src/`.
- Test configuration (Vitest) with one smoke test.
- Working `lint`, `typecheck`, `test`, and `build` npm scripts.

## 2. Out of scope

- Real authentication or sessions.
- Database tables, Supabase, or migrations.
- Licence generation or validation.
- Company registration logic.
- Todo CRUD and dashboard counts.
- Subdomain / workspace resolution.
- Extensions and diagnostics integrations.
- Production deployment and CI.

## 3. Required routes

```text
/          → redirect to /login
/login     → placeholder Company login page
/register  → placeholder Company registration page
/admin     → placeholder Platform Admin page
```

Any unknown route redirects to `/login`.

## 4. Folder structure

Create only what Phase 1 needs; leave later modules for their phases.

```text
src/
├── modules/
│   ├── auth/            # login + register placeholder pages
│   └── platform-admin/  # admin placeholder page
├── shared/              # shared UI/util placeholders (as needed)
├── infrastructure/      # app-level setup (router) as needed
├── App.tsx              # route definitions
├── main.tsx             # app entry
└── App.test.tsx         # smoke test
```

## 5. Acceptance criteria

1. `npm run dev` starts the app without errors.
2. Visiting `/` redirects to `/login`.
3. `/login`, `/register`, and `/admin` each render their placeholder page.
4. An unknown route redirects to `/login`.
5. `npm run lint` passes with no errors.
6. `npm run typecheck` passes with no errors.
7. `npm run test` passes.
8. `npm run build` produces a production build with no errors.

## 6. Test plan

Keep tests minimal and scoped to Phase 1 routing only.

- Render the app at `/` and assert it redirects to `/login`.
- Render at `/login`, `/register`, `/admin` and assert each placeholder renders.
- Render an unknown path and assert it redirects to `/login`.

RLS and tenant-isolation tests are deferred to the database phase.

## 7. Ordered implementation tasks

1. Initialize Vite React + TypeScript project (`package.json`, `tsconfig`, `vite.config.ts`).
2. Add npm scripts: `dev`, `build`, `lint`, `typecheck`, `test`.
3. Configure ESLint (flat config) and confirm `lint` runs.
4. Add React Router and define routes in `App.tsx`.
5. Implement `/` redirect to `/login` and unknown-route fallback.
6. Create placeholder pages: `auth/LoginPage`, `auth/RegisterPage`, `platform-admin/AdminPage`.
7. Create the base folder structure (`modules/`, `shared/`, `infrastructure/`).
8. Configure Vitest + Testing Library and add the routing smoke test.
9. Run `lint`, `typecheck`, `test`, `build`; fix any failures.
10. Report actual results and stop for review.
