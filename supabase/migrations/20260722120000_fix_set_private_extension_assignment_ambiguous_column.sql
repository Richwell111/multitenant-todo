-- Fix: the UPDATE branch of set_private_extension_assignment referenced unqualified
-- company_id / extension_id, which collide with the RETURNS TABLE OUT columns of the
-- same name and raised SQLSTATE 42702 ("column reference is ambiguous") whenever an
-- existing assignment row was toggled (disable, or re-enable an existing assignment).
-- Aliasing the UPDATE target and qualifying the predicate resolves the ambiguity.
-- Only the UPDATE branch changed; all guards, INSERT, history write, and grants are
-- preserved.

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
    update public.company_extensions as assignment
       set enabled = p_enabled
     where assignment.company_id = p_company_id
       and assignment.extension_id = p_extension_id
    returning assignment.* into v_assignment;
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

-- Re-affirm least-privilege execution (create or replace preserves ACL; this is idempotent).
revoke all on function public.set_private_extension_assignment(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.set_private_extension_assignment(uuid, uuid, boolean, text) to authenticated;
