# ADR 0005: Cache do conteúdo em memória com conferência de versão

- **Status:** aceita
- **Data:** 2026-11

## Contexto

Cada página (e cada gravação de decisão) relia as mais de 1.100 estratégias do banco. Com muitos usuários isso multiplica consultas pesadas e repetidas. O conteúdo só muda em deploys de carga ou edições pela tela. O Data Cache da Vercel tem limite de 2 MB por item, e o conteúdo já passa de 1 MB e cresce a cada aula.

## Decisão

Guardar estratégias, drills e legenda em memória por instância (`src/lib/content.ts`), lidos com a chave de serviço. A cada 30s uma consulta mínima confere `content_version` e `cargas_version` em `settings`; se mudou, recarrega. Edições pelo app invalidam na hora e gravam uma nova `content_version`. Idade máxima de 10 min cobre edições feitas fora do app.

## Consequências

- Páginas e gravações deixam de ler o conteúdo do banco; sobra uma consulta de versão a cada 30s por instância.
- Sem limite de tamanho do cache.
- Instâncias diferentes podem ficar até 30s desatualizadas após uma edição.
- Memória por instância cresce com o conteúdo (hoje alguns MB).

## Alternativas consideradas

`unstable_cache`/Data Cache da Vercel (limite de 2 MB por item); Redis externo (mais um serviço para um problema que a memória resolve).
