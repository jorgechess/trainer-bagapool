-- Usuários de teste: não entram no ranking e só o admin (e o próprio usuário) os vê.
-- Jogador continua vendo só o próprio desempenho e o da sua pool.
-- Rode no SQL Editor do Supabase (uma vez), depois da 0008.

alter table public.profiles add column if not exists is_test boolean not null default false;

-- Perfil de teste (true) — false para os demais e para ids desconhecidos.
create or replace function public.is_test_user(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_test from public.profiles where id = target), false)
$$;

-- Jogador vê o próprio desempenho e o da sua pool; admin, coaches e mentores veem todos.
-- Usuário de teste: só o admin e ele mesmo.
create or replace function public.can_view_user(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    target = auth.uid()
    or (
      (public.is_admin() or not public.is_test_user(target))
      and (
        public.views_all_performance()
        or exists (
          select 1 from public.profiles p
          where p.id = target and p.pool_id is not null and p.pool_id = public.my_pool()
        )
      )
    )
$$;

-- Lista do time: quem é de teste só aparece para o admin e para si mesmo.
drop policy if exists "perfis: leitura" on public.profiles;
create policy "perfis: leitura" on public.profiles for select to authenticated
  using (public.my_role() is not null and (not is_test or id = auth.uid() or public.is_admin()));

-- Ranking mensal: usuários de teste ficam fora.
create or replace function public.monthly_ranking(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, decisions bigint, correct bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, count(*)::bigint, count(*) filter (where a.correct)::bigint
  from public.attempts a
  join public.profiles p on p.id = a.user_id and p.active and not p.is_test
  where public.my_role() is not null
    and a.created_at >= p_from
    and a.created_at < p_to
    and not exists (
      select 1 from public.drills d
      where d.id = a.drill_id and coalesce(d.data -> 'tags', '[]'::jsonb) ? 'fora-do-ranking'
    )
  group by a.user_id
$$;

revoke all on function public.monthly_ranking(timestamptz, timestamptz) from public;
grant execute on function public.monthly_ranking(timestamptz, timestamptz) to authenticated;
