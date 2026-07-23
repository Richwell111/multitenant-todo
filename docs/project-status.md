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

Phase 5 implementation is complete locally; Phase 6 Platform Admin implementation is now complete pending manual review.

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
- npm run test -- passed (15 files, 106 tests).
- npm run build -- passed.
- No migration was created and no Cloud schema was changed. The transactional supabase/tests/isolation.sql verification passed against Supabase Cloud; its Platform Admin assertions target synthetic IDs so existing Cloud Companies do not affect the check, and all synthetic data rolled back.
- Manual browser verification of Todo interactions remains the next review step.

## Specification Tree Audit

- Canonical specifications present: 001-foundation, 002-database,
  003-licensing-registration, 004-authentication, 005-todo, 006-platform-admin, and 007-extension-test.
- Requested future canonical folder 008-deployment
  are not yet present; no placeholder specifications were
  invented.
- The twelve empty noncanonical folders were moved, without deletion, to
  specs/_archive. The archive is historical and non-authoritative.
- Company registration is specified across the Phase 3 licensing/registration
  contract and the Phase 4 authentication handoff. The final handoff is
  /login with a success message and no automatic browser session.
- Registration implementation and focused tests cover key generation/hashing,
  validation, RPC atomic redemption, Auth-user compensation/reconciliation,
  safe errors, redirect handoff, and account/session guards.

## Phase 6 Platform Admin Implementation

Result: PHASE 6 COMPLETE

- `/admin` provides protected Platform Admin counts, Company/licence listings,
  active/suspended status controls, and existing licence generation.
- Status updates send only `{ status }`; no task data is requested.
- No Phase 6 migration or Cloud schema/RLS change was required.

### Phase 6 files

- `src/modules/platform-admin/AdminPage.tsx`
- `src/modules/platform-admin/platformAdminRepository.ts`
- `src/modules/platform-admin/platformAdminService.ts`
- `src/modules/platform-admin/platformAdminService.test.ts`
- `specs/006-platform-admin/spec.md`

### Phase 6 validation

- `npm run lint` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- `npm run typecheck` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- `npm run test` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed: 15 files, 106 tests.
- `npm run build` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- Manual browser verification was completed by the project owner and passed.

## Phase 7 Extension Test Implementation

Result: PHASE 7 COMPLETE

### Implemented scope

- Added `extensions` and `company_extensions` with fixed idempotent proof seeds.
- Added forced RLS and least-privilege grants for Company visibility and
  Platform Admin assignment management.
- Assignment changes use an upsert on `(company_id, extension_id)` and update
  only `enabled`.
- Added Company and Platform Admin extension repositories/services and UI.
- Task Notes Summary uses the existing authenticated Company task boundary.
- Priority Labels Demo is read-only and does not alter `tasks`.

### Phase 7 files

- `supabase/migrations/20260721150000_extensions.sql`
- `supabase/migrations/20260721151000_fix_extension_assignment_rls.sql`
- `supabase/tests/extensions.sql`
- `src/modules/extensions/`
- `src/modules/platform-admin/platformAdminExtensionRepository.ts`
- `src/modules/platform-admin/platformAdminExtensionService.ts`
- `src/modules/platform-admin/PlatformAdminExtensions.tsx`
- `src/modules/companies/WorkspacePage.tsx`
- `src/modules/platform-admin/AdminPage.tsx`

### Validation

- `npm run lint` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- `npm run typecheck` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- `npm run test` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed: 19 files, 114 tests.
- `npm run build` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â passed.
- Linked Cloud migration history is in parity through
  `20260721151000_fix_extension_assignment_rls.sql` for project
  `vckpgejyisetnggooxlf`.
- `supabase/tests/extensions.sql` passed transactionally; all synthetic data
  rolled back.
- `supabase/tests/isolation.sql` passed after the extension migrations.
- Cloud table existence, fixed seed IDs, assignment primary key, and RLS checks
  passed.
- Security Advisor reported only the pre-existing
  `auth_leaked_password_protection` warning; no extension-related warning was
  reported.

### Defects found and fixed

- The initial assignment INSERT/UPDATE policies caused infinite RLS recursion by
  cross-referencing `extensions` from a policy that was itself reached through
  `extensions`. The follow-up migration restricts writes directly to the
  approved fixed private-extension UUID and removes the recursion.

### Manual browser verification

Completed by the project owner and passed:

