# Phase 3: Licensing and Company Registration - Specification

## 1. Scope

Implement the smallest secure Phase 3 flow on Supabase Cloud:

- An authenticated Platform Admin generates a licence from Company Name,
  Expiry Date, and initial Status.
- A cryptographically random licence key is returned once. Only its SHA-256
  hash and display prefix are stored.
- A Company registers with Company Name, Company Email, Password, Workspace
  Slug, and Licence Key.
- Trusted server-side logic creates the Supabase Auth user, inserts the
  `companies` row, and redeems the licence.
- The Company row and licence redemption are one PostgreSQL transaction.
- If database registration fails after Auth user creation, the new Auth user
  is removed when it is safe to do so.
- Successful registration redirects to the Company's workspace subdomain.

The existing four tables remain the complete data model. No extra table is
required.

## 2. Out of scope

- Company or Platform Admin login flows, sessions, logout, and password reset.
- Email confirmation, invitations, and custom SMTP.
- Todo CRUD and dashboard functionality.
- Platform Admin Company listing, suspension, or reactivation.
- Licence listing, editing, revocation UI, or raw-key recovery.
- Multiple Company users, teams, roles, billing, analytics, extensions, and
  diagnostics integrations.
- Production domain/DNS configuration and deployment.
- Local Supabase, Docker, or self-hosting.

## 3. User flows

### Generate a licence

1. An existing authenticated Platform Admin opens `/admin`.
2. The admin enters Company Name, Expiry Date, and initial Status.
3. The client calls the authenticated `generate-licence` Edge Function.
4. The function verifies that the caller has their own `platform_admins` row.
5. It validates the input, generates and hashes a key, and inserts the licence
   through the caller-scoped Supabase client so existing RLS remains active.
6. The response displays the raw key once with a copy action and a warning that
   it cannot be recovered. The raw key is not persisted in browser storage.

### Register a Company

1. A visitor opens `/register` and submits all five registration fields.
2. The public `register-company` Edge Function validates and normalizes input.
3. It hashes the supplied key and performs a read-only preflight using its
   server-only Supabase secret key. This avoids creating an Auth user for an
   obviously invalid request.
4. It creates the Auth user with the normalized email and supplied password.
5. It calls one restricted database RPC that repeats authoritative validation,
   locks the licence, inserts the Company, and redeems the licence atomically.
6. On success, the client discards the password and licence key and redirects
   to the workspace subdomain. Phase 3 does not create a session; the existing
   root redirect takes the visitor to that workspace's `/login` route.

## 4. Data flow

```text
Admin browser + user JWT
  -> generate-licence Edge Function
  -> caller-scoped RLS authorization
  -> licences { company_name, key_hash, key_prefix, status, expires_at }
  <- one response containing the raw key

Registration browser
  -> register-company Edge Function
  -> normalize + SHA-256 hash + database preflight
  -> Supabase Auth admin.createUser
  -> service-role-only registration RPC
       -> lock licence row
       -> insert companies row
       -> update licence to redeemed
  <- workspace slug
  -> workspace subdomain
```

Passwords are sent only over HTTPS to the Edge Function and then to Supabase
Auth. Raw licence keys exist only in the generation response, registration
request, and short-lived function memory.

## 5. Security design

- Use two Supabase Edge Functions because generation and registration have
  different authentication requirements.
- `generate-licence` requires a valid user JWT and verifies the caller through
  the non-recursive `platform_admins` self-read policy before generating a key.
- `register-company` is necessarily public because the Company has no account
  yet. Possession of a valid high-entropy, unused licence is the registration
  capability. Invalid keys must not create Auth users.
- Use the current Supabase server-only secret API key in the registration Edge
  Function. It must live in Supabase Function secrets, never a `VITE_` variable,
  response, log, URL, or repository file. It executes database requests as the
  `service_role` role and bypasses RLS.
- Use a separate privileged Supabase client that cannot inherit a caller's
  session or Authorization header.
