# Phase 7: Extension Test

Status: draft for review. This document specifies the architecture proof only;
it does not approve implementation or migrations.

## 1. Purpose

Prove that one shared extension can be available to every active Company while
one private extension can be enabled for one approved Company, without weakening
tenant isolation or changing core Todo behavior. This is not a marketplace or a
general plugin runtime.

## 2. Scope

- Register two static, code-owned proof extensions:
  - **Task Notes Summary** (shared): a read-only summary of the current
    Company’s own tasks.
  - **Priority Labels Demo** (private): a read-only panel shown only when the
    current Company has an enabled assignment.
- Add an Extensions section to the protected Company workspace.
- Allow Platform Admins to list extensions and assignments and enable or disable
  the private proof extension for a Company.
- Provide loading, empty, error, retry, pending, and success feedback.
- Enforce visibility and assignment isolation with Supabase RLS.

The existing task table, task repository, task service, dashboard counts, and
task UI remain unchanged. The shared summary may read the already-authorized
Company task list through the existing task boundary; it must never accept a
Company ID from the browser.

## 3. Out of scope

- Marketplace, extension upload, dynamic JavaScript loading, `eval`, or remote
  code execution;
- arbitrary plugin packages, third-party code, versioning, dependencies, or a
  permissions framework;
- billing, paid extensions, analytics, diagnostics, webhooks, deployment, or
  Phase 8 work;
- extension creation UI, editing extension metadata, or deleting extensions;
- changing task schema, task behavior, or Todo permissions;
- Platform Admin access to Company task content;
- multiple Company users, teams, roles, or invitations.

## 4. Shared extension behavior

`task-notes-summary` is a code-owned shared extension with
`availability_type = 'shared'` and `is_active = true`. Every active Company
can see it. Its panel displays only derived values such as total, pending, and
completed tasks from the current Company’s existing RLS-scoped task list. It
has no write controls and no cross-Company input.

Suspended Companies receive no extension rows and no summary data.

## 5. Private extension behavior

`priority-labels-demo` is a code-owned private extension with
`availability_type = 'private'`. It is visible only to an active Company with
an enabled `company_extensions` assignment for that extension. The proof panel
contains static/read-only demonstration content and does not add fields to or
mutate `tasks`.

Disabling the assignment removes the panel after refresh. An absent assignment
and a disabled assignment both mean that the Company cannot see the private
extension.

## 6. Minimal data model

The current four-table schema has no extension registry or assignment table.
Two new tables are therefore justified and sufficient:

```text
extensions
- id uuid primary key
- key text unique not null
- name text not null
- description text not null
- availability_type text not null check ('shared' or 'private')
- is_active boolean not null default true
- created_at timestamptz not null default now()

company_extensions
- company_id uuid not null references companies(id) on delete cascade
- extension_id uuid not null references extensions(id) on delete cascade
- enabled boolean not null default true
- created_at timestamptz not null default now()
- primary key (company_id, extension_id)
```

Add an index supporting assignment lookups by `extension_id` and `enabled`.
No task, user, or metadata table is added. Static proof-extension behavior is
compiled into the application; the registry stores discovery and assignment
state only.

## 7. RLS and authorization model

Both tables must have RLS enabled and forced. Browser access uses the existing
authenticated Supabase client; no service-role key or SECURITY DEFINER function
is introduced.

`extensions` SELECT policy for `authenticated`:

- a Platform Admin may read registered extensions;
- an active Company may read active shared extensions;
- an active Company may read active private extensions only when an enabled
  assignment exists for `auth.uid()`;
- suspended Companies read zero extension rows.

`company_extensions` policies for `authenticated`:

- a Platform Admin may SELECT all assignments and INSERT or UPDATE assignments;
- an active Company may SELECT only its own enabled assignments;
- Companies have no INSERT, UPDATE, or DELETE policy;
- assignment writes are limited to the `enabled` mutation for existing rows;
  repository operations may insert a new assignment only for the Platform Admin
  path and only for the private proof extension;
- no anonymous application access is granted.

The Platform Admin policies must test membership in `platform_admins` using the
authenticated user ID. Company policies must use `auth.uid()` and the Company
row’s active status. RLS, grants, and the server-authoritative authenticated
identity—not a slug, URL, display value, or form-supplied `company_id`—are the
authorization boundary.

Platform Admin queries must never select from `tasks`; the extension registry
and assignment tables contain no task content.

## 8. Company workspace flow

1. The existing workspace guard authenticates the Company and verifies the
   requested slug.
2. The extension service requests the current Company’s visible extensions.
3. The repository uses the browser Supabase client; it does not accept a
   Company ID or slug for authorization.
4. The workspace renders the shared summary when returned and the private demo
   only when its assignment is returned.
5. A suspended or unauthorized Company receives no extension data and retains
   the existing workspace protection behavior.

## 9. Platform Admin assignment flow

1. The existing `/admin` guard permits only a Platform Admin.
2. The dashboard loads extension definitions and assignment rows, plus safe
   Company names/slugs from the existing Companies list if needed for display.
3. The Admin may enable or disable only `priority-labels-demo` for a selected
   Company. Shared extensions have no assignment control.
4. The control confirms the target Company and action, disables duplicate
   requests while pending, maps failures to safe messages, and refreshes the
   assignment list after success.
5. No task query, extension creation, code upload, or arbitrary extension
   mutation is available.

## 10. Repository responsibilities

Add small typed repositories behind Supabase:

