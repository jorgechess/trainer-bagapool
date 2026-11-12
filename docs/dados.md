# Modelo de dados e permissões

Banco: Postgres gerenciado pelo Supabase. Esquema `public`, migrações em
[`supabase/migrations`](../supabase/migrations), testes das permissões em
[`supabase/tests/rls_test.sql`](../supabase/tests/rls_test.sql).

## Diagrama entidade-relacionamento

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "gatilho on_auth_user_created"
  POOLS ||--o{ PROFILES : "pool_id"
  PROFILES ||--o{ ATTEMPTS : "user_id"
  PROFILES ||--o{ MONTHLY_PLANS : "user_id"
  PROFILES ||--o{ STRATEGIES : "created_by"
  PROFILES ||--o{ DRILLS : "created_by"
  DRILLS ||..o{ ATTEMPTS : "drill_id (texto, sem FK)"
  STRATEGIES ||..o{ ATTEMPTS : "strategy_id (texto, sem FK)"

  POOLS { uuid id PK; text name UK; text color; text logo }
  PROFILES { uuid id PK; text name; text email; text nick UK; text role; uuid pool_id FK; bool active; bool must_change_password; uuid[] mentored_pools }
  SETTINGS { text key PK; jsonb value; timestamptz updated_at; uuid updated_by }
  STRATEGIES { text id PK; text name; text street; text situation; jsonb data }
  DRILLS { text id PK; text name; jsonb data; bool active }
  ATTEMPTS { bigint id PK; uuid user_id FK; text drill_id; text strategy_id; bool correct; jsonb data; timestamptz created_at }
  STAT_STANDARDS { text id PK; text stat_key UK; jsonb data }
  MONTHLY_PLANS { uuid id PK; uuid user_id FK; text month; jsonb stats; jsonb plan }
```

`attempts.drill_id` e `strategy_id` não têm chave estrangeira de propósito: o histórico continua válido
quando um drill é arquivado ou uma estratégia é removida. O `data` da tentativa guarda uma cópia do que
importa para o leak finder (nome, situação, posição, stack, board, mão, respostas).

## Tabelas

| Tabela | Conteúdo | Quem escreve |
| --- | --- | --- |
| `pools` | Pools do time, com cor e logo | Admin |
| `profiles` | Um perfil por conta do Auth: papel, pool, nick, ativo, pools mentoradas | Gatilho (criação), admin, mentor (jogadores da pool), o próprio usuário (`set_my_mentored_pools`) |
| `settings` | Chave/valor JSON: `legend`, `plan_config`, `cargas_version`, `content_version` | Gestão de conteúdo, importação de cargas |
| `strategies` | Estratégias; o objeto `Strategy` inteiro fica em `data` (ver [cargas-e-drills.md](cargas-e-drills.md)) | Gestão de conteúdo, importação de cargas |
| `drills` | Drills; `active = false` arquiva sem apagar o histórico | Gestão de conteúdo, importação de cargas |
| `attempts` | Uma linha por decisão treinada | O próprio jogador, via `/api/decisoes` |
| `stat_standards` | Faixa ideal, margem, prioridade e drills de cada stat do HUD | Gestão de conteúdo |
| `monthly_plans` | Plano do mês por jogador (`month` = `AAAA-MM`, único por usuário) | O próprio usuário e gestão de conteúdo |

Chaves de `settings` usadas pelo sistema:

| Chave | Valor | Uso |
| --- | --- | --- |
| `legend` | Lista de ações com cor, tipo e sizing | Cores da mesa e dos ranges |
| `plan_config` | Parâmetros do plano do mês | Plano e warmup |
| `cargas_version` | SHA-1 das cargas do repositório | Importa as cargas uma vez por versão |
| `content_version` | Marca de tempo aleatória | Invalida o cache do conteúdo nas outras instâncias |

## Papéis

| Papel (`role`) | Gestão de conteúdo | Vê desempenho de todos | Cadastra pessoas |
| --- | :---: | :---: | :---: |
| `admin` | ✓ | ✓ | Todo o time |
| `coach` | ✓ | ✓ | |
| `mentor` | ✓ | ✓ | Jogadores da própria pool |
| `admin_drills` | ✓ | | |
| `jogador` | | Só o próprio e o da pool | |

## Row Level Security

Todas as tabelas têm RLS ligado. Funções auxiliares (`security definer`, leem o perfil do usuário logado):

| Função | Retorna |
| --- | --- |
| `my_role()` | Papel do usuário logado, ou `null` se inativo |
| `my_pool()` | Pool do usuário logado |
| `is_content_manager()` | `admin`, `coach`, `admin_drills` ou `mentor` |
| `views_all_performance()` | `admin`, `coach` ou `mentor` |
| `is_admin()` | `admin` |
| `can_view_user(target)` | Próprio usuário, quem vê todos, ou mesma pool |
| `set_my_mentored_pools(uuid[])` | RPC: grava as pools que o usuário acompanha (só quem vê todos) |
| `monthly_ranking(de, até)` | RPC: decisões e acertos por jogador ativo no período, para qualquer usuário ativo (só totais; sem drills com tag `fora-do-ranking`) |

Políticas:

| Tabela | Leitura | Escrita |
| --- | --- | --- |
| `pools`, `profiles` | Qualquer usuário ativo | Admin |
| `settings`, `strategies`, `drills`, `stat_standards` | Qualquer usuário ativo | Gestão de conteúdo |
| `attempts` | `can_view_user(user_id)` | Insert só com `user_id = auth.uid()` e usuário ativo; sem update/delete |
| `monthly_plans` | `can_view_user(user_id)` | Insert/update pelo dono ou gestão de conteúdo; delete pela gestão |

Operações que passam por cima do RLS (chave de serviço, só no servidor e depois da checagem do papel):
cadastro e edição de membros, conversão de nick em e-mail no login, importação de cargas, leitura do
conteúdo compartilhado para o cache e marcação de `content_version`.

## Migrações

| Arquivo | Mudança |
| --- | --- |
| `0001_inicial.sql` | Esquema, funções, RLS, gatilho de perfis |
| `0002_identidade_pools.sql` | Cor e logo das pools; pools do time |
| `0003_login_por_nick.sql` | `nick` (único, sem diferenciar maiúsculas) e `must_change_password` |
| `0004_pools_mentoradas.sql` | `mentored_pools` e RPC `set_my_mentored_pools` |
| `0005_ranking.sql` | Índice `attempts (created_at)` e RPC `monthly_ranking` (ranking mensal) |
| `0006_pools_nameless_underdogz.sql` | Pools Nameless e Underdogz |
| `0007_ranking_mesa_final.sql` | `monthly_ranking` passa a contar os drills especiais; fica fora só a tag `fora-do-ranking` |
| `0008_pedidos_drill.sql` | Tabelas `drill_requests` e `drill_request_images` (pedidos de drill com prints) e RLS |

Regras para migrações novas: numeração sequencial, idempotentes (`if not exists`, blocos `do $$`),
nunca editar uma migração já aplicada, e cobrir permissões novas em `supabase/tests/rls_test.sql`.
O código tolera migração ainda não rodada quando dá (ex.: `PROFILE_COLUMNS_OLD` em `data.ts`).
