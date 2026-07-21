# Phase 2: Database — Specification

## 1. Scope

Define and provision the database foundation on **Supabase Cloud** for the multi-tenant Todo SaaS:

- Supabase Cloud project requirements and connection env vars.
- Four core tables: `platform_admins`, `companies`, `licences`, `tasks`.
- Primary keys, foreign keys, and `company_id` on every Company-owned record.
- The authenticated-account → `company_id` mapping used by isolation.
- Row Level Security (RLS) enabled on all four tables.
- Policies that let a Company read/write only its own tasks.
- Platform Admin access boundaries (no automatic access to task content).
- Basic indexes for isolation and dashboard counts.
- Version-controlled migration structure (Supabase CLI, pushed to Cloud).
- Seed strategy for one Platform Admin.
- Test strategy proving Company isolation.

This phase produces the **specification only**. Migrations and code are implemented in a later step, after review.

## 2. Out of scope

- Local Supabase, Docker, self-hosting, offline setup.
- UI implementation and real login flows.
- Licence generation UI and redemption logic (Phase 3).
- Company registration implementation (Phase 3).
- Todo pages or CRUD (Phase 5).
- Extensions and diagnostics tables (`company_extensions`, `diagnostic_events`).
- Deployment (Phase 8).
- Separate Postgres schemas beyond the default `public` (+ Supabase-managed `auth`).
- Roles, teams, or multiple users per Company.

## 3. Data model

One shared PostgreSQL database. All application tables live in `public`. Authentication is handled by Supabase Auth (`auth.users`); passwords are never stored in application tables.

### platform_admins
| column | type | notes |
| --- | --- | --- |
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| email | text | NOT NULL, UNIQUE (mirror of the auth email) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### companies
| column | type | notes |
| --- | --- | --- |
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| name | text | NOT NULL |
| email | text | NOT NULL, UNIQUE |
| slug | text | NOT NULL, UNIQUE (workspace subdomain slug) |
| status | text | NOT NULL, DEFAULT `'active'`, CHECK IN (`'active'`,`'suspended'`) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### licences
| column | type | notes |
| --- | --- | --- |
| id | uuid | PK, DEFAULT gen_random_uuid() |
| company_name | text | NOT NULL (name entered when the licence is generated) |
| key_hash | text | NOT NULL, UNIQUE (secure hash of the licence key — raw key never stored) |
| key_prefix | text | NOT NULL (e.g. `TDO-7K9P`, shown to the admin for identification) |
| status | text | NOT NULL, DEFAULT `'available'`, CHECK IN (`'available'`,`'redeemed'`,`'expired'`,`'revoked'`) |
| expires_at | timestamptz | NOT NULL |
| redeemed_by_company_id | uuid | NULL, FK → `companies(id)` (set on redemption in Phase 3) |
| redeemed_at | timestamptz | NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

### tasks
| column | type | notes |
| --- | --- | --- |
| id | uuid | PK, DEFAULT gen_random_uuid() |
| company_id | uuid | NOT NULL, FK → `companies(id)` ON DELETE CASCADE |
| title | text | NOT NULL |
| description | text | NULL |
| status | text | NOT NULL, DEFAULT `'pending'`, CHECK IN (`'pending'`,`'completed'`) |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

## 4. Relationships

```text
auth.users 1─1 platform_admins        (platform_admins.id = auth.users.id)
auth.users 1─1 companies              (companies.id = auth.users.id)
companies  1─* tasks                  (tasks.company_id → companies.id)
companies  0/1─* licences             (licences.redeemed_by_company_id → companies.id)
```

- Each Platform Admin account is exactly one `auth.users` row.
- Each Company account is exactly one `auth.users` row (one account per customer).
- Every task belongs to exactly one Company via `company_id`.
- A licence, once redeemed, points at the Company that redeemed it.

## 5. Authenticated account to company_id mapping

The mapping is **identity**: a Company's primary key equals its Supabase Auth user id.

```text
companies.id = auth.users.id = auth.uid()
```

Therefore `company_id` on a task is the same UUID as the owning account's `auth.uid()`. RLS needs no lookup table or join to resolve the tenant — it compares `tasks.company_id = auth.uid()` directly. The same pattern applies to `platform_admins.id = auth.uid()`.

A caller is classified by which table their `auth.uid()` appears in:
- appears in `companies` → a Company (tenant) user;
- appears in `platform_admins` → a Platform Admin;
- appears in neither → an ordinary/anonymous authenticated user with no access.

No privileged helper function is needed. Admin policies check for the caller's own RLS-visible row in `platform_admins` with `EXISTS`.

## 6. RLS rules

RLS is **enabled and forced** on all four tables. Policies target `authenticated` explicitly. Default posture is deny; `anon` receives no table privileges or policies, and every authenticated access path below is explicit.

