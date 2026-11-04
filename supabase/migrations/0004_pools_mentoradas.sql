-- Pools que cada mentor/coach/admin acompanha na tela de Desempenho.
-- Rode no SQL Editor do Supabase (uma vez), depois da 0003.

alter table public.profiles add column if not exists mentored_pools uuid[] not null default '{}';

-- Cada um atualiza só a própria lista (o perfil continua sendo alterado só pelo admin).
create or replace function public.set_my_mentored_pools(pool_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.views_all_performance() then
    raise exception 'Sem permissão para acompanhar pools';
  end if;
  update public.profiles
  set mentored_pools = coalesce(
    (select array_agg(p.id order by p.name) from public.pools p where p.id = any (coalesce(pool_ids, '{}'))),
    '{}'
  )
  where id = auth.uid();
end;
$$;

revoke all on function public.set_my_mentored_pools(uuid[]) from public;
grant execute on function public.set_my_mentored_pools(uuid[]) to authenticated;