- Keep all existing table RLS and privileges unchanged. Neither `anon` nor
  `authenticated` receives direct Company-insert or licence-redemption access.
- The database registration function is `SECURITY INVOKER`, uses fully
  qualified object names with a fixed empty `search_path`, and is executable
  only by `service_role`. Revoke EXECUTE from `PUBLIC`, `anon`, and
  `authenticated` explicitly.
- Do not put credentials, raw keys, passwords, hashes, or full request bodies in
  logs. A generated request/correlation ID may be logged with sanitized codes.
- Return `Cache-Control: no-store` for both endpoints, especially the response
  that contains the raw key.
- Accept only `POST` and required CORS preflight requests; reject oversized or
  malformed JSON before privileged work.

## 6. Licence key format

Canonical format:

```text
TDO-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
```

- Each `X` is an uppercase hexadecimal character (`0-9`, `A-F`).
- The 32 hexadecimal characters encode 16 bytes (128 bits) generated with Web
  Crypto `crypto.getRandomValues`; `Math.random` is forbidden.
- Registration trims surrounding whitespace, converts letters to uppercase,
  and then requires the exact canonical pattern. Internal characters are not
  removed or repaired.
- `key_prefix` is `TDO-` plus the first eight hexadecimal characters, for
  example `TDO-7F3A91BC`. It is an identifier, not a secret or lookup key.
- A hash collision or unique-constraint collision during generation causes a
  fresh key to be generated, with at most three attempts before a generic
  server error.

## 7. Licence hashing design

- Canonicalize the key as defined above, encode it as UTF-8, and calculate
  SHA-256 with Web Crypto.
- Store the lowercase 64-character hexadecimal digest in `licences.key_hash`.
- Query licences only by the digest; never query or log the raw key.
- No salt or server-side pepper is required: the key already has 128 bits of
  random entropy, and deterministic hashing is needed for indexed lookup.
- Include fixed hash test vectors so generation and registration cannot drift.

## 8. Registration mechanism

Selected mechanism: a Supabase Edge Function orchestrating Supabase Auth and a
narrow PostgreSQL RPC.

The RPC, provisionally named `public.complete_company_registration`, accepts:

```text
auth_user_id uuid
company_name text
company_email text
workspace_slug text
licence_key_hash text
```

It must:

1. Run as `SECURITY INVOKER` and be callable only by `service_role`.
2. Reject an Auth user already present in `platform_admins` or `companies`.
3. Select the matching licence `FOR UPDATE` to serialize competing redemption.
4. Repeat all licence, expiry, Company Name, email, and slug checks.
5. Insert `companies.id = auth_user_id` with status `active`.
6. Update the same licence to `redeemed`, set
   `redeemed_by_company_id = auth_user_id`, and set `redeemed_at = now()`.
7. Return a small result code and workspace slug; never return the hash.

The Edge Function uses `auth.admin.createUser` with `email_confirm: true` because
email confirmation is not part of Version 1. It does not return a session or
automatically sign in the new Company.

## 9. Atomicity and rollback strategy

Supabase Auth administration and PostgreSQL cannot share one transaction.
Atomicity is therefore divided deliberately:

- The Company insert and licence update occur inside one RPC call and one
  PostgreSQL transaction. Any exception rolls back both changes.
- `FOR UPDATE` ensures only one concurrent request can redeem a licence.
- Existing unique constraints remain authoritative for Company email, slug,
  and licence hash races.
- The Edge Function creates the Auth user only after preflight succeeds, then
  compensates if the database transaction fails.

Cleanup rules after Auth user creation:

1. For a definite business rejection or rolled-back RPC, hard-delete the exact
   newly created Auth user by returned UUID.
2. For a timeout or ambiguous RPC response, first query by that UUID. If both
   the Company and matching redemption exist, treat registration as successful.
