# Phase 4: Authentication - Specification

Status: **approved and implemented.**

## 1. Scope

Give the two existing account kinds a real session:

- Company login at `/login`.
- Platform Admin login, reached through `/admin`.
- `supabase.auth.signInWithPassword` as the only credential mechanism.
- Supabase's normal browser session persistence.
- Session restoration on page load, before any protected content renders.
- Logout for both account kinds.
- Account-kind detection: Platform Admin versus Company.
- Platform Admin lands on `/admin`; a Company lands on its workspace.
- A placeholder protected `/workspace/:slug` route.
- A Platform Admin is refused Company workspace routes.
- A Company is refused `/admin`.
- A suspended Company authenticates but is denied workspace access.
- Clear, non-enumerating invalid-credential errors.

No new table, no schema change, and no RLS change is expected. Phase 2 policies
and Phase 3 Edge Functions already provide everything this phase authorizes
against.

## 2. Out of scope

- Password reset, change, and recovery email. Platform Admin password recovery
  is handled out of band through the Supabase Dashboard, which is acceptable for
  this proof of concept.
- Custom cookie storage, custom token storage, and any token handling beyond
  what supabase-js does by default.
- Email confirmation, invitations, magic links, OAuth, MFA, custom SMTP.
- Sign-up from `/login`; registration remains the Phase 3 `/register` flow.
- Todo CRUD and the dashboard. `/workspace/:slug` renders a placeholder that
  Phase 5 replaces.
- Platform Admin listings, suspension UI, and reactivation UI.
- "Remember me", idle timeout, device management, session revocation UI.
- Server-side rendering, middleware, and `@supabase/ssr`. This stays a
  React/Vite single-page application.
- Production DNS, subdomain deployment, and cross-subdomain session handling,
  which belong to Phase 8.

## 3. Routes and hosts — approved design

### Local development: one origin

All local development uses `http://localhost:5173`. Subdomain hosts, `lvh.me`,
and every other local domain alias are excluded.

```text
http://localhost:5173/login             Company login
http://localhost:5173/register          Company registration (Phase 3)
http://localhost:5173/admin             Platform Admin area
http://localhost:5173/workspace/alpha   Company Alpha workspace
http://localhost:5173/workspace/beta    Company Beta workspace
```

Because the workspace is a path rather than a subdomain, the session established
at `/login` is already on the same browser origin as the workspace. This is the
entire reason for the path form: it removes cross-origin session handling from
Phase 4 rather than solving it.

### Production: subdomains

```text
https://todoapp.com/login
https://todoapp.com/register
https://todoapp.com/admin
https://<slug>.<configured-base-domain>
```

The base domain stays configurable through the existing
`VITE_WORKSPACE_BASE_DOMAIN` variable; `todoapp.com` is the illustrative value.

### Consequence for session persistence in production

Supabase's default browser persistence is `localStorage`, which is scoped to one
origin. Locally that is sufficient, because login and workspace share
`localhost:5173`. **In production, `todoapp.com` and `alpha.todoapp.com` are
different origins, so a session created at `todoapp.com/login` will not be
present on the workspace subdomain.** Phase 4 does not solve this, by decision.
It is recorded in §12 and belongs to Phase 8, which owns subdomain deployment.
Phase 4 is verified locally, where the single origin makes the flow complete and
testable end to end.

## 4. `buildWorkspaceUrl` — updated behaviour

[workspaceUrl.ts](src/modules/auth/workspaceUrl.ts) currently returns
`<slug>.localhost:<port>/login` for local hosts. Phase 4 changes it to:

| Environment | Result |
| --- | --- |
| Local (`localhost` / `127.0.0.1` / `::1`) | `http://localhost:5173/workspace/<slug>` |
| Production | `https://<slug>.<configured-base-domain>` |

The function keeps validating the slug through `validateWorkspaceSlug` and keeps
throwing on an invalid slug or a missing/invalid base domain. Its existing tests
are updated with it, including the Phase 3 registration redirect that already
depends on it. A local result is a path on the current origin, so it no longer
needs to construct a host at all.

