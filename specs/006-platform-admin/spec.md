# Phase 6: Platform Admin - Specification

Status: draft for review. No Phase 6 code or database changes are approved by
this document alone.

## 1. Scope

Add a basic Platform Admin dashboard at /admin for authenticated Platform Admin
accounts. It provides:

- Company and licence summary counts;
- Company listing and active/suspended status management;
- Licence listing and status display;
- licence generation through the existing generate-licence Edge Function;
- safe loading, empty, error, confirmation, pending, and success states.

This phase reuses the existing four-table schema, authentication, RLS policies,
and licence-generation function. It does not add tables or change RLS unless a
separately verified gap is found.

## 2. Out of scope

- Viewing, editing, or deleting Company tasks;
- editing Company name, email, slug, or created date;
- deleting Companies, manually creating Companies, or impersonating Companies;
- multiple Platform Admin roles, permissions UI, or audit-log UI;
- analytics beyond the dashboard counts;
- diagnostics, extensions, billing, payments, email notifications, deployment,
  and Phase 7 or Phase 8 work;
- licence revocation or any other licence mutation;
- licence raw-key recovery or redisplay.

Licence statuses including revoked remain visible in the list. Revocation is
excluded because the current phase does not need another privileged mutation
path. A future revocation feature must define a secure server-side operation,
confirmation, redeemed-licence protection, and least-privilege grants before
implementation.

## 3. User flows

### Entering the dashboard

1. AuthProvider restores the Supabase session and resolves the account kind.
2. A Platform Admin is allowed to /admin.
3. A Company receives the existing ADMIN_ONLY refusal and no admin data is
   requested.
4. An unauthenticated visitor sees the existing Platform Admin sign-in state.
5. After a successful session restore, the dashboard loads Companies and
   licences through the Platform Admin service.

### Reviewing dashboard data

1. The page loads Companies and licences through repository methods.
2. Counts are derived from the returned, RLS-scoped rows.
3. A licence with stored status available whose expires_at is in the past is
   displayed and counted as expired without mutating the database. No scheduler
   is introduced.
4. Empty datasets show separate, clear empty states.

### Suspending or reactivating a Company

1. The admin selects Suspend for an active Company or Reactivate for a
   suspended Company.
2. The page confirms the exact status change.
3. The status control enters a pending state and duplicate updates are blocked.
4. The service validates the transition and the repository updates only
   companies.status for the selected Company ID.
5. The page refreshes Companies and derived counts after success and shows
   non-sensitive success feedback.
6. A failed update preserves the last successful list and shows a safe error.
   The Company name, email, slug, and tasks are never edited by this flow.

### Generating a licence

1. The existing basic generation form remains available to an authenticated
   Platform Admin.
2. The form calls the existing generate-licence Edge Function through the
   licensing service.
3. The raw key is shown once in component memory with Copy and Dismiss actions.
4. Dismiss clears the result; the key is not stored in localStorage, session
   storage, URLs, query caches, or logs.
5. Generation errors are mapped to safe messages and duplicate submissions are
   prevented.

## 4. Admin dashboard layout

Keep the layout basic and accessible:

- page heading, account context, and logout control;
- summary cards or labelled values:
  - total Companies;
  - active Companies;
  - suspended Companies;
  - total licences;
  - available licences;
  - redeemed licences;
  - expired licences;
  - revoked licences;
- Companies section with fields:
  - Company name;
  - email;
  - workspace slug;
  - status;
  - created date;
  - status action;
- Licences section with fields:
  - Company name;
  - display prefix;
  - status;
  - expiry date;
  - created date;
  - redeemed date when present;
- existing licence-generation form and one-time result;
- loading, empty, retryable error, confirmation, pending, and success regions.

The page must not render task rows or task controls. The existing local route is
/workspace/:slug; no new route or production deployment behavior is added.

## 5. Company-management requirements

The repository returns only the fields needed by the list. The service maps
database rows to safe domain records and derives counts.

Allowed mutation:

- active -> suspended;
- suspended -> active.

The request may contain only the Company ID and target status. The repository
must send an update object containing only { status } and must select the
updated safe fields. The authenticated Platform Admin JWT, RLS, and the
companies.status column grant remain authoritative. A URL, display name, or
client-selected field is never an authorization boundary.

No Company profile field is editable. Status changes must use confirmation,
pending controls, safe errors, and a refresh after success.

## 6. Licence-management requirements

Licence list rows contain:

- id;
- company_name;
- key_prefix;
- status;
- expires_at;
- created_at;
- redeemed_at when present.

Status presentation is:

- available when stored status is available and the expiry is in the future;
- expired when stored status is expired, or stored status is available and
  expires_at has passed;
