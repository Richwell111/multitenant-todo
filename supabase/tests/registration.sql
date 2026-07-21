-- Phase 3 Cloud verification for the restricted registration RPC.
-- Run with a privileged SQL session after applying the migration.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(result boolean, message text)
returns void language plpgsql as $$
begin
  if result is not true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

select pg_temp.assert_true(
  to_regprocedure('public.complete_company_registration(uuid,text,text,text,text)') is not null,
  'registration RPC exists'
);
select pg_temp.assert_true(
  (select r.rolname = 'postgres'
   from pg_proc p join pg_roles r on r.oid = p.proowner
   where p.oid = 'public.complete_company_registration(uuid,text,text,text,text)'::regprocedure),
  'registration RPC owner is postgres'
);
select pg_temp.assert_true(
  (select not p.prosecdef
   from pg_proc p
   where p.oid = 'public.complete_company_registration(uuid,text,text,text,text)'::regprocedure),
  'registration RPC is SECURITY INVOKER'
);
select pg_temp.assert_true(
  (select replace(replace(array_to_string(coalesce(p.proconfig, '{}'::text[]), ','), '"', ''), ' ', '') = 'search_path='
   from pg_proc p
   where p.oid = 'public.complete_company_registration(uuid,text,text,text,text)'::regprocedure),
  'registration RPC has a fixed empty search_path'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.complete_company_registration(uuid,text,text,text,text)', 'execute')
  and has_function_privilege('postgres', 'public.complete_company_registration(uuid,text,text,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.complete_company_registration(uuid,text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_company_registration(uuid,text,text,text,text)', 'execute'),
  'only trusted roles retain EXECUTE (PUBLIC, anon, and authenticated do not)'
);
select pg_temp.assert_true(
  (select pg_get_functiondef('public.complete_company_registration(uuid,text,text,text,text)'::regprocedure) ilike '%FOR UPDATE%'),
  'licence row is locked before validation/redemption'
);
select pg_temp.assert_true(
  (select pg_get_functiondef('public.complete_company_registration(uuid,text,text,text,text)'::regprocedure) ilike '%status = ''redeemed''%'
    and pg_get_functiondef('public.complete_company_registration(uuid,text,text,text,text)'::regprocedure) ilike '%redeemed_by_company_id%'
    and pg_get_functiondef('public.complete_company_registration(uuid,text,text,text,text)'::regprocedure) ilike '%redeemed_at%'),
  'RPC redeems the licence with both redemption fields'
);

rollback;