### tasks (tenant-owned content — admins get nothing)
- SELECT / INSERT / UPDATE / DELETE allowed only when `company_id = (select auth.uid())` and the matching `companies` row has `status = 'active'`.
- INSERT/UPDATE use the same condition in `WITH CHECK`, so a Company cannot write rows for another Company or continue writing while suspended.
- **No Platform Admin policy** — admins have no route to task titles/descriptions.

### companies
- SELECT: `id = (select auth.uid())` OR the caller has its own visible `platform_admins` row (a Company reads its own row; an admin reads all).
- UPDATE: only a caller with its own visible `platform_admins` row may target Company rows. Privileges are restricted to `UPDATE (status)` so an admin cannot change other Company columns. Companies do not edit their profile in v1.
- INSERT: no direct policy for anon/companies; registration writes through an elevated path (Phase 3, see Assumptions).

### licences
- SELECT / INSERT / UPDATE: only a caller with its own visible `platform_admins` row.
- DELETE: no policy; licence history is retained.
- Companies have **no** direct licence access; registration-time validation and redemption run through a narrowly scoped trusted server path in Phase 3.

### platform_admins
- SELECT: `id = (select auth.uid())` (an admin may read only their own row and support the admin checks above).
- No INSERT/UPDATE/DELETE policy (managed via seed / service role).

The migration must set explicit table and column privileges matching these operations. RLS controls rows, not columns or whether a role may invoke an operation.

## 7. Platform Admin access boundaries

- The Platform Admin can read `companies` and `licences` (management views).
- The Platform Admin can update `companies.status` (suspend / reactivate).
- The Platform Admin **cannot** read `tasks` rows — no SELECT policy grants it, so private task content is never exposed by default.
- A suspended Company can still read its own `companies` row for status handling but cannot read or write tasks.
- Any future admin visibility into task metadata must be an explicit, separate, reviewed policy — not a default.
- The `service_role` key bypasses RLS entirely and is therefore restricted to migrations, seeds, and trusted server-side scripts; it is never shipped to the browser.

## 8. Required indexes

- `tasks (company_id, status)` — covers tenant filtering, the `tasks.company_id` foreign key access path, and dashboard counts. A separate `tasks (company_id)` index would be redundant.
- `companies (slug)` UNIQUE — subdomain resolution (constraint-backed).
- `companies (email)` UNIQUE — duplicate-email rejection (constraint-backed).
- `licences (key_hash)` UNIQUE — licence lookup by hash (constraint-backed).
- `licences (redeemed_by_company_id)` — indexes the nullable foreign key used for redemption history.

## 9. Migration plan

Migrations are authored as SQL files under `supabase/migrations/` (Supabase CLI), committed to git, and applied to the Cloud project with `supabase db push`. No local database engine is required to author or push them.

Ordered migrations (create each filename with `supabase migration new <name>`; the CLI supplies its timestamp prefix):
1. `*_core_tables.sql` — create `platform_admins`, `companies`, `licences`, `tasks` with PKs, FKs, and CHECK constraints.
2. `*_indexes.sql` — the non-constraint indexes from §8.
3. `*_rls.sql` — explicit privileges, `ENABLE`/`FORCE` RLS on all four tables, and all policies from §6.

Seed lives separately (see §10) and is not part of the schema migrations.

## 10. Seed plan

Goal: one working Platform Admin account, with no secrets committed.

1. Create the admin **auth user** in Supabase Cloud (dashboard "Add user", or a one-off script using the service-role key) with a known email and a password supplied out-of-band.
2. Run `supabase/seed.sql`, which links that auth user into `platform_admins` by email:

   ```sql
   insert into public.platform_admins (id, email)
   select id, email from auth.users where email = :'admin_email'
   on conflict (id) do nothing;
   ```

- No Company or licence seed data in this phase (created via Phase 3 flows).
- The admin email is passed as a psql variable / env value, not hardcoded in the repo. The password is never stored in the repo.

## 11. Environment variables

Frontend (Vite — safe to expose, `VITE_` prefixed):
- `VITE_SUPABASE_URL` — Cloud project URL.
- `VITE_SUPABASE_ANON_KEY` — anon public key (RLS still applies).

Server/tooling only (never `VITE_`-prefixed, never in client bundle, never committed):
- `SUPABASE_SERVICE_ROLE_KEY` — for seeds/admin scripts (bypasses RLS).
- `SUPABASE_PROJECT_REF` — for `supabase link`.
- `SUPABASE_DB_PASSWORD` — for `supabase db push`.
- `SUPABASE_ACCESS_TOKEN` — for the Supabase CLI.

A committed `.env.example` documents names only (no values). Real values live in an uncommitted `.env` / CI secrets.