- `listVisibleExtensions()` for the current Company;
- `listAdminExtensions()` for registered extensions;
- `listAdminAssignments()` for assignment management;
- `setPrivateExtensionEnabled(companyId, extensionId, enabled)` for the guarded
  Platform Admin path.

The Company method must not accept `company_id`; the authenticated JWT and RLS
derive visibility. The Admin mutation may accept IDs returned from the Admin
list, but RLS must still verify Platform Admin membership and the service must
reject non-private or unknown extension keys. Repositories return typed safe
errors and never expose raw SQL or database error text.

## 11. Service responsibilities

Add an extension service that:

- requires an active Company account for Company visibility;
- requires a Platform Admin account for registry/assignment management;
- maps visible rows to the two known proof extensions;
- computes the Task Notes Summary using the existing Company-scoped task
  service/repository boundary;
- validates that only the private proof extension can be assigned;
- maps network, RLS, not-found, suspended, and duplicate-operation failures to
  stable safe messages;
- never imports React, performs routing, accepts a tenant selector, or exposes
  Platform Admin task content.

## 12. Loading, empty, error, retry, pending, and success states

- Workspace extension loading shows a neutral loading state.
- No visible extensions shows a clear empty state; a missing private assignment
  is not an error.
- Load failures show a safe message and Retry without fabricated extension data.
- Admin assignment controls show confirmation, pending/disabled state, safe
  failure feedback, and success feedback after refresh.
- Duplicate enable/disable requests are prevented while pending.
- Suspended or unauthorized access follows the existing workspace/admin guard
  states and does not reveal extension data.

## 13. Acceptance criteria

1. An active Company sees Task Notes Summary with only its own task-derived
   values.
2. An active Company with an enabled assignment sees Priority Labels Demo.
3. An active Company without an assignment does not see the private demo.
4. Disabling an assignment removes the private demo after refresh.
5. A suspended Company sees no extension data.
6. Company A cannot see Company B’s assignments or private extension.
7. Cross-slug workspace protection remains unchanged.
8. Platform Admin can list registered extensions and assignments and can enable
   or disable only the private proof extension.
9. Platform Admin cannot read task rows through the extension system.
10. Anonymous users cannot read extension or assignment data.
11. Loading, empty, retry, error, pending, confirmation, and success states are
    safe and clear.
12. No task table, Todo behavior, service-role credential, dynamic code loading,
    or remote execution is introduced.
13. The two new tables are covered by version-controlled migration SQL with
    RLS, grants, policies, constraints, and the required index.

## 14. Test plan

### Company access

- active Company sees the shared extension;
- active Company with assignment sees the private extension;
- active Company without assignment does not see it;
- suspended Company sees zero extensions;
- Company A cannot read Company B assignments;
- changing the workspace slug does not bypass the existing guard.

### Platform Admin

- Admin lists extensions and assignments;
- Admin enables and disables the private extension;
- duplicate assignment actions are prevented;
- invalid/shared extension assignment is rejected;
- Admin receives zero task rows.

### Shared summary

- summary uses only current Company task data;
- correct counts and empty state;
- load failure and Retry;
- no cross-tenant leakage;
- Todo create/edit/complete/delete behavior remains unchanged.

### Private demo

- appears only when enabled;
- disappears after disable and refresh;
- refresh preserves the enabled assignment;
- it never mutates or adds columns to `tasks`.

### Database/RLS verification

Use a transactional SQL verification script with synthetic identities and
`ROLLBACK` to prove:

- all extension tables have RLS enabled and forced;
- active Company sees shared and only its own enabled private assignment;
- Company cannot read another Company’s assignments or write assignments;
- suspended Company sees zero extension data;
- Platform Admin can list and manage assignments but receives zero task rows;
- anonymous access is denied;
- duplicate `(company_id, extension_id)` assignments are impossible;
- no synthetic rows remain after rollback.

## 15. Ordered implementation tasks

1. Reconfirm the current schema, grants, RLS, Company status checks, and task
   isolation verification.
2. Add the two-table version-controlled migration, seed the two static
   extensions, and define least-privilege grants and RLS policies.
3. Add typed extension repositories and safe error mapping.
4. Add the extension service and Company-scoped shared summary integration.
5. Add the workspace Extensions section with all required states.
6. Add Platform Admin assignment listing and private-extension controls without
   changing existing Company/licence/task controls.
7. Add unit, component, repository, service, and SQL isolation tests.
8. Review for task leakage, cross-tenant IDs, dynamic code, and secret exposure.
9. Run lint, typecheck, tests, build, SQL isolation verification, and the
   Supabase security advisor; update project status and stop for review.

## 16. Assumptions and unresolved decisions

### Resolved for this proof

- The two-table registry/assignment model is the minimum model that supports
  shared discovery and private Company enablement.
- The two proof extensions are static, code-owned, read-only demonstrations.
- Shared summary data is derived through the existing active-Company task
  access; no new task RPC or task schema is required.
- Suspended Companies receive no extension rows.
- Revocation, extension creation, uploads, dynamic loading, and arbitrary code
  execution are excluded.

### Unresolved before implementation

- Whether Admin assignment writes should use a repository insert/update pair or
  one guarded upsert; either must preserve the unique key and least-privilege
  column grants.
- Exact seed UUID strategy for the two static extensions; implementation must
  use generated or deterministic non-secret IDs, never real account values.
- Whether the Admin assignment list should show Company email in addition to
  name and slug; no extra data is required for authorization.
- Final production subdomain/session behavior remains a Phase 8 decision.
