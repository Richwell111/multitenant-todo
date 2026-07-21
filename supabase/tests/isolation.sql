begin;

create function pg_temp.assert_true(result boolean, message text)
returns void
language plpgsql
as $$
begin
  if result is not true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.task_insert_is_denied(target_company_id uuid)
returns boolean
language plpgsql
as $$
begin
  insert into public.tasks (company_id, title)
  values (target_company_id, 'Denied isolation test');
  return false;
exception
  when insufficient_privilege then
    return true;
end;
$$;

create function pg_temp.company_name_update_is_denied(target_company_id uuid)
returns boolean
language plpgsql
as $$
begin
  update public.companies
  set name = 'Denied isolation test'
  where id = target_company_id;
  return false;
exception
  when insufficient_privilege then
    return true;
end;
$$;

create function pg_temp.task_update_count(target_task_id uuid)
returns integer
language plpgsql
as $$
declare
  affected_rows integer;
begin
  update public.tasks
  set title = title || ' updated'
  where id = target_task_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.task_delete_count(target_task_id uuid)
returns integer
language plpgsql
as $$
declare
  affected_rows integer;
begin
  delete from public.tasks
  where id = target_task_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.application_select_is_denied(relation_name text)
returns boolean
language plpgsql
as $$
begin
  execute format('select 1 from public.%I limit 1', relation_name);
  return false;
exception
  when insufficient_privilege then
    return true;
end;
$$;

select pg_temp.assert_true(
  (
    select count(*) = 4
    from pg_class
    where oid in (
      'public.platform_admins'::regclass,
      'public.companies'::regclass,
      'public.licences'::regclass,
      'public.tasks'::regclass
    )
      and relkind = 'r'
  ),
  'All four application tables must exist'
);
select pg_temp.assert_true(
  (
    select count(*) = 4
    from pg_class
    where oid in (
      'public.platform_admins'::regclass,
      'public.companies'::regclass,
      'public.licences'::regclass,
      'public.tasks'::regclass
    )
      and relrowsecurity
      and relforcerowsecurity
  ),
  'RLS must be enabled and forced on all application tables'
);
select pg_temp.assert_true(
  (
    select count(*) = 10
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'platform_admins',
        'companies',
        'licences',
        'tasks'
      )
  ),
  'Exactly the ten approved RLS policies must exist'
);
select pg_temp.assert_true(
  to_regclass('public.tasks_company_id_status_idx') is not null,
  'The tasks tenant/status index must exist'
);
select pg_temp.assert_true(
  to_regclass('public.licences_redeemed_by_company_id_idx') is not null,
  'The redeemed licence Company index must exist'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.platform_admins', 'select')
  and not has_table_privilege('anon', 'public.companies', 'select')
  and not has_table_privilege('anon', 'public.licences', 'select')
  and not has_table_privilege('anon', 'public.tasks', 'select'),
  'Anonymous role must have no application SELECT privileges'
);
select pg_temp.assert_true(
  not has_table_privilege(
    'authenticated',
    'public.companies',
    'update'
  )
  and has_column_privilege(
    'authenticated',
    'public.companies',
    'status',
    'update'
  )
  and not has_column_privilege(
    'authenticated',
    'public.companies',
    'name',
    'update'
  ),
  'Authenticated has column-level UPDATE only on companies.status'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'phase2-alpha@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'phase2-beta@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'phase2-suspended@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'phase2-admin@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.companies (id, name, email, slug, status)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Phase 2 Alpha',
    'phase2-alpha@example.invalid',
    'phase2-alpha',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Phase 2 Beta',
    'phase2-beta@example.invalid',
    'phase2-beta',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Phase 2 Suspended',
    'phase2-suspended@example.invalid',
    'phase2-suspended',
    'suspended'
  );

insert into public.platform_admins (id, email)
values (
  '10000000-0000-0000-0000-000000000004',
  'phase2-admin@example.invalid'
);

insert into public.licences (
  id,
  company_name,
  key_hash,
  key_prefix,
  status,
  expires_at
)
values (
  '20000000-0000-0000-0000-000000000001',
  'Phase 2 Alpha',
  'phase2-test-hash-not-a-real-key',
  'TDO-TEST',
  'available',
  now() + interval '1 day'
);

insert into public.tasks (id, company_id, title)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Alpha task'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Beta task'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'Suspended task'
  );

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 1 from public.tasks),
  'Alpha must see only its own task'
);
select pg_temp.assert_true(
  (select bool_and(company_id = (select auth.uid())) from public.tasks),
  'Every task visible to Alpha must belong to Alpha'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.companies),
  'Alpha must see only its own Company row'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.licences),
  'Alpha must not see licences'
);
select pg_temp.assert_true(
  pg_temp.task_insert_is_denied(
    '10000000-0000-0000-0000-000000000002'
  ),
  'Alpha must not insert a task for Beta'
);

insert into public.tasks (company_id, title)
values (
  '10000000-0000-0000-0000-000000000001',
  'Allowed Alpha task'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 1 from public.tasks),
  'Beta must see only its own task'
);
select pg_temp.assert_true(
  (select bool_and(company_id = (select auth.uid())) from public.tasks),
  'Every task visible to Beta must belong to Beta'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 0 from public.tasks),
  'Platform Admin must not see tasks'
);
select pg_temp.assert_true(
  (select count(*) = 3 from public.companies),
  'Platform Admin must see all Companies'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.licences),
  'Platform Admin must see licences'
);

update public.companies
set status = 'suspended'
where id = '10000000-0000-0000-0000-000000000002';

select pg_temp.assert_true(
  (
    select status = 'suspended'
    from public.companies
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  'Platform Admin must be able to suspend a Company'
);
select pg_temp.assert_true(
  pg_temp.company_name_update_is_denied(
    '10000000-0000-0000-0000-000000000002'
  ),
  'Platform Admin must not update Company columns other than status'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select count(*) = 0 from public.tasks),
  'Suspended Company must not see tasks'
);
select pg_temp.assert_true(
  pg_temp.task_insert_is_denied(
    '10000000-0000-0000-0000-000000000003'
  ),
  'Suspended Company must not insert tasks'
);
select pg_temp.assert_true(
  pg_temp.task_update_count(
    '30000000-0000-0000-0000-000000000003'
  ) = 0,
  'Suspended Company must not update tasks'
);
select pg_temp.assert_true(
  pg_temp.task_delete_count(
    '30000000-0000-0000-0000-000000000003'
  ) = 0,
  'Suspended Company must not delete tasks'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '',
  true
);
set local role anon;

select pg_temp.assert_true(
  pg_temp.application_select_is_denied('platform_admins'),
  'Anonymous caller must not select platform_admins'
);
select pg_temp.assert_true(
  pg_temp.application_select_is_denied('companies'),
  'Anonymous caller must not select companies'
);
select pg_temp.assert_true(
  pg_temp.application_select_is_denied('licences'),
  'Anonymous caller must not select licences'
);
select pg_temp.assert_true(
  pg_temp.application_select_is_denied('tasks'),
  'Anonymous caller must not select tasks'
);

reset role;
rollback;