3. If neither exists, hard-delete the new Auth user.
4. If state is inconsistent or Auth deletion fails, return
   `REGISTRATION_INCOMPLETE`, log only the request ID and Auth user UUID, and
   require trusted operator cleanup. Do not expose internal details or retry a
   destructive action indefinitely.

A process crash between Auth creation and compensation can still leave an Auth
user without a Company; cross-service absolute atomicity is impossible. Such a
user has no Company row and therefore no application access under current RLS.

## 10. Validation rules

### Licence generation

- Company Name: Unicode NFKC, trim and collapse internal whitespace; 1-200
  characters after normalization.
- Expiry Date: strict `YYYY-MM-DD`; today or a future UTC date.
- Initial Status: `available` or `revoked` only. `redeemed` and `expired` are
  system-managed states.
- An expiry date is inclusive. Store `expires_at` as 00:00:00 UTC on the next
  calendar day; a licence is expired when `now() >= expires_at`.

### Company registration

- Company Name: same normalization and limit as generation. It must equal the
  licence Company Name after case-insensitive normalized comparison. Store the
  licence's canonical Company Name in `companies.name`.
- Company Email: trim and lowercase before Auth and database use; require a
  syntactically valid email and rely on Supabase Auth plus the database unique
  constraint for authoritative uniqueness.
- Password: must satisfy the Supabase Auth project's configured password policy.
  It is never normalized, persisted by application code, or logged.
- Workspace Slug: trim and lowercase; 3-63 ASCII characters; start and end with
  a letter or digit; contain only letters, digits, and single hyphens; reject
  consecutive hyphens and the `xn--` prefix.
- Reserved slugs: `admin`, `api`, `app`, `assets`, `auth`, `login`, `register`,
  `status`, `support`, and `www`. Keep this one shared constant used by client,
  Edge Function, and tests; the Edge Function is authoritative.
- Licence Key: exact canonical format after trim/uppercase.
- Licence: matching hash exists; stored status is exactly `available`;
  redemption fields are null; and `now() < expires_at`.
- Expiry is evaluated from `expires_at` at use time. Phase 3 does not add a
  scheduler or mutate an otherwise `available` licence merely because time
  passed.
- A `revoked`, `redeemed`, `expired`, missing, or internally inconsistent
  licence cannot register a Company.

## 11. Error handling

Use stable codes with short user-safe messages:

| Code | HTTP | Meaning shown to user |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Correct the highlighted fields. |
| `UNAUTHENTICATED` | 401 | Platform Admin authentication is required. |
| `FORBIDDEN` | 403 | This account is not a Platform Admin. |
| `INVALID_LICENCE` | 422 | The licence key is invalid. |
| `LICENCE_EXPIRED` | 422 | The licence has expired. |
| `LICENCE_UNAVAILABLE` | 422 | The licence is revoked, redeemed, or unavailable. |
| `COMPANY_NAME_MISMATCH` | 422 | Company Name does not match the licence. |
| `EMAIL_IN_USE` | 409 | The Company email is already registered. |
| `SLUG_IN_USE` | 409 | The workspace slug is unavailable. |
| `RESERVED_SLUG` | 400 | Choose another workspace slug. |
| `REGISTRATION_INCOMPLETE` | 500 | Registration could not be completed; contact support with the request ID. |
| `INTERNAL_ERROR` | 500 | The request could not be completed. |

Do not return database messages, constraint details, stack traces, Auth provider
responses, hashes, credentials, or the submitted licence key. Missing, malformed,
and non-matching hashes must not reveal database contents.

## 12. Edge Function contracts

### `POST /functions/v1/generate-licence`

Authentication: valid Platform Admin user JWT.

Request:

```json
{
  "companyName": "Alpha Limited",
  "expiryDate": "2026-12-31",
  "status": "available"
}
```

Success (`201`):

```json
{
  "licence": {
    "id": "generated-uuid",
    "companyName": "Alpha Limited",
    "keyPrefix": "TDO-7F3A91BC",
    "status": "available",
    "expiresAt": "2027-01-01T00:00:00.000Z"
  },
  "licenceKey": "shown-only-in-this-response"
}
```

