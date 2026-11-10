-- Ranking mensal: decisões e acertos por jogador no período, para todo o time.
-- As tentativas de cada um continuam protegidas pelo RLS; aqui só saem os totais.
-- Drills especiais (tag "especial") não contam.

create index if not exists attempts_created_at_idx on public.attempts (created_at);

create or replace function public.monthly_ranking(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, decisions bigint, correct bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, count(*)::bigint, count(*) filter (where a.correct)::bigint
  from public.attempts a
  join public.profiles p on p.id = a.user_id and p.active
  where public.my_role() is not null
    and a.created_at >= p_from
    and a.created_at < p_to
    and not exists (
      select 1 from public.drills d
      where d.id = a.drill_id and coalesce(d.data -> 'tags', '[]'::jsonb) ? 'especial'
    )
  group by a.user_id
$$;

revoke all on function public.monthly_ranking(timestamptz, timestamptz) from public;
grant execute on function public.monthly_ranking(timestamptz, timestamptz) to authenticated;