Slugs remain routing values in both forms. A slug is never passed to a query as
an authorization argument; every read stays scoped by `auth.uid()` under RLS.

## 5. Session persistence — approved design

Use supabase-js's normal browser session persistence. No custom `storage`
adapter, no cookie code, no chunking, and no tokens in URLs, query strings, or
fragments.

The existing `getSupabaseClient` factory in
[client.ts](src/infrastructure/supabase/client.ts) keeps its default behaviour:
`persistSession` and `autoRefreshToken` remain on, and supabase-js manages
storage and refresh itself. Phase 4 adds no new environment variable for auth.

## 6. Account-kind detection — approved design

There is **no role column, no custom JWT claim, and no additional
account-mapping table.** Account kind is derived from which existing table owns
the authenticated user id, queried in this order:

```sql
-- 1. Platform Admin?
select id from public.platform_admins where id = auth.uid();

-- 2. otherwise, Company?
select id, name, slug, status from public.companies where id = auth.uid();
```

```text
platform_admins row exists  -> Platform Admin
otherwise companies row     -> Company
neither                     -> deny access and sign out
```

Both reads go through the existing Phase 2 RLS self-read policies, so a caller
can only ever resolve its own row and the answer is trustworthy. The
`platform_admins` query runs first and short-circuits; the `companies` query is
skipped for an admin.

A user with no record in either table is an orphaned Auth user — the residue
Phase 3 §9 describes when compensation fails. Access is denied and the session
is signed out. The same treatment applies to a user present in both tables,
which is an integrity fault rather than a valid state.

Detection runs once per session resolution and is cached in memory only.

## 7. Platform Admin setup

Phase 4 begins here, because no Platform Admin identity exists in Cloud today
and that is why Phase 3's `/admin` form could never be exercised end to end.

1. Create one Supabase Auth user manually in the Cloud dashboard.
2. Copy that user's UUID and insert the same UUID into `platform_admins` using
   the existing Phase 2 parameterized seed procedure.
3. Verify the two ids match and that the account resolves as a Platform Admin.

The password is chosen at setup time and typed by hand. **No credential, real
password, real email, or real UUID is committed to the repository, written into
a migration, put in `.env.example`, or included in any test fixture.** Tests use
synthetic runtime-only values.

If this password is lost, it is reset out of band through the Supabase
Dashboard. That is the accepted recovery path for this proof of concept.

## 8. Flows

### `/login` — Company login

1. A visitor opens `/login`.
2. They submit email and password; the form disables while pending.
3. `signInWithPassword` runs. On failure, §10's `INVALID_CREDENTIALS` is shown.
4. The account kind is resolved (§6).
5. A **Platform Admin** signing in here is redirected to `/admin`. The session is
   valid and is kept; only the destination changes.
6. A **suspended Company** is authenticated but denied workspace access: the
   session remains and `COMPANY_SUSPENDED` is shown with a logout control.
7. An **active Company** is redirected to its own workspace via
   `buildWorkspaceUrl`.

### `/admin` — Platform Admin login

`/admin` renders its own sign-in state when unauthenticated; no separate
`/admin/login` route is added. On success the account kind is resolved, and a
Company is refused with `ADMIN_ONLY`. A Platform Admin sees the existing Phase 3
licence generation form, which finally receives the JWT it has been missing.

### `/workspace/:slug` — placeholder protected route

A new protected route rendering a minimal placeholder: the Company name and a
logout control. It exists in Phase 4 only to prove the guard works. Phase 5
replaces the placeholder body with the Todo dashboard.

Admission requires an authenticated, active Company whose
`companies.slug` equals the `:slug` route parameter. The parameter is
compared against the value the database returned for `auth.uid()`; it is never
used to look a Company up.

### Session restoration

On load the app resolves the session before rendering protected content, showing
a neutral loading state. supabase-js refreshes tokens itself; an
`onAuthStateChange` subscription clears cached account state on `SIGNED_OUT` and
on refresh failure. Restoration re-runs §6 detection and the §9 guard, so a
Company suspended between visits loses workspace access on its next load.

