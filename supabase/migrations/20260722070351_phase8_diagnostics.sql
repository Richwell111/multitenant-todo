create table public.extension_assignment_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  extension_id uuid not null references public.extensions (id),
  enabled boolean not null,
  changed_at timestamptz not null default now(),
  disabled_reason text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint extension_assignment_events_reason_check check (
    (enabled and disabled_reason is null)
    or (
      not enabled
      and disabled_reason in (
        'no_longer_needed',
        'too_complex',
        'performance_problem',
        'missing_expected_functionality',
        'replaced_by_other_process',
        'cost_concern',
        'temporary_pause',
        'other'
      )
    )
  )
);

create index extension_assignment_events_company_changed_idx
  on public.extension_assignment_events (company_id, changed_at desc);
create index extension_assignment_events_extension_changed_idx
  on public.extension_assignment_events (extension_id, changed_at desc);

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_company_id uuid references public.companies (id) on delete set null,
  extension_id uuid references public.extensions (id) on delete set null,
  requested_outcome text not null
    constraint feature_requests_outcome_length_check check (char_length(requested_outcome) between 1 and 500),
  classification text not null
    constraint feature_requests_classification_check check (
      classification in ('core', 'shared_feature', 'private_customization', 'configuration', 'rejected_or_postponed')
    ),
  request_status text not null default 'requested'
    constraint feature_requests_request_status_check check (
      request_status in ('requested', 'under_review', 'approved', 'rejected', 'postponed')
    ),
  development_status text not null default 'not_started'
    constraint feature_requests_development_status_check check (
      development_status in ('not_started', 'specification', 'in_development', 'testing', 'completed')
    ),
  deployment_status text not null default 'not_deployed'
    constraint feature_requests_deployment_status_check check (
      deployment_status in ('not_deployed', 'ready_to_deploy', 'deployed', 'failed')
    ),
  target_release text
    constraint feature_requests_target_release_length_check check (target_release is null or char_length(target_release) between 1 and 80),
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feature_requests_company_requested_idx
  on public.feature_requests (requesting_company_id, requested_at desc);
create index feature_requests_status_idx
  on public.feature_requests (request_status, development_status, deployment_status);

create table public.release_records (
  id uuid primary key default gen_random_uuid(),
  version text not null
    constraint release_records_version_length_check check (char_length(version) between 1 and 80),
  environment text not null
    constraint release_records_environment_length_check check (char_length(environment) between 1 and 40),
  released_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index release_records_released_at_idx
  on public.release_records (released_at desc);

alter table public.extension_assignment_events enable row level security;
alter table public.extension_assignment_events force row level security;
alter table public.feature_requests enable row level security;
alter table public.feature_requests force row level security;
alter table public.release_records enable row level security;
alter table public.release_records force row level security;

revoke all on table public.extension_assignment_events from anon, authenticated;
revoke all on table public.feature_requests from anon, authenticated;
revoke all on table public.release_records from anon, authenticated;
grant select on table public.extension_assignment_events to authenticated;
grant select on table public.feature_requests to authenticated;
grant select on table public.release_records to authenticated;

create policy extension_assignment_events_select_platform_admin
on public.extension_assignment_events
for select
to authenticated
using (exists (
  select 1 from public.platform_admins as platform_admin
  where platform_admin.id = (select auth.uid())
));

create policy feature_requests_select_platform_admin
on public.feature_requests
for select
to authenticated
using (exists (
  select 1 from public.platform_admins as platform_admin
  where platform_admin.id = (select auth.uid())
));

create policy release_records_select_platform_admin
on public.release_records
for select
to authenticated
using (exists (
  select 1 from public.platform_admins as platform_admin
  where platform_admin.id = (select auth.uid())
));

-- Assignment changes and lifecycle history are one trusted atomic operation.
create or replace function public.set_private_extension_assignment(
  p_company_id uuid,
  p_extension_id uuid,
  p_enabled boolean,
  p_disabled_reason text default null
)
returns table (
  company_id uuid,
  extension_id uuid,
  enabled boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous_enabled boolean;
  v_assignment public.company_extensions;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins as platform_admin
    where platform_admin.id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'platform admin access required';
  end if;

  if p_extension_id <> '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception using errcode = '22023', message = 'only the private proof extension is assignable';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception using errcode = '22023', message = 'Company not found';
  end if;

  if p_enabled and p_disabled_reason is not null then
    raise exception using errcode = '22023', message = 'enabled assignments cannot include a disablement reason';
  end if;

  if not p_enabled and p_disabled_reason not in (
    'no_longer_needed',
    'too_complex',
    'performance_problem',
    'missing_expected_functionality',
    'replaced_by_other_process',
    'cost_concern',
    'temporary_pause',
    'other'
  ) then
    raise exception using errcode = '22023', message = 'a controlled disablement reason is required';
  end if;

  select assignment.enabled
    into v_previous_enabled
    from public.company_extensions as assignment
   where assignment.company_id = p_company_id
     and assignment.extension_id = p_extension_id
   for update;

  if not found then
    insert into public.company_extensions (company_id, extension_id, enabled)
    values (p_company_id, p_extension_id, p_enabled)
    returning * into v_assignment;
  else
    update public.company_extensions
       set enabled = p_enabled
     where company_id = p_company_id
       and extension_id = p_extension_id
    returning * into v_assignment;
  end if;

  if v_previous_enabled is distinct from p_enabled then
    insert into public.extension_assignment_events (
      company_id,
      extension_id,
      enabled,
      changed_at,
      disabled_reason,
      actor_id
    )
    values (
      p_company_id,
      p_extension_id,
      p_enabled,
      now(),
      case when p_enabled then null else p_disabled_reason end,
      auth.uid()
    );
  end if;

  return query
  select v_assignment.company_id,
         v_assignment.extension_id,
         v_assignment.enabled,
         v_assignment.created_at;
end;
$$;

revoke all on function public.set_private_extension_assignment(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.set_private_extension_assignment(uuid, uuid, boolean, text) to authenticated;

-- Browser clients may read assignment state, but all assignment writes go through the RPC.
revoke insert, update on table public.company_extensions from authenticated;
revoke update (enabled) on table public.company_extensions from authenticated;
drop policy if exists company_extensions_insert_platform_admin on public.company_extensions;
drop policy if exists company_extensions_update_platform_admin on public.company_extensions;