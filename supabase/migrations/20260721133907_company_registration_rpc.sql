create or replace function public.complete_company_registration(
  p_auth_user_id uuid,
  p_company_name text,
  p_company_email text,
  p_workspace_slug text,
  p_licence_key_hash text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_licence public.licences%rowtype;
  v_company_name text;
  v_licence_company_name text;
  v_company_email text;
  v_workspace_slug text;
  v_constraint_name text;
begin
  if p_auth_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_USER_NOT_ELIGIBLE';
  end if;

  if p_company_name is null
    or p_company_email is null
    or p_workspace_slug is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_licence_key_hash is null then
    raise exception using errcode = 'P0001', message = 'INVALID_LICENCE';
  end if;

  v_company_name := regexp_replace(
    btrim(normalize(p_company_name, NFKC)),
    '[[:space:]]+',
    ' ',
    'g'
  );
  v_company_email := lower(btrim(p_company_email));
  v_workspace_slug := lower(btrim(p_workspace_slug));

  if char_length(v_company_name) < 1
    or char_length(v_company_name) > 200 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_company_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if char_length(v_workspace_slug) < 3
    or char_length(v_workspace_slug) > 63
    or v_workspace_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
    or v_workspace_slug like '%--%'
    or v_workspace_slug like 'xn--%'
    or v_workspace_slug = any (
      array[
        'admin', 'api', 'app', 'assets', 'auth',
        'login', 'register', 'status', 'support', 'www'
      ]
    ) then
    raise exception using
      errcode = 'P0001',
      message = case
        when v_workspace_slug = any (
          array[
            'admin', 'api', 'app', 'assets', 'auth',
            'login', 'register', 'status', 'support', 'www'
          ]
        ) then 'RESERVED_SLUG'
        else 'VALIDATION_ERROR'
      end;
  end if;

  if p_licence_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_LICENCE';
  end if;

  if exists (
    select 1
    from public.platform_admins
    where id = p_auth_user_id
  ) or exists (
    select 1
    from public.companies
    where id = p_auth_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'AUTH_USER_NOT_ELIGIBLE';
  end if;

  select licence.*
  into v_licence
  from public.licences as licence
  where licence.key_hash = p_licence_key_hash
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_LICENCE';
  end if;

  if v_licence.status = 'expired'
    or (
      v_licence.status = 'available'
      and v_licence.expires_at <= clock_timestamp()
    ) then
    raise exception using errcode = 'P0001', message = 'LICENCE_EXPIRED';
  end if;

  if v_licence.status <> 'available'
    or v_licence.redeemed_by_company_id is not null
    or v_licence.redeemed_at is not null then
    raise exception using errcode = 'P0001', message = 'LICENCE_UNAVAILABLE';
  end if;

  v_licence_company_name := regexp_replace(
    btrim(normalize(v_licence.company_name, NFKC)),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if lower(v_company_name) <> lower(v_licence_company_name) then
    raise exception using errcode = 'P0001', message = 'COMPANY_NAME_MISMATCH';
  end if;

  if exists (
    select 1
    from public.companies
    where lower(email) = v_company_email
  ) then
    raise exception using errcode = 'P0001', message = 'EMAIL_IN_USE';
  end if;

  if exists (
    select 1
    from public.companies
    where lower(slug) = v_workspace_slug
  ) then
    raise exception using errcode = 'P0001', message = 'SLUG_IN_USE';
  end if;

  begin
    insert into public.companies (id, name, email, slug, status)
    values (
      p_auth_user_id,
      v_licence.company_name,
      v_company_email,
      v_workspace_slug,
      'active'
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      raise exception using
        errcode = 'P0001',
        message = case v_constraint_name
          when 'companies_email_key' then 'EMAIL_IN_USE'
          when 'companies_slug_key' then 'SLUG_IN_USE'
          else 'AUTH_USER_NOT_ELIGIBLE'
        end;
  end;

  update public.licences
  set
    status = 'redeemed',
    redeemed_by_company_id = p_auth_user_id,
    redeemed_at = clock_timestamp()
  where id = v_licence.id
    and status = 'available'
    and redeemed_by_company_id is null
    and redeemed_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'LICENCE_UNAVAILABLE';
  end if;

  return v_workspace_slug;
end;
$function$;

revoke execute on function public.complete_company_registration(
  uuid, text, text, text, text
) from PUBLIC;

revoke execute on function public.complete_company_registration(
  uuid, text, text, text, text
) from anon;

revoke execute on function public.complete_company_registration(
  uuid, text, text, text, text
) from authenticated;

grant execute on function public.complete_company_registration(
  uuid, text, text, text, text
) to service_role;