- redeemed when stored status is redeemed;
- revoked when stored status is revoked.

The derived expired display does not update licences.status. The list never
selects key_hash and never has access to a raw key.

Generation reuses the existing generate-licence service and Edge Function.
Its existing validation, Platform Admin authorization, Web Crypto randomness,
hashing, one-time raw-key response, and safe logging rules remain authoritative.
The Phase 6 page may show the generated key only until Dismiss or page
navigation.

Licence revocation is explicitly excluded. No browser code may update licence
status in this phase.

## 7. Repository responsibilities

Add a small Platform Admin repository behind the Supabase browser client:

- listCompanies(): select id, name, email, slug, status, created_at;
- updateCompanyStatus(companyId, status): update only status and return the
  updated safe Company record;
- listLicences(): select id, company_name, key_prefix, status, expires_at,
  created_at, redeemed_at.

The repository must:

- use the authenticated browser client and current JWT;
- never use service-role or secret keys;
- never query tasks;
- never select key_hash or raw licence data;
- preserve typed lower-level failures while omitting raw database text from UI
  responses;
- rely on RLS and column privileges rather than a client-supplied admin claim.

The existing licensing repository/service remains responsible for generation;
do not duplicate that Edge Function integration.

## 8. Service responsibilities

Add a Platform Admin service that:

- requires an account resolved as kind platform-admin;
- loads Companies and licences and derives all summary counts;
- maps rows to domain types and derives expired licence display status;
- validates Company status transitions;
- maps network, RLS, not-found, and malformed-row failures to stable safe
  messages;
- coordinates refresh after status mutations;
- does not access React state, routing, Supabase directly, or task data;
- does not expose raw licence keys beyond the existing generation result.

The service may load the two lists in parallel, but a failure must not be presented
as fabricated counts. A successful prior snapshot may remain visible while a
retryable error is shown.

## 9. Validation rules

- Only active and suspended Company statuses are accepted.
- A status update must be a real transition; an active Company cannot be
  suspended twice and a suspended Company cannot be reactivated twice.
- Company IDs must be IDs returned by the repository; names, emails, and slugs
  are display values only.
- Company list fields are display-only.
- Licence statuses are limited to available, redeemed, expired, and revoked;
  expiry-derived display status must not mutate stored status.
- Licence dates are rendered from stored timestamptz values in a safe consistent
  format.
- No raw database, SQL, JWT, hash, password, service-role key, or secret is
  shown to a user.
- The existing generate-licence validation remains authoritative for Company
  Name, expiry date, and initial status.

## 10. Loading, empty, error, confirmation, and success states

- Initial authentication loading uses the existing AuthProvider state.
- Dashboard loading shows a neutral state and does not show fabricated counts.
- Company and licence sections may show independent loading/empty states.
- A load failure shows a safe message and Retry; it does not reveal Supabase
  errors or replace a previous successful snapshot with fake data.
- Status changes show a confirmation prompt naming the Company and new status.
- During a status update, the selected action is disabled and duplicate requests
  are prevented.
- Successful status changes refresh both the Company list and summary counts,
  then show non-sensitive feedback.
- Failed status changes preserve the previous list and offer retry.
- Licence generation retains existing pending, field-error, safe-error, Copy,
  and Dismiss behavior.
- Dismiss removes the raw key from React state; it must not persist elsewhere.

## 11. Authentication and authorization requirements

- Only an authenticated account with a self-read row in platform_admins may
  access the dashboard data.
- The existing route guard blocks Companies with ADMIN_ONLY and leaves their
  session intact.
- Unauthenticated visitors receive the existing Platform Admin login state.
- Session restoration and SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED handling remain
  owned by AuthProvider.
- The browser uses only the configured Supabase URL and public anon/publishable
  key. Service-role and secret keys stay server-side.
- Platform Admin reads are limited to Companies and licences.
- Platform Admin receives no task rows; the page must not request tasks.
- Companies cannot read Platform Admin datasets or update another Company's
  status through the browser.

## 12. RLS assumptions

Reuse the existing policies without weakening them:

- companies SELECT allows a Company to read its own row or a Platform Admin to
  read Companies;
- companies UPDATE is available to Platform Admins only and the authenticated
  role has column UPDATE privilege only for status;
- licences SELECT is available to Platform Admins only;
- licences INSERT/UPDATE policies remain available to Platform Admins for the
  existing generation path, but Phase 6 does not expose licence mutation;
- platform_admins remains self-readable only;
- tasks has no Platform Admin policy, so Admin requests receive zero task rows;
- anon has no application access;
- all four application tables remain RLS-enabled and forced.

