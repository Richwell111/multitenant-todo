begin;

create function pg_temp.assert_true(result boolean, message text)
returns void
language plpgsql
as $$
begin
  if result is not true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

create function pg_temp.assignment_insert_is_denied(target_company_id uuid, target_extension_id uuid)
returns boolean
language plpgsql
as $$
begin
  insert into public.company_extensions (company_id, extension_id, enabled)
  values (target_company_id, target_extension_id, true);
  return false;
exception when insufficient_privilege then return true;
end;
$$;

create function pg_temp.invalid_extension_is_rejected()
returns boolean
language plpgsql
as $$
begin
  insert into public.extensions (id, key, name, availability_type)
  values ('33333333-3333-4333-8333-333333333333', 'invalid-test', 'Invalid', 'unsupported');
  return false;
exception when check_violation then return true;
end;
$$;

select pg_temp.assert_true(
  (select count(*) = 2 from public.extensions where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )),
  'The two fixed proof extensions must be seeded'
);
select pg_temp.assert_true(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.extensions'::regclass),
  'Extensions must have forced RLS'
);
select pg_temp.assert_true(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.company_extensions'::regclass),
  'Company extensions must have forced RLS'
);
select pg_temp.assert_true(
  pg_temp.invalid_extension_is_rejected(),
  'Unsupported availability type must be rejected'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'extension-alpha@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'extension-beta@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'extension-suspended@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'extension-admin@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.companies (id, name, email, slug, status)
values
  ('40000000-0000-0000-0000-000000000001', 'Extension Alpha', 'extension-alpha@example.invalid', 'extension-alpha', 'active'),
  ('40000000-0000-0000-0000-000000000002', 'Extension Beta', 'extension-beta@example.invalid', 'extension-beta', 'active'),
  ('40000000-0000-0000-0000-000000000003', 'Extension Suspended', 'extension-suspended@example.invalid', 'extension-suspended', 'suspended');

insert into public.platform_admins (id, email)
values ('40000000-0000-0000-0000-000000000004', 'extension-admin@example.invalid');

insert into public.company_extensions (company_id, extension_id, enabled)
values ('40000000-0000-0000-0000-000000000002', '22222222-2222-4222-8222-222222222222', true);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.extensions), 'Active unassigned Company sees shared extension only');
select pg_temp.assert_true((select count(*) = 0 from public.company_extensions), 'Company cannot see another Company assignment');
select pg_temp.assert_true(pg_temp.assignment_insert_is_denied('40000000-0000-0000-0000-000000000001', '22222222-2222-4222-8222-222222222222'), 'Company cannot insert assignments');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 2 from public.extensions), 'Assigned Company sees shared and private extensions');
select pg_temp.assert_true((select count(*) = 1 from public.company_extensions), 'Company sees only its own enabled assignment');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.extensions), 'Suspended Company sees no extensions');
select pg_temp.assert_true((select count(*) = 0 from public.company_extensions), 'Suspended Company sees no assignments');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 2 from public.extensions), 'Platform Admin sees all extensions');
select pg_temp.assert_true((select count(*) = 1 from public.company_extensions), 'Platform Admin sees assignments');

insert into public.company_extensions (company_id, extension_id, enabled)
values ('40000000-0000-0000-0000-000000000001', '22222222-2222-4222-8222-222222222222', true)
on conflict (company_id, extension_id) do update set enabled = excluded.enabled;
select pg_temp.assert_true((select enabled from public.company_extensions where company_id = '40000000-0000-0000-0000-000000000001'), 'Platform Admin can enable private assignment');

insert into public.company_extensions (company_id, extension_id, enabled)
values ('40000000-0000-0000-0000-000000000001', '22222222-2222-4222-8222-222222222222', false)
on conflict (company_id, extension_id) do update set enabled = excluded.enabled;
select pg_temp.assert_true((select not enabled from public.company_extensions where company_id = '40000000-0000-0000-0000-000000000001'), 'Platform Admin can disable private assignment');
select pg_temp.assert_true((select count(*) = 0 from public.tasks), 'Platform Admin receives no task rows through extensions');

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.assert_true((select not has_table_privilege('anon', 'public.extensions', 'select') and not has_table_privilege('anon', 'public.company_extensions', 'select')), 'Anonymous extension access is denied');

reset role;
rollback;
