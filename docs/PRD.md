# Multi-Tenant Todo SaaS

## Simple Product Requirements Document

## 1. Project Purpose

This project is a simple proof of concept for testing how one web application can serve multiple Companies.

The Todo functionality must remain basic.

The project should prove that:

* A Platform Admin can generate a licence key.
* A Company can register using the licence key.
* Each Company gets its own workspace.
* Each Company sees only its own tasks.
* One deployment serves all Companies.
* A developer can later add a customization for one or more Companies.
* Basic errors can be tracked.

This is not intended to be a complete task-management product.

---

## 2. Users

There are only two types of users.

### 2.1 Platform Admin

The Platform Admin manages the platform.

Route:

```text
/admin
```

The Platform Admin can:

* Log in
* Generate licence keys
* View licences
* View registered Companies
* Suspend or reactivate a Company
* View basic error information

### 2.2 Company

Each customer is represented as a Company.

A Company can:

* Register using a licence key
* Log in
* Access its workspace
* Create tasks
* View tasks
* Edit tasks
* Complete tasks
* Delete tasks
* Log out

There are no Company members, teams, roles, or invitations.

---

## 3. Application Routes

```text
/
→ redirect to /login

/login
→ Company login

/register
→ Company registration

/admin
→ Platform Admin area
```

Company workspaces use subdomains in production:

```text
alpha.todoapp.com
beta.todoapp.com
```

During local development, Company workspaces use a path on the single local
origin instead of a subdomain:

```text
http://localhost:5173/workspace/alpha
http://localhost:5173/workspace/beta
```

This keeps the login session on one browser origin locally, so no cross-origin
session handling is needed during development. The workspace slug is a routing
value in both forms; it is never the security boundary.

---

## 4. Licence Management

The Platform Admin generates a licence before a Company registers.

The licence form contains:

```text
Company Name
Expiry Date
Status
```

Licence statuses:

```text
Available
Redeemed
Expired
Revoked
```

The generated licence key is shown to the Platform Admin.

Example:

```text
TDO-7K9P-X4M2
```

A licence can only be used once.

After successful Company registration, the licence becomes:

```text
Redeemed
```

---

## 5. Company Registration

The registration form contains:

```text
Company Name
Company Email
Password
Workspace Slug
Licence Key
```

Example:

```text
Company Name: Alpha Limited
Company Email: alpha@example.com
Workspace Slug: alpha
```

After registration, the Company workspace becomes:

```text
alpha.todoapp.com
```

During local development:

```text
http://localhost:5173/workspace/alpha
```

The system must reject registration when:

* The licence is invalid
* The licence has expired
* The licence has been revoked
* The licence has already been used
* The workspace slug already exists
* The Company email already exists

---

## 6. Company Login

A Company logs in using:

```text
Company Email
Password
```

After login, the system redirects the Company to its workspace.

In production this is the Company subdomain:

```text
alpha.todoapp.com
```

Locally it is the workspace path on the same origin:

```text
http://localhost:5173/workspace/alpha
```

A Company must not be able to access another Company’s workspace.

---

## 7. Company Workspace

The Company workspace contains:

### Dashboard

The dashboard displays:

```text
Total Tasks
Pending Tasks
Completed Tasks
```

### Tasks

The Company can:

* Create a task
* View tasks
* Edit a task
* Mark a task as completed
* Mark a completed task as pending
* Delete a task

A task contains:

```text
Title
Description
Status
Created Date
```

No advanced task functionality is required.

---

## 8. Company Isolation

Every Company-owned record must include:

```text
company_id
```

Example:

```text
tasks
- id
- company_id
- title
- description
- status
- created_at
```

The database must ensure that:

```text
Company Alpha sees only Alpha tasks.
Company Beta sees only Beta tasks.
```

Changing the browser URL must not allow one Company to access another Company’s data.

---

## 9. Platform Admin Area

The Platform Admin area is available at:

```text
/admin
```

The Platform Admin can view:

### Licences

* Company name
* Licence prefix
* Expiry date
* Status

### Companies

* Company name
* Company email
* Workspace slug
* Status
* Registration date

### Company Actions

* Suspend Company
* Reactivate Company

### Basic Diagnostics

* Recent frontend errors
* Recent backend errors
* Affected Company
* Current application version

The Platform Admin should not automatically see private task descriptions.

---

## 10. Customizations

Customizations are created by developers in the codebase.