- Active Companies see the shared Task Notes Summary with current-Company-only counts.
- Unassigned Companies do not see Priority Labels Demo; assigned Companies see it after refresh.
- Company-to-Company private assignment isolation passed.
- Platform Admin enable/disable, no-task-content access, and confirmation flows passed.
- Suspended Companies receive no extension access.
- Disabling the private assignment removes it while the shared extension remains.
- Todo behavior and schema remain unchanged; no priority field was introduced.

Phase 7 is complete. No commit or push was performed.
## UI Polish Pass (before Phase 8)

Result: UI POLISH COMPLETE; Phase 8 diagnostics/deployment work has not started.

### UI files changed

- `src/index.css`
- `src/modules/auth/LoginPage.tsx`
- `src/modules/auth/RegisterPage.tsx`
- `src/modules/companies/WorkspacePage.tsx`
- `src/modules/extensions/ExtensionsSection.tsx`
- `src/modules/platform-admin/AdminPage.tsx`
- `src/modules/platform-admin/PlatformAdminExtensions.tsx`

### Pages and components polished

- Company login and registration now use centered responsive cards, clearer supporting text, consistent fields, validation/error treatments, and visible focus states.
- Platform Admin sign-in, overview, Company/licence tables, licence generation, one-time key result, and extension assignment controls now share the same cards, buttons, status badges, table overflow, and feedback states.
- Company workspace dashboard, task form/list/edit actions, loading/error/empty/success states, and extension panels now have consistent spacing and readable status treatment.
- No new UI framework or large design-system abstraction was introduced; the existing page components and CSS are reused.

### Responsive and accessibility review

- Global layout is constrained with safe page padding and a readable content width.
- Summary and extension cards collapse to one column below 700px; action groups wrap below 430px.
- Tables use horizontal overflow containers for narrow screens.
- Inputs retain explicit labels and validation relationships.
- Buttons retain semantic elements, clear names, disabled states, keyboard focus outlines, and distinct destructive styling.
- Statuses retain visible text labels and are not communicated by color alone.
- Static CSS/layout review covered approximately 375px, 768px, and 1280px widths. A live browser visual pass remains a review item.

### Validation

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test` - passed: 19 files, 114 tests.
- `npm run build` - passed.

No Supabase queries, RLS policies, migrations, authentication behavior, routes, data flows, or Phase 8 diagnostics code were changed. No commit or push was performed.

## Phase 8 PostHog Diagnostics Adapter

Status: PostHog usage adapter implemented (Phase 8 diagnostics integration)

### Package

- Installed `posthog-js@1.406.2`.
- `.env` remains ignored by Git; `git check-ignore -v .env` confirms
  `.gitignore:14:.env`.

### Files added

- `src/modules/diagnostics/diagnosticsTypes.ts`
- `src/modules/diagnostics/posthogAdapter.ts`
- `src/modules/diagnostics/diagnosticsService.ts`
- `src/modules/diagnostics/diagnostics.test.ts`
- `src/modules/diagnostics/posthogAdapter.test.ts`

### Files updated

- `src/main.tsx`
- `src/modules/auth/authService.ts`
- `src/modules/auth/registrationService.ts`
- `src/modules/companies/WorkspacePage.tsx`
- `src/modules/tasks/taskService.ts`
- `src/modules/licensing/licenceService.ts`
- `src/modules/platform-admin/AdminPage.tsx`
- `src/modules/platform-admin/platformAdminService.ts`
- `src/modules/platform-admin/platformAdminExtensionService.ts`
- `src/modules/extensions/extensionService.ts`
- `.env.example`
- `package.json`
- `package-lock.json`

### Architecture and integrated events

Application modules call the provider-neutral diagnostics service; only the PostHog
adapter imports `posthog-js`. Initialization occurs in `src/main.tsx` and is
disabled in tests, when diagnostics are disabled, or when key/host configuration
is missing.

Integrated events cover authentication, registration/licensing, Todo creation,
editing, completion/reopening/deletion, workspace view, Admin dashboard/status/
licence actions, extension visibility/load failures, and private assignment
enable/disable/action failures. Extension-open telemetry is emitted when the supported extension panel is opened.

### Privacy controls

- Explicit typed events only.
- Autocapture, pageview, page-leave capture, and session recording disabled.
- Identity is namespaced as `company:<auth-user-uuid>` or
  `platform-admin:<auth-user-uuid>`.
- Identification includes only account kind, release version, and environment.
- Runtime property allowlist strips unknown keys and sensitive values, including
  passwords, email, task content, licence values/hashes, tokens, headers, raw
  errors, and request/response bodies.
- Provider initialization, identity, reset, and capture failures are swallowed
  and cannot affect application actions.
- Logout resets the provider identity.

### Validation

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test` - passed: 21 files, 119 tests.
- `npm run build` - passed.

