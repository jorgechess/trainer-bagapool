# ADR 0004: Correção refeita no servidor

- **Status:** aceita
- **Data:** 2026-10 (registrada em 2026-11)

## Contexto

O treino roda no navegador para responder na hora, mas o desempenho alimenta o leak finder e o acompanhamento dos mentores. Um cliente adulterado poderia gravar só acertos.

## Decisão

O navegador envia apenas a mão, o board, a estratégia e a ação escolhida. O servidor recalcula a resposta certa (`gradeSubmission`) antes de gravar.

## Consequências

- Dados de desempenho confiáveis.
- Custo de CPU no servidor por decisão (pequeno; regras são funções puras e o conteúdo vem do cache).

## Alternativas consideradas

Confiar no resultado enviado pelo navegador.