The Platform Admin does not create custom features from the admin dashboard.

Use two simple customization types.

### Shared Extension

A feature that can be used by more than one Company.

Example:

```text
Task Approval
```

### Private Extension

A feature used only by one Company.

Example:

```text
Alpha Custom Export
```

Do not create one extension folder for every Company.

Prefer one reusable feature with different Company configuration.

---

## 11. Simple Architecture

Use a modular monolith.

```text
React application
        ↓
Services
        ↓
Repositories
        ↓
Supabase
```

Use one:

```text
GitHub repository
Vercel project
Supabase project
PostgreSQL database
Application deployment
```

Do not use:

* Microservices
* Kubernetes
* Separate databases for every Company
* Separate deployments for every Company
* Separate Git branches for every Company
* Complex event systems
* Message queues
* Advanced billing
* Multiple Company users

---

## 12. Suggested Modules

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

Keep the folder structure simple.

Do not create unnecessary abstraction layers.

---

## 13. Database Tables

The first version needs only these main tables:

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

Do not create additional tables unless they are required.

---

## 14. Basic Diagnostics

The project should track only essential information.

For an error, record:

```text
company_id
page or service
error message
application version
timestamp
```

The Platform Admin should be able to see:

```text
Which Company was affected?
Was it a frontend or backend error?
Which application version caused it?
```

Advanced session replay, detailed analytics, and complex performance dashboards can be added later.

---

## 15. Deployment

Use:

```text
Vercel
→ web application

Supabase Cloud
→ authentication and database

GitHub Actions
→ lint, test and build
```

One deployment serves all Company subdomains.

Example:

```text
alpha.todoapp.com
beta.todoapp.com
gamma.todoapp.com
```

---

## 16. Local Development

Use:

```text
http://localhost:5173/login
http://localhost:5173/register
http://localhost:5173/admin
http://localhost:5173/workspace/alpha
http://localhost:5173/workspace/beta
```

Local development uses one origin only. Do not use subdomain hosts, `lvh.me`, or
any other local domain alias.

Create two test Companies:

```text
Alpha Limited
Beta Limited
```

Test that:

1. Alpha can register and log in.
2. Beta can register and log in.
3. Alpha sees only Alpha tasks.
4. Beta sees only Beta tasks.
5. Alpha cannot access Beta by changing the URL.
6. The Platform Admin can view both Companies.
7. A suspended Company cannot access its workspace.
8. One standard update reaches both Companies.

---

## 17. Development Approach

Development should be simple and phase-based.

### Phase 1: Foundation

* React and TypeScript setup
* Routing
* `/` redirect to `/login`
* Placeholder `/login`
* Placeholder `/register`
* Placeholder `/admin`
* Basic folder structure

### Phase 2: Database

* Companies table
* Licences table
* Tasks table
* Platform Admin table
* Company isolation

### Phase 3: Licensing and Registration

* Generate licence
* Register Company
* Redeem licence
* Create workspace slug

### Phase 4: Authentication

* Company login
* Platform Admin login
* Logout
* Suspended Company blocking

### Phase 5: Todo

* Dashboard
* Create task
* View tasks
* Edit task
* Complete task
* Delete task

### Phase 6: Admin

* View Companies
* View licences
* Suspend Company
* Reactivate Company
* View basic errors

### Phase 7: Simple Extension Test

* Create one shared extension
* Create one private extension
* Verify they affect only permitted Companies

### Phase 8: Deployment

* GitHub Actions
* Vercel deployment
* Supabase Cloud
* Company subdomains
* Production cross-subdomain session handling

---

## 18. Success Criteria

The project is successful when:

1. `/` redirects to `/login`.
2. The Platform Admin can log in at `/admin`.
3. The Platform Admin can generate a licence.
4. A Company can register using a valid licence.
5. The licence cannot be reused.
6. The Company receives a unique workspace slug.
7. The Company can log in.
8. The Company can create, edit, complete, and delete tasks.
9. Company data is isolated.
10. A suspended Company cannot access the workspace.
11. One application deployment serves multiple Company subdomains.
12. One shared extension can be used by multiple Companies.
13. One private extension can affect only one Company.
14. Basic errors can be linked to the affected Company.

---

## 19. Core Project Rule

```text
Keep the application small.

Build only what is required to prove:

- multi-company onboarding;
- licence registration;
- data isolation;
- one shared deployment;
- simple customizations;
- basic diagnostics.
```
