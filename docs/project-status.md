# Project Status

## Current Phase

Phase 5 Todo implementation complete locally; manual Todo browser verification remains for review.

`/login` is a real Company login and `/admin` has a Platform Admin sign-in state.
Cloud contains one mapped Platform Admin and one mapped Company; owner-confirmed browser verification is complete.

## Completed
- Phase 1 foundation implemented.
- `/` redirects to `/login`.
- `/login` is implemented for Company and Platform Admin account detection; `/register` remains the Phase 3 registration flow.
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
- Company workspaces use subdomains in production.
- Local development uses one origin, `http://localhost:5173`, with Company
  workspaces at `/workspace/:slug`. No subdomain hosts, no `lvh.me`, no other
  local domain alias.
- Phase 4 uses Supabase's normal browser session persistence. No custom cookie
  or token storage.
- Account kind is detected by querying `platform_admins` then `companies` for
  `auth.uid()`. No role column, no custom JWT claim, no mapping table.
- Platform Admin password recovery is out of scope; out-of-band reset through
  the Supabase Dashboard is accepted for this proof of concept.
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

Complete controlled browser verification with the existing mapped Platform Admin
and Company identities. The database-column and auth-state subscription blockers
have now been fixed and covered by automated tests.

## Phase 4 Implementation
- `/login` replaced: real Company login using `signInWithPassword`.
- `/admin` shows a Platform Admin sign-in state when unauthenticated.
- Session restored on load through `AuthProvider` before protected content
  renders; Supabase's default browser persistence is used unchanged.
- Account kind resolved by querying `platform_admins` for `auth.uid()` first,
  then `companies`. No role column, JWT claim, or mapping table was added.
- An authenticated user in neither table is denied and signed out.
- Platform Admin signing in at `/login` is redirected to `/admin`.
- An active Company is redirected to `/workspace/<slug>`.
- Companies are blocked from `/admin`; Platform Admins are blocked from
  `/workspace/:slug`; a slug mismatch is blocked; suspended Companies are
  blocked from workspace access.
- Logout added to every authenticated and refusal state.
- `/workspace/:slug` renders a Phase 4 placeholder only: Company name, a
  signed-in confirmation, and a logout button. No Todo functionality.
- Successful registration now redirects to `/login` with a success message
  instead of the workspace URL.
- `buildWorkspaceUrl` returns `/workspace/<slug>` locally and
  `https://<slug>.<configured-base-domain>` in production.
- No database change was made. No custom cookie storage, no `lvh.me`, and no
  token in any URL.
- Guard tests were mutation-checked: disabling the workspace slug and Platform
  Admin checks makes five tests fail, so the guards are genuinely covered.

## Phase 4 Validation

- 
pm run lint` - passed.
- 
pm run typecheck` - passed.
- 
pm run test` - passed (10 files, 90 tests).
- 
pm run build` - passed.

Cloud structural checks now pass; live browser verification remains pending.

## Known Open Risk

With Supabase's default browser session persistence, a session created at
`todoapp.com/login` will not exist at `alpha.todoapp.com`, because they are
different origins. Local development is unaffected: it uses one origin and the
`/workspace/:slug` path. Phase 8 owns the production decision. Phase 4 must not
be treated as proving the production subdomain flow.

## Applied Cloud Migrations

- `20260721123640_core_tables.sql`
- `20260721123649_indexes.sql`
- `20260721123658_rls.sql`
- `20260721130528_restrict_rls_auto_enable_execute.sql`
- `20260721133907_company_registration_rpc.sql`

Local and remote migration histories match for all five versions.

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
- The registration RPC verification passed: owner, invoker mode, empty search path,
  function privileges, service-role table privileges, `FOR UPDATE`, guarded redemption,
  and rollback cleanup.
- The Supabase security advisor returned zero lints.
- The pre-existing `public.rls_auto_enable()` function still exists, remains
  owned by `postgres`, and retains `search_path=pg_catalog`.
- Its `ensure_rls` event trigger remains enabled for `ddl_command_end`.
- `PUBLIC`, `anon`, `authenticated`, and `service_role` cannot execute the
  function directly; `postgres` retains EXECUTE.
- The security advisor reports no issues after the follow-up migration.

## Required Validation

Latest Phase 3 results:

- 
pm run lint` - passed.
- 
pm run typecheck` - passed.
- 
pm run test` - passed (5 files, 28 tests).
- 
pm run build` - passed.

