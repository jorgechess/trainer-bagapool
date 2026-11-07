# ADR 0006: Decisões gravadas em lote

- **Status:** aceita
- **Data:** 2026-11

## Contexto

Cada mão concluída virava uma requisição e um `INSERT`. Com 100 jogadores respondendo a cada poucos segundos, são milhares de escritas pequenas por minuto, além do custo fixo de autenticação por requisição.

## Decisão

O navegador mantém uma fila em `localStorage` (`src/lib/decision-queue.ts`) e envia para `POST /api/decisoes` a cada 5 decisões, a cada 10s, ao terminar a sessão e ao sair da página (`fetch` com `keepalive`). O servidor recorrige e grava o lote num `INSERT` só.

## Consequências

- Cerca de 5× menos requisições e escritas.
- Decisões sobrevivem a queda de internet e a recarregar a página.
- O Desempenho pode levar alguns segundos para mostrar as últimas mãos.
- Se o navegador apagar o `localStorage` antes do envio, perde-se no máximo o lote em aberto.

## Alternativas consideradas

Manter uma escrita por mão; WebSocket/fila no servidor (complexidade desnecessária).