The UI guard is not the security boundary. Cloud isolation verification must
prove Company denial of admin datasets, Company denial of cross-Company status
updates, Admin denial of task rows, and Admin inability to update Company fields
other than status. A migration is not needed unless a verified gap is found.

## 13. Acceptance criteria

1. A valid Platform Admin session can open /admin and restore access after reload.
2. A Company is blocked from /admin and receives no Company-management or licence
   data.
3. An unauthenticated visitor sees the existing Admin sign-in state.
4. Dashboard counts correctly represent total, active, suspended, available,
   redeemed, expired, and revoked records.
5. Companies list all required fields and no task fields.
6. An active Company can be suspended only after confirmation.
7. A suspended Company can be reactivated only after confirmation.
8. Status actions show pending state, prevent duplicates, refresh rows/counts,
   and provide safe success/error states.
9. Platform Admin status updates change only companies.status.
10. Licence rows show the required fields and safe derived expiry status.
11. Generation uses the existing Edge Function, displays the raw key once, and
    supports Copy and Dismiss without persistence or logging.
12. Revocation is not implemented; redeemed licences cannot be changed by Phase
    6 UI.
13. Platform Admin receives no task rows and cannot edit Company name, email,
    slug, created_at, or tasks.
14. No service-role credential, raw key, hash, SQL, token, or secret reaches the
    browser or logs.
15. Existing Phase 2 RLS, Phase 3 registration, Phase 4 authentication, and
    Phase 5 Todo tests remain passing.
16. No new table, migration, route, or future-phase feature is introduced
    without a verified and separately approved gap.

## 14. Test plan

### Access and session

- Platform Admin can access /admin.
- Company is blocked with ADMIN_ONLY.
- Unauthenticated visitor sees the Admin sign-in state.
- Session restoration preserves Platform Admin access.
- Sign-out clears the dashboard.

### Dashboard and lists

- Correct Company counts for total, active, and suspended.
- Correct licence counts, including derived expired status.
- Required Company and licence fields are rendered.
- Empty Companies and empty licences states.
- Loading state.
- Load failure hides fabricated counts and offers Retry.
- Platform Admin list queries never request tasks.

### Company management

- Active -> suspended requires confirmation.
- Suspended -> active requires confirmation.
- Cancelled confirmation causes no update.
- Pending state prevents duplicate actions.
- Successful update refreshes rows and counts.
- Safe update failure preserves the previous snapshot.
- Repository update shape contains only status.
- No Company name, email, slug, created_at, or task edit control exists.

### Licence management

- Licence status display for available, redeemed, expired, and revoked.
- Generation success through the existing Edge Function.
- Raw key shown once; Copy works; Dismiss clears it.
- Duplicate generation is prevented while pending.
- Safe generation failure.
- Raw key is absent from persisted browser state after dismissal.
- No revocation control is rendered.

### Security and database verification

- Platform Admin receives zero task rows.
- Company cannot query platform_admins or licences.
- Company cannot update another Company's status.
- Platform Admin cannot update Company fields other than status.
- Browser bundles contain no service-role or secret key.
- Rerun the existing transactional Cloud isolation verification and security
  advisor if database access changes.

## 15. Ordered implementation tasks

1. Confirm the existing Companies/licences schema, grants, RLS policies, and
   Cloud isolation verification have no gap.
2. Add typed Platform Admin repository methods and safe error types.
3. Add the Platform Admin service for snapshots, counts, status transitions,
   and safe error mapping.
4. Expand /admin while preserving AuthProvider and the existing Admin access
   guard.
5. Reuse the existing licence-generation service/form and add list integration.
6. Add focused unit, repository, service, and component tests.
7. Review the diff for task access, secret exposure, raw-key persistence, and
   protected Company fields.
8. Run lint, typecheck, test, and build; run approved Cloud verification if
   database behavior was changed.
9. Update docs/project-status.md and stop for review before Phase 7.

## 16. Assumptions and unresolved decisions

### Resolved for Phase 6

- Licence revocation is excluded; revoked is a read-only display status.
- Expired display status is derived at read time for an available licence whose
  expires_at has passed; no scheduler or automatic status mutation is added.
- Company status changes use a simple confirmation prompt, not a new modal
  framework.
- Summary counts are derived from the two list snapshots; no count RPC is added.
- Existing RLS, column grants, and the four-table schema are reused.
- Existing licence generation remains the only raw-key-producing operation.

### Unresolved

- Whether future licence revocation should use a restricted RPC or a dedicated
  Edge Function, and whether licence UPDATE column grants should be narrowed.
- Whether large datasets will later require pagination or server-side counts.
- Whether Platform Admin list refresh should be automatic after session events
  beyond the initial load.
- Final production domain and cross-subdomain session behavior remain Phase 8
  decisions.
