# Testes e qualidade

## Pirâmide de testes

| Nível | Ferramenta | Onde | O que cobre |
| --- | --- | --- | --- |
| Unitário | `node:test` via `tsx` | `src/lib/poker/__tests__/` | Regras de poker, motor pós-flop, sorteio, cargas, leak finder, plano, cache, fila de decisões |
| Banco | `psql` + Postgres 16 | `scripts/test-db.sh`, `supabase/tests/` | Migrações aplicadas do zero e políticas RLS por papel |
| Ponta a ponta | Playwright (Chromium) | `scripts/e2e.mjs` | Fluxos reais no navegador contra Supabase local: login, treino, cada drill, desempenho, plano, warmup, gestão |
| Carga | Node + `fetch` | `scripts/carga.mjs` | 100 jogadores simultâneos por 60s: latência por rota, erros, integridade das gravações |
| Tipos e build | `tsc`, `next build` | CI | Tipagem estrita e build de produção |

## CI (GitHub Actions)

Dois workflows a cada push, em qualquer branch:

- **`ci.yml`**: job `verificar` (instalação, testes unitários, tipos, build) e job `banco` (migrações + RLS).
- **`e2e.yml`**: job `ponta-a-ponta`. Sobe o Supabase local (CLI + Docker), compila, roda o e2e e depois o
  teste de carga num segundo servidor com a configuração de produção. Publica capturas de tela, o log e o
  relatório de carga na branch `ci-capturas` (sobrescrita a cada execução).

Falhas mostram um resumo com o fim de cada log como anotação do job.

### Critérios do teste de carga

O job falha se:

- mais de 1% das requisições der erro (incluindo redirecionamento para o login);
- alguma decisão confirmada pela API não estiver no banco;
- o p95 da gravação de decisões passar de 10s.

As latências do CI servem para comparar versões entre si, não para prever a produção: no CI o Next roda
num processo só e divide 2 vCPUs com o Supabase.

## Rodando localmente

```bash
npm install
npm test                          # unitários
npm run typecheck
PGHOST=localhost PGUSER=postgres scripts/test-db.sh   # banco (Postgres local)

# Ponta a ponta e carga (Supabase CLI instalado)
supabase start
eval "$(supabase status -o env)"
export API_URL NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \
       SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY SERVICE_ROLE_KEY
NEXT_PUBLIC_DECISION_BATCH=1 npm run build
CONTENT_CHECK_SECONDS=0 npm run start &
BASE_URL=http://localhost:3000 node scripts/e2e.mjs
PORT=3001 npm run start &
BASE_URL=http://localhost:3001 CARGA_USUARIOS=100 CARGA_SEGUNDOS=60 node scripts/carga.mjs
```

## Padrões de código

- Domínio em funções puras, sem I/O, em `src/lib/poker` (fácil de testar); I/O só em `data.ts`,
  `content.ts`, `record-attempts.ts` e nas actions.
- Módulos de servidor marcados com `import "server-only"`.
- Toda regra nova de aula vem com testes que usam os exemplos da própria aula.
- Mudança visível ganha um passo no e2e com captura de tela.