### Remaining setup

The approved browser variables are `VITE_POSTHOG_KEY`,
`VITE_POSTHOG_HOST`, `VITE_DIAGNOSTICS_ENABLED`,
`VITE_APP_VERSION`, and `VITE_APP_ENVIRONMENT`. The ignored local `.env` uses the approved variable names. Its values were not read or printed.

No PostHog setup wizard was used, no server secret was
added, and no migrations or Cloud changes were made.

Durable diagnostics tables, the Platform Admin diagnostics dashboard, and Phase 9
deployment work remain outside this adapter pass. No commit or
push was performed.

## Phase 8 Sentry Diagnostics Adapter

Status: Sentry adapter implemented; dashboard/provider deployment review remains.

### Package and files

- Installed `@sentry/react@10.67.0` and updated `package.json`/`package-lock.json`.
- Added `src/modules/diagnostics/sentryAdapter.ts` and
  `src/modules/diagnostics/sentryAdapter.test.ts`.
- Updated `src/modules/diagnostics/diagnosticsTypes.ts`,
  `src/modules/diagnostics/diagnosticsService.ts`, and `.env.example`.

### Configuration and architecture

- Sentry is initialized only when `VITE_DIAGNOSTICS_ENABLED=true`,
  `VITE_SENTRY_DSN` is present, and runtime is not test mode.
- The diagnostics service fans out to Sentry and PostHog adapters; application
  modules do not import either provider SDK.
- Release and environment metadata use `VITE_APP_VERSION` and
  `VITE_APP_ENVIRONMENT`.
- Browser tracing is sampled at 0.1. Session replay is disabled by default and
  error replay is sampled at 1. Replay masks all text and inputs and blocks media.
- Trace propagation is limited to `localhost` and the origin derived from the
  configured Supabase URL.
- Sentry logs and metrics integrations are not enabled; `sendDefaultPii` is false.

### Privacy and failure handling

- `beforeSend` and `beforeSendTransaction` remove request data, headers,
  cookies, bodies, URLs/query data, credentials, task/licence values, raw error
  messages, and forbidden nested keys.
- User identity is limited to `company:<auth-user-uuid>` or
  `platform-admin:<auth-user-uuid>`; email, username, and IP fields are removed.
- Only allowlisted tags and scalar diagnostic metadata are attached.
- Safe diagnostic failures use an internal error code and never forward the
  original application error text. Provider failures are swallowed.
- Logout resets Sentry identity through the provider-neutral service.

### Validation

- Focused Sentry/diagnostics tests pass: 2 files, 9 tests
- Final validation passes: lint, typecheck, 22 test files / 125 tests, and build.
- Build reports the existing non-blocking large-chunk warning (approximately 994 kB).

### Remaining setup

The local ignored `.env` must provide `VITE_SENTRY_DSN` alongside the existing
safe diagnostics switches. Values are not read, printed, or committed. Sentry
Dashboard project settings (retention, alerting, and source-map policy) remain
manual review steps; no Sentry setup wizard or `@sentry/vite-plugin` was used.
No commit or push was performed.

## Phase 8 Durable Diagnostics and Usage Monitoring

Status: PHASE 8 CODE COMPLETE - Cloud migration and manual verification pending.

### Environment safety

- Local `.env` contains the approved variable name `VITE_POSTHOG_KEY` and does
  not contain `VITE_POSTHOG_PROJECT_TOKEN`; values were not read or printed.
- `.env` remains ignored and untracked.

### Database migration and security boundary

- Added `supabase/migrations/20260722070351_phase8_diagnostics.sql`.
- Added `supabase/tests/diagnostics.sql`.
- Migration creates only `extension_assignment_events`, `feature_requests`, and
  `release_records`; no generic `operational_events` table was added.
- All three tables have forced RLS, Platform Admin read policies, no anonymous
  access, and no browser insert/update/delete grants.
