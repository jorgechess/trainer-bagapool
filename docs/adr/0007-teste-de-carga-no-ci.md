# ADR 0007: Teste de carga com 100 jogadores no CI

- **Status:** aceita
- **Data:** 2026-11

## Contexto

Não havia medida objetiva de capacidade; a sensação de lentidão podia ser rede ou servidor.

## Decisão

Rodar `scripts/carga.mjs` no job `ponta-a-ponta`: 100 jogadores autenticados, 60s, mistura de abrir treino, gravar lotes, lista de drills, início e desempenho, com tempo entre ações comprimido. Relatório com p50/p95/p99 por rota publicado no resumo do job e em `ci-capturas/carga.md`. Falha com mais de 1% de erro, divergência entre decisões confirmadas e gravadas ou p95 de gravação acima de 10s.

## Consequências

- Regressões de desempenho aparecem no commit que as causou.
- Números do CI são relativos (runner de 2 vCPUs com Next e Supabase juntos), não previsão da produção.
- Job cerca de 2 minutos mais longo.

## Alternativas consideradas

k6 ou Artillery (mais uma ferramenta; o script em Node reaproveita o cliente de login do Supabase).
