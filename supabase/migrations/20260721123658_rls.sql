alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.licences enable row level security;
alter table public.licences force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.companies from anon, authenticated;
revoke all on table public.licences from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;

grant select on table public.platform_admins to authenticated;
grant select on table public.companies to authenticated;
grant update (status) on table public.companies to authenticated;
grant select, insert, update on table public.licences to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

create policy platform_admins_select_own
on public.platform_admins
for select
to authenticated
using (id = (select auth.uid()));

create policy companies_select_own_or_platform_admin
on public.companies
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
);

create policy companies_update_status_platform_admin
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
);

create policy licences_select_platform_admin
on public.licences
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
);

create policy licences_insert_platform_admin
on public.licences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
);

create policy licences_update_platform_admin
on public.licences
for update
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
);

create policy tasks_select_active_company
on public.tasks
for select
to authenticated
using (
  company_id = (select auth.uid())
  and not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.companies as company
    where company.id = (select auth.uid())
      and company.status = 'active'
  )
);

create policy tasks_insert_active_company
on public.tasks
for insert
to authenticated
with check (
  company_id = (select auth.uid())
  and not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.companies as company
    where company.id = (select auth.uid())
      and company.status = 'active'
  )
);

create policy tasks_update_active_company
on public.tasks
for update
to authenticated
using (
  company_id = (select auth.uid())
  and not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.companies as company
    where company.id = (select auth.uid())
      and company.status = 'active'
  )
)
with check (
  company_id = (select auth.uid())
  and not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.companies as company
    where company.id = (select auth.uid())
      and company.status = 'active'
  )
);

create policy tasks_delete_active_company
on public.tasks
for delete
to authenticated
using (
  company_id = (select auth.uid())
  and not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.companies as company
    where company.id = (select auth.uid())
      and company.status = 'active'
  )
);
