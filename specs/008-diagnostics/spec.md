# Phase 8: Diagnostics and Usage Monitoring

Status: draft for review. This document specifies the monitoring and
diagnostics design only; it does not approve implementation or migrations.

## 1. Purpose

Add tenant-safe technical diagnostics, product-usage visibility, extension
lifecycle history, and release metadata before deployment. Monitoring must
help the Platform Admin understand failures and adoption without exposing task
content, credentials, licence secrets, or private Company data.

## 2. Scope

- A central diagnostics service with provider adapters.
- Sentry for technical errors, traces, releases, and safely masked replay.
- PostHog for explicit product and extension usage events.
- Platform-owned Supabase records for extension assignment history, feature
  requests, and releases that require durable internal history.
- Pseudonymous account/Company identification for external providers.
- Core authentication, registration/licensing, Todo, Admin, and extension
  events.
- A protected Platform Admin diagnostics dashboard with safe summaries.
- Safe development/test no-op behavior and provider-failure tolerance.

## 3. Out of scope

- Full support-ticket or customer-facing diagnostics systems;
- unrestricted raw event exploration, raw request/response inspection, or a
  data warehouse;
- advanced business intelligence, billing analytics, automated extension
  retirement, automated pricing, deployment, or Phase 9 work;
- password reset, new authentication flows, Todo changes, or extension code
  execution;
- session recording without explicit masking and separate approval;
- customer-visible access to platform-wide diagnostics.

## 4. Sentry responsibilities

The Sentry adapter may send frontend exceptions, unhandled rejections, failed
operations, route/performance traces, release/environment metadata, and
extension-specific technical failures. It must:

- use `beforeSend` (and equivalent breadcrumb/request scrubbing) to remove
  forbidden fields and raw database/provider errors;
- attach only safe tags such as module, extension key, account kind, release,
  and environment;
- configure replay with all text and input values masked, media blocked, and a
  conservative sample rate;
- avoid request bodies, authorization headers, cookies, tokens, task values,
  email addresses, raw licence values, and free-text descriptions;
- keep development/preview sampling lower than production and allow the
  adapter to be disabled without affecting the application.

## 5. PostHog responsibilities

PostHog receives explicit typed usage events only. Autocapture and session
recording are disabled for this proof. Events may include safe metadata:
event name, pseudonymous account ID, account kind, module, extension key,
action, success/failure, safe error code, duration, release, environment, and
timestamp. PostHog must not receive email, task content, licence values,
passwords, tokens, raw errors, or form contents.

PostHog may provide adoption, most-used action, first-use/last-use, enabled-but-
unused, trend, and controlled-rollout metrics. Provider aggregation must use a
trusted server-side adapter or provider dashboard capability; no provider read
secret is exposed to the browser.

## 6. Supabase diagnostics responsibilities

Only platform-owned history that must survive provider changes is stored in
Supabase. The minimum Phase 8 model is:

### `extension_assignment_events`

- `id uuid primary key`;
- `company_id uuid not null references companies(id)`;
- `extension_id uuid not null references extensions(id)`;
- `enabled boolean not null`;
- `changed_at timestamptz not null`;
- `disabled_reason text null` with a controlled check when `enabled = false`;
- `actor_id uuid null references auth.users(id)`;
- `created_at timestamptz not null`.

Each enable/disable action creates a history row; history is never overwritten.
The row’s `changed_at` is the enabled or disabled timestamp. Last-used time is
an external usage metric in PostHog for this proof and is not duplicated in
the durable lifecycle table.

### `feature_requests`