### Logout

A logout control appears wherever an authenticated session renders, including
the suspended-Company and refusal states. It calls `supabase.auth.signOut()`,
clears cached account state, and returns the visitor to `/login` or `/admin`. A
failed network call still clears local state.

## 9. Access rules

| Route | Platform Admin | Company (own slug, active) | Company (suspended) | Company (other slug) | No session |
| --- | --- | --- | --- | --- | --- |
| `/login` | redirected to `/admin` | redirected to own workspace | `COMPANY_SUSPENDED` | n/a | login form |
| `/register` | unchanged Phase 3 form | unchanged Phase 3 form | unchanged | n/a | unchanged |
| `/admin` | admin area | `ADMIN_ONLY` | `ADMIN_ONLY` | `ADMIN_ONLY` | admin sign-in |
| `/workspace/:slug` | `WORKSPACE_FORBIDDEN` | placeholder workspace | `COMPANY_SUSPENDED` | `WORKSPACE_FORBIDDEN` | redirected to `/login` |

Notes:

- Blocking a Platform Admin from Company workspace routes is a product rule
  enforced in the route guard, not a database privilege change. Phase 2 already
  denies Platform Admins all task rows, and that stays true.
- Refusals keep the session and offer a logout control plus a link to the
  account's correct destination.
- A Company visiting another Company's workspace path learns nothing about
  whether that slug exists.
- Guards are UX. Every guard has a matching RLS rule already enforced in the
  database, so editing the URL changes nothing about what data is reachable.

## 10. Errors

| Code | Shown to user |
| --- | --- |
| `INVALID_CREDENTIALS` | Incorrect email or password. |
| `COMPANY_SUSPENDED` | This Company account is suspended. Contact support. |
| `ADMIN_ONLY` | This account cannot access the Platform Admin area. |
| `WORKSPACE_FORBIDDEN` | This account cannot access this workspace. |
| `ACCOUNT_INVALID` | This account is not set up correctly. Contact support. |
| `NETWORK_ERROR` | Sign-in could not be completed. Try again. |

A wrong password, an unknown email, and an unconfirmed user all return
`INVALID_CREDENTIALS`, so `/login` cannot be used to enumerate accounts. Raw
Supabase Auth messages, emails, tokens, and passwords are never rendered or
logged.

## 11. Security requirements

- Password fields use `type="password"` and `autoComplete="current-password"`;
  passwords are never held in state after submit, logged, or put in a URL.
- No token ever appears in a URL, query string, fragment, or log line.
- No service-role key and no new secret. `signInWithPassword` runs against the
  existing anon-key browser client.
- The suspended check reads `companies.status` from the database on every
  session resolution, never from cached client state.
- Enable Supabase Auth's built-in sign-in rate limiting; add no custom throttle.

## 12. Files expected to change

```text
src/modules/auth/LoginPage.tsx                 replace the Phase 1 placeholder
src/modules/auth/authRepository.ts             new: signIn, signOut, getSession, self-reads
src/modules/auth/authService.ts                new: account-kind resolution, guard decisions
src/modules/auth/AuthProvider.tsx              new: restoration + cached account state
src/modules/auth/loginSchemas.ts               new: email/password form validation
src/modules/auth/RequireCompany.tsx            new: workspace route guard
src/modules/auth/workspaceUrl.ts               local path form, production subdomain
src/modules/auth/workspaceUrl.test.ts          updated for the new local form
src/modules/companies/WorkspacePage.tsx        new: Phase 5 placeholder
src/modules/platform-admin/AdminPage.tsx       sign-in state + logout; form otherwise unchanged
src/App.tsx                                    /workspace/:slug route + guards
docs/project-status.md                         phase result
focused *.test.ts / *.test.tsx
```

`src/infrastructure/supabase/client.ts` is **not** expected to change: default
session persistence is used as is. No new environment variable is added.

