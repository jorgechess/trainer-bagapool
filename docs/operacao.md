# Operação (runbook)

Primeira instalação: [SETUP.md](../SETUP.md). Este documento cobre o dia a dia.

## Variáveis de ambiente

| Variável | Onde | Obrigatória | Uso |
| --- | --- | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local` | ✓ | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel, `.env.local` | ✓ | Chave pública (respeita o RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (servidor) | ✓ | Chave de serviço: cadastro de membros, login por nick, cargas, cache. **Nunca no código nem no navegador** |
| `CONTENT_CHECK_SECONDS` | Opcional | | Intervalo da conferência de versão do cache (padrão 30). O e2e usa 0 |
| `NEXT_PUBLIC_DECISION_BATCH` | Opcional, no build | | Decisões por envio (padrão 5). O e2e usa 1 |

## Deploy

- Todo push na `main` publica na Vercel automaticamente. O CI (GitHub Actions) roda em paralelo: um
  commit com CI vermelho já estará no ar, então só faça push de código que passou nos testes locais.
- **Rollback**: Vercel → Deployments → no deploy anterior, *Promote to Production*. As cargas não voltam
  sozinhas (o banco mantém a versão mais nova); para desfazer conteúdo, reverta o commit e faça push.

## Migrações do banco

1. Arquivo novo em `supabase/migrations/` (número seguinte).
2. O job `banco` do CI aplica todas as migrações e roda os testes de RLS.
3. Em produção: Supabase → SQL Editor → colar o arquivo → Run. Rodar **antes** do deploy que depende dela
   quando possível (o código tolera colunas que ainda não existem só em casos específicos).

Migrações pendentes conhecidas devem ser avisadas na resposta do commit (ex.: 0003 e 0004).

## Conteúdo

- **Atualizar ranges e drills**: mudar a carga em `cargas/` e fazer push. O primeiro acesso depois do
  deploy importa; as outras instâncias atualizam o cache em até 30s.
- **Editar direto no painel do Supabase** (evite): o cache só percebe em até 10 min. Para forçar, rode
  `update public.settings set value = to_jsonb(now()::text) where key = 'content_version';`
  (ou `insert ... on conflict` se a chave ainda não existir).

## Chaves e acessos

- **Rotacionar a chave de serviço**: Supabase → Project Settings → API → gerar nova → atualizar
  `SUPABASE_SERVICE_ROLE_KEY` na Vercel → Redeploy.
- **Senha esquecida**: admin ou mentor da pool gera senha provisória em **Jogadores**.
- **Desligar alguém**: desmarcar *ativo* em **Jogadores** (o RLS passa a negar tudo; o histórico fica).

## Monitoramento

| O quê | Onde |
| --- | --- |
| Erros do servidor (cargas, decisões descartadas) | Vercel → Logs (`Falha ao importar as cargas`, `Decisão inválida descartada`) |
| Uso do banco, conexões, cota do Auth | Supabase → Reports |
| Saúde do código | GitHub Actions: jobs `verificar`, `banco`, `ponta-a-ponta` |
| Capacidade | Relatório do teste de carga no resumo do job `ponta-a-ponta` e em `ci-capturas/carga.md` |

## Incidentes comuns

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| "Configure NEXT_PUBLIC_SUPABASE_URL" | Variável faltando | Adicionar na Vercel e fazer Redeploy |
| Drill novo não aparece | Carga com erro (log `Carga X com erros`) ou deploy não terminou | Ver logs; corrigir a carga |
| "Não foi possível salvar algumas decisões" | Sem internet ou sessão expirada | A fila guarda e reenvia; se persistir, sair e entrar de novo |
| Página lenta para todos | Postgres no limite do plano | Supabase → Reports; subir o plano ou revisar consultas do Desempenho |
| Coluna inexistente (`42703`) | Migração não rodada | Rodar a migração pendente |
| Jogador volta para o login com "acesso não está ativo" | Perfil desativado | Reativar em Jogadores |