- `id uuid primary key`;
- `requesting_company_id uuid null references companies(id)`;
- `requested_outcome text not null` with a bounded length;
- `classification text not null`;
- `status text not null`;
- `requested_at timestamptz not null`;
- `target_release text null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Phase 8 implements the data model and a Platform Admin read-only view only.
There is no Company request form or status-editing workflow yet. Any future
request input must reject sensitive/free-text content and use the same safe
metadata rules.

### `release_records`

- `id uuid primary key`;
- `version text not null`;
- `environment text not null`;
- `released_at timestamptz not null`;
- `created_at timestamptz not null`.

Release rows are written by trusted release/diagnostics infrastructure, not by
Company browsers. No raw deployment logs or secrets are stored.

Transient provider events and every PostHog/Sentry event are not duplicated in
Supabase. An optional safe operational-failure table is deferred unless the
dashboard cannot meet its recent-failure requirement from the trusted provider
adapters.

## 7. Privacy and data-minimization rules

Never send or persist:

- task titles, descriptions, or other task content;
- passwords, full licence keys, licence hashes, tokens, authorization headers,
  service-role keys, or secrets;
- raw request/response bodies, raw Supabase/provider errors, email addresses,
  or unrestricted personally sensitive free text.

Use only allowlisted metadata: a pseudonymous account/Company ID, account kind,
route, module, extension key, action, safe error code, outcome, duration,
release, environment, and timestamp. Runtime validation must reject unknown or
forbidden properties rather than merely relying on callers to omit them.

External-provider identity is a stable SHA-256 digest of the authenticated
account UUID with a diagnostics namespace; the raw UUID and email are never
sent to Sentry or PostHog. Supabase-owned lifecycle rows may retain the
internal `company_id` needed for Platform Admin audit, protected by RLS.

## 8. Event taxonomy

The diagnostics service exposes typed events for:

Authentication:

- `auth.login_succeeded`, `auth.login_failed`, `auth.logout`,
  `auth.session_restored`;

Registration/licensing:

- `company.registration_succeeded`, `company.registration_failed`,
  `licence.generated`, `licence.redemption_failed`;

Todo:

- `todo.workspace_viewed`, `todo.task_created`, `todo.task_updated`,
  `todo.task_completed`, `todo.task_reopened`, `todo.task_deleted`;

Platform Admin:

- `admin.dashboard_viewed`, `admin.company_suspended`,
  `admin.company_reactivated`, `admin.licence_generated`;

Extensions:

- `extension.visible`, `extension.opened`, `extension.assignment_enabled`,
  `extension.assignment_disabled`, `extension.load_failed`,
  `extension.action_failed`.

Events never include task values, licence values, credentials, or raw errors.
Assignment enable/disable events also create the platform-owned lifecycle row.

## 9. Extension lifecycle model

Allowed disablement reasons are:

- `no_longer_needed`;
- `too_complex`;
- `performance_problem`;
- `missing_expected_functionality`;
- `replaced_by_other_process`;
- `cost_concern`;
- `temporary_pause`;
- `other`.

Phase 8 does not collect an unrestricted `other` note. The assignment service
requires a controlled reason for every disable action, records the authenticated
actor, and emits the matching PostHog/Sentry-safe event. Enablement records a
history row with `enabled = true`; disablement records one with `enabled =
false` and a valid reason. Existing Phase 7 assignment state remains the
current source of access; history is append-only evidence.

## 10. Feature-request lifecycle model

Allowed classifications:

- `core`, `shared_extension`, `private_extension`, `configuration`,
  `rejected_or_postponed`.

Allowed statuses:

- `requested`, `under_review`, `approved`, `in_development`, `deployed`,
  `rejected`, `postponed`.

The Phase 8 decision is data model plus Platform Admin read-only display. No
Company creates requests and no browser status-management UI is implemented.
Target release is a bounded release identifier, not arbitrary deployment text.

## 11. Diagnostics architecture

```text
Application modules
  -> diagnostics service
      -> Sentry adapter
      -> PostHog adapter
      -> Supabase diagnostics repository / trusted server boundary
