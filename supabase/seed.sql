\set ON_ERROR_STOP on

-- This seed is intentionally not automatic. It links one existing Supabase
-- Auth user to platform_admins without storing an email or password in git.
--
-- Run with a direct Cloud connection after replacing DATABASE_URL securely:
-- psql $DATABASE_URL --set=admin_email='admin@example.invalid' --file supabase/seed.sql
--
-- Supply a real admin email only at execution time. Never commit it.

\if :{?admin_email}
\else
  \echo 'Missing required psql variable: admin_email'
  \quit
\endif

begin;

select count(*) = 1 as seed_auth_user_is_unique
from auth.users
where lower(email) = lower(:'admin_email')
\gset

\if :seed_auth_user_is_unique
\else
  \echo 'Expected exactly one existing auth.users row for admin_email'
  \quit
\endif

insert into public.platform_admins (id, email)
select id, email
from auth.users
where lower(email) = lower(:'admin_email')
on conflict (id) do update
set email = excluded.email;

commit;
