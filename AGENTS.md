# Multi-Tenant Todo SaaS Agent Instructions

## Read First

Before planning or editing, read:

1. `docs/PRD.md`
2. `docs/project-status.md`
3. the relevant file under `specs/`
4. `CLAUDE.md` for additional project rules

## Project Goal

Build a small proof-of-concept multi-tenant Todo SaaS.

Keep the implementation simple.

The purpose is to prove:

- licence-based Company registration;
- Company-isolated task data;
- one shared deployment;
- Company subdomains;
- basic Platform Admin management;
- reusable and private extension concepts;
- basic diagnostics.

## Current Backend Direction

Use Supabase Cloud only.

Do not add:

- local Supabase;
- Docker;
- self-hosting;
- offline mode;
- cloud/local synchronization.

## Product Rules

- `/` redirects to `/login`.
- `/login` is Company login.
- `/register` is licence-based registration.
- `/admin` is the Platform Admin area.
- `/workspace/:slug` is the Company workspace during local development.
- There is no landing page.
- There is no Company Owner concept.
- There is one account per Company in Version 1.
- Company workspaces use subdomains in production, for example
  `alpha.todoapp.com`.
- Local development uses one origin: `http://localhost:5173`. Do not use
  `alpha.localhost`, `lvh.me`, or any other local domain alias.
- One codebase and one deployment serve all Companies.

## Architecture

Use a simple modular monolith.

Dependency direction:

Routes/components
→ services
→ repositories
→ Supabase

Do not access Supabase directly from presentation components.

Do not create unnecessary abstractions.

## Security

- Every Company-owned row must include `company_id`.
- Enforce isolation using PostgreSQL RLS.
- Do not trust the subdomain alone.
- Never expose service-role credentials to the frontend.
- Never commit secrets.
- Never store raw licence keys.
- Platform Admin must not automatically access private task content.

## Development Process

Work one phase at a time.

For each phase:

1. Read the approved specification.
2. Confirm scope.
3. List files to be changed.
4. Implement only that scope.
5. Add relevant tests.
6. Run validation.
7. Report results.
8. Stop for review.

Do not implement future phases early.

## Current Phase

Phase 4: Authentication specification review.

Phases 1 to 3 are implemented. `/login` is still the Phase 1 placeholder and
does not sign anyone in; real authentication is Phase 4.

Do not write authentication code until `specs/004-authentication/spec.md` is
approved.

## Git

- Do not commit directly to `master`.
- Work on the current phase branch.
- Do not create branches per Company.
- Do not commit or push unless explicitly instructed.
