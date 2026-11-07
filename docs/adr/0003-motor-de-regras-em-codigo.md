# ADR 0003: Regras pós-flop em código TypeScript puro

- **Status:** aceita
- **Data:** 2026-10 (registrada em 2026-11)

## Contexto

Os spots pós-flop do game plan do time não são ranges fixos: a resposta depende do board (classe, textura, runout) e da mão (par, draw, kicker, naipe). Representar isso como dados exigiria uma linguagem de regras própria.

## Decisão

Implementar cada game plan como funções puras em `src/lib/poker/` (ex.: `cbet-turn.ts`), selecionadas pelo campo `cbet.table` da estratégia, com testes que usam os exemplos de cada aula.

## Consequências

- Expressividade total e testes rápidos (milissegundos, sem banco).
- A mesma função corrige no navegador (feedback imediato) e no servidor (gravação).
- Mudar uma regra exige deploy (aceitável: as regras mudam junto com as aulas).
- Interpretação das aulas fica explícita no código e nos testes, fácil de revisar com o time.

## Alternativas consideradas

Árvores de decisão em JSON (difícil de expressar draws e kickers); planilhas importadas (sem lógica).
