# Phase 5: Todo Specification

Status: approved for Phase 5 implementation; no schema change is required.

## 1. Scope

Replace the protected `/workspace/:slug` placeholder with a basic Company Todo
workspace. The workspace provides a dashboard, task list, and the minimum task
operations required by the PRD:

- total task count;
- pending task count;
- completed task count;
- create a task;
- list tasks;
- edit a task;
- mark a task completed;
- return a completed task to pending;
- delete a task.

The existing Phase 4 authentication and workspace guard remain authoritative. A
Company must be authenticated, active, and accessing its own slug before task
data is loaded or mutated.

## 2. Out of scope

- task assignment or multiple Company users;
- priorities, due dates, calendars, attachments, recurring tasks, comments, or
  notifications;
- analytics, advanced filtering, or advanced sorting;
- extensions or diagnostics integrations;
- Platform Admin task access or task-management UI;
- changes to authentication, registration, licences, Companies, or RLS;
- pagination, optimistic updates, offline mode, realtime subscriptions, or
  background synchronization;
- any Phase 6 or later functionality.

## 3. User flow

1. An unauthenticated visitor is redirected to `/login` by the existing guard.
2. A Platform Admin is refused with the existing workspace-forbidden state.
3. A suspended Company is refused with the existing suspended state.
4. An active Company whose account slug matches `/workspace/:slug` sees the
   workspace shell and a loading state while tasks are fetched.
5. The first successful fetch renders dashboard counts and the task list. Zero
   rows render the empty state.
6. The Company submits the create form. The service validates the input, the
   repository inserts a row for the authenticated Company, and the view refreshes
   its task snapshot with success feedback.
7. Edit, complete, return-to-pending, and delete use the same mutation path:
   validate, submit, refresh, and show a safe success or error message.
8. Refreshing the page repeats Phase 4 session restoration and then loads the
   current Company task snapshot. No task state is trusted from the URL.

## 4. Workspace layout

Keep the existing workspace route and Company identity. The basic layout contains:

- a header with Company name and the existing logout control;
- three summary cards: Total, Pending, and Completed;
- a create-task form with required Title and optional Description;
- a task list ordered by `created_at` descending (newest first);
- each task row showing title, description when present, status, created date,
  Edit, Complete/Return to pending, and Delete controls;
- loading, empty, inline error, and success feedback regions.

Editing may use an inline form or a small dialog, but it must remain a single
basic flow and must not introduce a new routing surface. React rendering must
escape task text; no HTML supplied by a Company is interpreted.

## 5. Data model assumptions

Reuse the existing `public.tasks` table without a migration:

| Column | Type/constraint | Phase 5 use |
| --- | --- | --- |
| `id` | uuid primary key, database default | immutable task identity |
| `company_id` | uuid not null, FK to `companies(id)` with cascade | tenant owner; never accepted from the URL |
| `title` | text not null | task title |
| `description` | text nullable | optional task details |
| `status` | text, CHECK `pending` or `completed` | task lifecycle |
| `created_at` | timestamptz default `now()` | display and newest-first ordering |

The authenticated Company ID is obtained from the current Supabase Auth session
and is the only value used for `company_id` on insert. Update and delete inputs
contain a task ID only; they never accept a replacement `company_id`, owner, or
created timestamp. The database remains the final authority.

The existing `(company_id, status)` index supports tenant filtering and dashboard
work. No additional index or table is required unless verification finds a real
gap.

## 6. Repository responsibilities

Create a small Todo repository behind the existing infrastructure boundary. It
may expose only:

- listCurrentCompanyTasks() — select the task fields needed by the view and order by created_at desc.
- createTask(input) — obtain the authenticated user ID and insert company_id from that session.
- updateTask(taskId, input) — update title and description by task ID only.
- updateTaskStatus(taskId, status) — update only the validated lifecycle status.
- deleteTask(taskId) — delete by task ID only.

The repository uses the browser Supabase client and never a service-role key. It
does not resolve another Company by slug and does not use a caller-supplied
Company ID as an authorization boundary. RLS errors and zero-row mutations are
translated into typed, safe repository errors; raw Supabase messages are not
shown directly to users.

## 7. Service responsibilities

The Todo service sits between components and the repository. It must:

- require an authenticated active Company account before loading or mutating;
- validate and normalize task input;
- default new tasks to `pending`;
- expose a single task snapshot containing rows and derived total/pending/
  completed counts;
- refresh the snapshot after every successful mutation;
- prevent duplicate submissions while a request is pending;
- clear field/action errors when the relevant input changes;
- preserve the current snapshot until a replacement succeeds, except when the
  account becomes invalid or signed out;
- map network, RLS, validation, and not-found failures to safe user messages.

Counts are derived from the RLS-scoped task list rather than from a new count RPC.
This is intentionally basic and keeps one consistent snapshot for the list and
cards.

## 8. Validation rules

- Title is required after trimming and must be 1-120 characters.
- Description is optional; trim it and allow at most 1,000 characters.
- New tasks always start as `pending`.
- Status accepts only `pending` or `completed`.
- Empty descriptions are stored as `null` or the repository's equivalent empty
  value consistently; the choice must be covered by tests.
- Task IDs must be valid identifiers returned by the repository; no task ID or
  slug is treated as proof of ownership.
- `company_id`, `created_at`, and the Company account are not editable form
  fields.
- Validation errors identify fields without echoing secrets or raw database
  errors. React text rendering prevents stored text from becoming executable
  markup.

## 9. Loading, empty, error, and success states