## 12. Acceptance criteria

1. A Supabase Cloud project exists and connection env vars are documented in `.env.example`.
2. All four tables exist with the columns, PKs, FKs, and CHECK constraints in §3.
3. Every task row carries a non-null `company_id` referencing `companies(id)`.
4. RLS is enabled (and forced) on all four tables, and role/table privileges match §6.
5. `companies.id` and `platform_admins.id` reference `auth.users(id)`.
6. An active signed-in Company can SELECT/INSERT/UPDATE/DELETE only tasks where `company_id = auth.uid()`.
7. A signed-in Company cannot read or write another Company's tasks by any request.
8. A suspended Company cannot read or write tasks.
9. An anonymous (unauthenticated) caller can read no application rows.
10. A Platform Admin can read `companies` and `licences` and update only `companies.status`.
11. A Platform Admin receives zero rows when selecting `tasks`.
12. The indexes in §8 exist.
13. Migrations apply cleanly to a fresh Cloud project via `supabase db push`.
14. The seed links exactly one Platform Admin to an existing `auth.users` row.

## 13. Test plan

Isolation is verified at the database layer by simulating each caller's JWT claims in a SQL session and asserting visible rows. Example matrix (run via `psql`/CLI against the Cloud DB or a disposable verification project):

Setup: two Company auth users **Alpha** and **Beta** (with matching `companies` rows) and one **Admin**; a few tasks per Company; one licence.

| Simulated caller | `set request.jwt.claims` role/sub | tasks visible | companies visible | licences visible |
| --- | --- | --- | --- | --- |
| Alpha | authenticated, sub = Alpha id | only Alpha's | own row | none |
| Beta | authenticated, sub = Beta id | only Beta's | own row | none |
| Admin | authenticated, sub = Admin id | **0 rows** | all | all |
| Suspended Company | authenticated, sub = suspended Company id | **0 rows** | own row | none |
| Anonymous | anon | 0 rows | 0 rows | 0 rows |

Assertions:
1. Alpha selecting tasks returns only Alpha rows; Beta only Beta rows.
2. Alpha inserting a task with `company_id` = Beta's id is rejected by the `WITH CHECK`.
3. Admin selecting `tasks` returns 0 rows (no task-content access).
4. Admin can select `companies` and `licences` and update a company's `status`.
5. Admin cannot update any Company column other than `status`.
6. A suspended Company cannot select, insert, update, or delete tasks.
7. Anonymous selects return 0 rows on all tables.

These checks are captured as a repeatable SQL script (e.g. `supabase/tests/isolation.sql`). Automated CI wiring for them is deferred; the script is runnable on demand this phase.

## 14. Ordered implementation tasks

1. Create the Supabase Cloud project; record URL and keys.
2. Add `.env.example` with the names from §11; wire real values into local `.env` / CI secrets.
3. Initialize Supabase CLI in the repo and `supabase link` to the Cloud project.
4. Use `supabase migration new` to create and write the core-tables migration (four tables + constraints).
5. Create and write the indexes migration.
6. Create and write the RLS migration (privileges, enable/force RLS, policies).
7. `supabase db push` to apply migrations to Cloud.
8. Create the Platform Admin auth user; run `supabase/seed.sql` to link it.
9. Write `supabase/tests/isolation.sql` and run the §13 matrix.
10. Record actual results; stop for review.

## 15. Assumptions and unresolved decisions

- **Mapping choice (confirmed for v1):** `companies.id = auth.users.id`. This is the simplest safe mapping for one account per Company and gives direct RLS ownership checks without another table or join. Registration must prevent an auth account from also being inserted into `platform_admins`; multi-user Companies would require revisiting this design.
- **Registration insert path:** creating the auth user, Company row, and redeemed licence must run through one narrowly scoped atomic trusted server operation in Phase 3. Whether that is a server-side service-role function or a hardened database RPC remains unresolved; no service-role credential may reach the browser.
- **Licence hashing:** the hash algorithm (proposed: SHA-256 of the raw key) and `key_prefix` format are finalized in Phase 3 generation; Phase 2 only reserves `key_hash` (unique) and `key_prefix`.
- **Company status values (confirmed):** `active` / `suspended` only.
- **Licence expiry timestamp (confirmed):** `expires_at` uses `timestamptz`. Phase 3 must define the displayed timezone/date-entry conversion consistently.
- **Licence expiry transition:** whether `available → expired` is computed on read or set by a scheduled job is deferred to Phase 3/6; Phase 2 stores the status and `expires_at` only.
- **Isolation tests** are SQL scripts run on demand this phase; turning them into automated CI checks is deferred (aligns with CLAUDE.md deferring RLS test automation to the database phase's follow-up).
