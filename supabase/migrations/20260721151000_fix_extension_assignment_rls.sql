drop policy company_extensions_insert_platform_admin
on public.company_extensions;

drop policy company_extensions_update_platform_admin
on public.company_extensions;

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
  and extension_id = '22222222-2222-4222-8222-222222222222'
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
  and extension_id = '22222222-2222-4222-8222-222222222222'
)
with check (
  exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.id = (select auth.uid())
  )
  and extension_id = '22222222-2222-4222-8222-222222222222'
);