- **Initial loading:** show a neutral workspace loading state while the active
  Company session and first task fetch resolve. Do not render another Company's
  task data.
- **Mutation loading:** disable the relevant submit/control and prevent duplicate
  requests; keep unrelated rows usable where safe.
- **Empty:** when the successful snapshot has zero rows, show a clear empty-state
  message and the create form.
- **Load error:** show a safe error with a Retry action; do not replace the view
  with fabricated counts or rows.
- **Mutation error:** keep the last successful snapshot, show an inline/action
  error, and allow retry after the request settles.
- **Success:** show brief, non-sensitive feedback such as â€œTask createdâ€ or
  â€œTask updatedâ€; clear it on the next action. Do not display database error
  details or authorization internals.
- **Signed out/suspended:** defer to the existing Phase 4 route/account guard;
  task requests must not continue after access is lost.

## 10. RLS assumptions

No RLS change is authorized. The existing migration enables and forces RLS on
`public.tasks`, grants the required task operations only to `authenticated`, and
has these policies:

- SELECT, INSERT, UPDATE, and DELETE require `company_id = auth.uid()`;
- the caller must not be a Platform Admin;
- the matching `companies` row must have `status = 'active'`;
- INSERT and UPDATE apply the same ownership/status rule in `WITH CHECK`;
- there is no Platform Admin task policy, so admins receive zero task rows;
- anonymous callers have no application table privileges or policies.

The UI guard is not the security boundary. Direct API requests, modified task
IDs, forged `company_id` values, and changed workspace slugs must still be denied
by RLS. Existing database isolation verification remains required after Todo
implementation.

## 11. Acceptance criteria

1. An active Company can open its own protected workspace and see Total, Pending,
   and Completed counts.
2. The task list contains only rows allowed by the authenticated Company's RLS
   context and is ordered newest first.
3. A Company can create a pending task with a valid title and optional description.
4. A Company can edit its own task title and description.
5. A Company can mark its own task completed and return it to pending.
6. A Company can delete its own task and the counts/list update afterward.
7. Loading, empty, action-pending, error/retry, and success states are visible and
   do not expose raw backend errors.
8. Refreshing the workspace restores the session through Phase 4 and reloads the
   current Company's tasks from Supabase.
9. A suspended Company cannot load or mutate tasks.
10. A Platform Admin receives no task rows and has no Todo controls.
11. Alpha cannot read, insert, update, or delete Beta tasks by changing the URL,
    request body, or task ID.
12. `company_id` is never a user-editable field and is derived from the
    authenticated session for inserts.
13. No database migration, extra table, service-role browser call, or later-phase
    feature is introduced.

## 12. Test plan

### Unit tests

- title/description/status validation and normalization;
- default pending status;
- task snapshot count derivation;
- safe mapping of repository errors;
- prevention of duplicate mutation submission.

### Repository/service tests

- list/create/update/delete request shapes use the authenticated ID only for
  insert;
- update/delete never send `company_id` or `created_at` as mutable fields;
- empty results and zero-row mutation errors are handled safely;
- active, suspended, Platform Admin, and signed-out access decisions.

### Component tests

- workspace loading, empty, populated, error, retry, and success states;
- create, edit, complete, return-to-pending, and delete interactions;
- counts update after each successful mutation;
- controls disable while pending and re-enable after completion;
- unauthenticated, suspended, and Platform Admin guards remain intact.

### Database/isolation verification

Extend or rerun the existing SQL isolation verification with synthetic rows
inside a transaction and `ROLLBACK`:

- Alpha sees and mutates only Alpha tasks;
- Beta cannot read or mutate Alpha tasks;
- forged cross-Company inserts/updates/deletes are rejected;
- suspended Company has zero task access;
- Platform Admin sees zero task rows;
- anon sees zero application rows.

No real credentials or permanent test data belong in the repository.

## 13. Ordered implementation tasks

1. Confirm the existing migration, RLS policies, privileges, index, and Cloud
   isolation verification still match this specification.
2. Add Todo validation types and unit tests.
3. Add the repository and service with typed safe errors and snapshot counts.
4. Replace the Phase 4 workspace placeholder with the basic dashboard, form, list,
   and state feedback while preserving the existing account guard and logout.
5. Add component, repository, and service tests for every operation and state.
6. Extend/rerun database isolation verification; do not alter the schema unless a
   verified gap is found and separately approved.
7. Run lint, typecheck, test, and build; review the diff for scope and secrets.
8. Update `docs/project-status.md` and stop for review before any later phase.

Expected Phase 5 files are limited to the Todo module, the existing workspace
component, focused tests, the approved SQL verification adjustment if needed, and
project status documentation. No migration is expected.

## 14. Assumptions and unresolved decisions

- The existing task schema and RLS policies are sufficient; this specification
  assumes verification finds no gap.
- A single RLS-scoped list is sufficient for counts in the proof of concept; no
  pagination, aggregate RPC, or realtime subscription is planned.
- Newest-first ordering by `created_at desc` is the only ordering required.
- The initial create form and edit form may be inline; the simplest accessible
  implementation should be chosen during review.
- Title and description limits (120 and 1,000 characters) are
  application validation limits, not schema changes.
- Whether empty descriptions are sent as `null` or an empty string must be fixed
  consistently in the repository tests.
- Success feedback may be inline rather than a toast; no notification system is
  needed.
- Production subdomain/session behavior remains governed by the Phase 4/Phase 8
  decisions; Todo authorization never trusts the slug alone.