- `set_private_extension_assignment` is a restricted `SECURITY DEFINER` RPC
  with a fixed `search_path`, Platform Admin membership check, private-feature
  restriction, controlled disablement reasons, and atomic assignment/history
  writes.
- Direct authenticated assignment INSERT/UPDATE privileges and policies are
  removed; browser assignment changes use the RPC only.

### Assignment lifecycle

- Enabling requires no reason.
- Disabling requires one of the controlled reasons from the approved
  specification.
- Repeated state writes are idempotent and do not create duplicate history.
- Lifecycle rows record Company, feature, state, timestamp, reason, and actor.

### Admin diagnostics

- Added `/admin/diagnostics` with Platform Admin-only access.
- Displays app version, environment, Sentry/PostHog configured state, enabled
  assignments by feature, recent lifecycle events, disablement reasons,
  read-only feature requests, and release records.
- Empty, loading, retry, and provider-unavailable states are explicit.
- The page does not query or render tasks, licence contents, credentials, raw
  errors, or provider analytics.
- Added Core Features, Shared Features, and Private Customizations terminology
  to the Admin feature section while preserving existing assignment controls.
- Added duplicate-safe `admin.features_viewed` and
  `admin.diagnostics_viewed` events.

### Validation

- Focused diagnostics/feature-management tests: 6 files, 12 tests � passed.
- `npm run lint` � passed.
- `npm run typecheck` � passed.
- `npm run test` — passed: 28 files, 136 tests.
- `npm run build` — passed with the existing large-chunk warning (approximately 1,007 kB).

### Cloud and manual blockers

- Cloud migration has not been applied.
- SQL/RLS verification has not run against Cloud.
- Local `supabase db lint --local --schema public --fail-on error` could not
  connect because no local Postgres instance is running. Docker/local Supabase
  remains intentionally disabled by project rules.
- Cloud migration review, Security Advisor, lifecycle/RLS verification, and
  browser checks remain required before Phase 8 can be operationally complete.
- No commit or push was performed.

## Phase 8 Feature Management and Customization Requests

Status: feature-management code implemented; Cloud migration and manual verification remain pending.

- Core Features now come from the typed static application registry in
  `src/modules/platform-admin/coreFeatureRegistry.ts`; they are active,
  read-only, and have no assignment controls.
- Shared Features and Private Customizations continue to use the existing
  `extensions` and `company_extensions` tables and preserve private assignment
  confirmation, pending, retry, and safe-error behavior.
- Added Platform Admin-only `/admin/customization-requests` with read-only
  lifecycle display and loading, empty, populated, error, and retry states.
- Company availability is derived from the extension definition and current
  assignment state; no duplicate availability column was added.
- The Phase 8 diagnostics migration now bounds `requested_outcome` to 500
  characters and uses `shared_feature` and `private_customization` enum values.
- Added repository, service, UI, registry, and routing tests. Requested outcome
  is rendered only in the Admin UI and is never sent to diagnostics telemetry.
- Updated navigation includes Overview, Companies and licences, Features,
  Customization Requests, and Diagnostics.

Cloud migration, SQL/RLS verification, Security Advisor review, and manual
browser verification remain pending. No commit or push was performed.
## Phase 8 UI Alignment and Layout Polish

Status: UI polish implemented; browser review and unrestricted runtime validation remain pending.

### Pages polished

- Company Login and Registration use the shared page shell and responsive card layout.
- Company Workspace uses the shared shell/header with improved spacing, task-action grouping,
  summary cards, and contained task tables/lists.
- Platform Admin Overview, Features, Diagnostics, and Customization Requests use consistent
  centered content, headers, section cards, navigation, and table containers.
- Customization Requests use a readable desktop table and mobile request cards with all
  lifecycle fields and complete availability labels.

### Reusable UI and accessibility

- Added `src/shared/ui.tsx` primitives for page shells, headers, cards, badges, and states.
- Added active-state Admin navigation for Overview, Companies, Licences, Features,
  Customization Requests, and Diagnostics.
- Added semantic table captions, responsive card field labels, visible focus states,
  accessible loading/error/status feedback, and status text in addition to color.
- Added contained horizontal scrolling for wide desktop tables and page-level overflow
  protection.

### Responsive review

- CSS breakpoints cover approximately 375px, 768px, 1280px, and 1440px layouts.
- Mobile Customization Requests switch from a wide table to labeled cards.
- Forms, buttons, navigation, summary grids, and task actions stack within narrow widths.
- Manual browser verification at each target width remains pending.

