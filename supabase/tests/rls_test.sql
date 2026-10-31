-- Testes das permissões (RLS). Cada bloco falha com erro se a regra não for respeitada.
\set ON_ERROR_STOP on

-- Pools e usuários de teste
insert into public.pools (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Pool A'),
  ('00000000-0000-0000-0000-0000000000b2', 'Pool B');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'admin@t.com', '{"role":"admin"}', '{"name":"Admin"}'),
  ('10000000-0000-0000-0000-000000000002', 'coach@t.com', '{"role":"coach"}', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'ana@t.com', '{"role":"jogador","pool_id":"00000000-0000-0000-0000-0000000000a1"}', '{"name":"Ana"}'),
  ('10000000-0000-0000-0000-000000000004', 'bia@t.com', '{"pool_id":"00000000-0000-0000-0000-0000000000a1"}', '{}'),
  ('10000000-0000-0000-0000-000000000005', 'caio@t.com', '{"pool_id":"00000000-0000-0000-0000-0000000000b2"}', '{}'),
  -- tentativa de virar admin pelo metadata do usuário (deve ser ignorada)
  ('10000000-0000-0000-0000-000000000006', 'esperto@t.com', '{}', '{"role":"admin"}'),
  ('10000000-0000-0000-0000-000000000007', 'mentor@t.com', '{"role":"mentor"}', '{}'),
  ('10000000-0000-0000-0000-000000000008', 'drills@t.com', '{"role":"admin_drills"}', '{}');

do $$ begin
  assert (select role from public.profiles where email = 'admin@t.com') = 'admin', 'perfil admin criado pelo trigger';
  assert (select name from public.profiles where email = 'ana@t.com') = 'Ana', 'nome vem do metadata';
  assert (select name from public.profiles where email = 'bia@t.com') = 'bia', 'nome padrão = parte do e-mail';
  assert (select role from public.profiles where email = 'bia@t.com') = 'jogador', 'papel padrão = jogador';
  assert (select role from public.profiles where email = 'esperto@t.com') = 'jogador', 'user_metadata não define papel';
  assert (select pool_id from public.profiles where email = 'ana@t.com') = '00000000-0000-0000-0000-0000000000a1', 'pool definida';
end $$;

-- Tentativas de cada jogador (inseridas como dono do banco)
insert into public.attempts (user_id, drill_id, strategy_id, correct, data) values
  ('10000000-0000-0000-0000-000000000003', 'd1', 's1', true, '{}'),
  ('10000000-0000-0000-0000-000000000004', 'd1', 's1', false, '{}'),
  ('10000000-0000-0000-0000-000000000005', 'd1', 's1', true, '{}');

insert into public.drills (id, name, data) values ('d1', 'Drill 1', '{}');

-- ---------------------------------------------------------------------------
-- Jogadora Ana (Pool A)
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

do $$ begin
  assert (select count(*) from public.attempts) = 2, 'Ana vê as tentativas dela e da Bia (mesma pool), não as do Caio';
  assert (select count(*) from public.drills) = 1, 'Ana vê os drills';
  assert (select count(*) from public.profiles) = 8, 'Ana vê a lista do time';
end $$;

-- Ana grava a própria tentativa
insert into public.attempts (user_id, drill_id, strategy_id, correct, data)
values ('10000000-0000-0000-0000-000000000003', 'd1', 's1', true, '{}');

-- Ana NÃO grava tentativa em nome de outro
do $$ begin
  begin
    insert into public.attempts (user_id, drill_id, strategy_id, correct, data)
    values ('10000000-0000-0000-0000-000000000005', 'd1', 's1', true, '{}');
    raise exception 'FALHA: Ana gravou tentativa do Caio';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ana NÃO cria drill
do $$ begin
  begin
    insert into public.drills (id, name, data) values ('d2', 'Drill da Ana', '{}');
    raise exception 'FALHA: jogadora criou drill';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ana NÃO muda o próprio papel (update simplesmente não afeta linhas)
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000003';
reset role;
do $$ begin
  assert (select role from public.profiles where email = 'ana@t.com') = 'jogador', 'Ana não virou admin';
end $$;

-- Ana cria o próprio plano mensal, mas não o de outro jogador
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
insert into public.monthly_plans (user_id, month, stats, plan)
values ('10000000-0000-0000-0000-000000000003', '2026-11', '{}', '{}');
do $$ begin
  begin
    insert into public.monthly_plans (user_id, month, stats, plan)
    values ('10000000-0000-0000-0000-000000000005', '2026-11', '{}', '{}');
    raise exception 'FALHA: Ana criou plano do Caio';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Caio (Pool B) não vê nada da Pool A
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
do $$ begin
  assert (select count(*) from public.attempts) = 1, 'Caio vê só as próprias tentativas';
  assert (select count(*) from public.monthly_plans) = 0, 'Caio não vê o plano da Ana';
end $$;

-- ---------------------------------------------------------------------------
-- Coach vê tudo e cria conteúdo
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.attempts) = 4, 'coach vê as tentativas de todos';
end $$;
insert into public.drills (id, name, data) values ('d-coach', 'Drill do coach', '{}');
insert into public.strategies (id, name, street, data) values ('s-coach', 'Estratégia', 'preflop', '{}');
insert into public.settings (key, value) values ('legend', '[]');
-- coach NÃO cadastra pool
do $$ begin
  begin
    insert into public.pools (name) values ('Pool do coach');
    raise exception 'FALHA: coach criou pool';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Mentor vê tudo
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000007';
do $$ begin
  assert (select count(*) from public.attempts) = 4, 'mentor vê as tentativas de todos';
end $$;

-- Admin de drills cria drills mas não vê o desempenho de todos
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000008';
insert into public.drills (id, name, data) values ('d-adm', 'Drill do admin de drills', '{}');
do $$ begin
  assert (select count(*) from public.attempts) = 0, 'admin de drills sem pool não vê tentativas de outros';
end $$;

-- ---------------------------------------------------------------------------
-- Admin gerencia pools e perfis
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
insert into public.pools (name) values ('Pool C');
update public.profiles set pool_id = '00000000-0000-0000-0000-0000000000b2' where email = 'bia@t.com';
reset role;
do $$ begin
  assert (select pool_id from public.profiles where email = 'bia@t.com') = '00000000-0000-0000-0000-0000000000b2', 'admin trocou a pool da Bia';
end $$;

-- Jogador desativado perde o acesso
update public.profiles set active = false where email = 'caio@t.com';
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
do $$ begin
  assert (select count(*) from public.drills) = 0, 'jogador desativado não vê drills';
  assert (select count(*) from public.profiles) = 0, 'jogador desativado não vê o time';
end $$;

-- Visitante sem login não vê nada
reset role;
set role anon;
reset request.jwt.claim.sub;
do $$ begin
  assert (select count(*) from public.drills) = 0, 'anônimo não vê drills';
  assert (select count(*) from public.attempts) = 0, 'anônimo não vê tentativas';
end $$;
reset role;

select 'RLS: todos os testes passaram' as resultado;