## Important Restrictions

- Do not implement future phases.
- Do not add local Supabase or Docker.
- Do not expose secrets.
- Do not store raw licence keys.
- Do not weaken RLS.
- Do not commit or push without permission.

## Phase 3 Local Implementation

- Restricted `public.complete_company_registration` RPC migration applied and verified
  in Supabase Cloud.
- `generate-licence` and `register-company` deployed successfully; Cloud metadata
  reports ACTIVE status with JWT verification true/false as specified.
- Browser Supabase client, licensing/registration services, workspace URL helper,
  and simple `/admin` and `/register` forms implemented.
- Unit/handler tests and `supabase/tests/registration.sql` verification added.
- Local validation: lint, typecheck, test (14 tests), and build passed.

## Phase 3 Slug Auto-Fill Correction

Approved UX correction applied to `/register` after Phase 3 browser testing.

- Workspace Slug now auto-fills from Company Name using the existing
  `suggestWorkspaceSlug` helper; no new normalization logic was added.
- The suggestion is lowercase ASCII, replaces spaces and punctuation with single
  hyphens, and removes leading and trailing hyphens.
- The slug field remains editable; it is never disabled or read-only.
- Manual editing of the slug stops further automatic replacement.
- Clearing the slug field resumes suggestions, so the required field cannot be
  left permanently blank.
- Server-side slug validation remains authoritative. The suggestion is fed
  through the same `validateWorkspaceSlug` rules, including reserved-slug
  rejection; no client value bypasses the Edge Function.
- Tests added: `src/modules/auth/registrationSchemas.test.ts` and
  `src/modules/auth/RegisterPage.test.tsx`.
- Validation after the correction: 
pm run lint` passed, 
pm run typecheck`
  passed, 
pm run test` passed (5 files, 28 tests), 
pm run build` passed.

## Phase 3 Registration/Auth Redirect Correction

- Root cause: `/register` rendered the form while an existing Platform Admin
  session remained active. After registration, `/login` correctly restored that
  session and redirected it to `/admin`.
- `/register` now blocks authenticated Platform Admins and Companies until they
  explicitly log out. It never silently signs out an authenticated user.
- Unauthenticated registration still creates the Auth user, Company row, and
  licence redemption server-side, creates no browser session, and navigates to
  `/login` with the safe sign-in success message.
- Workspace slug auto-fill remains editable and stops replacing a manual value.
- Automated validation: lint, typecheck, test (8 files, 83 tests), and build
  passed.
- Manual browser verification: not run in this correction.
- Cloud database record verification: not run because no real registration was
  performed.
- Remaining issue: Phase 4 browser verification still requires a seeded or
  confirmed Platform Admin identity and two browser contexts.
## Phase 4 Final Verification Audit

Result: **PHASE 4 COMPLETE**

### Acceptance criteria

1. Company valid-credential login to `/workspace/<slug>`: **repository fix implemented**.
   The auth repository now selects `companies.slug` and maps it to the UI
   `workspaceSlug` field; automated regression coverage passes. Live Cloud login
   owner-confirmed manual browser verification passed.
2. Platform Admin login at `/admin` and end-to-end licence generation: **automated
   flow passed; owner-confirmed manual browser flow passed**.
3. Platform Admin at `/login` redirects to `/admin`: **local automated test passed;
   owner-confirmed manual browser flow passed**.
4. Company at `/admin` receives `ADMIN_ONLY`: **local automated test passed**.
5. Platform Admin at `/workspace/:slug` receives `WORKSPACE_FORBIDDEN`: **local
   automated test passed**.
6. Company Alpha cannot open Beta's workspace: **owner-confirmed manual browser
   verification passed**.
7. Suspended Company authenticates but is blocked: **local automated test passed;
   owner-confirmed Cloud verification passed**.
8. Reload restoration and logout: **owner-confirmed manual browser verification passed**.
   The `onAuthStateChange` subscription handles signed-in, signed-out, token-refresh,
   and session changes with cleanup and race protection.
9. No token in URLs and safe non-enumerating credential errors: **source review and
   automated tests passed**.
10. `buildWorkspaceUrl` local-path and production-subdomain behavior: **tests
    passed**.
11. Phase 1 routing, Phase 3 registration/slug behavior, and Phase 2 isolation:
    **automated tests and the previously approved Cloud isolation verification
    passed**.

### Automated results

