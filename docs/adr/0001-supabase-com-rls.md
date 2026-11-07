# ADR 0001: Supabase com RLS como backend

- **Status:** aceita
- **Data:** 2026-10 (registrada em 2026-11)

## Contexto

O time precisa de login, banco e permissões por papel e por pool, com orçamento mínimo e sem servidor próprio para manter.

## Decisão

Usar Supabase (Postgres gerenciado + Auth) e garantir as permissões com Row Level Security no próprio banco, além das checagens na interface. Operações administrativas usam a chave de serviço apenas no servidor.

## Consequências

- Permissões valem mesmo se a interface tiver um bug ou alguém chamar a API direto.
- Postgres completo (índices, JSONB, funções) sem administrar servidor.
- Testes de RLS próprios (`supabase/tests/rls_test.sql`) para não regredir.
- Dependência de um fornecedor; migração para outro Postgres é viável, mas o Auth teria que ser trocado.

## Alternativas consideradas

Firebase (sem SQL e regras menos expressivas para o leak finder); backend próprio (mais custo e manutenção).