### Validation

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — blocked in the sandbox by Vite `spawn EPERM` during config loading.
- `npm run build` — blocked in the sandbox by Vite `spawn EPERM` during config loading.
- Previous unrestricted Phase 8 validation passed with 28 files and 136 tests; this polish
  pass requires a fresh unrestricted test/build run.
- No business logic, auth behavior, telemetry meanings, RLS, or migrations were changed.

Remaining Phase 8 work: migration review/application, Cloud SQL/RLS verification, Security
Advisor review, manual browser verification, and unrestricted test/build validation. No
commit or push was performed.

## Phase 8 Admin Navigation and Feature UI

Status: ADMIN NAVIGATION AND FEATURE UI COMPLETE (code); manual browser verification and the
prior Phase 8 Cloud/migration blockers remain.

### Root cause of the broken Features navigation

The Admin navigation linked to in-page hash anchors (`/admin#overview`, `/admin#companies`,
`/admin#licences`, `/admin#features`) that all resolved to the single `/admin` route. `AdminPage`
rendered one monolithic dashboard with every section stacked at once; nothing rendered or scrolled
based on the hash, and React Router does not switch pages on a hash change. The hash was consumed
only to compute the active-link highlight, so clicking Features changed the URL to `/admin#features`
while the same full page continued rendering from the top (Overview). Cause: route configuration
(hash anchors used instead of real routes) plus no hash-driven rendering. Customization Requests and
Diagnostics were already real routes and worked.

### Routing changes

- Replaced hash navigation with real nested routes under one shared layout: `/admin` (Overview),
  `/admin/companies`, `/admin/licences`, `/admin/features`, `/admin/customization-requests`,
  `/admin/diagnostics`.
- Direct navigation, refresh, and Back/Forward now load the correct page; the active item is marked
  with `aria-current="page"` via `NavLink`.

### Admin layout and files

- `AdminLayout.tsx` (new): the single protected shell and the only Admin auth guard. Renders the
  session-check state, the shared Admin login for unauthenticated visitors, the `ADMIN_ONLY` refusal
  for Company accounts, and the sidebar shell with `<Outlet>` for authenticated Platform Admins.
- `adminContext.ts` (new): `useAdminOutlet` supplies the account/signOut to pages; no page duplicates
  the guard.
- `AdminNavigation.tsx` (rewritten): vertical sidebar of real-route `NavLink`s with inline icons.
- `AdminLoginForm.tsx` (new, extracted from the old `AdminPage`).
- Pages separated from the old monolith: `AdminOverviewPage.tsx`, `AdminCompaniesPage.tsx`,
  `AdminLicencesPage.tsx`, `AdminFeaturesPage.tsx`. `AdminDiagnosticsPage.tsx` and
  `AdminCustomizationRequestsPage.tsx` were reduced to content wrappers inside the layout.
- `AdminPage.tsx` removed. `App.tsx` updated to the nested route tree.
- `src/index.css`: added the Admin application shell (fixed desktop sidebar, mobile top bar with an
  accessible menu button, off-canvas drawer, scrim). `src/modules/diagnostics/diagnosticsTypes.ts`:
  added `admin.overview_viewed`, `admin.companies_viewed`, `admin.licences_viewed`.

### Standard Features table

- `/admin/features` section A lists the static Core Feature registry read-only (Feature, Description,
  Category, Availability = "All active Companies", a "Standard" status badge, Companies covered).
- No enable/disable and no per-Company assignment controls.

### Customizations & Extensions table

- `/admin/features` section B (refactored `PlatformAdminExtensions`) uses business terminology:
  "Customizations & Extensions" and "Company Access". User-facing feature types are "Shared Extension"
  and "Private Customization". Per-Company availability shows Enabled / Disabled / "Available — Not
  Enabled".
- Existing assignment authorization is preserved: only the deployed private proof extension is
  assignable, disabling still requires an approved controlled reason, and lifecycle history is written
  through the existing `set_private_extension_assignment` RPC. No task content is rendered.

### Preserved behavior

- No change to `platformAdminService`/repository (counts, `changeCompanyStatus`, `generateLicence`),
  the extension/customization/diagnostics services and repositories, `coreFeatureRegistry`,
  `evaluateAdminAccess`, `AuthProvider`, Supabase queries, RLS, tenant isolation, licence generation,
  or Company suspension. Overview reuses the existing count calculations unchanged.

