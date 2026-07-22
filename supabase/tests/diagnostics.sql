\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(result boolean, message text)
returns void language plpgsql as $$
begin
  if result is not true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

create function pg_temp.call_without_privilege(command text)
returns boolean language plpgsql as $$
begin
  execute command;
  return false;
exception when insufficient_privilege then
  return true;
end;
$$;

create function pg_temp.call_and_expect_failure(command text)
returns boolean language plpgsql as $$
begin
  execute command;
  return false;
exception when others then
  return true;
end;
$$;

select pg_temp.assert_true(
  (select count(*) = 3 from pg_class where oid in (
    'public.extension_assignment_events'::regclass,
    'public.feature_requests'::regclass,
    'public.release_records'::regclass
  ) and relrowsecurity and relforcerowsecurity),
  'All diagnostics tables must have forced RLS'
);
select pg_temp.assert_true(
  to_regclass('public.operational_events') is null,
  'No generic operational_events table is introduced'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.extension_assignment_events', 'select')
  and not has_table_privilege('anon', 'public.feature_requests', 'select')
  and not has_table_privilege('anon', 'public.release_records', 'select')
  and has_table_privilege('authenticated', 'public.extension_assignment_events', 'select')
  and has_table_privilege('authenticated', 'public.feature_requests', 'select')
  and has_table_privilege('authenticated', 'public.release_records', 'select'),
  'Only authenticated callers receive table SELECT privilege'
);
insert into public.feature_requests (
  requested_outcome,
  classification,
  request_status,
  development_status,
  deployment_status
)
values ('Valid Phase 8 request', 'shared_feature', 'requested', 'not_started', 'not_deployed');
select pg_temp.assert_true(
  (select count(*) = 1 from public.feature_requests where requested_outcome = 'Valid Phase 8 request'),
  'A valid feature request satisfies the lifecycle constraints'
);
select pg_temp.assert_true(
  pg_temp.call_and_expect_failure($cmd$insert into public.feature_requests (requested_outcome, classification) values (repeat('x', 501), 'core')$cmd$)
  and pg_temp.call_and_expect_failure($cmd$insert into public.feature_requests (requested_outcome, classification) values ('invalid classification', 'unsupported')$cmd$)
  and pg_temp.call_and_expect_failure($cmd$insert into public.feature_requests (requested_outcome, classification, request_status) values ('invalid request status', 'core', 'unsupported')$cmd$)
  and pg_temp.call_and_expect_failure($cmd$insert into public.feature_requests (requested_outcome, classification, development_status) values ('invalid development status', 'core', 'unsupported')$cmd$)
  and pg_temp.call_and_expect_failure($cmd$insert into public.feature_requests (requested_outcome, classification, deployment_status) values ('invalid deployment status', 'core', 'unsupported')$cmd$),
  'Invalid feature request values are rejected'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.extension_assignment_events', 'insert')
  and not has_table_privilege('authenticated', 'public.feature_requests', 'insert')
  and not has_table_privilege('authenticated', 'public.release_records', 'insert')
  and not has_table_privilege('authenticated', 'public.company_extensions', 'insert')
  and not has_table_privilege('authenticated', 'public.company_extensions', 'update'),
  'Browser roles cannot directly write lifecycle or assignment rows'
);
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.set_private_extension_assignment(uuid,uuid,boolean,text)', 'execute')
  and not has_function_privilege('anon', 'public.set_private_extension_assignment(uuid,uuid,boolean,text)', 'execute')
  and (select p.prosecdef from pg_proc p where p.oid = 'public.set_private_extension_assignment(uuid,uuid,boolean,text)'::regprocedure),
  'Only authenticated callers can reach the guarded SECURITY DEFINER RPC'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('70000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase8-alpha@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('70000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase8-admin@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.companies (id, name, email, slug, status)
values ('70000000-0000-0000-0000-000000000001', 'Phase 8 Alpha', 'phase8-alpha@example.invalid', 'phase8-alpha', 'active');
insert into public.platform_admins (id, email)
values ('70000000-0000-0000-0000-000000000002', 'phase8-admin@example.invalid');

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 1 from public.set_private_extension_assignment(
    '70000000-0000-0000-0000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    true,
    null
  )),
  'Platform Admin can enable the private proof feature through the RPC'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.extension_assignment_events where company_id = '70000000-0000-0000-0000-000000000001' and enabled),
  'Enabling creates one lifecycle event'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.set_private_extension_assignment(
    '70000000-0000-0000-0000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    true,
    null
  )),
  'Repeated enable is idempotent'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.extension_assignment_events where company_id = '70000000-0000-0000-0000-000000000001'),
  'Repeated enable does not duplicate history'
);
select pg_temp.assert_true(
  pg_temp.call_and_expect_failure($cmd$select * from public.set_private_extension_assignment('70000000-0000-0000-0000-000000000001', '22222222-2222-4222-8222-222222222222', false, 'not_allowed')$cmd$),
  'Uncontrolled disablement reasons are rejected'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.set_private_extension_assignment(
    '70000000-0000-0000-0000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    false,
    'temporary_pause'
  )),
  'Platform Admin can disable with a controlled reason'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.extension_assignment_events where company_id = '70000000-0000-0000-0000-000000000001')
  and (select disabled_reason = 'temporary_pause' from public.extension_assignment_events where company_id = '70000000-0000-0000-0000-000000000001' and not enabled),
  'Disable history records the controlled reason atomically'
);

reset role;
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 0 from public.extension_assignment_events),
  'Companies cannot read platform lifecycle history'
);
select pg_temp.assert_true(
  pg_temp.call_without_privilege($cmd$insert into public.feature_requests (requested_outcome, classification) values ('blocked', 'core')$cmd$),
  'Companies cannot insert feature requests from the browser'
);
select pg_temp.assert_true(
  pg_temp.call_without_privilege($cmd$insert into public.release_records (version, environment, released_at) values ('blocked', 'test', now())$cmd$),
  'Companies cannot insert release records from the browser'
);
select pg_temp.assert_true(
  pg_temp.call_without_privilege($cmd$select * from public.set_private_extension_assignment('70000000-0000-0000-0000-000000000001', '22222222-2222-4222-8222-222222222222', true, null)$cmd$),
  'Companies cannot call the Platform Admin lifecycle RPC successfully'
);

reset role;
rollback;