### `POST /functions/v1/register-company`

Authentication: no user JWT; the one-time licence is the capability. The
function must be deployed with gateway JWT verification disabled and perform
all validation internally.

Request:

```json
{
  "companyName": "Alpha Limited",
  "companyEmail": "alpha@example.com",
  "password": "request-only-value",
  "workspaceSlug": "alpha",
  "licenceKey": "request-only-value"
}
```

Success (`201`):

```json
{
  "company": {
    "name": "Alpha Limited",
    "email": "alpha@example.com",
    "workspaceSlug": "alpha"
  }
}
```

Errors use:

```json
{
  "code": "STABLE_ERROR_CODE",
  "message": "Safe user-facing message",
  "fieldErrors": {},
  "requestId": "non-secret-correlation-id"
}
```

## 13. UI requirements

- Replace only the relevant `/admin` and `/register` placeholders.
- Components call services, services call repositories, and repositories invoke
  Supabase Edge Functions. Presentation components do not access Supabase
  directly.
- Admin form: Company Name, Expiry Date, Status (`Available` default or
  `Revoked`), submit state, field errors, and one-time key result.
- The result provides Copy and Dismiss actions and explicitly says the key
  cannot be recovered. Do not put it in a URL, local/session storage, cookies,
  query caches, or analytics.
- Registration form: Company Name, Company Email, Password, Workspace Slug,
  Licence Key, submit state, accessible field errors, and safe form-level error.
- Disable duplicate submits while a request is pending.
- On success, clear password/key state and navigate with `window.location.replace`
  to the configured workspace base URL with the normalized slug inserted as the
  subdomain. Do not trust the slug later as an authorization boundary.
- Platform Admin login is Phase 4. Phase 3 verifies generation using an existing
  seeded admin session/JWT supplied at test time and does not add a login form.

## 14. Acceptance criteria

1. Only a valid Platform Admin JWT can generate a licence.
2. Generation stores only the SHA-256 hash and prefix; the raw key appears in
   exactly one successful response and is not recoverable from the database.
3. Generated keys use 128 bits from Web Crypto and the specified format.
4. Registration rejects every invalid licence state and an expired instant.
5. Registration rejects duplicate normalized email, duplicate slug, reserved
   slug, invalid slug, and Company Name mismatch.
6. A successful registration creates one Auth user and one matching Company
   where `companies.id = auth.users.id`.
7. The same transaction marks the licence `redeemed` and sets both redemption
   fields to the Company and current time.
8. Concurrent redemption attempts produce at most one Company and one redeemed
   licence result.
9. A database failure leaves no Company or partial licence redemption and
   triggers safe Auth-user compensation.
10. `anon` and `authenticated` cannot call the registration RPC or directly
    insert Companies/redeem licences; existing RLS remains effective.
11. Successful registration redirects to the normalized workspace subdomain
    without automatically signing the Company in.
12. No real IDs, emails, passwords, keys, hashes, tokens, or secrets are
    committed or logged.
13. Existing Phase 1 routing and Phase 2 isolation tests still pass.

## 15. Test plan

### Unit and function tests

- Key format, allowed alphabet, deterministic hash vectors, prefix extraction,
  collision retry limit, and mocked Web Crypto generation.
- Company Name/email/slug normalization, every reserved slug, expiry conversion,
  and boundary lengths.
- Admin JWT absent/invalid, authenticated non-admin, and Platform Admin success.
- Raw key returned once while inserts contain only hash and prefix.
- Every registration error code, sanitized response, and no sensitive logging.
- Auth creation failure, RPC rejection, cleanup success/failure, and ambiguous
  RPC outcome reconciliation.
- UI field validation, pending-state duplicate-submit prevention, one-time key
  dismissal, and workspace redirect construction.

### Cloud database and integration verification

