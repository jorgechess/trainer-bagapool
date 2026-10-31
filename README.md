# Trainer Baga Pool

Ferramenta de treino no estilo GTO Wizard com as estratégias do time Baga Pool: ranges do time, drills, leak finder e plano mensal a partir do relatório do Hand2Note.

- **Colocar no ar:** veja o [SETUP.md](SETUP.md).
- **Especificação:** [docs/especificacao.md](docs/especificacao.md).

## O que tem

| Tela | Quem usa | Para quê |
| --- | --- | --- |
| Drills | Todos | Treinar. Cada mão segue a linha correta até a última decisão do drill. |
| Desempenho | Todos | Leak finder por situação, posição, street, stack, proporção, etiqueta e estratégia. |
| Plano do mês | Todos | Stats do popup → focos do mês → metas de decisões por drill. |
| Estratégias | Coaches, mentores, admins | Ranges pintados na grade (ou por texto: `22+, A2s+`), com texturas no pós-flop. |
| Legenda | Coaches, mentores, admins | Uma cor por ação e por sizing. |
| Standards | Coaches, mentores, admins | Faixa ideal, margem, prioridade e drills de cada stat. |
| Importar | Coaches, mentores, admins | Carga em lote de estratégias e drills em JSON. |
| Jogadores | Admin | Cadastro de jogadores, papéis e pools. |

Permissões (garantidas no banco, não só na tela): o jogador vê o próprio desempenho e o da sua pool; admin, coaches e mentores veem todos; só quem gerencia conteúdo cria drills e estratégias; só o admin cadastra pessoas.

## Stack

Next.js 15 (App Router) + TypeScript, Supabase (Postgres, login, RLS) e Vercel.

## Estrutura

```
src/lib/poker/        regras de poker, sem dependências (testadas)
  cards, hands        cartas, 169 mãos, combos
  legend, range       legenda de cores, ranges, notação em texto
  texture             high (T–K), mid (9–6), low (5–2), ás; naipes; board pareado
  strategy, drill     estratégias, motor de drills, correção no servidor
  leaks, plan         leak finder e plano mensal (muito fora → fora, por prioridade)
  permissions         papéis
  importer            carga em lote
src/app/              telas e ações do servidor
supabase/migrations/  banco, permissões (RLS) e gatilho de perfis
supabase/tests/       testes das permissões
scripts/e2e.mjs       teste de ponta a ponta no navegador
```

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev
```

## Testes

```bash
npm test                     # regras de poker (node:test)
npm run typecheck
scripts/test-db.sh           # migrações + permissões num Postgres local (PGHOST/PGPORT/PGUSER)
```

No GitHub Actions rodam três verificações a cada envio: testes + tipos + build, banco + permissões, e o teste de ponta a ponta (Supabase local + navegador). As capturas de tela do teste de ponta a ponta ficam na branch `ci-capturas`.
