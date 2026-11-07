# API e ações do servidor

O sistema não expõe uma API pública. A interface fala com o servidor por **Server Actions** do Next.js
(chamadas tipadas a partir dos componentes) e por uma rota HTTP, `POST /api/decisoes`. Todas exigem
sessão: o middleware manda para `/login` quem não estiver autenticado.

Convenção de resposta: `ActionResult = { ok: true, message?: string } | { ok: false, error: string }`,
com mensagens em português prontas para a tela.

## `POST /api/decisoes`

Grava um lote de decisões do treino. É uma rota em vez de server action para o navegador poder enviar com
`fetch(..., { keepalive: true })` ao sair da página.

**Requisição**

```http
POST /api/decisoes
Content-Type: application/json
Cookie: sb-<projeto>-auth-token=...

{
  "submissions": [
    {
      "drillId": "cbet-turn-ip",
      "decisions": [
        { "strategyId": "cbet-turn-ip-hj-xx", "heroCards": ["Ac", "Js"], "board": ["8h", "9s", "5h", "Kd"], "chosenActionId": "bet-67" }
      ]
    }
  ]
}
```

| Campo | Regra |
| --- | --- |
| `submissions` | 1 a 50 itens; no total até 200 decisões |
| `drillId` | Drill ativo (no aquecimento, o drill de origem de cada decisão) |
| `decisions` | 1 a 10 por item (uma mão); `heroCards` com 2 cartas; `board` com as cartas da street da estratégia |
| `chosenActionId` | Uma das `actionIds` da estratégia |

**Processamento**

1. Valida o formato (zod).
2. Confere a sessão e se o perfil está ativo.
3. Para cada decisão, busca drill e estratégia no cache e **recalcula a resposta certa** (`gradeSubmission`).
   Decisões de drill arquivado, estratégia removida ou cartas inválidas são descartadas (com log), sem
   derrubar o lote.
4. Faz **um** `INSERT` em `attempts` com a sessão do usuário (o RLS exige `user_id = auth.uid()`).

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| 200 | `{ "ok": true }` | Gravado (ou nada válido para gravar) |
| 400 | `{ "ok": false, "error": "Dados inválidos." }` | JSON ou formato inválido; lote grande demais |
| 401 | `{ "ok": false, "error": "Sessão expirada. Entre de novo." }` | Sem sessão válida ou perfil inativo |
| 302 → `/login` | HTML | Sem cookie de sessão (middleware) |

**Cliente**: `src/lib/decision-queue.ts` (fila) e `sendDecisions` em `src/components/Trainer.tsx`.
Envia a cada `NEXT_PUBLIC_DECISION_BATCH` decisões (padrão 5), a cada 10s, ao terminar a sessão e ao
esconder ou sair da página. Sem conexão, a fila fica no `localStorage` (`trainer:fila-decisoes`) e vai
na próxima tentativa; itens de outra aba são adotados depois de 30s.

## Server Actions

| Ação | Arquivo | Permissão | Efeito |
| --- | --- | --- | --- |
| `loginAddress(identificador)` | `app/login/actions.ts` | Pública | Converte nick no e-mail interno da conta (não revela se o nick existe) |
| `changePassword(senha, confirmação)` | `app/trocar-senha/actions.ts` | Logado | Troca a senha provisória |
| `recordDecisions(submissão)` | `app/(app)/drills/actions.ts` | Logado | Grava uma mão (compatibilidade; o treino usa `/api/decisoes`) |
| `saveDrill`, `archiveDrill` | `app/(app)/drills/actions.ts` | Gestão de conteúdo | Cria/edita/arquiva drill; invalida o cache |
| `saveStrategy`, `deleteStrategy` | `app/(app)/estrategias/actions.ts` | Gestão de conteúdo | Cria/edita/remove estratégia (bloqueia se usada); invalida o cache |
| `saveLegend` | `app/(app)/legenda/actions.ts` | Gestão de conteúdo | Salva as cores (bloqueia remover ação em uso); invalida o cache |
| `saveStandards`, `savePlanConfig` | `app/(app)/admin/standards/actions.ts` | Gestão de conteúdo | Standards dos stats e parâmetros do plano |
| `savePlan`, `editPlanDrill` | `app/(app)/plano/actions.ts` | O próprio usuário (não jogador para drills) ou gestão | Plano do mês e drills do warmup |
| `saveMentoredPools` | `app/(app)/desempenho/actions.ts` | Quem vê todos | Pools acompanhadas no Desempenho |
| `createMember`, `updateMember`, `resetPassword` | `app/(app)/admin/jogadores/actions.ts` | Admin; mentor só jogadores da própria pool | Cadastro por nick com senha provisória |
| `createPool`, `updatePool`, `deletePool` | `app/(app)/admin/jogadores/actions.ts` | Admin | Pools |

Toda ação começa com `requireProfile`, `requireContentManager`, `requireMemberManager` ou `requireAdmin`
(`src/lib/data.ts`), e o banco confere de novo pelo RLS.