Component → service → repository → Supabase is preserved. `LoginPage`,
`AdminPage`, and `WorkspacePage` never touch the Supabase client directly.

## 13. Required tests

1. **Platform Admin detection** — a user with a `platform_admins` row resolves as
   Platform Admin.
2. **Company detection** — a user with a `companies` row and no admin row
   resolves as Company.
3. **Neither-record denial** — a user in neither table is denied and signed out.
4. **Company blocked from `/admin`** — refused with `ADMIN_ONLY`, no admin data
   rendered.
5. **Platform Admin blocked from `/workspace/:slug`** — refused with
   `WORKSPACE_FORBIDDEN`, still no task rows.
6. **Cross-Company workspace blocked** — Alpha cannot open
   `/workspace/beta`.
7. **Suspended Company blocked** — authenticates, then is denied workspace
   access with `COMPANY_SUSPENDED`.
8. **Session persists across a reload** — an authenticated page reload restores
   the session without re-entering credentials, and the workspace stays
   reachable on the same origin.
9. **Logout clears the session** — after `signOut`, no session remains and
   back-navigation does not restore the workspace.
10. **Invalid credentials show a safe error** — `INVALID_CREDENTIALS` only, with
    no distinction between an unknown email and a wrong password, and no raw
    Supabase message surfaced.
11. **`buildWorkspaceUrl`** — local produces `/workspace/<slug>` on
    `localhost:5173`; production produces `https://<slug>.<base-domain>`;
    invalid slug and missing base domain still throw.

Supporting coverage: form validation, pending state, duplicate-submit
prevention, and the loading state during restoration. Auth calls are mocked;
unit and component tests never contact Cloud.

Cloud verification, with runtime-only synthetic accounts deleted afterwards:
real Platform Admin sign-in plus end-to-end licence generation; Company sign-in
and workspace admission; suspended-Company refusal; cross-workspace refusal.

Commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
and a rerun of `supabase/tests/isolation.sql`.

## 14. Acceptance criteria

1. A Company with correct credentials reaches `/workspace/<own-slug>` with a
   live session; a wrong password yields `INVALID_CREDENTIALS`.
2. A Platform Admin signing in at `/admin` can generate a licence end to end —
   the Phase 3 gap this phase exists to close.
3. A Platform Admin at `/login` is redirected to `/admin`.
4. A Company at `/admin` is refused with `ADMIN_ONLY` and gains no admin data.
5. A Platform Admin at `/workspace/:slug` is refused with `WORKSPACE_FORBIDDEN`
   and still sees no task rows.
6. Company Alpha cannot open Beta's workspace path, by URL or by request.
7. A suspended Company authenticates but is denied workspace access, and a
   Company suspended mid-session loses access on its next resolution.
8. Reloading an authenticated page restores the session; logout ends it and
   back-navigation does not restore it.
9. No token appears in any URL, and no error distinguishes an unknown email from
   a wrong password.
10. `buildWorkspaceUrl` produces the local path form and the production
    subdomain form, and its updated tests pass.
11. Phase 1 routing, Phase 3 slug/registration, and Phase 2 isolation tests all
    still pass.

## 15. Remaining unresolved decisions

1. **Production cross-subdomain session.** With default `localStorage`
   persistence, a session created at `todoapp.com/login` will not exist at
   `alpha.todoapp.com`. Local development is unaffected because it uses one
   origin. Phase 8 must choose how production handles this — a parent-domain
   cookie adapter, sign-in on the workspace subdomain, or serving the workspace
   as a path in production too. **Nothing about Phase 4 should be treated as
   proving the production subdomain flow.**
2. **Production base domain value.** `todoapp.com` is illustrative; the real
   value is supplied through `VITE_WORKSPACE_BASE_DOMAIN` at deployment.
3. **Phase 3 registration redirect - resolved.** Registration navigates exactly
   to `/login` with a transient success message. It does not create a browser
   session; the Company signs in separately.
4. **Workspace placeholder content.** Phase 4 renders the Company name and a
   logout control only. Confirm nothing more is expected before Phase 5.
