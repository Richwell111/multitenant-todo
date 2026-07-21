# Multi-Tenant Todo SaaS — Claude Code Instructions

## Project Purpose

This project is a small proof of concept for testing a multi-company SaaS architecture.

The Todo functionality must remain basic.

The project should prove:

* A Platform Admin can generate a licence.
* A Company can register using the licence.
* Each Company receives its own workspace.
* Each Company sees only its own data.
* One deployment serves all Companies.
* A feature can later be shared or customized for selected Companies.
* Basic errors can be linked to an affected Company.

Do not turn this into a full task-management product.

---

## Source of Truth

Before planning or implementing work, read:

```text
docs/PRD.md
CLAUDE.md
```

The PRD defines the approved product scope.

Specification authority: use only the canonical phase folders `specs/001-foundation` through `specs/008-deployment`. `specs/_archive` is historical and must not be used as implementation authority.

Do not add functionality that is not required by the PRD.

---

## Simplicity Rule

Always choose the simplest implementation that satisfies the requirements.

Avoid:

* unnecessary abstractions;
* unnecessary design patterns;
* premature optimization;
* microservices;
* message queues;
* event-driven architecture;
* multiple databases;
* multiple deployments;
* one branch per Company;
* one directory per Company;
* complex billing;
* teams and roles;
* functionality intended only for future phases.

Do not build future functionality early.

Do not introduce an abstraction unless it solves a current requirement.

---

## Product Rules

The required routes are:

```text
/
→ redirect to /login

/login
→ Company login

/register
→ Company registration using a licence

/admin
→ Platform Admin area

/workspace/:slug
→ Company workspace (local development)
```

Company workspaces use subdomains in production:

```text
alpha.todoapp.com
beta.todoapp.com
```

Local development uses one origin only:

```text
http://localhost:5173/login
http://localhost:5173/register
http://localhost:5173/admin
http://localhost:5173/workspace/alpha
```

Do not use `alpha.localhost`, `lvh.me`, or any other local domain alias. The
single local origin keeps the login session usable without cross-origin session
handling.

There is:

* no landing page;
* no Company Owner concept;
* one Company account per customer;
* one Platform Admin area;
* one shared application deployment;
* one shared PostgreSQL database.

---

## Version 1 Company Features

A Company can:

* register using a licence;
* log in;
* log out;
* access its workspace;
* create tasks;
* view tasks;
* edit tasks;
* complete tasks;
* return completed tasks to pending;
* delete tasks.

The dashboard contains only:

* total tasks;
* pending tasks;
* completed tasks.

Do not add advanced task functionality unless the PRD is updated.

---

## Version 1 Platform Admin Features

The Platform Admin can:

* log in;
* generate licences;
* view licences;
* view Companies;
* suspend a Company;
* reactivate a Company;
* view basic error information.

The Platform Admin does not create custom functionality from the admin interface.

Customizations are implemented by developers in the codebase.

---

## Licence Rules

A licence contains:

* Company name;
* expiry date;
* status.

Supported statuses:

```text
Available
Redeemed
Expired
Revoked
```

A licence:

* can be used only once;
* must be validated on the backend;
* becomes Redeemed after successful registration;
* must not be stored as a raw value in the database.

Store only a secure hash of the licence key.

The raw licence key may be shown once after generation.

---

## Company Isolation

Every Company-owned database row must include:

```text
company_id
```

Company isolation must be enforced by PostgreSQL Row Level Security.

The frontend must never be treated as the security boundary.

The subdomain identifies the requested workspace, but the backend and database must verify Company access.

Company Alpha must never access Company Beta data by:

* changing the URL;
* modifying a request;
* calling the API directly;
* manipulating frontend state.

---

## Architecture

Use a simple modular monolith.

Dependency direction:

```text
Routes and components
→ services
→ repositories
→ Supabase
```

Do not call Supabase directly from presentation components.

Do not create unnecessary architecture layers.

Suggested modules:

```text
auth
companies
licensing
tasks
platform-admin
extensions
diagnostics
```

Suggested structure:

```text
src/
├── modules/
│   ├── auth/
│   ├── companies/
│   ├── licensing/
│   ├── tasks/
│   ├── platform-admin/
│   ├── extensions/
│   └── diagnostics/
├── shared/
└── infrastructure/
```

Keep each module small.

Only create folders that are currently needed.

---

## Database Scope

The initial version requires only:

```text
platform_admins
companies
licences
tasks
```

Optional later tables:

```text
company_extensions
diagnostic_events
```

Do not create extra tables without a current requirement.

All database changes must use version-controlled migration files.