### Responsive and accessibility review

- CSS reviewed at ~375px, 768px, 1280px, and 1440px. Desktop uses a fixed sidebar; below 900px it
  collapses to an accessible menu-button drawer with a scrim, and wide tables switch to mobile cards.
- Semantic `nav`/`main`/tables, `aria-current` active state, `aria-expanded`/`aria-controls` on the
  menu button, visible focus states, labelled inputs, real `button`/`a` elements, and status text
  (not colour alone) throughout. A safe search box was intentionally omitted because it would not yet
  perform a real local filter.

### Validation

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed: 32 files, 153 tests.
- `npm run build` — passed (existing ~1,025 kB large-chunk warning only).
- `git diff --check` — clean (informational LF/CRLF notices only).

### Remaining Phase 8 work

- Cloud SQL/RLS verification (`supabase/tests/diagnostics.sql` and `isolation.sql`) against the linked
  Cloud database, and Security Advisor review for new Phase 8 findings.
- No commit or push was performed; Phase 9 was not started.

## Phase 8 Final Verification

Status: PHASE 8 INCOMPLETE — only the owner-run Security Advisor review remains. Cloud SQL/RLS
verification passed against Cloud after fixing one verified RPC defect; all other verification is
complete.

### Cloud migration status (verified)

- `npx supabase migration list` — all eight local migrations have matching remote entries, including
  the Phase 8 diagnostics migration `20260722070351_phase8_diagnostics`.
- `npx supabase db push --dry-run` — "Remote database is up to date."
- Conclusion: the Phase 8 Cloud migration is applied. Cloud migration application is removed from the
  remaining blockers. (Supersedes the earlier "Cloud migration has not been applied" note in the
  Phase 8 Durable Diagnostics section.)

### Automated validation (this pass)

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — passed: 32 files, 153 tests.
- `npm run build` — passed (existing ~1,025 kB large-chunk warning only).
- `git diff --check` — clean (informational LF/CRLF notices only).

### Manual and provider verification (completed by the project owner and attested as passed)

- Routing: `/admin`, `/admin/companies`, `/admin/licences`, `/admin/features`,
  `/admin/customization-requests`, `/admin/diagnostics`; direct navigation, refresh, Back/Forward,
  active sidebar state, Company denial, and unauthenticated Admin login.
- Responsive at 375px, 768px, 1280px, and 1440px: no page-level overflow, accessible mobile
  navigation, usable tables and cards.
- Features: Standard Features read-only; Shared Features and Private Customizations display correctly;
  enable works; disabling requires a controlled reason; lifecycle history preserved; no task content.
- Diagnostics: Sentry/PostHog configured status, release records, assignment lifecycle, disablement
  reasons, and customization lifecycle summaries.
- Providers: sanitized Sentry test event received; explicit PostHog events received; no autocapture;
  no PostHog session recording; no sensitive task, Company, licence, token, or raw-error content.

### Cloud SQL/RLS verification (run against Cloud)

Connection note: the supplied direct host `db.<ref>.supabase.co` is IPv6-only and unreachable from
the current environment, so verification used the eu-west-1 IPv4 session pooler with the existing
`SUPABASE_DB_PASSWORD` via `PGPASSWORD`. No connection string or password was printed, logged, or
written anywhere. Both test files are transactional (`begin;` … `rollback;`) and were run with
`ON_ERROR_STOP`.

- `supabase/tests/isolation.sql` — PASSED (exit 0, reached ROLLBACK, 0 errors). Core tables exist;
  RLS enabled and forced; approved policies and indexes present; anon has no SELECT; authenticated
  may update only `companies.status`; Company A/B see only their own tasks; cross-Company insert
  rejected; Platform Admin sees zero task rows, can read Companies/licences, can suspend, cannot
  update protected Company fields; suspended Company denied all task access; anon denied.
- `supabase/tests/diagnostics.sql` — FAILED at the assignment RPC path. Assertions up to that point
  passed (diagnostic tables exist, forced RLS, no `operational_events` table, anon denied, browser
  SELECT-only grants, feature-request constraints, first-enable insert). Failure:

  > `ERROR: column reference "company_id" is ambiguous` in
  > `public.set_private_extension_assignment` (SQLSTATE 42702).

