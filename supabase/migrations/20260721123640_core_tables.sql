create table public.platform_admins (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  slug text not null unique,
  status text not null default 'active'
    constraint companies_status_check check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.licences (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  status text not null default 'available'
    constraint licences_status_check check (
      status in ('available', 'redeemed', 'expired', 'revoked')
    ),
  expires_at timestamptz not null,
  redeemed_by_company_id uuid references public.companies (id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending'
    constraint tasks_status_check check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);
