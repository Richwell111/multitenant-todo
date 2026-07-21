# Project Status

## Current Phase

Phase 2: Database implementation and follow-up security hardening complete,
awaiting review.

## Completed

- Phase 1 foundation implemented.
- `/` redirects to `/login`.
- `/login`, `/register`, and `/admin` placeholders created.
- Routing tests pass.
- Lint, typecheck, tests, and build pass.
- Supabase Cloud project linked.
- Phase 2 database specification approved.
- Four Phase 2 application tables created in Supabase Cloud:
  `platform_admins`, `companies`, `licences`, and `tasks`.
- Primary keys, foreign keys, CHECK constraints, unique constraints, and
  required indexes applied.
- RLS enabled and forced on all four application tables.
- Company task isolation, active-status enforcement, Company self-read,
  Platform Admin management access, and anonymous denial verified.
- Platform Admin Company updates are restricted to `companies.status` by
  both column privileges and RLS.
- Platform Admin task access is denied.
- Safe parameterized Platform Admin seed procedure added.
- Transactional Cloud isolation verification passes and rolls back all
  synthetic test data.
- Direct execution of the pre-existing `public.rls_auto_enable()` event-trigger
  function is restricted to its `postgres` owner.
- Lint, typecheck, tests, and build pass after the Cloud migration.

## Confirmed Decisions

- Supabase Cloud only.
- One shared PostgreSQL database.
- One Company account per customer.
- No Company Owner concept.
- No landing page.
- `/login` is the Company login.
- `/admin` is the Platform Admin route.
- Company workspaces use subdomains.
- Minimal Todo functionality only.
- Modular monolith.
- No microservices.
- Platform Admin must not automatically access private task content.
- Company statuses are `active` and `suspended`.
- `expires_at` uses `timestamptz`.
- Database changes use version-controlled migrations.

## Database Mapping

`companies.id = auth.users.id`

Confirmed and implemented for Version 1 to keep tenant ownership and RLS
checks direct.

## Current Task

Review the completed Phase 2 database implementation and follow-up security
hardening.

Do not begin Phase 3 until Phase 2 is accepted.

## Applied Cloud Migrations

- `20260721123640_core_tables.sql`
- `20260721123649_indexes.sql`
- `20260721123658_rls.sql`
- `20260721130528_restrict_rls_auto_enable_execute.sql`

Local and remote migration histories match for all four versions.

## Database Verification

- `supabase/tests/isolation.sql` passed against the linked Supabase Cloud
  database.
- The verification runs inside a transaction and finishes with `ROLLBACK`.
- All four tables exist.
- RLS is enabled and forced on all four tables.
- Exactly ten approved RLS policies exist.
- Required indexes exist.
- Anonymous callers have no application SELECT privileges.
- `authenticated` has no table-level UPDATE privilege on `companies`.
- `authenticated` has column-level UPDATE on `companies.status`, but not
  `companies.name`.
- Alpha and Beta see only their own tasks and Company row.
- Cross-Company task insertion is rejected.
- A Platform Admin sees all Companies and licences, can update Company
  status, cannot update Company name, and sees zero tasks.
- A suspended Company cannot select, insert, update, or delete tasks.
- The performance advisor reports no warnings.
- The pre-existing `public.rls_auto_enable()` function still exists, remains
  owned by `postgres`, and retains `search_path=pg_catalog`.
- Its `ensure_rls` event trigger remains enabled for `ddl_command_end`.
- `PUBLIC`, `anon`, `authenticated`, and `service_role` cannot execute the
  function directly; `postgres` retains EXECUTE.
- The security advisor reports no issues after the follow-up migration.

## Required Validation

Latest Phase 2 results:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed (1 file, 5 tests).
- `npm run build` — passed.

## Important Restrictions

- Do not implement future phases.
- Do not add local Supabase or Docker.
- Do not expose secrets.
- Do not store raw licence keys.
- Do not weaken RLS.
- Do not commit or push without permission.
