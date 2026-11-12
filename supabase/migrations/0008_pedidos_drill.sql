-- Pedidos de drill: qualquer pessoa do time descreve o drill que quer e anexa prints da estratégia.
-- Quem gerencia conteúdo (admin, coach, admin de drills, mentor) vê todos e responde na análise semanal.
-- Rode no SQL Editor do Supabase (uma vez), depois da 0007.

create table if not exists public.drill_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  status text not null default 'novo' check (status in ('novo', 'em_analise', 'aprovado', 'recusado', 'feito')),
  reply text check (reply is null or char_length(reply) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists drill_requests_created_at on public.drill_requests (created_at desc);

-- Prints anexados (PNG/JPEG/WebP em base64, até 6 por pedido e ~1,6 MB cada)
create table if not exists public.drill_request_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.drill_requests (id) on delete cascade,
  position int not null default 0,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data text not null check (char_length(data) <= 2300000),
  created_at timestamptz not null default now()
);

create index if not exists drill_request_images_request on public.drill_request_images (request_id, position);

alter table public.drill_requests enable row level security;
alter table public.drill_request_images enable row level security;

-- Pedidos: cada um cria e vê os seus; quem gerencia conteúdo vê todos e muda status/resposta
drop policy if exists drill_requests_select on public.drill_requests;
create policy drill_requests_select on public.drill_requests for select
  using (user_id = auth.uid() or public.is_content_manager());

drop policy if exists drill_requests_insert on public.drill_requests;
create policy drill_requests_insert on public.drill_requests for insert
  with check (user_id = auth.uid() and public.my_role() is not null and status = 'novo' and reply is null);

drop policy if exists drill_requests_update on public.drill_requests;
create policy drill_requests_update on public.drill_requests for update
  using (public.is_content_manager()) with check (public.is_content_manager());

-- Prints: entram junto com o próprio pedido; quem vê o pedido vê os prints
drop policy if exists drill_request_images_select on public.drill_request_images;
create policy drill_request_images_select on public.drill_request_images for select
  using (exists (
    select 1 from public.drill_requests r
    where r.id = request_id and (r.user_id = auth.uid() or public.is_content_manager())
  ));

drop policy if exists drill_request_images_insert on public.drill_request_images;
create policy drill_request_images_insert on public.drill_request_images for insert
  with check (exists (
    select 1 from public.drill_requests r where r.id = request_id and r.user_id = auth.uid() and r.status = 'novo'
  ));

grant select, insert, update on public.drill_requests to authenticated;
grant select, insert on public.drill_request_images to authenticated;