- Rollback confirmation (read-only, after the failure): synthetic users = 0, synthetic Companies = 0,
  temporary `feature_requests` with `requested_outcome = 'Valid Phase 8 request'` = 0. The aborted
  diagnostics transaction left no synthetic data.

### Verified Phase 8 defect (Cloud RPC)

`public.set_private_extension_assignment` (migration `20260722070351_phase8_diagnostics.sql`) declares
`returns table (company_id uuid, extension_id uuid, enabled boolean, created_at timestamptz)`, so
those names are PL/pgSQL OUT variables in scope. The UPDATE branch (lines ~186–190) uses unqualified
`where company_id = p_company_id and extension_id = p_extension_id`, which collides with those OUT
variables and raises SQLSTATE 42702. The SELECT (aliased `assignment`) and the INSERT are safe; only
the UPDATE path fails. Impact: any assignment toggle that updates an existing `company_extensions`
row (disabling, or re-enabling an existing assignment) fails; only the first-ever INSERT succeeds.

Fix applied (owner-approved): migration
`20260722120000_fix_set_private_extension_assignment_ambiguous_column.sql` re-creates the function
with the UPDATE target aliased and the predicate qualified, mirroring the SELECT. Only the UPDATE
branch changed; all guards, the INSERT, the history write, `security definer`, the fixed
`search_path`, and the least-privilege grants are preserved.

```sql
    update public.company_extensions as assignment
       set enabled = p_enabled
     where assignment.company_id = p_company_id
       and assignment.extension_id = p_extension_id
    returning assignment.* into v_assignment;
```

The migration was pushed with `npx supabase db push` (tracked, not a manual edit);
`npx supabase migration list` shows `20260722120000` at local↔remote parity and
`db push --dry-run` reports "Remote database is up to date."

### Cloud re-verification after the fix

- `supabase/tests/diagnostics.sql` — PASSED (exit 0, ROLLBACK reached, 0 errors, all 18 assertions),
  including the previously-failing UPDATE / idempotent-re-enable / controlled-disable path.
- `supabase/tests/isolation.sql` — PASSED (exit 0, ROLLBACK reached, 0 errors, all 27 assertions),
  including Platform Admin receiving zero task rows.
- Rollback checks (read-only): synthetic users = 0, synthetic Companies = 0, temporary
  `feature_requests` = 0.
- Local automated gates re-run and green: `npm run lint`, `npm run typecheck`,
  `npm run test` (32 files / 153 tests), `npm run build`, `git diff --check`.

Connection note: verification used the eu-west-1 IPv4 session pooler because the supplied direct
`db.<ref>.supabase.co` host is IPv6-only and unreachable in this environment; no connection string or
password was printed, logged, or written anywhere.

### Security Advisor

Not accessible from the current environment (no Supabase advisor tooling is connected). Not fabricated.
The project owner must inspect Security Advisor and confirm no new Phase 8 findings involving:
`extension_assignment_events`, `feature_requests`, `release_records`,
`set_private_extension_assignment`, missing RLS, unsafe grants, mutable/unsafe function
`search_path`, Company access to Platform Admin diagnostics, and Platform Admin access to tasks. The
pre-existing leaked-password-protection warning may remain documented separately if it is unrelated
to Phase 8.

### Verdict

PHASE 8 INCOMPLETE — one item remains: the owner-run Supabase Security Advisor review.

All other verification now passes: the assignment-RPC defect is fixed and applied to Cloud;
`diagnostics.sql` and `isolation.sql` both pass against Cloud; rollback checks are clean; Platform
Admin receives zero task rows; and all local automated gates are green. The Security Advisor review
cannot be run from this environment (no advisor tooling), and per the verification rules it is not
fabricated.

Sole remaining blocker:

1. Owner-run Supabase Security Advisor review confirming no new Phase 8 findings involving
   `extension_assignment_events`, `feature_requests`, `release_records`,
   `set_private_extension_assignment`, missing RLS, unsafe grants, mutable/unsafe function
   `search_path`, Company access to Platform Admin diagnostics, or Platform Admin access to tasks.
   (A pre-existing leaked-password-protection warning, if present and unrelated to Phase 8, may remain
   documented separately.)

Once the owner confirms the Security Advisor shows no new Phase 8 findings, this becomes PHASE 8
COMPLETE. No commit or push was performed; Phase 9 was not started.