- Verify RPC owner, `SECURITY INVOKER`, fixed search path, and EXECUTE grants.
- Simulate `anon`, `authenticated`, and `service_role`; only `service_role` can
  execute the RPC.
- Verify licence row locking with two concurrent redemption attempts.
- Force an insert/update error and prove Company plus redemption roll back.
- Run end-to-end generation and registration with runtime-only synthetic values;
  clean up created Auth/database records without committing credentials.
- Rerun `supabase/tests/isolation.sql` and the Supabase security advisor.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Run pinned Deno tests for Edge Function logic without starting local Supabase
  or Docker.

## 16. Ordered implementation tasks

1. Confirm the Cloud Auth password policy, project secret-key configuration,
   application base URL, and allowed browser origins.
2. Add shared Edge Function validation, key, hash, CORS, response, and logging
   utilities with pinned Deno/npm imports.
3. Add the service-role-only `SECURITY INVOKER` registration RPC in one
   version-controlled migration; review privileges before Cloud push.
4. Implement and unit-test `generate-licence`.
5. Implement and unit-test `register-company`, including compensation and
   ambiguous-result reconciliation.
6. Add the browser Supabase client, repositories, services, validation schemas,
   and workspace URL helper without bypassing the module dependency direction.
7. Implement the two forms and focused component tests.
8. Show migration SQL and Edge Function deployment commands before executing
   them against the linked Cloud project.
9. Apply the migration, deploy the functions, run Cloud security/integration
   verification, and rerun Phase 2 isolation tests.
10. Run all application and Edge Function validations, update project status,
    report exact results, and stop before Phase 4.

Expected implementation files (exact test filenames may be combined if simpler):

```text
supabase/migrations/*_company_registration_rpc.sql
supabase/functions/_shared/licence.ts
supabase/functions/_shared/http.ts
supabase/functions/generate-licence/index.ts
supabase/functions/register-company/index.ts
supabase/functions/tests/*.test.ts
supabase/deno.json
supabase/config.toml
supabase/tests/registration.sql
src/infrastructure/supabase/client.ts
src/modules/licensing/licenceRepository.ts
src/modules/licensing/licenceService.ts
src/modules/licensing/licenceSchemas.ts
src/modules/auth/registrationRepository.ts
src/modules/auth/registrationService.ts
src/modules/auth/registrationSchemas.ts
src/modules/auth/workspaceUrl.ts
src/modules/auth/RegisterPage.tsx
src/modules/platform-admin/AdminPage.tsx
focused `*.test.ts` / `*.test.tsx` files
.env.example
docs/project-status.md
```

No new application table is expected.

## 17. Assumptions and unresolved decisions

### Resolved for Phase 3

- Trusted mechanism: two Supabase Edge Functions using a server-only secret key
  where privileged Auth/database work is required.
- Database atomicity: one service-role-only, `SECURITY INVOKER` RPC for Company
  creation and licence redemption; Auth failure compensation remains in Edge.
- Licence key: `TDO-` plus 128 random bits encoded as grouped uppercase hex.
- Hash: SHA-256 of the canonical key, stored as lowercase hexadecimal.
- Expiry: UTC, inclusive selected date represented by exclusive next-day
  midnight; validation uses `now() < expires_at`.
- Expiry handling: compute expiry from `expires_at` at use time; do not add a
  scheduler or automatic stored-status transition.
- Company Name: normalized case-insensitive match is required; the licence value
  is stored as the canonical Company name.
- Admin authorization: valid user JWT plus membership in `platform_admins`.
- Registration success does not sign in the Company; Phase 4 owns login.

### Remaining deployment-time decisions

- The production base domain and exact allowed-origin list are supplied in
  environment configuration before deployment; local examples use
  `http://localhost:3000` and `http://<slug>.localhost:3000`.
- The Cloud project's exact password policy must be confirmed and mirrored in
  form guidance; Supabase Auth remains authoritative.
- CAPTCHA or external rate limiting is deferred unless the public Cloud test
  shows abuse risk. It must not weaken licence validation if later added.
