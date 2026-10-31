-- Trainer Baga Pool — estrutura inicial do banco
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'jogador'
    check (role in ('admin', 'coach', 'admin_drills', 'mentor', 'jogador')),
  pool_id uuid references public.pools (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Configurações do time (legenda de cores, configuração do plano mensal...)
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.strategies (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  street text not null check (street in ('preflop', 'flop', 'turn', 'river')),
  situation text not null default '',
  data jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drills (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  data jsonb not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  drill_id text not null,
  strategy_id text not null,
  correct boolean not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index attempts_user_created on public.attempts (user_id, created_at desc);
create index attempts_drill on public.attempts (drill_id);

create table public.stat_standards (
  id text primary key default gen_random_uuid()::text,
  stat_key text not null unique,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  stats jsonb not null,
  plan jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- ---------------------------------------------------------------------------
-- Funções de apoio para as permissões
-- ---------------------------------------------------------------------------

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.my_pool() returns uuid
language sql stable security definer set search_path = public as $$
  select pool_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_content_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'coach', 'admin_drills', 'mentor'), false)
$$;

create or replace function public.views_all_performance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'coach', 'mentor'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Jogador vê o próprio desempenho e o da sua pool; admin, coaches e mentores veem todos.
create or replace function public.can_view_user(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    target = auth.uid()
    or public.views_all_performance()
    or exists (
      select 1 from public.profiles p
      where p.id = target and p.pool_id is not null and p.pool_id = public.my_pool()
    )
$$;

-- Cria o perfil automaticamente quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, pool_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'jogador'),
    nullif(new.raw_app_meta_data ->> 'pool_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Segurança por linha (RLS)
-- ---------------------------------------------------------------------------

alter table public.pools enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.strategies enable row level security;
alter table public.drills enable row level security;
alter table public.attempts enable row level security;
alter table public.stat_standards enable row level security;
alter table public.monthly_plans enable row level security;

-- Pools e perfis: todo o time vê; só o admin altera.
create policy "pools: leitura" on public.pools for select to authenticated using (public.my_role() is not null);
create policy "pools: admin" on public.pools for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "perfis: leitura" on public.profiles for select to authenticated using (public.my_role() is not null);
create policy "perfis: admin" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Conteúdo (legenda, estratégias, drills, standards): todo o time lê; quem cria drills altera.
create policy "settings: leitura" on public.settings for select to authenticated using (public.my_role() is not null);
create policy "settings: gestão" on public.settings for all to authenticated
  using (public.is_content_manager()) with check (public.is_content_manager());

create policy "estratégias: leitura" on public.strategies for select to authenticated using (public.my_role() is not null);
create policy "estratégias: gestão" on public.strategies for all to authenticated
  using (public.is_content_manager()) with check (public.is_content_manager());

create policy "drills: leitura" on public.drills for select to authenticated using (public.my_role() is not null);
create policy "drills: gestão" on public.drills for all to authenticated
  using (public.is_content_manager()) with check (public.is_content_manager());

create policy "standards: leitura" on public.stat_standards for select to authenticated using (public.my_role() is not null);
create policy "standards: gestão" on public.stat_standards for all to authenticated
  using (public.is_content_manager()) with check (public.is_content_manager());

-- Tentativas: cada jogador grava as próprias; leitura segue a regra de visibilidade.
create policy "tentativas: gravar as próprias" on public.attempts for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy "tentativas: leitura" on public.attempts for select to authenticated using (public.can_view_user(user_id));

-- Planos mensais: leitura segue a visibilidade; coaches/mentores/admin e o próprio jogador criam.
create policy "planos: leitura" on public.monthly_plans for select to authenticated using (public.can_view_user(user_id));
create policy "planos: criar" on public.monthly_plans for insert to authenticated
  with check (public.is_content_manager() or user_id = auth.uid());
create policy "planos: atualizar" on public.monthly_plans for update to authenticated
  using (public.is_content_manager() or user_id = auth.uid())
  with check (public.is_content_manager() or user_id = auth.uid());
create policy "planos: apagar" on public.monthly_plans for delete to authenticated using (public.is_content_manager());