- 
pm run lint` - passed.
- 
pm run typecheck` - passed.
- 
pm run test` - passed: 10 files, 90 tests (including Edge Function tests).
- 
pm run build` - passed.

### Manual browser results

Completed manually by the project owner:

- Platform Admin login at `/admin`, refresh persistence, workspace-route block, and logout.
- Company login, correct workspace redirect, refresh persistence, `/admin` block,
  cross-slug workspace block, and logout.
- Suspended Company workspace denial.
- Registration redirect exactly to `/login` with no automatic browser session.
### Cloud verification results

Read-only verification used the configured linked Supabase project without
printing secrets or account values:

- Platform Admin rows: 1; Company rows: 1; Auth users: 2.
- Every `platform_admins.id` matches an Auth user: passed.
- Every `companies.id` matches an Auth user: passed.
- Redeemed licences with redemption metadata: 1.
- Every redeemed licence links to an existing Company: passed.
- Duplicate Company emails: 0; duplicate workspace slugs: 0.
- Orphan Auth users: 0.
- Edge Function source logging review found only request IDs and Auth user IDs;
  passwords, raw licence keys, hashes, and service-role secrets are not logged.
  Historical Cloud log inspection was not available through the pinned CLI.

### Defects found and fixed

- Fixed the Phase 3 redirect defect: authenticated users now receive an explicit
  `/register` block and must choose logout before registering; unauthenticated
  success navigates exactly to `/login` with the safe message and does not mutate
  the browser session.
- Fixed the Phase 4 database-column defect: `authRepository.findCompany` now
  selects `companies.slug` and maps it to `workspaceSlug`.
- Added the race-safe `AuthProvider` Supabase auth-state subscription, including
  signed-in, signed-out, token-refresh, session-change, cleanup, and focused tests.

### Remaining notes

- Fresh Edge Function log retrieval was unavailable through the pinned CLI; source
  review confirmed no sensitive logging.
- Production cross-subdomain session handling remains a Phase 8 concern.

Phase 5 implementation is complete locally; do not start Phase 6 until review.

## Phase 4 Completion Confirmation

**PHASE 4 COMPLETE**

The project owner completed the manual Supabase Cloud/browser verification for
Platform Admin login, refresh persistence, workspace protection, Company login,
workspace routing, cross-Company blocking, suspended access, logout, and
registration hand-off. Structural Cloud checks and automated validation passed.
Fresh Edge Function logs were not retrievable through the pinned CLI; source
review confirmed that passwords, raw licence keys, hashes, tokens, and secrets
are not logged.

## Phase 5 Todo Implementation

Result: PHASE 5 CODE COMPLETE

- The protected active-Company workspace now renders a basic Todo dashboard.
- Dashboard counts are derived from the authenticated Company task list: total, pending, and completed.
- Companies can create, list, edit, complete, reopen, and delete their own tasks.
- Create and edit forms trim values and enforce title (1-120 characters) and description (optional, maximum 1000 characters) validation.
- Loading, empty, retryable error, validation, pending-action, and success states are shown without exposing database errors.
- The component uses the task service only; Supabase access remains in the task repository.
- company_id is always derived from the current authenticated session in the repository. No URL or form value can select a tenant.
- Existing Cloud tasks schema and RLS policies were reused without a migration. RLS still requires auth.uid() = company_id, an active Company, and excludes Platform Admins for every task operation.
- Platform Admin routes continue to receive no task rows because the existing policies provide no task access.
- Removed the native task-list bullet marker with a scoped list reset in src/index.css.

### Phase 5 Files

- src/modules/tasks/taskSchemas.ts
- src/modules/tasks/taskRepository.ts
- src/modules/tasks/taskService.ts
- src/modules/tasks/taskSchemas.test.ts
- src/modules/tasks/taskRepository.test.ts
- src/modules/tasks/taskService.test.ts
- src/modules/companies/WorkspacePage.tsx
- src/modules/companies/WorkspacePage.test.tsx
- supabase/tests/isolation.sql (fixture assertion correction only)

### Phase 5 Validation

- npm run lint -- passed.
- npm run typecheck -- passed.
- npm run test -- passed (14 files, 103 tests).
- npm run build -- passed.
- No migration was created and no Cloud schema was changed. The transactional supabase/tests/isolation.sql verification passed against Supabase Cloud; its Platform Admin assertions target synthetic IDs so existing Cloud Companies do not affect the check, and all synthetic data rolled back.
- Manual browser verification of Todo interactions remains the next review step.