```

Components call stable diagnostics methods only:

- `identifyAccount`;
- `clearIdentity`;
- `captureUsage`;
- `captureFailure`;
- `capturePerformance`;
- `recordExtensionLifecycle`;
- `recordReleaseMetadata`.

The service owns event validation, pseudonymous identity, release/environment
properties, provider fan-out, and failure isolation. UI components never call a
provider SDK or diagnostic table directly.

## 12. Platform Admin dashboard

The protected `/admin` diagnostics section displays safe aggregates:

- release, environment, and Sentry/PostHog availability;
- recent safe operational failures from trusted provider adapters when
  available;
- most-used modules/actions, active Companies by selected period, account-kind
  usage, and peak periods;
- total/active/shared/private extensions, enabled Companies per extension,
  enabled-but-unused Companies, recently disabled assignments, controlled
  disablement reasons, extension failures, and provider last-used metrics;
- feature requests by classification/status and release records.

Empty, loading, retry, and provider-unavailable states are explicit. Aggregates
contain no task rows, task content, raw errors, email, or credentials. Company
accounts cannot access this section and Platform Admin queries never request
`tasks`.

## 13. Environment configuration

Only safe public configuration may use Vite variables:

- `VITE_SENTRY_DSN`;
- `VITE_POSTHOG_KEY`;
- `VITE_POSTHOG_HOST`;
- `VITE_APP_VERSION`;
- `VITE_APP_ENVIRONMENT`.

Provider read/admin secrets, Supabase service-role keys, and diagnostic write
secrets remain server-side. Missing configuration disables the corresponding
adapter and does not block login, registration, Todo, or extension use.

## 14. Development and test behavior

- Diagnostics are disabled by default for local development unless explicitly
  enabled.
- Test mode uses no-op or in-memory adapters and never sends real telemetry.
- Preview uses separate release/environment metadata and conservative sampling.
- Event tests inspect allowlisted payloads and forbidden-property rejection
  without network calls.

## 15. Failure handling

Provider initialization, capture, identity, and lifecycle-write failures are
swallowed after being reduced to a safe internal status. They must never fail a
login, registration, Todo mutation, Admin action, or extension render. The
dashboard reports provider unavailable/retryable states without exposing the
provider error body.

## 16. RLS and authorization

All diagnostic tables are RLS-enabled and forced. Platform Admins may read
platform-wide lifecycle, feature-request, and release records. Company
accounts may not read platform-wide diagnostics and have no unrestricted
diagnostic INSERT/UPDATE/DELETE privileges from the browser. Trusted server
infrastructure records lifecycle/release data after validating the actor and
safe fields.

If Company-scoped lifecycle reads are ever added, they must be limited to the
authenticated Company’s own `company_id`; this Phase does not expose them.
Platform Admin policies never grant task access, and no diagnostic policy
references or selects task content.

## 17. Acceptance criteria

1. Diagnostics are accessed through one service and adapters, not UI/provider
   calls scattered through modules.
2. Sentry and PostHog initialize safely with release/environment metadata and
   no forbidden payloads.
3. External identity is pseudonymous; logout clears it.
4. Required authentication, registration/licensing, Todo, Admin, and extension
   events are emitted with allowlisted metadata.
5. Extension enable/disable history preserves actor, timestamp, state, and a
   controlled disablement reason.
6. Feature requests and release records have the approved bounded lifecycle;
   the Admin view is read-only.
7. Diagnostics tables are RLS-protected; Companies cannot read platform data or
   write unrestricted diagnostics; Admin receives no task content.
8. Provider outages do not break core application actions.
9. Development and test modes send no real telemetry.
10. The Admin dashboard provides safe system, usage, extension, lifecycle, and
    request/release states with loading, empty, retry, and unavailable feedback.
11. No secrets, task content, raw licence data, tokens, headers, raw errors, or
    sensitive free text reaches telemetry or durable diagnostics.

## 18. Test plan

### Diagnostics service and adapters

- no-op behavior with providers disabled;
- Sentry scrubbing, release/environment, replay masking, and safe failure;
- PostHog explicit events, pseudonymous identity, logout reset, and no network
  calls in tests;
- forbidden-property rejection and safe metadata allowlisting;
- provider failures do not fail core actions.

### Usage integration

- login success/failure, logout, session restoration;
- registration/licence success/failure;
- Todo workspace and mutation events;
- Admin status/licence events;
- extension visibility, open, assignment, load, and action failures;
- no task content or licence secrets in any payload.

### Supabase lifecycle and RLS

- enable/disable rows preserve history and controlled reasons;
- Company cannot read platform lifecycle or feature-request data;
- Platform Admin can read safe records but no task rows;
- trusted writes reject invalid actor/reason/state values;
- rollback leaves no synthetic diagnostics data;
- all diagnostic tables have forced RLS and least-privilege grants.

### Dashboard

- loading, empty, retry, provider-unavailable, aggregate, lifecycle, and
  request/release states;
- Company route denied; Admin route does not query tasks;
- no sensitive content rendered.

## 19. Ordered implementation tasks

1. Confirm provider package/version choices, environment conventions, and the
   existing RLS/extension assignment model.
2. Finalize the diagnostics event allowlist, pseudonymous identity, release
   metadata, and no-op adapters.
3. Add Sentry and PostHog adapters with scrubbing/masking and provider-failure
   isolation.
4. Add the Supabase diagnostics migration, trusted write boundary, fixed
   controlled values, indexes, grants, and RLS policies.
5. Add the diagnostics service and integrate required events across auth,
   registration/licensing, Todo, Admin, and extensions.
6. Add the protected Admin diagnostics summaries and read-only lifecycle,
   feature-request, and release views.
7. Add unit, adapter, integration, dashboard, and transactional SQL tests.
8. Review bundles, telemetry payloads, provider settings, and RLS for secrets,
   task content, and cross-tenant access.
9. Run lint, typecheck, tests, build, Cloud migration/RLS verification, and the
   security advisor; update project status and stop before deployment.

## 20. Assumptions and unresolved decisions

### Resolved for this specification

- Sentry handles technical errors/traces/replay; PostHog handles explicit usage
  analytics; Supabase stores only platform-owned lifecycle/request/release
  history.
- Feature requests are modelled and shown read-only to Admin in Phase 8; no
  customer request workflow is built.
- Last-used extension time is a PostHog metric for this proof, not duplicated in
  the lifecycle table.
- Disablement reasons are controlled values with no free-text note.
- Diagnostics are optional and fail open for core product behavior.

### Unresolved before implementation

- Exact Sentry/PostHog package versions and whether provider aggregation uses a
  dedicated trusted Edge Function or an approved provider API integration.
- Exact hashing/namespace implementation for pseudonymous IDs and whether a
  server-only namespace value is required.
- Whether recent safe operational failures need the deferred `operational_events`
  table after provider aggregation is prototyped.
- Final release-record write trigger and release metadata source.
- Final deployment domain and cross-subdomain behavior remain Phase 9 decisions.
