create table public.extensions (
  id uuid primary key,
  key text not null unique,
  name text not null,
  description text,
  availability_type text not null
    constraint extensions_availability_type_check check (availability_type in ('shared', 'private')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.company_extensions (
  company_id uuid not null references public.companies (id) on delete cascade,
  extension_id uuid not null references public.extensions (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, extension_id)
);

create index company_extensions_extension_enabled_idx
  on public.company_extensions (extension_id, enabled);

alter table public.extensions enable row level security;
alter table public.extensions force row level security;
alter table public.company_extensions enable row level security;
alter table public.company_extensions force row level security;

revoke all on table public.extensions from anon, authenticated;
revoke all on table public.company_extensions from anon, authenticated;

grant select on table public.extensions to authenticated;
grant select, insert on table public.company_extensions to authenticated;
grant update (enabled) on table public.company_extensions to authenticated;

create policy extensions_select_visible
on public.extensions
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  or (
    is_active
    and exists (
      select 1
      from public.companies as company
      where company.id = (select auth.uid())
        and company.status = 'active'
    )
    and (
      availability_type = 'shared'
      or exists (
        select 1
        from public.company_extensions as assignment
        where assignment.company_id = (select auth.uid())
          and assignment.extension_id = extensions.id
          and assignment.enabled
      )
    )
  )
);

create policy company_extensions_select_visible
on public.company_extensions
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  or (
    company_id = (select auth.uid())
    and enabled
    and exists (
      select 1
      from public.companies as company
      where company.id = (select auth.uid())
        and company.status = 'active'
    )
  )
);

create policy company_extensions_insert_platform_admin
on public.company_extensions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.extensions as extension
    where extension.id = extension_id
      and extension.availability_type = 'private'
  )
);

create policy company_extensions_update_platform_admin
on public.company_extensions
for update
to authenticated
using (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.extensions as extension
    where extension.id = extension_id
      and extension.availability_type = 'private'
  )
)
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and exists (
    select 1
    from public.extensions as extension
    where extension.id = extension_id
      and extension.availability_type = 'private'
  )
);

insert into public.extensions (id, key, name, description, availability_type, is_active)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'task-notes-summary',
    'Task Notes Summary',
    'A read-only summary of task descriptions for the current Company.',
    'shared',
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'priority-labels-demo',
    'Priority Labels Demo',
    'A private, read-only extension proof panel.',
    'private',
    true
  )
on conflict (id) do update
set key = excluded.key,
    name = excluded.name,
    description = excluded.description,
    availability_type = excluded.availability_type,
    is_active = excluded.is_active;