Do not manually change production database tables.

### Current backend direction

Supabase Cloud only.

Do not add local Supabase, Docker, self-hosted Supabase, offline mode, or cloud/local synchronization unless the PRD is explicitly changed.

---

## Extension Rules

Use two extension types:

### Shared extension

A feature that may be used by multiple Companies.

Example:

```text
Task Approval
```

### Private extension

A genuinely unique feature used by one Company.

Example:

```text
Alpha Custom Export
```

Do not create one extension folder per Company.

Use this decision order:

```text
Configuration
→ Shared extension
→ Private extension
→ Separate deployment
```

Do not duplicate an entire standard module for one Company.

Do not scatter checks such as this throughout the codebase:

```ts
if (companyId === "company-a") {
  // custom behaviour
}
```

Keep Company-specific behavior isolated.

---

## Diagnostics

Keep diagnostics basic.

For an application error, record:

```text
company_id
source
error message
application version
timestamp
```

The Platform Admin should be able to determine:

* which Company was affected;
* whether the error came from the frontend or backend;
* which application version was running.

Do not build advanced analytics, distributed tracing, or complex dashboards in the first version.

---

## Development Approach

Development is phase-based and specification-driven.

For each phase:

1. Read `docs/PRD.md`.
2. Define the exact phase scope.
3. Create a short specification.
4. Define measurable acceptance criteria.
5. Create a small ordered task list.
6. Implement only the approved phase.
7. Add relevant tests.
8. Run validation commands.
9. Report actual results.
10. Stop before starting the next phase.

Do not generate specifications containing unnecessary complexity.

A phase specification should be concise.

---

## Current Development Phases

```text
Phase 1: Foundation
Phase 2: Database
Phase 3: Licensing and Company Registration
Phase 4: Authentication
Phase 5: Todo
Phase 6: Platform Admin
Phase 7: Extension Test
Phase 8: Deployment
```

The current phase is:

```text
Phase 4: Authentication specification review
```

Phases 1 to 3 are implemented. Phase 3 also received one approved correction:
the Workspace Slug auto-fills from Company Name and stays editable.

`/login` is still the Phase 1 placeholder. It does not sign anyone in. That is
expected: real authentication is Phase 4 work.

Do not write authentication code until `specs/004-authentication/spec.md` is
approved.

Phase 4 includes:

* Company login at `/login`;
* Platform Admin login state at `/admin`;
* `signInWithPassword` with Supabase's normal browser session persistence;
* session restoration and logout;
* Platform Admin versus Company account detection;
* route guards, including suspended Companies;
* a placeholder protected `/workspace/:slug` route.

Phase 4 must not include:

* password reset or recovery;
* custom cookie or token storage;
* Todo CRUD or the dashboard;
* Platform Admin listings, suspension, or reactivation UI;
* extensions, diagnostics, or deployment.

---

## Testing Rules

Before marking work complete, run the relevant available commands:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Do not claim that a command passed unless it was actually executed.

Add tests only for current requirements.

Do not create large test frameworks for future functionality.

Tenant-isolation and RLS tests will be added when the database phase begins.

---

## Security Rules

Never:

* expose a Supabase service-role key in frontend code;
* hardcode secrets;
* commit `.env` files containing secrets;
* store raw licence keys;
* weaken RLS to solve an application bug;
* trust the subdomain alone;
* log passwords, tokens, or licence keys;
* expose private Company task content to the Platform Admin by default.

Use environment variables for configuration.

---

## Git Rules

Do not commit directly to `main`.

Use phase branches such as:

```text
phase/001-foundation
phase/002-database
phase/003-licensing-registration
```

Do not create branches per Company.

Do not commit or push unless explicitly instructed.

Before proposing a commit:

* show changed files;
* summarize the changes;
* report test results;
* mention unresolved issues.

Keep commits small and descriptive.

---

## Claude Code Working Rules

Before editing code:

1. Inspect the repository.
2. Read the PRD and this file.
3. State the current phase.
4. Explain which files will change.
5. Identify any assumptions.
6. Avoid changing files outside the phase scope.

During implementation:

* work in small steps;
* preserve existing working behavior;
* do not rewrite unrelated files;
* do not install unnecessary packages;
* do not implement future phases;
* update tests with the implementation.

After implementation:

* run the required validation commands;
* report actual results;
* list files changed;
* identify deviations from the specification;
* stop and wait for review.

---

## Core Instruction

```text
Keep the project small.

Build only what is required to prove:

- licence-based Company onboarding;
- Company workspaces;
- Company data isolation;
- one shared deployment;
- simple extensions;
- basic diagnostics.
```
